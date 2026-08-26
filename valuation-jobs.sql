-- =====================================================================
-- Twinx AI Portal — Ingatlan értékbecslés ASZINKRON job (valuation_jobs)
-- Futtasd a Supabase SQL Editorban a schema.sql UTÁN. Idempotens.
--
-- MIÉRT: az értékbecslés eddig EGY kérésen belül várta ki a Perplexity választ,
-- ezért lassú válasznál időkorlátba futott ("Az adatlekérés túllépte az időkorlátot").
-- Mostantól a beküldés csak létrehoz egy jobot, a kliens pedig pollingozza az
-- állapotot — így a partner SOHA nem ütközik platform-időkorlátba, és el is
-- navigálhat: a kész riport az előzményekbe (Korábbi munkák) kerül.
--
-- KREDIT: a levonás CSAK sikeres becslés után történik (a státusz-végponton),
-- ezért a `credits_charged` induláskor 0.
-- =====================================================================

create table if not exists public.valuation_jobs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  service_id       uuid references public.services (id) on delete set null,
  status           text not null default 'processing',   -- processing | done | failed
  input_data       jsonb not null,                        -- a becslés bemenete (űrlap + fotó-elemzés)
  request_id       text,                                  -- Perplexity async request id (ha async ágon fut)
  credits_charged  integer not null default 0,            -- csak sikeres becslés után > 0
  report           text,                                  -- a kész riport szövege
  output_url       text,                                  -- a mentett PDF URL-je (ha készül)
  error            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists valuation_jobs_user_created_idx
  on public.valuation_jobs (user_id, created_at desc);

-- updated_at automatikus frissítés (set_updated_at a schema.sql-ből)
drop trigger if exists set_valuation_jobs_updated_at on public.valuation_jobs;
create trigger set_valuation_jobs_updated_at
  before update on public.valuation_jobs
  for each row execute function public.set_updated_at();

-- RLS: a user a SAJÁT jobjait olvassa; admin mindet. Írás a backendből
-- (service_role) történik, ami megkerüli az RLS-t.
alter table public.valuation_jobs enable row level security;

drop policy if exists "valuation_jobs_select_own" on public.valuation_jobs;
create policy "valuation_jobs_select_own" on public.valuation_jobs
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "valuation_jobs_admin_write" on public.valuation_jobs;
create policy "valuation_jobs_admin_write" on public.valuation_jobs
  for all using (public.is_admin()) with check (public.is_admin());
