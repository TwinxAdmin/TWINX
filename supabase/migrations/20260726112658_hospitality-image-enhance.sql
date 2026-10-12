-- Ingatlan — Képjavító: előzmény (dátum-mappák) + kedvencek.
-- A jobs sor egy feldolgozás: mód + képpárok (eredeti + feljavított URL). A kedvencek
-- egy-egy feljavított képet jelölnek. RLS: mindenki csak a sajátját éri el.
-- Idempotens; futtatás: Supabase → SQL Editor.

create table if not exists public.image_enhance_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null,                          -- 'feljavitas' | 'rendrakas'
  items jsonb not null default '[]'::jsonb,     -- [{ "original": url, "enhanced": url }]
  created_at timestamptz not null default now()
);
create index if not exists image_enhance_jobs_user_idx on public.image_enhance_jobs (user_id, created_at desc);
alter table public.image_enhance_jobs enable row level security;

drop policy if exists "ie_jobs_select_own" on public.image_enhance_jobs;
create policy "ie_jobs_select_own" on public.image_enhance_jobs
  for select using (auth.uid() = user_id);
drop policy if exists "ie_jobs_insert_own" on public.image_enhance_jobs;
create policy "ie_jobs_insert_own" on public.image_enhance_jobs
  for insert with check (auth.uid() = user_id);
drop policy if exists "ie_jobs_delete_own" on public.image_enhance_jobs;
create policy "ie_jobs_delete_own" on public.image_enhance_jobs
  for delete using (auth.uid() = user_id);

create table if not exists public.image_enhance_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original text,
  enhanced text not null,
  mode text,
  created_at timestamptz not null default now(),
  unique (user_id, enhanced)
);
create index if not exists image_enhance_fav_user_idx on public.image_enhance_favorites (user_id, created_at desc);
alter table public.image_enhance_favorites enable row level security;

drop policy if exists "ie_fav_select_own" on public.image_enhance_favorites;
create policy "ie_fav_select_own" on public.image_enhance_favorites
  for select using (auth.uid() = user_id);
drop policy if exists "ie_fav_insert_own" on public.image_enhance_favorites;
create policy "ie_fav_insert_own" on public.image_enhance_favorites
  for insert with check (auth.uid() = user_id);
drop policy if exists "ie_fav_update_own" on public.image_enhance_favorites;
create policy "ie_fav_update_own" on public.image_enhance_favorites
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "ie_fav_delete_own" on public.image_enhance_favorites;
create policy "ie_fav_delete_own" on public.image_enhance_favorites
  for delete using (auth.uid() = user_id);
