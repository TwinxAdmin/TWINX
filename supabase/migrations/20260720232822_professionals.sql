-- Szakember-kereső (vendéglátás + ingatlan) — előzmény + kedvencek.
-- A Perplexity keres szakembereket a partner szűrői szerint; a keresések mentődnek,
-- egy-egy konkrét szakembert a partner kedvencnek jelölhet. Idempotens; Supabase → SQL Editor.

-- 1) Keresések előzménye (iparágra bontva).
create table if not exists public.professional_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  industry text not null,                    -- 'hospitality' | 'realestate'
  query jsonb not null default '{}'::jsonb,
  results jsonb not null default '[]'::jsonb,
  extras jsonb not null default '{}'::jsonb,
  raw text,
  pdf_url text,
  credits_charged numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists professional_searches_user_idx
  on public.professional_searches (user_id, created_at desc);
create index if not exists professional_searches_ind_idx
  on public.professional_searches (user_id, industry);

alter table public.professional_searches enable row level security;

drop policy if exists "prof_search_select_own" on public.professional_searches;
create policy "prof_search_select_own" on public.professional_searches
  for select using (auth.uid() = user_id);
drop policy if exists "prof_search_insert_own" on public.professional_searches;
create policy "prof_search_insert_own" on public.professional_searches
  for insert with check (auth.uid() = user_id);
drop policy if exists "prof_search_delete_own" on public.professional_searches;
create policy "prof_search_delete_own" on public.professional_searches
  for delete using (auth.uid() = user_id);

-- 2) Kedvenc szakemberek (egyenként).
create table if not exists public.professional_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  industry text not null,
  name text not null,
  role text,
  location text,
  distance text,
  experience text,
  availability text,
  rate text,
  phone text,
  email text,
  website text,
  why text,
  source text,
  source_what text,                          -- melyik szakma-keresésnél jött
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists professional_favorites_user_idx
  on public.professional_favorites (user_id, created_at desc);

alter table public.professional_favorites enable row level security;

drop policy if exists "prof_fav_select_own" on public.professional_favorites;
create policy "prof_fav_select_own" on public.professional_favorites
  for select using (auth.uid() = user_id);
drop policy if exists "prof_fav_insert_own" on public.professional_favorites;
create policy "prof_fav_insert_own" on public.professional_favorites
  for insert with check (auth.uid() = user_id);
drop policy if exists "prof_fav_delete_own" on public.professional_favorites;
create policy "prof_fav_delete_own" on public.professional_favorites
  for delete using (auth.uid() = user_id);
