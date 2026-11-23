-- Havi plafon, használat-mérés és pluszcsomag az egyedi modulokra (terv 20, D53).
--
-- Additív (D51): új táblák és függvények; a company_modules már tartalmazza a monthly_cap / usage_unit_label /
-- included_units / extra_pack_* oszlopokat (20261124090000_company-modules.sql). A régi ingatlanos modulok
-- pénztárcája és a usage_history érintetlen.
-- Mértékegység: Ft, nettó önköltség, egész. Időszak: budapesti naptári hónap ('YYYY-MM').
-- Elv: a költséges hívás ELŐTT foglalás (sorzár a company_modules soron), siker után elszámolás, hibánál feloldás.
-- A pluszcsomag a keretet azonnal bővíti; a fizetési tétel (company_payments, terv 19) később kötődik be (payment_id).
-- Visszacsinálás: supabase/down/20261124120000_module-usage.down.sql
-- Újrafuttatható.

create or replace function public.budapest_period(p_ts timestamptz default now())
returns text language sql stable set search_path = public as $$
  select to_char(p_ts at time zone 'Europe/Budapest', 'YYYY-MM');
$$;

-- ---------------------------------------------------------------------------
-- 1) Táblák
-- ---------------------------------------------------------------------------
create table if not exists public.module_usage_events (
  id                uuid primary key default gen_random_uuid(),
  company_module_id uuid not null references public.company_modules (id) on delete cascade,
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
create index if not exists module_usage_events_period_idx on public.module_usage_events (company_module_id, period);
create index if not exists module_usage_events_open_idx on public.module_usage_events (created_at) where status = 'foglalt';
alter table public.module_usage_events enable row level security;

create table if not exists public.module_cap_adjustments (
  id                uuid primary key default gen_random_uuid(),
  company_module_id uuid not null references public.company_modules (id) on delete cascade,
  period            text not null,
  extra_cost_ft     integer not null check (extra_cost_ft > 0),
  extra_units       integer,
  price_net         integer,
  reason            text not null check (char_length(reason) between 1 and 500),
  payment_id        uuid,               -- terv 19: company_payments (külső kulcs a 19-es migrációval)
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now()
);
create index if not exists module_cap_adjustments_idx on public.module_cap_adjustments (company_module_id, period);
alter table public.module_cap_adjustments enable row level security;

-- Egy küszöb egy hónapban egyszer jelez — a kerethez kötve: keretemelés / pluszcsomag után (más keret-értéknél) újra élhet.
create table if not exists public.cap_notifications (
  id                uuid primary key default gen_random_uuid(),
  company_module_id uuid not null references public.company_modules (id) on delete cascade,
  period            text not null,
  threshold         integer not null check (threshold in (80, 100)),
  cap_ft            integer not null,
  sent_at           timestamptz not null default now(),
  unique (company_module_id, period, threshold, cap_ft)
);
alter table public.cap_notifications enable row level security;

-- RLS: csak admin olvas (a cégvezető és a felhasználó a keretet és a használatot nem látja).
drop policy if exists module_usage_events_admin on public.module_usage_events;
create policy module_usage_events_admin on public.module_usage_events for select using (public.is_admin());
drop policy if exists module_cap_adjustments_admin on public.module_cap_adjustments;
create policy module_cap_adjustments_admin on public.module_cap_adjustments for select using (public.is_admin());
drop policy if exists cap_notifications_admin on public.cap_notifications;
create policy cap_notifications_admin on public.cap_notifications for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 2) Segédek: hatékony keret és havi használat
-- ---------------------------------------------------------------------------
-- A hatékony havi keret = monthly_cap + az időszak pluszcsomagjai. null = nincs keret (nem költséges modul).
create or replace function public.module_effective_cap(p_cm uuid, p_period text)
returns integer language sql stable security definer set search_path = public as $$
  select case when cm.monthly_cap is null then null
              else cm.monthly_cap + coalesce((select sum(extra_cost_ft) from public.module_cap_adjustments
                                               where company_module_id = p_cm and period = p_period), 0)::int end
  from public.company_modules cm where cm.id = p_cm;
$$;

-- A havi használat: a foglalt (becsült) + az elszámolt (tényleges, ha van, különben becsült) költség.
create or replace function public.module_period_usage(p_cm uuid, p_period text)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when status = 'elszamolt' then coalesce(actual_cost_ft, estimated_cost_ft) else estimated_cost_ft end), 0)::int
  from public.module_usage_events where company_module_id = p_cm and period = p_period and status in ('foglalt', 'elszamolt');
$$;

-- Admin-nézet: minden modul aktuális havi állapota (felhasznált, keret, százalék).
create or replace function public.module_cap_status(p_period text default null)
returns table (company_module_id uuid, period text, used_ft integer, cap_ft integer, pct integer, units integer)
language sql stable security definer set search_path = public as $$
  with p as (select coalesce(p_period, public.budapest_period()) as per)
  select cm.id, p.per, public.module_period_usage(cm.id, p.per), public.module_effective_cap(cm.id, p.per),
         case when public.module_effective_cap(cm.id, p.per) is null or public.module_effective_cap(cm.id, p.per) = 0 then null
              else (100 * public.module_period_usage(cm.id, p.per) / public.module_effective_cap(cm.id, p.per))::int end,
         coalesce((select sum(units) from public.module_usage_events e where e.company_module_id = cm.id and e.period = p.per
                     and e.status in ('foglalt', 'elszamolt')), 0)::int
  from public.company_modules cm, p;
$$;

-- ---------------------------------------------------------------------------
-- 3) Foglalás / elszámolás / feloldás
--    Hibakódok: modul_nem_aktiv · nincs_hozzaferes · keret_elfogyott · nincs_ilyen
-- ---------------------------------------------------------------------------
create or replace function public.usage_reserve(p_cm uuid, p_user uuid, p_operation text, p_estimated_ft integer,
  p_request_key text, p_units integer default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cm public.company_modules%rowtype; v_period text := public.budapest_period(); v_cap integer; v_used integer;
        v_id uuid; v_admin boolean;
begin
  -- Idempotencia: ugyanaz a kérés kétszer nem foglal.
  select id into v_id from public.module_usage_events where request_key = p_request_key;
  if v_id is not null then return jsonb_build_object('ok', true, 'event_id', v_id, 'repeat', true); end if;

  select * into cm from public.company_modules where id = p_cm for update;   -- sorzár: párhuzamos foglalások sorban
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  v_admin := public.require_admin(p_user);
  if not v_admin then
    if not public.module_is_live(p_cm) then return jsonb_build_object('ok', false, 'error', 'modul_nem_aktiv'); end if;
    if not public.user_has_module_access(p_user, p_cm) then return jsonb_build_object('ok', false, 'error', 'nincs_hozzaferes'); end if;
  end if;
  v_cap := public.module_effective_cap(p_cm, v_period);
  v_used := public.module_period_usage(p_cm, v_period);
  if v_cap is not null and v_used + greatest(p_estimated_ft, 0) > v_cap then
    return jsonb_build_object('ok', false, 'error', 'keret_elfogyott', 'used', v_used, 'cap', v_cap);
  end if;
  insert into public.module_usage_events (company_module_id, user_id, operation_key, units, estimated_cost_ft, period, request_key)
  values (p_cm, p_user, p_operation, greatest(coalesce(p_units, 1), 1), greatest(p_estimated_ft, 0), v_period, p_request_key)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'event_id', v_id);
end $$;

-- Elszámolás siker után (a tényleges költséggel, ha ismert). Ha túllépi a becslést, egyszer átengedjük.
create or replace function public.usage_settle(p_event uuid, p_actual_ft integer default null, p_job text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update public.module_usage_events
     set status = 'elszamolt', actual_cost_ft = case when p_actual_ft is null then null else greatest(p_actual_ft, 0) end,
         job_id = coalesce(p_job, job_id), settled_at = now()
   where id = p_event and status = 'foglalt';
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.usage_release(p_event uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update public.module_usage_events set status = 'feloldott', settled_at = now() where id = p_event and status = 'foglalt';
  return jsonb_build_object('ok', found);
end $$;

-- Elakadt foglalások feloldása (alapból 60 percnél régebbi) — a napi ütemezett karbantartás hívja.
create or replace function public.usage_release_stale(p_minutes integer default 60)
returns integer language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  update public.module_usage_events set status = 'feloldott', settled_at = now()
   where status = 'foglalt' and created_at < now() - make_interval(mins => greatest(p_minutes, 5));
  get diagnostics v = row_count;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- 4) Keret-műveletek (csak admin): pluszcsomag és keret módosítása, indoklással, naplózva
-- ---------------------------------------------------------------------------
create or replace function public.cap_add_pack(p_actor uuid, p_cm uuid, p_extra_cost_ft integer, p_extra_units integer,
  p_price_net integer, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cm public.company_modules%rowtype; v_period text := public.budapest_period(); v_id uuid;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  if coalesce(p_extra_cost_ft, 0) <= 0 or coalesce(trim(p_reason), '') = '' then return jsonb_build_object('ok', false, 'error', 'hianyzo_mezo'); end if;
  select * into cm from public.company_modules where id = p_cm for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if cm.monthly_cap is null then return jsonb_build_object('ok', false, 'error', 'nincs_keret'); end if;
  insert into public.module_cap_adjustments (company_module_id, period, extra_cost_ft, extra_units, price_net, reason, created_by)
  values (p_cm, v_period, p_extra_cost_ft, p_extra_units, p_price_net, trim(p_reason), p_actor) returning id into v_id;
  insert into public.access_audit_log (actor_id, action, company_id, module_key, details)
  values (p_actor, 'pluszcsomag_hozzaadva', cm.company_id, cm.module_key,
          jsonb_build_object('period', v_period, 'extra_cost_ft', p_extra_cost_ft, 'extra_units', p_extra_units));
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.cap_set(p_actor uuid, p_cm uuid, p_new_cap integer, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cm public.company_modules%rowtype;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  if p_new_cap is not null and p_new_cap < 0 then return jsonb_build_object('ok', false, 'error', 'hianyzo_mezo'); end if;
  if coalesce(trim(p_reason), '') = '' then return jsonb_build_object('ok', false, 'error', 'hianyzo_mezo'); end if;
  select * into cm from public.company_modules where id = p_cm for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if cm.is_api_costly and p_new_cap is null and cm.state = 'aktiv' then return jsonb_build_object('ok', false, 'error', 'plafon_kell'); end if;
  update public.company_modules set monthly_cap = p_new_cap, updated_at = now() where id = p_cm;
  insert into public.access_audit_log (actor_id, action, company_id, module_key, details)
  values (p_actor, 'keret_modositva', cm.company_id, cm.module_key,
          jsonb_build_object('from', cm.monthly_cap, 'to', p_new_cap, 'reason', trim(p_reason)));
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- 5) Küszöb-értesítések: az esedékes (80% / 100%) jelzések, és megjelölésük kiküldöttnek (egyszer / hónap / keret)
-- ---------------------------------------------------------------------------
create or replace function public.cap_thresholds_due()
returns table (company_module_id uuid, period text, threshold integer, used_ft integer, cap_ft integer)
language sql stable security definer set search_path = public as $$
  select s.company_module_id, s.period, t.th, s.used_ft, s.cap_ft
  from public.module_cap_status() s
  cross join (values (80), (100)) as t(th)
  where s.cap_ft is not null and s.cap_ft > 0 and s.used_ft * 100 >= s.cap_ft * t.th
    and not exists (select 1 from public.cap_notifications n
                    where n.company_module_id = s.company_module_id and n.period = s.period and n.threshold = t.th and n.cap_ft = s.cap_ft);
$$;

create or replace function public.cap_mark_notified(p_cm uuid, p_period text, p_threshold integer, p_cap integer)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into public.cap_notifications (company_module_id, period, threshold, cap_ft) values (p_cm, p_period, p_threshold, p_cap)
  on conflict do nothing;
  return found;
end $$;

-- ---------------------------------------------------------------------------
-- 6) Jogok
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'budapest_period(timestamptz)', 'module_effective_cap(uuid, text)', 'module_period_usage(uuid, text)', 'module_cap_status(text)',
    'usage_reserve(uuid, uuid, text, integer, text, integer)', 'usage_settle(uuid, integer, text)', 'usage_release(uuid)',
    'usage_release_stale(integer)', 'cap_add_pack(uuid, uuid, integer, integer, integer, text)', 'cap_set(uuid, uuid, integer, text)',
    'cap_thresholds_due()', 'cap_mark_notified(uuid, text, integer, integer)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
