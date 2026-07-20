-- Vendéglátás — Étlap / Menü kettébontott árazás.
-- Ugyanaz az étel étlapról kis szériában készül (magasabb önköltség, saját eladási ár),
-- menübe viszont nagy mennyiségben (alacsonyabb önköltség, és a MENÜNEK van egy ára,
-- nem az egyes ételnek). Idempotens; futtatás: Supabase → SQL Editor.

-- 1) Étel: menüben az előállítási költség (opcionális; üres = nem megy menübe).
alter table public.restaurant_dishes
  add column if not exists menu_cost_price numeric;

-- 2) Költségprofil: a napi menük ára (NEM költség, csak beállítás — a fix költség
--    összegébe nem számít bele).
alter table public.restaurant_cost_profile
  add column if not exists menu_price_2 numeric not null default 0,
  add column if not exists menu_price_3 numeric not null default 0;

-- 3) Eladás-napló: csatorna (étlap / menü). A régi sorok étlaposnak minősülnek.
alter table public.dish_sales
  add column if not exists channel text not null default 'etlap';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'dish_sales_channel_check'
  ) then
    alter table public.dish_sales
      add constraint dish_sales_channel_check check (channel in ('etlap', 'menu'));
  end if;
end $$;

-- Az egyediség mostantól csatornánként értendő.
alter table public.dish_sales
  drop constraint if exists dish_sales_user_id_dish_id_period_start_period_end_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'dish_sales_unique_entry'
  ) then
    alter table public.dish_sales
      add constraint dish_sales_unique_entry
      unique (user_id, dish_id, period_start, period_end, channel);
  end if;
end $$;

-- 4) Eladott napi menük darabszáma időszakonként (+ opcionális ár-felülírás).
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
