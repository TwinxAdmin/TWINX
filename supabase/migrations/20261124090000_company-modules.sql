-- Egyedi modulok, előfizetés (helyek, érvényesség), átadás, meghívás és modul-hozzáférés
-- (terv 14 / 2.3–2.5, terv 13, terv 23; D43, D44, D46, D47, D53, D54, D56).
--
-- Additív (D51): új táblák és függvények; meglévő tábla nem változik. Az egyedi modult a kód regiszterének
-- szöveges kulcsa azonosítja (module_key) — a regiszterben való szereplést és a data_policy-t az API ellenőrzi.
-- Biztonság: RLS minden táblán; írás csak a függvényeken át (service_role). A helyek száma tranzakcióban,
-- a company_modules sor zárolásával érvényesül. A meghívó tokennek csak a hash-e kerül az adatbázisba.
-- Visszacsinálás: supabase/down/20261124090000_company-modules.down.sql
-- Újrafuttatható.

-- ---------------------------------------------------------------------------
-- 1) company_modules — cég × egyedi modul (állapot + előfizetés)
-- ---------------------------------------------------------------------------
create table if not exists public.company_modules (
  id                     uuid primary key default gen_random_uuid(),
  company_id             uuid not null references public.companies (id) on delete cascade,
  module_key             text not null check (module_key ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  state                  text not null default 'felmeres'
                         check (state in ('felmeres', 'ajanlat', 'fejlesztes', 'teszt', 'atadva', 'aktiv', 'szunetel', 'lemondva')),
  owner_admin_id         uuid references public.profiles (id) on delete set null,
  seats                  integer not null default 0 check (seats >= 0 and seats <= 10000),
  valid_until            date,
  is_api_costly          boolean not null default false,
  monthly_cap            integer check (monthly_cap is null or monthly_cap >= 0),   -- Ft, nettó önköltség (D53)
  usage_unit_label       text,
  included_units         integer,
  extra_pack_units       integer,
  extra_pack_cost_cap_ft integer,
  extra_pack_price_net   integer,
  cancel_requested_at    timestamptz,
  cancel_effective_on    date,
  cancel_reason          text,
  activated_at           timestamptz,
  activated_by           uuid references public.profiles (id) on delete set null,
  note                   text check (note is null or char_length(note) <= 2000),     -- követés, NDA-adat NEM
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (company_id, module_key)
);
alter table public.company_modules enable row level security;

-- ---------------------------------------------------------------------------
-- 2) module_handovers — átadási bejegyzés (terv 23), csak hozzáfűzés + állapotváltás
-- ---------------------------------------------------------------------------
create table if not exists public.module_handovers (
  id                  uuid primary key default gen_random_uuid(),
  company_module_id   uuid not null references public.company_modules (id) on delete cascade,
  status              text not null default 'ervenyes' check (status in ('ervenyes', 'felulirva', 'visszavonva')),
  accepted_by_name    text not null check (char_length(accepted_by_name) between 1 and 120),
  accepted_by_role    text check (accepted_by_role is null or char_length(accepted_by_role) <= 80),
  accepted_by_user_id uuid references auth.users (id) on delete set null,
  accepted_via        text not null check (accepted_via in ('email', 'telefon', 'szemelyesen', 'videohivas', 'egyeb')),
  accepted_on         date not null,
  delivered_summary   text not null check (char_length(delivered_summary) between 1 and 1000),
  note                text check (note is null or char_length(note) <= 1000),
  recorded_by         uuid references public.profiles (id) on delete set null,
  recorded_at         timestamptz not null default now(),
  superseded_by       uuid references public.module_handovers (id) on delete set null,
  revoked_by          uuid references public.profiles (id) on delete set null,
  revoked_at          timestamptz,
  revoked_reason      text
);
create unique index if not exists module_handovers_valid_uq on public.module_handovers (company_module_id) where status = 'ervenyes';
alter table public.module_handovers enable row level security;

-- ---------------------------------------------------------------------------
-- 3) module_invitations — meghívók (a token hash-e; egy címre egy nyitott meghívó modulonként)
-- ---------------------------------------------------------------------------
create table if not exists public.module_invitations (
  id                uuid primary key default gen_random_uuid(),
  company_module_id uuid not null references public.company_modules (id) on delete cascade,
  company_id        uuid not null references public.companies (id) on delete cascade,
  module_key        text not null,
  email             text not null check (char_length(email) between 3 and 254),
  token_hash        text not null unique,
  invited_by        uuid references public.profiles (id) on delete set null,
  status            text not null default 'meghivva' check (status in ('meghivva', 'elfogadva', 'lejart', 'visszavonva')),
  expires_at        timestamptz not null,
  accepted_by       uuid references auth.users (id) on delete set null,
  accepted_at       timestamptz,
  last_sent_at      timestamptz,
  resend_count      integer not null default 0,
  created_at        timestamptz not null default now()
);
create unique index if not exists module_invitations_open_uq on public.module_invitations (company_module_id, email) where status = 'meghivva';
create index if not exists module_invitations_company_idx on public.module_invitations (company_id, created_at desc);
alter table public.module_invitations enable row level security;

-- ---------------------------------------------------------------------------
-- 4) module_access — ki használhatja a modult
-- ---------------------------------------------------------------------------
create table if not exists public.module_access (
  id                uuid primary key default gen_random_uuid(),
  company_module_id uuid not null references public.company_modules (id) on delete cascade,
  company_id        uuid not null references public.companies (id) on delete cascade,
  module_key        text not null,
  user_id           uuid not null references auth.users (id) on delete cascade,
  status            text not null default 'aktiv' check (status in ('aktiv', 'eltavolitva')),
  granted_via       text not null check (granted_via in ('invitation', 'head_self', 'admin')),
  invitation_id     uuid references public.module_invitations (id) on delete set null,
  granted_at        timestamptz not null default now(),
  removed_at        timestamptz,
  removed_by        uuid references public.profiles (id) on delete set null
);
create unique index if not exists module_access_active_uq on public.module_access (company_module_id, user_id) where status = 'aktiv';
create index if not exists module_access_user_idx on public.module_access (user_id) where status = 'aktiv';
alter table public.module_access enable row level security;

-- ---------------------------------------------------------------------------
-- 5) Segédfüggvények
-- ---------------------------------------------------------------------------
-- Foglalt helyek: aktív hozzáférés + nem lejárt, nyitott meghívó.
create or replace function public.module_seats_used(p_cm uuid)
returns integer language sql stable security definer set search_path = public as $$
  select (select count(*) from public.module_access where company_module_id = p_cm and status = 'aktiv')::int
       + (select count(*) from public.module_invitations where company_module_id = p_cm and status = 'meghivva' and expires_at > now())::int;
$$;

-- A modul tényleges elérhetősége egy felhasználónak (terv 14 / 2.5): aktív hozzáférés + aktív tagság + aktív modul + érvényes.
create or replace function public.user_has_module_access(p_user uuid, p_cm uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.module_access a
    join public.company_modules cm on cm.id = a.company_module_id
    join public.company_members m on m.company_id = cm.company_id and m.user_id = a.user_id and m.status = 'aktiv'
    join public.companies c on c.id = cm.company_id and c.status = 'aktiv'
    where a.company_module_id = p_cm and a.user_id = p_user and a.status = 'aktiv'
      and cm.state = 'aktiv' and cm.valid_until is not null and cm.valid_until >= (now() at time zone 'Europe/Budapest')::date
  );
$$;

create or replace function public.is_head_of(p_actor uuid, p_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_members
                 where company_id = p_company and user_id = p_actor and status = 'aktiv' and is_company_head);
$$;

-- ---------------------------------------------------------------------------
-- 6) RLS — olvasás (írás csak a függvényeken át)
-- ---------------------------------------------------------------------------
drop policy if exists company_modules_read on public.company_modules;
create policy company_modules_read on public.company_modules for select
  using (public.is_admin() or (state = 'aktiv' and public.is_company_member(company_id)));
drop policy if exists module_handovers_read on public.module_handovers;
create policy module_handovers_read on public.module_handovers for select using (public.is_admin());
drop policy if exists module_invitations_read on public.module_invitations;
create policy module_invitations_read on public.module_invitations for select using (public.is_admin());   -- a token_hash miatt
drop policy if exists module_access_read on public.module_access;
create policy module_access_read on public.module_access for select
  using (public.is_admin() or user_id = auth.uid() or public.is_company_head(company_id));

-- ---------------------------------------------------------------------------
-- 7) Admin-függvények: modul felvétele, állapot, előfizetés, átadás, aktiválás
--    Hibakódok: nem_admin · nincs_ilyen · mar_van · tiltott_allapot · atadas_bejegyzes_kell · kevesebb_mint_foglalt
--               · hianyzo_mezo · datum_jovobeli · nem_teszt · nem_atadva · nincs_ervenyes_atadas · lejart_elofizetes
--               · plafon_kell · nincs_cegvezeto · aktiv_elobb_kikapcsol
-- ---------------------------------------------------------------------------
create or replace function public.admin_create_company_module(p_actor uuid, p_company uuid, p_module_key text, p_owner uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  if not exists (select 1 from public.companies where id = p_company) then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  insert into public.company_modules (company_id, module_key, owner_admin_id) values (p_company, lower(trim(p_module_key)), p_owner)
  returning id into v_id;
  insert into public.access_audit_log (actor_id, action, company_id, module_key, details)
  values (p_actor, 'modul_allapot_valtozott', p_company, lower(trim(p_module_key)), jsonb_build_object('to', 'felmeres'));
  return jsonb_build_object('ok', true, 'id', v_id);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'mar_van');
end $$;

-- Állapotváltás a fejlesztés szakaszai között. Az Átadva csak átadási bejegyzéssel (record_handover),
-- az Aktív csak Aktiválással (activate_company_module) érhető el; aktív modulnál előbb Kikapcsolás kell.
create or replace function public.admin_set_module_state(p_actor uuid, p_cm uuid, p_state text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cm public.company_modules%rowtype;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  select * into cm from public.company_modules where id = p_cm for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if p_state = 'atadva' then return jsonb_build_object('ok', false, 'error', 'atadas_bejegyzes_kell'); end if;
  if p_state = 'aktiv' then return jsonb_build_object('ok', false, 'error', 'tiltott_allapot'); end if;
  if p_state not in ('felmeres', 'ajanlat', 'fejlesztes', 'teszt', 'szunetel', 'lemondva') then
    return jsonb_build_object('ok', false, 'error', 'tiltott_allapot');
  end if;
  if cm.state = 'aktiv' then return jsonb_build_object('ok', false, 'error', 'aktiv_elobb_kikapcsol'); end if;
  if cm.state = p_state then return jsonb_build_object('ok', true, 'unchanged', true); end if;
  update public.company_modules set state = p_state, updated_at = now() where id = p_cm;
  insert into public.access_audit_log (actor_id, action, company_id, module_key, details)
  values (p_actor, 'modul_allapot_valtozott', cm.company_id, cm.module_key, jsonb_build_object('from', cm.state, 'to', p_state));
  return jsonb_build_object('ok', true);
end $$;

-- Előfizetés: helyek, érvényesség, API-költség jelölő és havi plafon (csak admin). A helyek nem csökkenthetők
-- a már foglalt alá.
create or replace function public.admin_set_module_subscription(p_actor uuid, p_cm uuid, p_seats integer, p_valid_until date,
  p_is_api_costly boolean, p_monthly_cap integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cm public.company_modules%rowtype; v_used integer;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  select * into cm from public.company_modules where id = p_cm for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  v_used := public.module_seats_used(p_cm);
  if p_seats < v_used then return jsonb_build_object('ok', false, 'error', 'kevesebb_mint_foglalt', 'used', v_used); end if;
  update public.company_modules
     set seats = p_seats, valid_until = p_valid_until, is_api_costly = coalesce(p_is_api_costly, false),
         monthly_cap = p_monthly_cap, updated_at = now()
   where id = p_cm;
  if cm.seats is distinct from p_seats then
    insert into public.access_audit_log (actor_id, action, company_id, module_key, details)
    values (p_actor, 'helyek_modositva', cm.company_id, cm.module_key, jsonb_build_object('from', cm.seats, 'to', p_seats));
  end if;
  if cm.valid_until is distinct from p_valid_until then
    insert into public.access_audit_log (actor_id, action, company_id, module_key, details)
    values (p_actor, 'ervenyesseg_modositva', cm.company_id, cm.module_key, jsonb_build_object('from', cm.valid_until, 'to', p_valid_until));
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_update_company_module(p_actor uuid, p_cm uuid, p_owner uuid, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  update public.company_modules set owner_admin_id = p_owner, note = nullif(trim(coalesce(p_note, '')), ''), updated_at = now()
   where id = p_cm;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- Átadás rögzítése (terv 23): első átadás Teszt → Átadva; új átadás (Átadva / Aktív) felülírja az előzőt.
create or replace function public.record_handover(p_actor uuid, p_cm uuid, p_name text, p_role text, p_via text,
  p_on date, p_summary text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cm public.company_modules%rowtype; v_old uuid; v_new uuid;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_summary), '') = '' or p_on is null
     or p_via not in ('email', 'telefon', 'szemelyesen', 'videohivas', 'egyeb') then
    return jsonb_build_object('ok', false, 'error', 'hianyzo_mezo');
  end if;
  if p_on > (now() at time zone 'Europe/Budapest')::date then return jsonb_build_object('ok', false, 'error', 'datum_jovobeli'); end if;
  select * into cm from public.company_modules where id = p_cm for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if cm.state not in ('teszt', 'atadva', 'aktiv') then return jsonb_build_object('ok', false, 'error', 'nem_teszt'); end if;

  select id into v_old from public.module_handovers where company_module_id = p_cm and status = 'ervenyes' for update;
  if v_old is not null then update public.module_handovers set status = 'felulirva' where id = v_old; end if;
  insert into public.module_handovers (company_module_id, accepted_by_name, accepted_by_role, accepted_via, accepted_on,
                                       delivered_summary, note, recorded_by)
  values (p_cm, trim(p_name), nullif(trim(coalesce(p_role, '')), ''), p_via, p_on, trim(p_summary),
          nullif(trim(coalesce(p_note, '')), ''), p_actor)
  returning id into v_new;
  if v_old is not null then update public.module_handovers set superseded_by = v_new where id = v_old; end if;
  if cm.state = 'teszt' then
    update public.company_modules set state = 'atadva', updated_at = now() where id = p_cm;
  end if;
  insert into public.access_audit_log (actor_id, action, company_id, module_key, details)
  values (p_actor, case when v_old is null then 'atadas_rogzitve' else 'atadas_felulirva' end, cm.company_id, cm.module_key,
          jsonb_build_object('handover_id', v_new));
  return jsonb_build_object('ok', true, 'id', v_new);
end $$;

-- Átadás visszavonása: csak Átadva (még nem aktivált) modulnál; a modul Teszt állapotba lép vissza.
create or replace function public.revoke_handover(p_actor uuid, p_cm uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cm public.company_modules%rowtype; v_h uuid;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  select * into cm from public.company_modules where id = p_cm for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if cm.state <> 'atadva' then return jsonb_build_object('ok', false, 'error', 'nem_atadva'); end if;
  if coalesce(trim(p_reason), '') = '' then return jsonb_build_object('ok', false, 'error', 'hianyzo_mezo'); end if;
  update public.module_handovers set status = 'visszavonva', revoked_by = p_actor, revoked_at = now(), revoked_reason = trim(p_reason)
   where company_module_id = p_cm and status = 'ervenyes' returning id into v_h;
  update public.company_modules set state = 'teszt', updated_at = now() where id = p_cm;
  insert into public.access_audit_log (actor_id, action, company_id, module_key, details)
  values (p_actor, 'atadas_visszavonva', cm.company_id, cm.module_key, jsonb_build_object('handover_id', v_h));
  return jsonb_build_object('ok', true);
end $$;

-- Aktiválás (D43, D44, D46, D56): Átadva (vagy Szünetel → újraaktiválás), érvényes előfizetés, plafon az
-- API-költséges modulnál, legalább egy aktív cégvezető, érvényes átadási bejegyzés. A regiszter és a
-- data_policy ellenőrzése az API-ban történik. Az aktiválás NEM ad felhasználói hozzáférést.
create or replace function public.activate_company_module(p_actor uuid, p_cm uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cm public.company_modules%rowtype;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  select * into cm from public.company_modules where id = p_cm for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if cm.state not in ('atadva', 'szunetel') then return jsonb_build_object('ok', false, 'error', 'nem_atadva'); end if;
  if not exists (select 1 from public.module_handovers where company_module_id = p_cm and status = 'ervenyes') then
    return jsonb_build_object('ok', false, 'error', 'nincs_ervenyes_atadas');
  end if;
  if cm.valid_until is null or cm.valid_until < (now() at time zone 'Europe/Budapest')::date then
    return jsonb_build_object('ok', false, 'error', 'lejart_elofizetes');
  end if;
  if cm.is_api_costly and cm.monthly_cap is null then return jsonb_build_object('ok', false, 'error', 'plafon_kell'); end if;
  if not exists (select 1 from public.company_members where company_id = cm.company_id and is_company_head and status = 'aktiv') then
    return jsonb_build_object('ok', false, 'error', 'nincs_cegvezeto');
  end if;
  update public.company_modules set state = 'aktiv', activated_at = now(), activated_by = p_actor, updated_at = now() where id = p_cm;
  insert into public.access_audit_log (actor_id, action, company_id, module_key)
  values (p_actor, 'modul_aktivalva', cm.company_id, cm.module_key);
  return jsonb_build_object('ok', true);
end $$;

-- Kikapcsolás: Aktív → Szünetel (a hozzáférések sorai megmaradnak, de a modul senkinek nem elérhető).
create or replace function public.deactivate_company_module(p_actor uuid, p_cm uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cm public.company_modules%rowtype;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  select * into cm from public.company_modules where id = p_cm for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if cm.state <> 'aktiv' then return jsonb_build_object('ok', false, 'error', 'tiltott_allapot'); end if;
  update public.company_modules set state = 'szunetel', updated_at = now() where id = p_cm;
  insert into public.access_audit_log (actor_id, action, company_id, module_key)
  values (p_actor, 'modul_kikapcsolva', cm.company_id, cm.module_key);
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- 8) Cégvezetői függvények: meghívás, újraküldés, visszavonás, „Használom én is", eltávolítás, elfogadás
--    Hibakódok: nem_cegvezeto · modul_nem_aktiv · nincs_szabad_hely · mar_meghivva · mar_hozzafer · tul_sok_meghivo
--               · nincs_ilyen · meghivo_ervenytelen · mas_email · nem_megerositett
-- ---------------------------------------------------------------------------
create or replace function public.module_is_live(p_cm uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_modules cm join public.companies c on c.id = cm.company_id and c.status = 'aktiv'
                 where cm.id = p_cm and cm.state = 'aktiv'
                   and cm.valid_until is not null and cm.valid_until >= (now() at time zone 'Europe/Budapest')::date);
$$;

create or replace function public.create_invitation(p_actor uuid, p_cm uuid, p_email text, p_token_hash text, p_days integer default 7)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cm public.company_modules%rowtype; v_email text := lower(trim(p_email)); v_id uuid; v_recent integer;
begin
  select * into cm from public.company_modules where id = p_cm for update;   -- zárolás: helyszámítás tranzakcióban
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if not (public.require_admin(p_actor) or public.is_head_of(p_actor, cm.company_id)) then
    return jsonb_build_object('ok', false, 'error', 'nem_cegvezeto');
  end if;
  if not public.module_is_live(p_cm) then return jsonb_build_object('ok', false, 'error', 'modul_nem_aktiv'); end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' or char_length(v_email) > 254 then
    return jsonb_build_object('ok', false, 'error', 'ervenytelen_email');
  end if;
  -- Küldési korlát: cégenként óránként legfeljebb 20 meghívó (újraküldéssel együtt).
  select count(*) into v_recent from public.module_invitations
   where company_id = cm.company_id and (created_at > now() - interval '1 hour' or last_sent_at > now() - interval '1 hour');
  if v_recent >= 20 then return jsonb_build_object('ok', false, 'error', 'tul_sok_meghivo'); end if;
  if exists (select 1 from public.module_access a join auth.users u on u.id = a.user_id
             where a.company_module_id = p_cm and a.status = 'aktiv' and lower(u.email) = v_email) then
    return jsonb_build_object('ok', false, 'error', 'mar_hozzafer');
  end if;
  -- A lejárt, még „meghivva" státuszú meghívót lezárjuk, hogy ne akadályozza az újat.
  update public.module_invitations set status = 'lejart'
   where company_module_id = p_cm and email = v_email and status = 'meghivva' and expires_at <= now();
  if exists (select 1 from public.module_invitations where company_module_id = p_cm and email = v_email and status = 'meghivva') then
    return jsonb_build_object('ok', false, 'error', 'mar_meghivva');
  end if;
  if public.module_seats_used(p_cm) >= cm.seats then return jsonb_build_object('ok', false, 'error', 'nincs_szabad_hely'); end if;
  insert into public.module_invitations (company_module_id, company_id, module_key, email, token_hash, invited_by, expires_at, last_sent_at)
  values (p_cm, cm.company_id, cm.module_key, v_email, p_token_hash, p_actor,
          now() + make_interval(days => greatest(1, least(coalesce(p_days, 7), 30))), now())
  returning id into v_id;
  insert into public.access_audit_log (actor_id, action, company_id, module_key, target_email)
  values (p_actor, 'meghivva', cm.company_id, cm.module_key, v_email);
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- Újraküldés: új token-hash és lejárat (a régi link érvénytelen); lejárt meghívó csak szabad hellyel nyitható újra.
create or replace function public.resend_invitation(p_actor uuid, p_inv uuid, p_token_hash text, p_days integer default 7)
returns jsonb language plpgsql security definer set search_path = public as $$
declare i public.module_invitations%rowtype; cm public.company_modules%rowtype; v_recent integer;
begin
  select * into i from public.module_invitations where id = p_inv;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  select * into cm from public.company_modules where id = i.company_module_id for update;
  select * into i from public.module_invitations where id = p_inv for update;
  if not (public.require_admin(p_actor) or public.is_head_of(p_actor, cm.company_id)) then
    return jsonb_build_object('ok', false, 'error', 'nem_cegvezeto');
  end if;
  if i.status not in ('meghivva', 'lejart') then return jsonb_build_object('ok', false, 'error', 'meghivo_ervenytelen'); end if;
  if not public.module_is_live(cm.id) then return jsonb_build_object('ok', false, 'error', 'modul_nem_aktiv'); end if;
  select count(*) into v_recent from public.module_invitations
   where company_id = cm.company_id and (created_at > now() - interval '1 hour' or last_sent_at > now() - interval '1 hour');
  if v_recent >= 20 then return jsonb_build_object('ok', false, 'error', 'tul_sok_meghivo'); end if;
  -- Ha a meghívó már nem foglal helyet (lejárt), újranyitáskor szabad hely kell.
  if (i.status = 'lejart' or i.expires_at <= now()) and public.module_seats_used(cm.id) >= cm.seats then
    return jsonb_build_object('ok', false, 'error', 'nincs_szabad_hely');
  end if;
  update public.module_invitations
     set token_hash = p_token_hash, status = 'meghivva', last_sent_at = now(), resend_count = resend_count + 1,
         expires_at = now() + make_interval(days => greatest(1, least(coalesce(p_days, 7), 30)))
   where id = p_inv;
  insert into public.access_audit_log (actor_id, action, company_id, module_key, target_email)
  values (p_actor, 'meghivo_ujrakuldve', cm.company_id, cm.module_key, i.email);
  return jsonb_build_object('ok', true, 'email', i.email);
end $$;

create or replace function public.revoke_invitation(p_actor uuid, p_inv uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare i public.module_invitations%rowtype;
begin
  select * into i from public.module_invitations where id = p_inv for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if not (public.require_admin(p_actor) or public.is_head_of(p_actor, i.company_id)) then
    return jsonb_build_object('ok', false, 'error', 'nem_cegvezeto');
  end if;
  if i.status <> 'meghivva' then return jsonb_build_object('ok', false, 'error', 'meghivo_ervenytelen'); end if;
  update public.module_invitations set status = 'visszavonva' where id = p_inv;
  insert into public.access_audit_log (actor_id, action, company_id, module_key, target_email)
  values (p_actor, 'meghivo_visszavonva', i.company_id, i.module_key, i.email);
  return jsonb_build_object('ok', true);
end $$;

-- „Használom én is": a cégvezető a saját fiókjának ad egy helyet (azonnali).
create or replace function public.add_self_access(p_actor uuid, p_cm uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cm public.company_modules%rowtype;
begin
  select * into cm from public.company_modules where id = p_cm for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if not public.is_head_of(p_actor, cm.company_id) then return jsonb_build_object('ok', false, 'error', 'nem_cegvezeto'); end if;
  if not public.module_is_live(p_cm) then return jsonb_build_object('ok', false, 'error', 'modul_nem_aktiv'); end if;
  if exists (select 1 from public.module_access where company_module_id = p_cm and user_id = p_actor and status = 'aktiv') then
    return jsonb_build_object('ok', false, 'error', 'mar_hozzafer');
  end if;
  if public.module_seats_used(p_cm) >= cm.seats then return jsonb_build_object('ok', false, 'error', 'nincs_szabad_hely'); end if;
  insert into public.module_access (company_module_id, company_id, module_key, user_id, granted_via)
  values (p_cm, cm.company_id, cm.module_key, p_actor, 'head_self');
  insert into public.access_audit_log (actor_id, action, company_id, module_key, target_user_id, details)
  values (p_actor, 'hozzaferes_megadva', cm.company_id, cm.module_key, p_actor, jsonb_build_object('via', 'head_self'));
  return jsonb_build_object('ok', true);
end $$;

-- Eltávolítás: cégvezető (a cégében), admin, vagy a felhasználó a sajátját. A hely azonnal felszabadul.
create or replace function public.remove_access(p_actor uuid, p_cm uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cm public.company_modules%rowtype;
begin
  select * into cm from public.company_modules where id = p_cm for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if not (public.require_admin(p_actor) or public.is_head_of(p_actor, cm.company_id) or p_actor = p_user) then
    return jsonb_build_object('ok', false, 'error', 'nem_cegvezeto');
  end if;
  update public.module_access set status = 'eltavolitva', removed_at = now(), removed_by = p_actor
   where company_module_id = p_cm and user_id = p_user and status = 'aktiv';
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  insert into public.access_audit_log (actor_id, action, company_id, module_key, target_user_id)
  values (p_actor, 'hozzaferes_eltavolitva', cm.company_id, cm.module_key, p_user);
  return jsonb_build_object('ok', true);
end $$;

-- Elfogadás: a belépett felhasználó (a végpont azonosítja), MEGERŐSÍTETT, a meghívottal egyező e-mail címmel.
-- A tagság (ha még nincs) és a hozzáférés egy tranzakcióban jön létre. Ha a modul közben nem aktív / lejárt,
-- a hozzáférés NEM aktiválódik (modul_nem_aktiv), a meghívó nyitva marad a lejáratig.
create or replace function public.accept_invitation(p_user uuid, p_token_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare i public.module_invitations%rowtype; v_email text; v_confirmed timestamptz;
begin
  select * into i from public.module_invitations where token_hash = p_token_hash for update;
  if not found or i.status <> 'meghivva' or i.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'meghivo_ervenytelen');
  end if;
  select lower(email), email_confirmed_at into v_email, v_confirmed from auth.users where id = p_user;
  if v_email is null then return jsonb_build_object('ok', false, 'error', 'meghivo_ervenytelen'); end if;
  if v_confirmed is null then return jsonb_build_object('ok', false, 'error', 'nem_megerositett'); end if;
  if v_email <> i.email then return jsonb_build_object('ok', false, 'error', 'mas_email'); end if;
  perform 1 from public.company_modules where id = i.company_module_id for update;
  if not public.module_is_live(i.company_module_id) then return jsonb_build_object('ok', false, 'error', 'modul_nem_aktiv'); end if;

  insert into public.company_members (company_id, user_id, joined_via) values (i.company_id, p_user, 'invitation')
  on conflict (company_id, user_id) do update set status = 'aktiv', removed_at = null
    where public.company_members.status <> 'aktiv';
  insert into public.module_access (company_module_id, company_id, module_key, user_id, granted_via, invitation_id)
  values (i.company_module_id, i.company_id, i.module_key, p_user, 'invitation', i.id)
  on conflict do nothing;
  update public.module_invitations set status = 'elfogadva', accepted_by = p_user, accepted_at = now() where id = i.id;
  insert into public.access_audit_log (actor_id, action, company_id, module_key, target_user_id, target_email)
  values (p_user, 'meghivo_elfogadva', i.company_id, i.module_key, p_user, i.email);
  return jsonb_build_object('ok', true, 'company_id', i.company_id, 'module_key', i.module_key);
end $$;

-- ---------------------------------------------------------------------------
-- 9) Jogok
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'module_seats_used(uuid)', 'user_has_module_access(uuid, uuid)', 'is_head_of(uuid, uuid)', 'module_is_live(uuid)',
    'admin_create_company_module(uuid, uuid, text, uuid)', 'admin_set_module_state(uuid, uuid, text)',
    'admin_set_module_subscription(uuid, uuid, integer, date, boolean, integer)', 'admin_update_company_module(uuid, uuid, uuid, text)',
    'record_handover(uuid, uuid, text, text, text, date, text, text)', 'revoke_handover(uuid, uuid, text)',
    'activate_company_module(uuid, uuid)', 'deactivate_company_module(uuid, uuid)',
    'create_invitation(uuid, uuid, text, text, integer)', 'resend_invitation(uuid, uuid, text, integer)',
    'revoke_invitation(uuid, uuid)', 'add_self_access(uuid, uuid)', 'remove_access(uuid, uuid, uuid)',
    'accept_invitation(uuid, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
