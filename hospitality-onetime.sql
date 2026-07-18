-- Vendéglátás — Egyszeri (nem havi) kiadások, dátummal.
-- Pl. új sütő vásárlása augusztusban. A riport csak arra az időszakra számolja
-- költségként, amelybe a kiadás dátuma (spent_on) beleesik. Idempotens.

create table if not exists public.restaurant_one_time_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  amount numeric not null default 0,
  spent_on date not null,               -- a kiadás napja (ez alapján esik időszakba)
  created_at timestamptz not null default now()
);

create index if not exists one_time_costs_user_date_idx
  on public.restaurant_one_time_costs (user_id, spent_on);

alter table public.restaurant_one_time_costs enable row level security;

drop policy if exists "one_time_select_own" on public.restaurant_one_time_costs;
create policy "one_time_select_own" on public.restaurant_one_time_costs
  for select using (auth.uid() = user_id);

drop policy if exists "one_time_insert_own" on public.restaurant_one_time_costs;
create policy "one_time_insert_own" on public.restaurant_one_time_costs
  for insert with check (auth.uid() = user_id);

drop policy if exists "one_time_update_own" on public.restaurant_one_time_costs;
create policy "one_time_update_own" on public.restaurant_one_time_costs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "one_time_delete_own" on public.restaurant_one_time_costs;
create policy "one_time_delete_own" on public.restaurant_one_time_costs
  for delete using (auth.uid() = user_id);
