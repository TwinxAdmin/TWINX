-- =====================================================================
-- Twinx AI Portal — Telek értékbecslés (land_jobs)
-- Futtasd a Supabase SQL Editorban a schema.sql UTÁN.
-- A "magas" szint (Perplexity Deep Research) aszinkron: a job tárolja a
-- Perplexity request_id-t, a kliens pollingozza az állapotot. A kimeneti PDF a
-- meglévő `reports` bucketbe kerül. A "normál" szint szinkron (nem hoz létre jobot).
-- Idempotens.
-- =====================================================================

create table if not exists public.land_jobs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  service_id       uuid references public.services (id) on delete set null,
  status           text not null default 'processing',   -- processing | done | failed
  level            text not null,                         -- normal | high
  input_data       jsonb not null,
  request_id       text,                                  -- Perplexity async request id (magas szint)
  credits_charged  integer not null default 0,
  report           text,                                  -- a nyers AI-szöveg
  output_url       text,                                  -- a végleges PDF URL-je
  error            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists land_jobs_user_created_idx
  on public.land_jobs (user_id, created_at desc);

-- updated_at automatikus frissítés (set_updated_at a schema.sql-ből)
drop trigger if exists set_land_jobs_updated_at on public.land_jobs;
create trigger set_land_jobs_updated_at
  before update on public.land_jobs
  for each row execute function public.set_updated_at();

-- RLS: a user a SAJÁT jobjait olvassa; admin mindet. Írás a backendből
-- (service_role) történik, ami megkerüli az RLS-t.
alter table public.land_jobs enable row level security;

drop policy if exists "land_jobs_select_own" on public.land_jobs;
create policy "land_jobs_select_own" on public.land_jobs
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "land_jobs_admin_write" on public.land_jobs;
create policy "land_jobs_admin_write" on public.land_jobs
  for all using (public.is_admin()) with check (public.is_admin());
