-- =====================================================================
-- Twinx — Videó-könyvtár: cím, előkép (poszter) és saját mappák
-- Futtasd a Supabase SQL Editorban a video-v2.sql UTÁN.
-- =====================================================================

-- A videó címe (az ingatlan címe) és az előkép URL-je.
alter table public.video_jobs add column if not exists title        text;
alter table public.video_jobs add column if not exists poster_url   text;

-- Saját mappák (a dátum-mappák automatikusak, ezek a partner sajátjai).
create table if not exists public.video_folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create index if not exists video_folders_user_idx on public.video_folders (user_id, name);

alter table public.video_folders enable row level security;

drop policy if exists "video_folders_own" on public.video_folders;
create policy "video_folders_own" on public.video_folders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- A videó besorolása saját mappába (null = csak a dátum-mappában látszik).
alter table public.video_jobs
  add column if not exists folder_id uuid references public.video_folders (id) on delete set null;

-- A felhasználó a SAJÁT videóit módosíthatja (áthelyezés) és törölheti.
drop policy if exists "video_jobs_update_own" on public.video_jobs;
create policy "video_jobs_update_own" on public.video_jobs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "video_jobs_delete_own" on public.video_jobs;
create policy "video_jobs_delete_own" on public.video_jobs
  for delete using (user_id = auth.uid());

-- A meglévő videók címét a meta-ból emeljük ki (egyszeri).
update public.video_jobs
set title = nullif(trim(coalesce(meta ->> 'title', '')), '')
where title is null;
