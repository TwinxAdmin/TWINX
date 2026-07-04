-- =====================================================================
-- Twinx AI Portal — Ötletláda (moderált, publikus)
-- Futtasd a Supabase SQL Editorban a schema.sql UTÁN.
-- =====================================================================

create table if not exists public.ideas (
  id            uuid primary key default gen_random_uuid(),
  author_name   text,              -- opcionális, nyilvánosan megjelenhet
  author_email  text,              -- CSAK adminnak, nyilvánosan SOHA
  content       text not null,
  status        text not null default 'pending',  -- pending | approved | rejected
  created_at    timestamptz not null default now(),
  approved_at   timestamptz
);

create index if not exists ideas_status_idx on public.ideas (status, created_at desc);

-- RLS: közvetlen elérés CSAK adminnak. A publikus beküldés és a jóváhagyott
-- ötletek nyilvános listája a backendből (service_role) megy, szűrt mezőkkel —
-- így a beküldő e-mailje sosem szivárog ki.
alter table public.ideas enable row level security;

drop policy if exists "ideas_admin_all" on public.ideas;
create policy "ideas_admin_all" on public.ideas
  for all using (public.is_admin()) with check (public.is_admin());
