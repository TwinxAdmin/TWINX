-- Vendéglátás — Beszállító-kereső (Perplexity webes kutatás) mentett keresései.
-- A találatok azért tárolódnak, hogy a partner később INGYEN visszanézhesse őket
-- (másodszor ne kelljen kreditet fizetnie ugyanazért).
-- Idempotens; futtatás: Supabase → SQL Editor.

create table if not exists public.supplier_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query jsonb not null default '{}',      -- mit/hol/típus/mennyiség/körzet
  results jsonb not null default '[]',    -- a megtalált beszállítók
  extras jsonb not null default '{}',     -- piaci helyzet, szezonalitás, tippek
  raw text,                               -- nyers AI-válasz (ha a JSON-parse elszállna)
  pdf_url text,
  credits_charged integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists supplier_searches_user_idx
  on public.supplier_searches (user_id, created_at desc);

alter table public.supplier_searches enable row level security;

drop policy if exists "supplier_searches_select_own" on public.supplier_searches;
create policy "supplier_searches_select_own" on public.supplier_searches
  for select using (auth.uid() = user_id);

drop policy if exists "supplier_searches_insert_own" on public.supplier_searches;
create policy "supplier_searches_insert_own" on public.supplier_searches
  for insert with check (auth.uid() = user_id);

drop policy if exists "supplier_searches_delete_own" on public.supplier_searches;
create policy "supplier_searches_delete_own" on public.supplier_searches
  for delete using (auth.uid() = user_id);
