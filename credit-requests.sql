-- =====================================================================
-- Twinx — Kredit-kérés (sales)
-- Futtasd a Supabase SQL Editorban.
--
-- A sales szerepkör fogyasztja a keretét (nem korlátlan, mint az admin).
-- Ha elfogy, itt tud kérni újat: benyújt egy igényt, az adminok e-mailt
-- kapnak, és jóváhagyáskor megtörténik a jóváírás (a kredit-naplóba is bekerül).
-- =====================================================================

create table if not exists public.credit_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  user_email  text,
  amount      integer not null check (amount > 0),
  reason      text,                                   -- mire kell
  status      text not null default 'pending'
                check (status in ('pending', 'approved', 'rejected')),
  decided_by  uuid references auth.users (id) on delete set null,
  decided_by_email text,
  decided_at  timestamptz,
  decision_note text,                                 -- elutasítás indoka
  granted_amount integer,                             -- amennyit ténylegesen adott
  created_at  timestamptz not null default now()
);

create index if not exists credit_requests_status_idx on public.credit_requests (status, created_at desc);
create index if not exists credit_requests_user_idx on public.credit_requests (user_id, created_at desc);

-- Egy felhasználónak egyszerre csak EGY függő kérése lehet (ne spamelhessen).
create unique index if not exists credit_requests_one_pending
  on public.credit_requests (user_id) where status = 'pending';

alter table public.credit_requests enable row level security;

-- A kérelmező a SAJÁT kéréseit látja; az admin mindet.
drop policy if exists "credit_requests_select_own" on public.credit_requests;
create policy "credit_requests_select_own" on public.credit_requests
  for select using (user_id = auth.uid() or public.is_admin());

-- Írni csak a szerver (service_role) tud — a route ellenőrzi a szerepkört és
-- a mennyiséget, így a kérés adatai nem manipulálhatók a böngészőből.

-- ---------------------------------------------------------------------
-- JÓVÁHAGYÁS egyetlen tranzakcióban: a kérés lezárása + a kredit jóváírása
-- + a napló írása. Ez azért kell, mert három külön lépésben előfordulhatna,
-- hogy egy hálózati hiba után a kérés újra nyitottá válik, és egy másik admin
-- MÉGEGYSZER jóváírja — vagy fordítva: a kérés lezárul, de kredit nem érkezik.
--
-- Visszatér: a ténylegesen jóváírt kredit, vagy 0, ha a kérést már elbírálták.
-- ---------------------------------------------------------------------
create or replace function public.credit_request_approve(
  p_id          uuid,
  p_admin       uuid,
  p_admin_email text,
  p_amount      integer,   -- null vagy 0 = a kért mennyiség
  p_note        text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid;
  v_email   text;
  v_granted integer;
begin
  -- A kérés "elkapása": csak EGY hívó nyerhet (a sor zárolva van az UPDATE alatt).
  update public.credit_requests
     set status           = 'approved',
         decided_by       = p_admin,
         decided_by_email = p_admin_email,
         decided_at       = now(),
         decision_note    = p_note,
         granted_amount   = coalesce(nullif(p_amount, 0), amount)
   where id = p_id
     and status = 'pending'
   returning user_id, user_email, granted_amount
        into v_user, v_email, v_granted;

  if v_user is null then
    return 0;  -- már elbírálták
  end if;

  -- Jóváírás UGYANEBBEN a tranzakcióban.
  insert into public.wallets (user_id, balance)
  values (v_user, v_granted)
  on conflict (user_id) do update
    set balance = public.wallets.balance + excluded.balance,
        updated_at = now();

  -- A kredit-naplóba is bekerül, hogy egy helyen látszódjon minden jóváírás.
  insert into public.credit_grants (admin_id, admin_email, user_id, user_email, amount, note)
  values (p_admin, p_admin_email, v_user, v_email, v_granted,
          'Kredit-kérés jóváhagyva' || coalesce(' — ' || nullif(trim(p_note), ''), ''));

  return v_granted;
end;
$$;

revoke all on function public.credit_request_approve(uuid, uuid, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.credit_request_approve(uuid, uuid, text, integer, text)
  to service_role;
