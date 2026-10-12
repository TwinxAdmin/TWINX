-- Vendéglátás — Eladás-napló (Profit kalkulátor adatforrása).
-- A partner időszakonként/naponta rögzíti az eladott adagokat; a riport ebből aggregál
-- tetszőleges dátumtartományra. Futtatás: Supabase → SQL Editor. Idempotens.

-- A korábbi, nem használt heti tábla eltávolítása (ha létezett).
drop table if exists public.dish_sales_weekly cascade;

create table if not exists public.dish_sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dish_id uuid not null references public.restaurant_dishes(id) on delete cascade,
  period_start date not null,   -- az eladás időszakának kezdete (egy nap esetén = period_end)
  period_end date not null,     -- az eladás időszakának vége
  qty integer not null default 0 check (qty >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, dish_id, period_start, period_end)
);

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
