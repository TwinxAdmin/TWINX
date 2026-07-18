-- Vendéglátás modul — a partner saját étel-adatbázisa (RAG-forrás a menü-generátorhoz).
-- Futtatás: Supabase → SQL Editor. Idempotens (biztonságosan újrafuttatható).

create table if not exists public.restaurant_dishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  category text not null check (category in ('leves','foetel','desszert','ital','koret','eloetel')),
  cuisine_style text,
  profit_margin text not null default 'medium' check (profit_margin in ('low','medium','high')),
  image_url text,
  created_at timestamptz not null default now()
);

-- Gyors lekérdezés a partner saját ételeire (előszűréshez).
create index if not exists restaurant_dishes_user_idx on public.restaurant_dishes (user_id);

alter table public.restaurant_dishes enable row level security;

-- RLS: mindenki KIZÁRÓLAG a saját ételeit látja/módosítja.
drop policy if exists "dishes_select_own" on public.restaurant_dishes;
create policy "dishes_select_own" on public.restaurant_dishes
  for select using (auth.uid() = user_id);

drop policy if exists "dishes_insert_own" on public.restaurant_dishes;
create policy "dishes_insert_own" on public.restaurant_dishes
  for insert with check (auth.uid() = user_id);

drop policy if exists "dishes_update_own" on public.restaurant_dishes;
create policy "dishes_update_own" on public.restaurant_dishes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "dishes_delete_own" on public.restaurant_dishes;
create policy "dishes_delete_own" on public.restaurant_dishes
  for delete using (auth.uid() = user_id);
