-- =====================================================================
-- Twinx — IRODAI TWINX FIÓK (1. lépés: alap táblák + kredit-függvények)
-- Futtasd a Supabase SQL Editorban (a schema.sql + wallet.sql UTÁN).
-- Idempotens: többször is lefuttatható.
--
-- Modell (TODO.md 6.7. fázis):
--   • Közös irodai egyenleg (offices.balance) — csak a vezető vásárol rá.
--   • Tagonkénti KERET (office_members.allowance): ennyit költhet a tag az
--     irodai egyenlegből. A keret egy plafon, a kredit nem „vándorol" — így
--     kilépéskor nincs mit visszavenni.
--   • Jogosultságok tagonként: can_allocate (kioszthat), unlimited (korlátlan),
--     can_view_work (látja a kollégák irodai munkáit).
--   • A tag SAJÁT pénztárcája (wallets) érintetlen marad — ahhoz ez nem nyúl.
--   • Mappák / megosztás / módosítási napló: KÉSŐBBI lépés, külön SQL.
--
-- Írás kizárólag a szerveren (service_role, API route-ok) vagy az alábbi
-- SECURITY DEFINER függvényeken át történik — böngészőből nem manipulálható.
-- =====================================================================


-- 1) IGÉNYLÉS a TWINX-től ----------------------------------------------
create table if not exists public.office_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  user_email    text,
  office_name   text not null check (char_length(office_name) between 2 and 80),
  team_size     integer check (team_size between 1 and 500),
  phone         text,
  note          text,
  -- A vezető döntése az igényléskor: kollégánként rálát-e az irodai munkákra.
  leader_view   boolean not null default false,
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected')),
  decided_by    uuid references auth.users (id) on delete set null,
  decided_at    timestamptz,
  decision_note text,
  created_at    timestamptz not null default now()
);

create index if not exists office_requests_status_idx on public.office_requests (status, created_at desc);
-- Egy felhasználónak egyszerre csak EGY függő igénylése lehet.
create unique index if not exists office_requests_one_pending
  on public.office_requests (user_id) where status = 'pending';

alter table public.office_requests enable row level security;
drop policy if exists "office_requests_select_own" on public.office_requests;
create policy "office_requests_select_own" on public.office_requests
  for select using (user_id = auth.uid() or public.is_admin());


-- 2) IRODA ---------------------------------------------------------------
create table if not exists public.offices (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete restrict,
  request_id    uuid references public.office_requests (id) on delete set null,
  name          text not null check (char_length(name) between 2 and 80),
  balance       integer not null default 0 check (balance >= 0),
  join_code     text not null unique,               -- pl. TWX-8K4P
  leader_view   boolean not null default false,     -- vezetői rálátás (módosítható)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists set_offices_updated_at on public.offices;
create trigger set_offices_updated_at
  before update on public.offices
  for each row execute function public.set_updated_at();


-- 3) TAGSÁG (egy felhasználó = egy iroda) --------------------------------
create table if not exists public.office_members (
  office_id      uuid not null references public.offices (id) on delete cascade,
  user_id        uuid not null unique references auth.users (id) on delete cascade,
  role           text not null default 'member' check (role in ('owner', 'member')),
  allowance      integer not null default 0 check (allowance >= 0),  -- új tag: 0
  can_allocate   boolean not null default false,   -- kioszthat kreditet (helyettes)
  unlimited      boolean not null default false,   -- kérés nélkül költhet az irodai egyenlegből
  can_view_work  boolean not null default false,   -- látja a kollégák irodai munkáit
  joined_via     text check (joined_via in ('owner', 'code', 'email')),
  joined_at      timestamptz not null default now(),
  primary key (office_id, user_id)
);

create index if not exists office_members_office_idx on public.office_members (office_id);


-- 4) IRODAI KREDIT-NAPLÓ (vásárlás, kiosztás, költés) --------------------
create table if not exists public.office_ledger (
  id          bigint generated always as identity primary key,
  office_id   uuid not null references public.offices (id) on delete cascade,
  kind        text not null check (kind in ('purchase', 'allocate', 'spend', 'adjust')),
  actor_id    uuid references auth.users (id) on delete set null,  -- ki csinálta
  member_id   uuid references auth.users (id) on delete set null,  -- kinek / ki költött
  amount      integer not null,
  service_id  text,                                                  -- költésnél: melyik modul
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists office_ledger_office_idx on public.office_ledger (office_id, created_at desc);


-- 5) SEGÉDFÜGGVÉNYEK RLS-hez (SECURITY DEFINER → nincs rekurzív policy) --
create or replace function public.my_office_id()
returns uuid
language sql security definer stable set search_path = public
as $$
  select office_id from public.office_members where user_id = auth.uid();
$$;

-- Vezető vagy kiosztó-jogú tag az adott irodában?
create or replace function public.is_office_manager(p_office uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.office_members
    where office_id = p_office and user_id = auth.uid()
      and (role = 'owner' or can_allocate)
  );
$$;


-- 6) RLS -----------------------------------------------------------------
alter table public.offices        enable row level security;
alter table public.office_members enable row level security;
alter table public.office_ledger  enable row level security;

-- Az iroda sorát (benne az EGYENLEGGEL) csak a vezető és az admin olvassa.
-- A tagok az iroda nevét a szerveren át kapják meg — az egyenleget nem látják.
drop policy if exists "offices_select_owner" on public.offices;
create policy "offices_select_owner" on public.offices
  for select using (owner_id = auth.uid() or public.is_admin());

-- Tagság: a saját sor mindenkinek; a teljes taglista a vezetőnek/kiosztónak.
drop policy if exists "office_members_select" on public.office_members;
create policy "office_members_select" on public.office_members
  for select using (
    user_id = auth.uid()
    or public.is_office_manager(office_id)
    or public.is_admin()
  );

-- Napló: a saját tételek a tagnak; az egész iroda naplója a vezetőnek/kiosztónak.
drop policy if exists "office_ledger_select" on public.office_ledger;
create policy "office_ledger_select" on public.office_ledger
  for select using (
    member_id = auth.uid()
    or public.is_office_manager(office_id)
    or public.is_admin()
  );


-- 7) ATOMIKUS MŰVELETEK --------------------------------------------------

-- 7a) Jóváírás az iroda egyenlegére (vásárlás / admin-korrekció).
create or replace function public.office_add(
  p_office uuid, p_amount integer, p_actor uuid, p_kind text default 'purchase', p_note text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  update public.offices set balance = balance + p_amount where id = p_office;
  insert into public.office_ledger (office_id, kind, actor_id, amount, note)
  values (p_office, p_kind, p_actor, p_amount, p_note);
end;
$$;

-- 7b) Keret kiosztása egy tagnak (+ vagy − irányban).
--     Szabályok: csak vezető vagy kiosztó-jogú tag; a kiosztó MAGÁNAK nem adhat
--     (a vezető igen); csak azonos irodán belül; a keret nem mehet 0 alá.
--     Visszatér: az új keret, vagy NULL, ha a művelet nem engedélyezett.
create or replace function public.office_allocate(
  p_actor uuid, p_member uuid, p_delta integer, p_note text default null
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_actor  public.office_members%rowtype;
  v_target public.office_members%rowtype;
begin
  if p_delta = 0 then return null; end if;

  select * into v_actor from public.office_members where user_id = p_actor;
  if not found or not (v_actor.role = 'owner' or v_actor.can_allocate) then return null; end if;

  select * into v_target from public.office_members
    where user_id = p_member and office_id = v_actor.office_id
    for update;
  if not found then return null; end if;
  if p_actor = p_member and v_actor.role <> 'owner' then return null; end if;
  if v_target.allowance + p_delta < 0 then return null; end if;

  update public.office_members set allowance = allowance + p_delta
    where office_id = v_target.office_id and user_id = p_member;

  insert into public.office_ledger (office_id, kind, actor_id, member_id, amount, note)
  values (v_target.office_id, 'allocate', p_actor, p_member, p_delta, p_note);

  return v_target.allowance + p_delta;
end;
$$;

-- 7c) Költés az irodai egyenlegből (irodai munkamódban).
--     Vezető és „korlátlan" tag: csak az iroda egyenlege számít.
--     Alap tag: a saját kerete ÉS az iroda egyenlege is fedezze; mindkettő csökken.
--     Visszatér: true = sikeres levonás, false = nincs elég keret / egyenleg.
create or replace function public.office_deduct(
  p_user uuid, p_amount integer, p_service text default null
)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_m public.office_members%rowtype;
  v_ok integer;
begin
  if p_amount <= 0 then return false; end if;

  select * into v_m from public.office_members where user_id = p_user for update;
  if not found then return false; end if;

  if not (v_m.role = 'owner' or v_m.unlimited) and v_m.allowance < p_amount then
    return false;
  end if;

  update public.offices set balance = balance - p_amount
    where id = v_m.office_id and balance >= p_amount;
  get diagnostics v_ok = row_count;
  if v_ok = 0 then return false; end if;

  if not (v_m.role = 'owner' or v_m.unlimited) then
    update public.office_members set allowance = allowance - p_amount
      where office_id = v_m.office_id and user_id = p_user;
  end if;

  insert into public.office_ledger (office_id, kind, actor_id, member_id, amount, service_id)
  values (v_m.office_id, 'spend', p_user, p_user, -p_amount, p_service);

  return true;
end;
$$;

-- A függvényeket csak a szerver (service_role) hívhatja — böngészőből nem.
revoke execute on function public.office_add(uuid, integer, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.office_allocate(uuid, uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.office_deduct(uuid, integer, text) from public, anon, authenticated;
