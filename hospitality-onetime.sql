-- Vendéglátás — Egyszeri (nem havi) kiadások, SAJÁT időszakkal (arányos elosztás).
-- Pl. új sütő, ami 3 hónapra vonatkozik: a riport az átfedő napok arányában számolja.
-- Idempotens; a korábbi `spent_on`-os sémáról is átmigrál.

create table if not exists public.restaurant_one_time_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  amount numeric not null default 0,
  period_start date,   -- mettől vonatkozik a kiadás
  period_end date,     -- meddig vonatkozik (egy napra: = period_start)
  created_at timestamptz not null default now()
);

-- Régi séma (spent_on) migrálása period_start/period_end-re.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'restaurant_one_time_costs' and column_name = 'spent_on'
  ) then
    alter table public.restaurant_one_time_costs add column if not exists period_start date;
    alter table public.restaurant_one_time_costs add column if not exists period_end date;
    update public.restaurant_one_time_costs
      set period_start = coalesce(period_start, spent_on),
          period_end   = coalesce(period_end, spent_on);
    alter table public.restaurant_one_time_costs drop column spent_on;
  end if;
end $$;

alter table public.restaurant_one_time_costs alter column period_start set not null;
alter table public.restaurant_one_time_costs alter column period_end set not null;

create index if not exists one_time_costs_user_range_idx
  on public.restaurant_one_time_costs (user_id, period_start, period_end);

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
