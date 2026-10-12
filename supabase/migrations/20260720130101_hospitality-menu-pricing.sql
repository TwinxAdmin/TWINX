-- Vendéglátás — Étlap / Menü kettébontott árazás (ÖNÁLLÓ, sorrendtől független).
-- Ugyanaz az étel étlapról kis szériában készül (magasabb önköltség, SAJÁT eladási ár),
-- menübe viszont nagy mennyiségben (alacsonyabb önköltség), és a MENÜNEK van ára, nem az
-- ételnek. Ez a szkript létrehozza a hiányzó táblákat is, ezért önmagában futtatható.
-- Idempotens; futtatás: Supabase → SQL Editor.

-- ---------------------------------------------------------------------------
-- 1) Étel: menüben az előállítási költség (opcionális; üres = nem megy menübe).
-- ---------------------------------------------------------------------------
alter table public.restaurant_dishes
  add column if not exists menu_cost_price numeric;

-- ---------------------------------------------------------------------------
-- 2) Költségprofil: a napi menük ára (NEM költség, csak beállítás).
-- ---------------------------------------------------------------------------
alter table public.restaurant_cost_profile
  add column if not exists menu_price_2 numeric not null default 0,
  add column if not exists menu_price_3 numeric not null default 0;

-- ---------------------------------------------------------------------------
-- 3) Eladás-napló (dish_sales) — létrehozás, ha még nincs; csatornával együtt.
--    A régi, nem használt heti tábla eltávolítása.
-- ---------------------------------------------------------------------------
drop table if exists public.dish_sales_weekly cascade;

create table if not exists public.dish_sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dish_id uuid not null references public.restaurant_dishes(id) on delete cascade,
  period_start date not null,   -- az eladás időszakának kezdete (egy nap: = period_end)
  period_end date not null,
  qty integer not null default 0 check (qty >= 0),
  channel text not null default 'etlap',  -- 'etlap' | 'menu'
  created_at timestamptz not null default now(),
  constraint dish_sales_unique_entry unique (user_id, dish_id, period_start, period_end, channel)
);

-- Ha a tábla korábbi (csatorna nélküli) sémával létezett: oszlop + megszorítások pótlása.
alter table public.dish_sales
  add column if not exists channel text not null default 'etlap';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dish_sales_channel_check') then
    alter table public.dish_sales
      add constraint dish_sales_channel_check check (channel in ('etlap', 'menu'));
  end if;
end $$;

-- Az egyediség mostantól csatornánként értendő.
alter table public.dish_sales
  drop constraint if exists dish_sales_user_id_dish_id_period_start_period_end_key;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'dish_sales_unique_entry') then
    alter table public.dish_sales
      add constraint dish_sales_unique_entry
      unique (user_id, dish_id, period_start, period_end, channel);
  end if;
end $$;

create index if not exists dish_sales_user_range_idx
  on public.dish_sales (user_id, period_start, period_end);

alter table public.dish_sales enable row level security;

drop policy if exists "dish_sales_select_own" on public.dish_sales;
create policy "dish_sales_select_own" on public.dish_sales
  for select using (auth.uid() = user_id);

drop policy if exists "dish_sales_insert_own" on public.dish_sales;
create policy "dish_sales_insert_own" on public.dish_sales
  for insert with check (auth.uid() = user_id);

drop policy if exists "dish_sales_update_own" on public.dish_sales;
create policy "dish_sales_update_own" on public.dish_sales
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "dish_sales_delete_own" on public.dish_sales;
create policy "dish_sales_delete_own" on public.dish_sales
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4) Eladott napi menük darabszáma időszakonként (+ opcionális ár-felülírás).
-- ---------------------------------------------------------------------------
create table if not exists public.menu_sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  qty_2 integer not null default 0 check (qty_2 >= 0),   -- eladott 2 fogásos menük
  qty_3 integer not null default 0 check (qty_3 >= 0),   -- eladott 3 fogásos menük
  price_2 numeric,                                       -- ha az időszakban eltérő volt az ár
  price_3 numeric,
  created_at timestamptz not null default now(),
  unique (user_id, period_start, period_end)
);

create index if not exists menu_sales_user_range_idx
  on public.menu_sales (user_id, period_start, period_end);

alter table public.menu_sales enable row level security;

drop policy if exists "menu_sales_select_own" on public.menu_sales;
create policy "menu_sales_select_own" on public.menu_sales
  for select using (auth.uid() = user_id);

drop policy if exists "menu_sales_insert_own" on public.menu_sales;
create policy "menu_sales_insert_own" on public.menu_sales
  for insert with check (auth.uid() = user_id);

drop policy if exists "menu_sales_update_own" on public.menu_sales;
create policy "menu_sales_update_own" on public.menu_sales
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "menu_sales_delete_own" on public.menu_sales;
create policy "menu_sales_delete_own" on public.menu_sales
  for delete using (auth.uid() = user_id);
