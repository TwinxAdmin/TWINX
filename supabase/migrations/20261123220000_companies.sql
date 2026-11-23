-- Cégek (terv 14 / 2.1, 2.2, 2.6; terv 12 / 1.3; D42, D45, D46, D47): a mi ügyfélnyilvántartásunk,
-- a cég-tagság a cégvezetői státusszal, és a csak hozzáfűzhető hozzáférési napló.
-- A modulok, előfizetés, meghívó és modul-hozzáférés táblái a 4. lépésben jönnek (külön migráció).
--
-- Additív (D51): új táblák és függvények; a meglévőkből csak a bookings ↔ companies külső kulcsok kerülnek be.
-- Az `offices` (irodai fiók) érintetlen — a Cég és az irodai fiók két külön fogalom (D35).
-- Biztonság: RLS minden táblán; olvasni az admin mindent, a cég aktív tagja a saját cégét és a saját sorát,
-- a cégvezető a cége tagjait; írás csak a függvényeken át (service_role). Az utolsó cégvezetőt a DB is védi.
-- Visszacsinálás: supabase/down/20261123220000_companies.down.sql
-- Újrafuttatható.

-- ---------------------------------------------------------------------------
-- 1) companies
-- ---------------------------------------------------------------------------
create table if not exists public.companies (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null check (char_length(name) between 1 and 160),
  status               text not null default 'aktiv' check (status in ('aktiv', 'szunetel', 'lezart')),
  booking_id           uuid references public.bookings (id) on delete set null,
  billing_name         text,
  billing_tax_number   text,
  billing_address      text,
  billing_email        text,
  closed_at            timestamptz,
  closed_reason        text,
  data_retention_until date,
  note                 text check (note is null or char_length(note) <= 2000),   -- követési megjegyzés, NDA-adat NEM
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists companies_created_idx on public.companies (created_at desc);
alter table public.companies enable row level security;

-- A foglalás ↔ cég kapcsolat (terv 15 / 3.3): a bookings.company_id most kapja meg a külső kulcsot.
do $$ begin
  alter table public.bookings add constraint bookings_company_fk
    foreign key (company_id) references public.companies (id) on delete set null;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2) company_members — cég-tagság + cégvezetői státusz (cégenként)
-- ---------------------------------------------------------------------------
create table if not exists public.company_members (
  company_id      uuid not null references public.companies (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  is_company_head boolean not null default false,
  status          text not null default 'aktiv' check (status in ('aktiv', 'eltavolitva')),
  joined_via      text not null default 'admin' check (joined_via in ('admin', 'invitation')),
  joined_at       timestamptz not null default now(),
  removed_at      timestamptz,
  primary key (company_id, user_id)
);
create index if not exists company_members_user_idx on public.company_members (user_id) where status = 'aktiv';
create index if not exists company_members_heads_idx on public.company_members (company_id)
  where is_company_head and status = 'aktiv';
alter table public.company_members enable row level security;

-- Az utolsó aktív cégvezető védelme (DB-szinten is). Átengedi: ha a cég már nincs (kaszkád), vagy lezárt.
create or replace function public.company_members_guard_last_head()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not (old.is_company_head and old.status = 'aktiv') then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' and new.is_company_head and new.status = 'aktiv' then return new; end if;
  select status into v_status from public.companies where id = old.company_id;
  if v_status is null or v_status = 'lezart' then return coalesce(new, old); end if;
  if not exists (select 1 from public.company_members
                 where company_id = old.company_id and user_id <> old.user_id
                   and is_company_head and status = 'aktiv') then
    raise exception 'utolso_cegvezeto' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists company_members_guard_last_head_trg on public.company_members;
create trigger company_members_guard_last_head_trg
  before update or delete on public.company_members
  for each row execute function public.company_members_guard_last_head();

-- ---------------------------------------------------------------------------
-- 3) access_audit_log — csak hozzáfűzhető napló (tokent, titkot sosem tartalmaz)
-- ---------------------------------------------------------------------------
create table if not exists public.access_audit_log (
  id             bigint generated always as identity primary key,
  at             timestamptz not null default now(),
  actor_id       uuid,
  action         text not null,
  company_id     uuid,
  module_key     text,
  target_user_id uuid,
  target_email   text,
  details        jsonb
);
create index if not exists access_audit_log_company_idx on public.access_audit_log (company_id, at desc);
alter table public.access_audit_log enable row level security;

create or replace function public.access_audit_log_append_only()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'A napló csak hozzáfűzhető.' using errcode = 'P0001';
end $$;
drop trigger if exists access_audit_log_append_only_trg on public.access_audit_log;
create trigger access_audit_log_append_only_trg
  before update or delete on public.access_audit_log
  for each row execute function public.access_audit_log_append_only();
revoke update, delete, truncate on public.access_audit_log from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) RLS — olvasás
-- ---------------------------------------------------------------------------
-- Segéd: a hívó aktív tagja / cégvezetője-e a cégnek (security definer: az RLS-ben rekurzió nélkül használható).
create or replace function public.is_company_member(p_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_members
                 where company_id = p_company and user_id = auth.uid() and status = 'aktiv');
$$;
create or replace function public.is_company_head(p_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_members
                 where company_id = p_company and user_id = auth.uid() and status = 'aktiv' and is_company_head);
$$;

drop policy if exists companies_read on public.companies;
create policy companies_read on public.companies for select
  using (public.is_admin() or public.is_company_member(id));

drop policy if exists company_members_read on public.company_members;
create policy company_members_read on public.company_members for select
  using (public.is_admin() or user_id = auth.uid() or public.is_company_head(company_id));

drop policy if exists access_audit_log_read on public.access_audit_log;
create policy access_audit_log_read on public.access_audit_log for select
  using (public.is_admin() or (company_id is not null and public.is_company_head(company_id)));

-- ---------------------------------------------------------------------------
-- 5) Admin-függvények (csak service_role; az API az admin-jogot ellenőrzi, itt még egyszer)
--    Hibakódok: nem_admin · nincs_ilyen · mar_ceg · nincs_felhasznalo · nem_tag · utolso_cegvezeto · ures_nev
-- ---------------------------------------------------------------------------
create or replace function public.require_admin(p_actor uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = p_actor and role = 'admin');
$$;

-- Új cég kézzel.
create or replace function public.admin_create_company(p_actor uuid, p_name text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text := trim(coalesce(p_name, ''));
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  if v_name = '' then return jsonb_build_object('ok', false, 'error', 'ures_nev'); end if;
  insert into public.companies (name, note, created_by) values (v_name, nullif(trim(coalesce(p_note, '')), ''), p_actor)
  returning id into v_id;
  insert into public.access_audit_log (actor_id, action, company_id, details)
  values (p_actor, 'ceg_letrehozva', v_id, jsonb_build_object('name', v_name));
  return jsonb_build_object('ok', true, 'company_id', v_id);
end $$;

-- Céggé alakítás egy foglalásból (D42): új cég a foglalás adataival, a foglalás állapota `cegge_alakitva`.
-- Ha a foglaló e-mail címével már van regisztrált felhasználó, tagként hozzáadjuk (NEM cégvezetőként —
-- a cégvezetőt az admin jelöli ki a Cégek lapon).
create or replace function public.admin_create_company_from_booking(p_actor uuid, p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b public.bookings%rowtype; v_id uuid; v_user uuid;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if b.company_id is not null then return jsonb_build_object('ok', false, 'error', 'mar_ceg', 'company_id', b.company_id); end if;

  insert into public.companies (name, booking_id, created_by) values (b.company_name, b.id, p_actor) returning id into v_id;
  update public.bookings
     set company_id = v_id, status = 'cegge_alakitva', handled_by = p_actor, cancel_token_hash = null, updated_at = now()
   where id = b.id;
  insert into public.booking_events (booking_id, actor, actor_id, kind, data)
  values (b.id, 'admin', p_actor, 'allapot', jsonb_build_object('from', b.status, 'to', 'cegge_alakitva', 'company_id', v_id));
  insert into public.access_audit_log (actor_id, action, company_id, details)
  values (p_actor, 'ceg_letrehozva', v_id, jsonb_build_object('name', b.company_name, 'booking_id', b.id));

  select id into v_user from auth.users where lower(email) = lower(b.email) limit 1;
  if v_user is not null then
    insert into public.company_members (company_id, user_id, joined_via) values (v_id, v_user, 'admin')
    on conflict (company_id, user_id) do nothing;
    insert into public.access_audit_log (actor_id, action, company_id, target_user_id, details)
    values (p_actor, 'tag_hozzaadva', v_id, v_user, jsonb_build_object('forras', 'foglalas'));
  end if;
  return jsonb_build_object('ok', true, 'company_id', v_id, 'member_added', v_user is not null);
end $$;

-- Cég adatainak módosítása (név, megjegyzés).
create or replace function public.admin_update_company(p_actor uuid, p_company uuid, p_name text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_name text := trim(coalesce(p_name, ''));
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  if v_name = '' then return jsonb_build_object('ok', false, 'error', 'ures_nev'); end if;
  update public.companies set name = v_name, note = nullif(trim(coalesce(p_note, '')), ''), updated_at = now()
   where id = p_company;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  insert into public.access_audit_log (actor_id, action, company_id, details)
  values (p_actor, 'ceg_modositva', p_company, jsonb_build_object('name', v_name));
  return jsonb_build_object('ok', true);
end $$;

-- Tag hozzáadása e-mail cím alapján (csak már regisztrált felhasználó). Az eltávolított tag visszavehető.
create or replace function public.admin_add_company_member(p_actor uuid, p_company uuid, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  if not exists (select 1 from public.companies where id = p_company) then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'nincs_felhasznalo'); end if;
  insert into public.company_members (company_id, user_id, joined_via) values (p_company, v_user, 'admin')
  on conflict (company_id, user_id) do update set status = 'aktiv', removed_at = null, joined_at = now();
  insert into public.access_audit_log (actor_id, action, company_id, target_user_id)
  values (p_actor, 'tag_hozzaadva', p_company, v_user);
  return jsonb_build_object('ok', true, 'user_id', v_user);
end $$;

-- Tag eltávolítása a cégből (az utolsó cégvezetőt a trigger védi).
create or replace function public.admin_remove_company_member(p_actor uuid, p_company uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  perform 1 from public.company_members where company_id = p_company and is_company_head and status = 'aktiv' for update;
  update public.company_members set status = 'eltavolitva', is_company_head = false, removed_at = now()
   where company_id = p_company and user_id = p_user and status = 'aktiv';
  if not found then return jsonb_build_object('ok', false, 'error', 'nem_tag'); end if;
  insert into public.access_audit_log (actor_id, action, company_id, target_user_id)
  values (p_actor, 'tag_eltavolitva', p_company, p_user);
  return jsonb_build_object('ok', true);
exception when sqlstate 'P0001' then
  return jsonb_build_object('ok', false, 'error', 'utolso_cegvezeto');
end $$;

-- Cégvezető kinevezése (admin; a cégvezetői kinevezés a 4. lépés Hozzáférések ablakában jön) — csak aktív tag.
create or replace function public.appoint_company_head(p_actor uuid, p_company uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_admin boolean := public.require_admin(p_actor);
begin
  if not v_admin and not exists (select 1 from public.company_members
       where company_id = p_company and user_id = p_actor and status = 'aktiv' and is_company_head) then
    return jsonb_build_object('ok', false, 'error', 'nem_admin');
  end if;
  update public.company_members set is_company_head = true
   where company_id = p_company and user_id = p_user and status = 'aktiv' and not is_company_head;
  if not found then
    if exists (select 1 from public.company_members where company_id = p_company and user_id = p_user and status = 'aktiv') then
      return jsonb_build_object('ok', true, 'unchanged', true);
    end if;
    return jsonb_build_object('ok', false, 'error', 'nem_tag');
  end if;
  insert into public.access_audit_log (actor_id, action, company_id, target_user_id)
  values (p_actor, 'cegvezeto_kinevezve', p_company, p_user);
  return jsonb_build_object('ok', true);
end $$;

-- Cégvezetői státusz elvétele (csak admin) / feladása (csak a sajátját). Az utolsót nem lehet.
create or replace function public.remove_company_head(p_actor uuid, p_company uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_admin boolean := public.require_admin(p_actor);
begin
  if not v_admin and p_actor <> p_user then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  -- A cég cégvezetőinek zárolása: két párhuzamos lemondás se hagyhassa cégvezető nélkül a céget.
  perform 1 from public.company_members where company_id = p_company and is_company_head and status = 'aktiv' for update;
  if not exists (select 1 from public.company_members where company_id = p_company and is_company_head
                   and status = 'aktiv' and user_id <> p_user) then
    return jsonb_build_object('ok', false, 'error', 'utolso_cegvezeto');
  end if;
  update public.company_members set is_company_head = false
   where company_id = p_company and user_id = p_user and status = 'aktiv' and is_company_head;
  if not found then return jsonb_build_object('ok', false, 'error', 'nem_tag'); end if;
  insert into public.access_audit_log (actor_id, action, company_id, target_user_id)
  values (p_actor, case when p_actor = p_user then 'cegvezeto_lemondott' else 'cegvezeto_elveve' end, p_company, p_user);
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- 6) Jogok: a módosító függvényeket csak a szerver hívhatja
-- ---------------------------------------------------------------------------
revoke all on function public.require_admin(uuid) from public, anon, authenticated;
revoke all on function public.admin_create_company(uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_create_company_from_booking(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_update_company(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_add_company_member(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.admin_remove_company_member(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.appoint_company_head(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.remove_company_head(uuid, uuid, uuid) from public, anon, authenticated;

grant execute on function public.require_admin(uuid) to service_role;
grant execute on function public.admin_create_company(uuid, text, text) to service_role;
grant execute on function public.admin_create_company_from_booking(uuid, uuid) to service_role;
grant execute on function public.admin_update_company(uuid, uuid, text, text) to service_role;
grant execute on function public.admin_add_company_member(uuid, uuid, text) to service_role;
grant execute on function public.admin_remove_company_member(uuid, uuid, uuid) to service_role;
grant execute on function public.appoint_company_head(uuid, uuid, uuid) to service_role;
grant execute on function public.remove_company_head(uuid, uuid, uuid) to service_role;
-- Az RLS-segédeket a bejelentkezett felhasználó is futtatja (a policy-kben).
grant execute on function public.is_company_member(uuid) to authenticated;
grant execute on function public.is_company_head(uuid) to authenticated;
