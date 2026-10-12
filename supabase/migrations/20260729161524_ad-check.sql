-- =====================================================================
-- Twinx — Hirdetés-ellenőrző: elemzések tárolása
-- Futtasd a Supabase SQL Editorban.
-- =====================================================================

create table if not exists public.ad_checks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  source_url      text,                 -- ha linkből dolgoztunk
  source_text     text,                 -- a feldolgozott hirdetésszöveg
  tone            text not null,        -- a kért hangnem az újraírt szöveghez
  score           int,                  -- összpontszám (0-100)
  result          jsonb not null default '{}'::jsonb,  -- a teljes elemzés
  pdf_url         text,
  credits_charged int not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists ad_checks_user_idx on public.ad_checks (user_id, created_at desc);

-- Felismerhető főcím az ingatlanról (város/kerület + utca, típus, méret) — ez a neve
-- az elemzésnek a könyvtárban, a nyers link helyett.
alter table public.ad_checks add column if not exists title text;

-- A korábbi elemzések címét az eredményből emeljük ki (egyszeri).
update public.ad_checks
set title = nullif(trim(coalesce(result ->> 'title', '')), '')
where title is null;

-- Saját mappák az elemzésekhez (a hónap-mappák automatikusak) — mint a videónál
-- és a hirdetéseknél.
create table if not exists public.ad_check_folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create index if not exists ad_check_folders_user_idx on public.ad_check_folders (user_id, name);

alter table public.ad_check_folders enable row level security;

drop policy if exists "ad_check_folders_own" on public.ad_check_folders;
create policy "ad_check_folders_own" on public.ad_check_folders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.ad_checks
  add column if not exists folder_id uuid references public.ad_check_folders (id) on delete set null;

-- Az áthelyezéshez kell UPDATE jog. Az ad_checks-ben nincs pénzügyi mező, amit
-- veszélyes lenne átírni (a credits_charged csak nyilvántartás), de a biztonság
-- kedvéért az áthelyezést itt is a szerver végzi ellenőrzés után.

alter table public.ad_checks enable row level security;

-- A partner a saját elemzéseit látja és törölheti; a létrehozás szerveroldalon
-- (service_role) történik a kredit levonása után.
drop policy if exists "ad_checks_select_own" on public.ad_checks;
create policy "ad_checks_select_own" on public.ad_checks
  for select using (user_id = auth.uid());

drop policy if exists "ad_checks_delete_own" on public.ad_checks;
create policy "ad_checks_delete_own" on public.ad_checks
  for delete using (user_id = auth.uid());
