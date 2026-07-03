-- =====================================================================
-- Twinx AI Portal — B2B leadek (6. fázis)
-- Futtasd a Supabase SQL Editorban a schema.sql UTÁN.
-- =====================================================================

create table if not exists public.leads (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  company    text,
  message    text not null,
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;

-- A leadeket csak admin olvashatja/kezelheti. A beszúrás a backendből
-- (service_role) történik, ami megkerüli az RLS-t.
drop policy if exists "leads_admin_all" on public.leads;
create policy "leads_admin_all" on public.leads
  for all using (public.is_admin()) with check (public.is_admin());
