-- Elrejtett dátum-mappák a "korábbi munkák" tálcán.
-- A dátum-mappák automatikusan jönnek létre az elkészült munkákból, ezért fizikailag
-- nem töröljük őket (a képek megmaradnak a tárhelyen), csak elrejtjük a listából.
-- Egyszer kell lefuttatni a Supabase SQL editorban.

create table if not exists public.asset_hidden_dates (
  user_id uuid not null references auth.users(id) on delete cascade,
  date_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, date_key)
);

alter table public.asset_hidden_dates enable row level security;

drop policy if exists "asset_hidden_dates own" on public.asset_hidden_dates;
create policy "asset_hidden_dates own" on public.asset_hidden_dates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
