-- valuation-engine.sql
-- A comp-alapú Értékbecslő motor SZÁMSZERŰ configjának verziózott tárolása.
-- Külön a szöveges ai_prompts-tól: itt csak számok/kapcsolók (params jsonb) élnek.
-- Az adminból szerkeszthető; egyszerre EGY aktív verzió (is_active).

create table if not exists public.valuation_engine_configs (
  id          uuid primary key default gen_random_uuid(),
  version     integer not null,
  is_active   boolean not null default false,
  params      jsonb   not null,
  note        text,
  created_at  timestamptz not null default now()
);

-- Egyszerre csak egy aktív verzió lehessen.
create unique index if not exists valuation_engine_one_active
  on public.valuation_engine_configs (is_active)
  where is_active;

alter table public.valuation_engine_configs enable row level security;

-- Olvasás: bejelentkezett felhasználó (a becslés futtatásához a szerver a service role-t
-- használja, de az adminnak közvetlen olvasás is kell). Írás CSAK szerverről (service role).
drop policy if exists vec_auth_select on public.valuation_engine_configs;
create policy vec_auth_select on public.valuation_engine_configs
  for select using (auth.role() = 'authenticated');

-- Alapértelmezett (v1) config beseedelése aktívként, ha még üres a tábla.
insert into public.valuation_engine_configs (version, is_active, params, note)
select 1, true, $json${
  "engine": { "mode": "off" },
  "comp": { "size_tolerance_pct": 20, "max_age_months": 6, "same_district_only": true, "min_count": 5 },
  "outlier": { "method": "median_band", "band_pct": 25, "min_kept": 4 },
  "central": { "method": "median" },
  "adjust": {
    "condition": { "felujitando": -12, "kozepes": 0, "jo": 4, "ujszeru": 10 },
    "location_premium_pct": 0
  },
  "realism": { "bp_min_huf_per_m2": 1000000, "asking_to_tx_pct": -7, "correction_cap_pct": 5 },
  "rounding": { "step_huf": 100000 },
  "cache": { "comps_days": 3 },
  "fallback": { "enabled": true, "min_comps_for_engine": 3 }
}$json$::jsonb, 'Alapértelmezett induló beállítás'
where not exists (select 1 from public.valuation_engine_configs);

-- A becslés levezetése (audit) az előzményhez, hogy visszanézhető legyen.
alter table public.usage_history add column if not exists valuation_audit jsonb;
