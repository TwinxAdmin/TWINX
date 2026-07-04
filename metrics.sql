-- =====================================================================
-- Twinx AI Portal — 6.5 Admin Költségfigyelő (metrics)
-- Futtasd a Supabase SQL Editorban a schema.sql és stripe.sql UTÁN.
-- =====================================================================

-- 1) API-költség napló (admin-only, userek elől TELJESEN rejtve) ------
create table if not exists public.api_cost_logs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users (id) on delete set null,
  service_id          uuid references public.services (id) on delete set null,
  feature             text not null,                 -- 'valuation', 'visualization', 'video'
  service_name        text not null,                 -- külső API: 'perplexity', 'google-studio', 'luma', 'shotstack'
  units               integer not null default 1,    -- pl. képek száma
  estimated_cost_usd  numeric(10,4) not null default 0,
  created_at          timestamptz not null default now()
);

create index if not exists api_cost_logs_created_idx
  on public.api_cost_logs (created_at desc);

-- RLS: CSAK admin olvashatja. A backend service_role-lal ír (megkerüli az RLS-t).
alter table public.api_cost_logs enable row level security;

drop policy if exists "api_cost_logs_admin_only" on public.api_cost_logs;
create policy "api_cost_logs_admin_only" on public.api_cost_logs
  for all using (public.is_admin()) with check (public.is_admin());


-- 2) Bevétel: a ténylegesen fizetett összeg (HUF) a vásárlásokhoz -----
-- A profitmarzshoz kell (fix HUF<->USD árfolyammal számoljuk a marzsot).
alter table public.credit_purchases
  add column if not exists amount_huf integer not null default 0;

-- Opcionális visszatöltés a meglévő teszt-vásárlásokhoz (mind 4990 Ft csomag volt):
-- update public.credit_purchases set amount_huf = 4990 where amount_huf = 0;
