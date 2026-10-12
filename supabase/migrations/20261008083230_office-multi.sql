-- =====================================================================
-- Twinx — TÖBB IRODAI FIÓK EGY FELHASZNÁLÓNAK + VÁLTÁS KÖZTÜK
-- Futtasd a Supabase SQL Editorban az office*.sql fájlok UTÁN. Idempotens.
--
-- • Egy felhasználó több irodának is tagja / létrehozója lehet.
-- • user_office_context: melyik iroda van KIVÁLASZTVA, és irodai módban dolgozik-e
--   (use_office=false = Privát, a saját kreditjéből). Ez váltja a work_mode oszlopot.
-- • A levonás (office_deduct), a kiosztás (office_allocate_in) és a munka
--   megjelölése (trigger) mostantól a KIVÁLASZTOTT irodára vonatkozik.
-- =====================================================================

-- 1) Egy user = egy iroda megkötés feloldása
alter table public.office_members drop constraint if exists office_members_user_id_key;
create index if not exists office_members_user_idx on public.office_members (user_id);

-- 2) Kiválasztott iroda + munkamód felhasználónként
create table if not exists public.user_office_context (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  office_id   uuid references public.offices (id) on delete set null,
  use_office  boolean not null default true,
  updated_at  timestamptz not null default now()
);
alter table public.user_office_context enable row level security;
drop policy if exists "user_office_context_select_own" on public.user_office_context;
create policy "user_office_context_select_own" on public.user_office_context
  for select using (user_id = auth.uid());

-- Átállás: a meglévő tagok kontextusa a mostani irodájuk + munkamódjuk.
insert into public.user_office_context (user_id, office_id, use_office)
select m.user_id, m.office_id, (coalesce(m.work_mode, 'office') = 'office')
  from public.office_members m
on conflict (user_id) do nothing;

-- 3) Levonás a KIVÁLASZTOTT irodából (azonos aláírás, új működés)
create or replace function public.office_deduct(
  p_user uuid, p_amount integer, p_service text default null
)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_office uuid;
  v_m public.office_members%rowtype;
  v_ok integer;
begin
  if p_amount <= 0 then return false; end if;

  select office_id into v_office from public.user_office_context
   where user_id = p_user and use_office;
  if v_office is null then return false; end if;

  select * into v_m from public.office_members
   where user_id = p_user and office_id = v_office for update;
  if not found then return false; end if;

  if not (v_m.role = 'owner' or v_m.unlimited) and v_m.allowance < p_amount then
    return false;
  end if;

  update public.offices set balance = balance - p_amount
   where id = v_office and balance >= p_amount;
  get diagnostics v_ok = row_count;
  if v_ok = 0 then return false; end if;

  if not (v_m.role = 'owner' or v_m.unlimited) then
    update public.office_members set allowance = allowance - p_amount
     where office_id = v_office and user_id = p_user;
  end if;

  insert into public.office_ledger (office_id, kind, actor_id, member_id, amount, service_id)
  values (v_office, 'spend', p_user, p_user, -p_amount, p_service);
  return true;
end;
$$;

-- 4) Keret kiosztása egy MEGADOTT irodában (a régi office_allocate egy-irodás volt)
create or replace function public.office_allocate_in(
  p_office uuid, p_actor uuid, p_member uuid, p_delta integer, p_note text default null
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_actor  public.office_members%rowtype;
  v_target public.office_members%rowtype;
begin
  if p_delta = 0 then return null; end if;

  select * into v_actor from public.office_members where user_id = p_actor and office_id = p_office;
  if not found or not (v_actor.role = 'owner' or v_actor.can_allocate) then return null; end if;

  select * into v_target from public.office_members
   where user_id = p_member and office_id = p_office for update;
  if not found then return null; end if;
  if p_actor = p_member and v_actor.role <> 'owner' then return null; end if;
  if v_target.allowance + p_delta < 0 then return null; end if;

  update public.office_members set allowance = allowance + p_delta
   where office_id = p_office and user_id = p_member;

  insert into public.office_ledger (office_id, kind, actor_id, member_id, amount, note)
  values (p_office, 'allocate', p_actor, p_member, p_delta, p_note);

  return v_target.allowance + p_delta;
end;
$$;

revoke execute on function public.office_deduct(uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.office_allocate_in(uuid, uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.office_deduct(uuid, integer, text) to service_role;
grant execute on function public.office_allocate_in(uuid, uuid, uuid, integer, text) to service_role;

-- 5) Irodai munka megjelölése: a KIVÁLASZTOTT iroda, ha irodai módban dolgozik
create or replace function public.usage_history_mark_office()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.office_id is null then
    select c.office_id into new.office_id
      from public.user_office_context c
      join public.office_members m on m.office_id = c.office_id and m.user_id = c.user_id
     where c.user_id = new.user_id and c.use_office;
  end if;
  return new;
end;
$$;

-- 6) Kredit-kérés: irodánként egy függő kérés (nem összesen egy) — ha a tábla már létezik
do $$
begin
  if to_regclass('public.office_credit_requests') is not null then
    drop index if exists public.office_credit_requests_one_pending;
    create unique index if not exists office_credit_requests_one_pending_per_office
      on public.office_credit_requests (office_id, user_id) where status = 'pending';
  end if;
end $$;
