-- Vendéglátás — Beszállító-kereső: KEDVENC BESZÁLLÍTÓK (egyenként).
-- A partner egy-egy KONKRÉT beszállítót tehet a kedvencek közé (nem az egész keresést),
-- és külön „Kedvencek" mappában csak azokat látja. Idempotens; Supabase → SQL Editor.

create table if not exists public.supplier_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  location text,
  distance text,
  offering text,
  phone text,
  email text,
  website text,
  why text,
  source text,
  source_what text,           -- melyik keresett alapanyagnál jött (csoportosításhoz)
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists supplier_favorites_user_idx
  on public.supplier_favorites (user_id, created_at desc);

alter table public.supplier_favorites enable row level security;

drop policy if exists "supplier_fav_select_own" on public.supplier_favorites;
create policy "supplier_fav_select_own" on public.supplier_favorites
  for select using (auth.uid() = user_id);

drop policy if exists "supplier_fav_insert_own" on public.supplier_favorites;
create policy "supplier_fav_insert_own" on public.supplier_favorites
  for insert with check (auth.uid() = user_id);

drop policy if exists "supplier_fav_delete_own" on public.supplier_favorites;
create policy "supplier_fav_delete_own" on public.supplier_favorites
  for delete using (auth.uid() = user_id);

-- A korábbi (keresés-szintű) kedvenc megjelölés már nem használt — elhagyható.
alter table public.supplier_searches drop column if exists is_favorite;
