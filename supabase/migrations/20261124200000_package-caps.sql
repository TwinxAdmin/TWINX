-- Az Ingatlan csomag havi költségkerete, cégenként (terv 27, D62). A terv 20 mechanikájára épül.
--
-- Döntés (5/a): KÜLÖN, additív táblák — nem egy 'ingatlan' sor a company_modules-ban. Ok: a company_modules
-- sorához aktiválás, helyek, érvényesség és module_access (meghívásos, helyenkénti) hozzáférés tartozik, az
-- Ingatlan-hozzáférés viszont felhasználóhoz kötött (company_access × services 'real-estate'). A mezőkészlet
-- ugyanaz, mint a 20-ban (keret Ft-ban, havi használat, foglalás idempotens kéréskulccsal, sorzár, budapesti hónap,
-- 80/100%-os jelzés egyszer / hónap / keret).
-- Egyszerű (D62): nincs pluszcsomag, fizetési tétel, ajánlat — a keret egyetlen szám, csak admin módosítja, indoklással.
-- A pénztárca, a usage_history és a 20-as táblák érintetlenek.
-- Visszacsinálás: supabase/down/20261124200000_package-caps.down.sql
-- Újrafuttatható.

-- ---------------------------------------------------------------------------
-- 1) Táblák
-- ---------------------------------------------------------------------------
create table if not exists public.package_caps (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  package_key text not null check (package_key in ('ingatlan')),
  monthly_cap integer not null check (monthly_cap >= 0),   -- Ft, nettó önköltség
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id) on delete set null,
  unique (company_id, package_key)
);
alter table public.package_caps enable row level security;

create table if not exists public.package_usage_events (
  id                uuid primary key default gen_random_uuid(),
  package_cap_id    uuid not null references public.package_caps (id) on delete cascade,
  company_id        uuid not null,
  user_id           uuid references auth.users (id) on delete set null,
  operation_key     text not null check (char_length(operation_key) between 1 and 60),
  units             integer not null default 1 check (units > 0),
  estimated_cost_ft integer not null check (estimated_cost_ft >= 0),
  actual_cost_ft    integer check (actual_cost_ft is null or actual_cost_ft >= 0),
  status            text not null default 'foglalt' check (status in ('foglalt', 'elszamolt', 'feloldott')),
  period            text not null,
  request_key       text not null unique,
  job_id            text,
  created_at        timestamptz not null default now(),
  settled_at        timestamptz
);
create index if not exists package_usage_events_period_idx on public.package_usage_events (package_cap_id, period);
create index if not exists package_usage_events_open_idx on public.package_usage_events (created_at) where status = 'foglalt';
alter table public.package_usage_events enable row level security;

create table if not exists public.package_cap_notifications (
  id             uuid primary key default gen_random_uuid(),
  package_cap_id uuid not null references public.package_caps (id) on delete cascade,
  period         text not null,
  threshold      integer not null check (threshold in (80, 100)),
  cap_ft         integer not null,
  sent_at        timestamptz not null default now(),
  unique (package_cap_id, period, threshold, cap_ft)
);
alter table public.package_cap_notifications enable row level security;

-- RLS: csak admin olvas; írás kizárólag a lenti (service_role) függvényekkel.
drop policy if exists package_caps_admin on public.package_caps;
create policy package_caps_admin on public.package_caps for select using (public.is_admin());
drop policy if exists package_usage_events_admin on public.package_usage_events;
create policy package_usage_events_admin on public.package_usage_events for select using (public.is_admin());
drop policy if exists package_cap_notifications_admin on public.package_cap_notifications;
create policy package_cap_notifications_admin on public.package_cap_notifications for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 2) Segédek
-- ---------------------------------------------------------------------------
-- Havi használat: foglalt (becsült) + elszámolt (tényleges, ha van, különben becsült).
create or replace function public.package_period_usage(p_pc uuid, p_period text)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when status = 'elszamolt' then coalesce(actual_cost_ft, estimated_cost_ft) else estimated_cost_ft end), 0)::int
  from public.package_usage_events where package_cap_id = p_pc and period = p_period and status in ('foglalt', 'elszamolt');
$$;

-- A felhasználó kerete: az aktív tagságai közül az első (legkorábbi csatlakozás) aktív cég, amelynek van ilyen kerete.
create or replace function public.package_cap_for_user(p_user uuid, p_package text)
returns uuid language sql stable security definer set search_path = public as $$
  select pc.id from public.package_caps pc
  join public.company_members m on m.company_id = pc.company_id and m.user_id = p_user and m.status = 'aktiv'
  join public.companies c on c.id = pc.company_id and c.status = 'aktiv'
  where pc.package_key = p_package
  order by m.joined_at, pc.created_at limit 1;
$$;

-- Admin-nézet: minden csomag-keret aktuális havi állapota.
create or replace function public.package_cap_status(p_period text default null)
returns table (package_cap_id uuid, company_id uuid, package_key text, period text, used_ft integer, cap_ft integer, pct integer, units integer)
language sql stable security definer set search_path = public as $$
  with p as (select coalesce(p_period, public.budapest_period()) as per)
  select pc.id, pc.company_id, pc.package_key, p.per, public.package_period_usage(pc.id, p.per), pc.monthly_cap,
         case when pc.monthly_cap = 0 then null else (100 * public.package_period_usage(pc.id, p.per) / pc.monthly_cap)::int end,
         coalesce((select sum(units) from public.package_usage_events e where e.package_cap_id = pc.id and e.period = p.per
                     and e.status in ('foglalt', 'elszamolt')), 0)::int
  from public.package_caps pc, p;
$$;

-- ---------------------------------------------------------------------------
-- 3) Foglalás / elszámolás / feloldás. Hibakódok: nincs_keret · keret_elfogyott · nincs_ilyen
--    p_settle = true: a foglalás egyben elszámolás a becsült költséggel (a közös kredit-ponton a hívás
--    sikere nem jelez vissza; hibánál a feloldás visszaadja). p_force = true: utólagos elszámolás (a kész
--    eredményt nem dobjuk el, pl. értékbecslés) — a keretet nem ellenőrzi, de beszámít.
-- ---------------------------------------------------------------------------
create or replace function public.package_usage_reserve(p_user uuid, p_package text, p_operation text, p_estimated_ft integer,
  p_request_key text, p_units integer default 1, p_settle boolean default false, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_pc uuid; pc public.package_caps%rowtype; v_period text := public.budapest_period(); v_used integer; v_id uuid;
begin
  select id into v_id from public.package_usage_events where request_key = p_request_key;
  if v_id is not null then return jsonb_build_object('ok', true, 'event_id', v_id, 'repeat', true); end if;

  v_pc := public.package_cap_for_user(p_user, p_package);
  if v_pc is null then return jsonb_build_object('ok', false, 'error', 'nincs_keret'); end if;
  select * into pc from public.package_caps where id = v_pc for update;   -- sorzár: a párhuzamos foglalások sorban
  v_used := public.package_period_usage(pc.id, v_period);
  if not p_force and v_used + greatest(p_estimated_ft, 0) > pc.monthly_cap then
    return jsonb_build_object('ok', false, 'error', 'keret_elfogyott');
  end if;
  insert into public.package_usage_events (package_cap_id, company_id, user_id, operation_key, units, estimated_cost_ft,
                                           status, period, request_key, settled_at)
  values (pc.id, pc.company_id, p_user, p_operation, greatest(coalesce(p_units, 1), 1), greatest(p_estimated_ft, 0),
          case when p_settle then 'elszamolt' else 'foglalt' end, v_period, p_request_key, case when p_settle then now() end)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'event_id', v_id);
end $$;

-- Szabad-e még a keret (foglalás NÉLKÜL) — az utólag elszámoló műveletek előellenőrzéséhez.
create or replace function public.package_cap_room(p_user uuid, p_package text, p_estimated_ft integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_pc uuid; v_cap integer;
begin
  v_pc := public.package_cap_for_user(p_user, p_package);
  if v_pc is null then return jsonb_build_object('ok', false, 'error', 'nincs_keret'); end if;
  select monthly_cap into v_cap from public.package_caps where id = v_pc;
  if public.package_period_usage(v_pc, public.budapest_period()) + greatest(p_estimated_ft, 0) > v_cap then
    return jsonb_build_object('ok', false, 'error', 'keret_elfogyott');
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.package_usage_settle(p_event uuid, p_actual_ft integer default null, p_job text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update public.package_usage_events
     set status = 'elszamolt', actual_cost_ft = case when p_actual_ft is null then null else greatest(p_actual_ft, 0) end,
         job_id = coalesce(p_job, job_id), settled_at = now()
   where id = p_event and status in ('foglalt', 'elszamolt');
  return jsonb_build_object('ok', found);
end $$;

-- Feloldás hibánál (a foglalt ÉS az azonnal elszámolt is visszaadható).
create or replace function public.package_usage_release(p_event uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update public.package_usage_events set status = 'feloldott', settled_at = now()
   where id = p_event and status in ('foglalt', 'elszamolt');
  return jsonb_build_object('ok', found);
end $$;

-- Elakadt (60 percnél régebbi, el nem számolt) foglalások feloldása — a napi karbantartás hívja.
create or replace function public.package_usage_release_stale(p_minutes integer default 60)
returns integer language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  update public.package_usage_events set status = 'feloldott', settled_at = now()
   where status = 'foglalt' and created_at < now() - make_interval(mins => greatest(p_minutes, 5));
  get diagnostics v = row_count;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- 4) Admin-műveletek: keret beállítása / módosítása (indoklással, naplózva) és hozzáférés-adás kerettel
-- ---------------------------------------------------------------------------
create or replace function public.package_cap_set(p_actor uuid, p_company uuid, p_package text, p_new_cap integer, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old integer;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  if p_new_cap is null or p_new_cap < 0 or coalesce(trim(p_reason), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'hianyzo_mezo');
  end if;
  if not exists (select 1 from public.companies where id = p_company) then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  select monthly_cap into v_old from public.package_caps where company_id = p_company and package_key = p_package for update;
  insert into public.package_caps (company_id, package_key, monthly_cap, updated_by)
  values (p_company, p_package, p_new_cap, p_actor)
  on conflict (company_id, package_key) do update set monthly_cap = excluded.monthly_cap, updated_at = now(), updated_by = p_actor;
  insert into public.access_audit_log (actor_id, action, company_id, module_key, details)
  values (p_actor, 'csomag_keret_modositva', p_company, p_package,
          jsonb_build_object('from', v_old, 'to', p_new_cap, 'reason', trim(p_reason)));
  return jsonb_build_object('ok', true);
end $$;

-- Ingatlan-hozzáférés megadása EGY tranzakcióban: a felhasználónak cégben kell lennie; ha a cégnek még nincs
-- kerete, a keret megadása kötelező (p_cap). Hibakódok: nem_admin · nincs_ceg · keret_kell · nincs_szolgaltatas
create or replace function public.package_grant_estate_access(p_actor uuid, p_user uuid, p_cap integer default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_has_cap boolean; v_sid uuid;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  select id into v_sid from public.services where slug = 'real-estate';
  if v_sid is null then return jsonb_build_object('ok', false, 'error', 'nincs_szolgaltatas'); end if;
  -- Elsőként az a cég, amelynek már van kerete; különben a legkorábbi aktív tagság.
  select m.company_id, (pc.id is not null) into v_company, v_has_cap
    from public.company_members m
    join public.companies c on c.id = m.company_id and c.status = 'aktiv'
    left join public.package_caps pc on pc.company_id = m.company_id and pc.package_key = 'ingatlan'
   where m.user_id = p_user and m.status = 'aktiv'
   order by (pc.id is null), m.joined_at limit 1;
  if v_company is null then return jsonb_build_object('ok', false, 'error', 'nincs_ceg'); end if;
  if not v_has_cap then
    if p_cap is null or p_cap < 0 then return jsonb_build_object('ok', false, 'error', 'keret_kell', 'company_id', v_company); end if;
    insert into public.package_caps (company_id, package_key, monthly_cap, updated_by) values (v_company, 'ingatlan', p_cap, p_actor)
    on conflict (company_id, package_key) do nothing;
    insert into public.access_audit_log (actor_id, action, company_id, module_key, details)
    values (p_actor, 'csomag_keret_modositva', v_company, 'ingatlan',
            jsonb_build_object('from', null, 'to', p_cap, 'reason', 'Hozzáférés-adáskor megadva'));
  end if;
  insert into public.company_access (user_id, service_id) values (p_user, v_sid) on conflict (user_id, service_id) do nothing;
  insert into public.access_audit_log (actor_id, action, company_id, module_key, target_user_id)
  values (p_actor, 'ingatlan_hozzaferes_megadva', v_company, 'real-estate', p_user);
  return jsonb_build_object('ok', true, 'company_id', v_company);
end $$;

-- ---------------------------------------------------------------------------
-- 5) Küszöb-értesítések (80% / 100%, egyszer / hónap / keret-érték)
-- ---------------------------------------------------------------------------
create or replace function public.package_thresholds_due()
returns table (package_cap_id uuid, company_id uuid, package_key text, period text, threshold integer, used_ft integer, cap_ft integer)
language sql stable security definer set search_path = public as $$
  select s.package_cap_id, s.company_id, s.package_key, s.period, t.th, s.used_ft, s.cap_ft
  from public.package_cap_status() s
  cross join (values (80), (100)) as t(th)
  where s.cap_ft > 0 and s.used_ft * 100 >= s.cap_ft * t.th
    and not exists (select 1 from public.package_cap_notifications n
                    where n.package_cap_id = s.package_cap_id and n.period = s.period and n.threshold = t.th and n.cap_ft = s.cap_ft);
$$;

create or replace function public.package_mark_notified(p_pc uuid, p_period text, p_threshold integer, p_cap integer)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into public.package_cap_notifications (package_cap_id, period, threshold, cap_ft) values (p_pc, p_period, p_threshold, p_cap)
  on conflict do nothing;
  return found;
end $$;

-- ---------------------------------------------------------------------------
-- 6) Jogok: csak a szerver (service_role)
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'package_period_usage(uuid, text)', 'package_cap_for_user(uuid, text)', 'package_cap_status(text)',
    'package_usage_reserve(uuid, text, text, integer, text, integer, boolean, boolean)', 'package_cap_room(uuid, text, integer)',
    'package_usage_settle(uuid, integer, text)', 'package_usage_release(uuid)', 'package_usage_release_stale(integer)',
    'package_cap_set(uuid, uuid, text, integer, text)', 'package_grant_estate_access(uuid, uuid, integer)',
    'package_thresholds_due()', 'package_mark_notified(uuid, text, integer, integer)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
