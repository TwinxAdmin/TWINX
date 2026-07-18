-- Vendéglátás — Önköltség & profit modul.
-- Két tábla: (1) étteremszintű fix költség-profil (1 sor / partner),
--            (2) heti eladás-napló (követés: tényleges profit ételenként).
-- Futtatás: Supabase → SQL Editor. Idempotens (biztonságosan újrafuttatható).

-- 1) Étteremszintű fix költség-profil (havi kiadások). Egy sor / felhasználó.
create table if not exists public.restaurant_cost_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rent numeric not null default 0,          -- bérleti díj
  wages numeric not null default 0,         -- bérek + járulékok
  utilities numeric not null default 0,     -- rezsi (áram/gáz/víz)
  insurance numeric not null default 0,     -- biztosítás
  accounting numeric not null default 0,    -- könyvelő / adminisztráció
  marketing numeric not null default 0,     -- marketing
  depreciation numeric not null default 0,  -- eszköz-amortizáció
  bank_fees numeric not null default 0,     -- bankköltség / kártyadíj
  delivery_fees numeric not null default 0, -- kiszállítói jutalék (Wolt / Foodora)
  other numeric not null default 0,         -- egyéb egyösszegű
  extra_items jsonb not null default '[]',  -- [{label, amount}] egyedi tételek
  updated_at timestamptz not null default now()
);

-- Ha a tábla már létezett, az új oszlopot külön is felvesszük (idempotens).
alter table public.restaurant_cost_profile
  add column if not exists delivery_fees numeric not null default 0;

alter table public.restaurant_cost_profile enable row level security;

drop policy if exists "cost_profile_select_own" on public.restaurant_cost_profile;
create policy "cost_profile_select_own" on public.restaurant_cost_profile
  for select using (auth.uid() = user_id);

drop policy if exists "cost_profile_insert_own" on public.restaurant_cost_profile;
create policy "cost_profile_insert_own" on public.restaurant_cost_profile
  for insert with check (auth.uid() = user_id);

drop policy if exists "cost_profile_update_own" on public.restaurant_cost_profile;
create policy "cost_profile_update_own" on public.restaurant_cost_profile
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) Heti eladás-napló — ételenként, heti bontásban (követés / tényleges profit).
create table if not exists public.dish_sales_weekly (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dish_id uuid not null references public.restaurant_dishes(id) on delete cascade,
  week_start date not null,                 -- az adott hét hétfője
  qty integer not null default 0 check (qty >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, dish_id, week_start)
);

create index if not exists dish_sales_weekly_user_week_idx
  on public.dish_sales_weekly (user_id, week_start);

alter table public.dish_sales_weekly enable row level security;

drop policy if exists "sales_select_own" on public.dish_sales_weekly;
create policy "sales_select_own" on public.dish_sales_weekly
  for select using (auth.uid() = user_id);

drop policy if exists "sales_insert_own" on public.dish_sales_weekly;
create policy "sales_insert_own" on public.dish_sales_weekly
  for insert with check (auth.uid() = user_id);

drop policy if exists "sales_update_own" on public.dish_sales_weekly;
create policy "sales_update_own" on public.dish_sales_weekly
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "sales_delete_own" on public.dish_sales_weekly;
create policy "sales_delete_own" on public.dish_sales_weekly
  for delete using (auth.uid() = user_id);
