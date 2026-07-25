-- Vendéglátás — Beszállító-kereső PRO (mély kutatás) aszinkron feldolgozáshoz.
-- A PRO mód a Perplexity legmélyebb keresőmodelljét használja, ami több percig futhat,
-- ezért NEM szinkron: beküldjük a kérést, a job ide kerül, a kliens pedig pollingozza a
-- státuszt (/api/hospitality/suppliers/status). Így a Vercel időkorlátja nem vágja le.
-- Idempotens; futtatás: Supabase → SQL Editor.

create table if not exists public.supplier_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'processing',  -- processing | finalizing | done | failed
  query jsonb not null default '{}'::jsonb,    -- a keresési feltételek (SupplierQuery)
  request_id text,                             -- a Perplexity async kérés azonosítója
  credits_charged integer not null default 0,  -- levont kredit (hibánál visszajár)
  search_id uuid,                              -- a kész supplier_searches sor id-ja
  error text,
  created_at timestamptz not null default now()
);

create index if not exists supplier_jobs_user_idx on public.supplier_jobs (user_id);

alter table public.supplier_jobs enable row level security;

-- A felhasználó a saját jobjait látja; az írást a szerver admin (service role) végzi.
drop policy if exists "supplier_jobs_select_own" on public.supplier_jobs;
create policy "supplier_jobs_select_own" on public.supplier_jobs
  for select using (auth.uid() = user_id);
