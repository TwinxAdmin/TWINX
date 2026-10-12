-- =====================================================================
-- Twinx — MODUL-ESEMÉNYNAPLÓ (ME2a, admin „Modul elemzés" → Tölcsér, hibák, futási idő, eszköz)
-- Futtatás: Supabase SQL Editor. Idempotens.
--
-- A modulok néhány ponton láthatatlan jelzést küldenek (POST /api/track/module-event):
--   form_start   — elkezdte kitölteni az űrlapot (oldal-megnyitásonként egyszer)
--   run_start    — elindította a futtatást
--   run_success  — kész lett (duration_ms = futási idő)
--   run_error    — hibával állt le (duration_ms + rövid hibakód a detail-ben)
--   download     — letöltötte az eredményt
--   share        — megosztotta (közös mappa / kolléga / link)
-- run_id: a kliens adja, ezzel párosul az indítás és a vége. device: a szerver állapítja meg (mobile / tablet / desktop).
-- Írni CSAK a szerver tud (service_role); olvasni csak admin. Az elemzés összesít — név szerint nem használjuk.
-- =====================================================================

create table if not exists public.module_events (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  module_href  text not null check (char_length(module_href) between 2 and 200),
  event        text not null check (event in ('form_start', 'run_start', 'run_success', 'run_error', 'download', 'share')),
  run_id       uuid,
  duration_ms  integer check (duration_ms is null or duration_ms between 0 and 86400000),
  device       text check (device is null or device in ('mobile', 'tablet', 'desktop')),
  detail       text check (detail is null or char_length(detail) <= 200),
  created_at   timestamptz not null default now()
);

-- az elemzéshez: modul + időszak, illetve felhasználó + időszak
create index if not exists module_events_module_idx on public.module_events (module_href, created_at desc);
create index if not exists module_events_user_idx   on public.module_events (user_id, created_at desc);
create index if not exists module_events_run_idx    on public.module_events (run_id) where run_id is not null;

alter table public.module_events enable row level security;

drop policy if exists "module_events_admin_read" on public.module_events;
create policy "module_events_admin_read" on public.module_events
  for select using (public.is_admin());
-- insert / update / delete policy NINCS: böngészőből nem írható (csak service_role).
