-- =====================================================================
-- Twinx AI Portal — 6.6 Videó pipeline (video_jobs)
-- Futtasd a Supabase SQL Editorban a schema.sql UTÁN.
-- Emellett hozz létre egy PUBLIKUS `music` bucketet (stílus-mappákkal), és a
-- videó kimenetekhez a `reports` bucketet használjuk (már megvan).
-- =====================================================================

create table if not exists public.video_jobs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  service_id       uuid references public.services (id) on delete set null,
  status           text not null default 'pending',  -- pending | animating | rendering | done | failed
  format           text not null,                    -- '16:9' | '9:16' | '1:1'
  music_style      text,                             -- zenei stílus slug
  music_url        text,                             -- a kiválasztott random zene URL-je
  image_count      integer not null,
  credits_charged  integer not null default 0,
  source_images    jsonb,                            -- bemeneti kép URL-ek
  clips            jsonb,                            -- Luma snittek: [{index, luma_id, status, url}]
  output_url       text,                             -- a végleges videó URL-je
  error            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists video_jobs_user_created_idx
  on public.video_jobs (user_id, created_at desc);

-- updated_at automatikus frissítés (a set_updated_at a schema.sql-ből jön)
drop trigger if exists set_video_jobs_updated_at on public.video_jobs;
create trigger set_video_jobs_updated_at
  before update on public.video_jobs
  for each row execute function public.set_updated_at();

-- RLS: a user a SAJÁT jobjait olvassa; admin mindet. Írás a backendből
-- (service_role) történik, ami megkerüli az RLS-t.
alter table public.video_jobs enable row level security;

drop policy if exists "video_jobs_select_own" on public.video_jobs;
create policy "video_jobs_select_own" on public.video_jobs
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "video_jobs_admin_write" on public.video_jobs;
create policy "video_jobs_admin_write" on public.video_jobs
  for all using (public.is_admin()) with check (public.is_admin());
