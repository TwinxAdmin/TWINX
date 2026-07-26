-- Ingatlan-mappák (címkézés) a közös "korábbi munkák" tálcához.
-- Egy kép több mappában is lehet (many-to-many). A dátum-mappák virtuálisak,
-- de egyedileg átnevezhetők (asset_date_labels).
-- Egyszer kell lefuttatni a Supabase SQL editorban.

-- 1) Elnevezett (ingatlan) mappák
create table if not exists public.asset_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
alter table public.asset_folders enable row level security;
drop policy if exists "asset_folders own" on public.asset_folders;
create policy "asset_folders own" on public.asset_folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists asset_folders_user_idx on public.asset_folders(user_id);

-- 2) Mappa-tagok (melyik kép melyik mappában) — egy kép több mappában is lehet
create table if not exists public.asset_folder_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid not null references public.asset_folders(id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now(),
  unique (user_id, folder_id, url)
);
alter table public.asset_folder_items enable row level security;
drop policy if exists "asset_folder_items own" on public.asset_folder_items;
create policy "asset_folder_items own" on public.asset_folder_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists asset_folder_items_folder_idx on public.asset_folder_items(folder_id);

-- 3) Dátum-mappák egyedi elnevezése (opcionális átnevezés)
create table if not exists public.asset_date_labels (
  user_id uuid not null references auth.users(id) on delete cascade,
  date_key text not null,
  name text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, date_key)
);
alter table public.asset_date_labels enable row level security;
drop policy if exists "asset_date_labels own" on public.asset_date_labels;
create policy "asset_date_labels own" on public.asset_date_labels
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
