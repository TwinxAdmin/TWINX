-- =====================================================================
-- Twinx — SZERKESZTÉS A KÖZÖS MAPPÁKBAN (IR8): módosítási napló + „épp szerkeszti" zár
-- Futtasd a Supabase SQL Editorban az office-folders.sql UTÁN. Idempotens.
--
-- • work_versions: minden mentett változat (ki, mikor, mi lett a szöveg és a PDF).
--   Az első szerkesztéskor az EREDETI állapot is bekerül, így mindig visszaállítható.
-- • work_locks: egyszerre egy ember szerkeszthet egy munkát; a zár 10 perc
--   tétlenség után magától lejár (a szerkesztő 2 percenként frissíti).
-- Írás/olvasás csak a szerveren át (service_role).
-- =====================================================================

create table if not exists public.work_versions (
  id               uuid primary key default gen_random_uuid(),
  history_id       uuid not null references public.usage_history (id) on delete cascade,
  saved_by         uuid references auth.users (id) on delete set null,
  kind             text not null default 'edit' check (kind in ('original', 'edit', 'restore')),
  output_text      text,
  output_file_url  text,
  created_at       timestamptz not null default now()
);
create index if not exists work_versions_history_idx on public.work_versions (history_id, created_at desc);

create table if not exists public.work_locks (
  history_id  uuid primary key references public.usage_history (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  locked_at   timestamptz not null default now()
);

alter table public.work_versions enable row level security;
alter table public.work_locks    enable row level security;
