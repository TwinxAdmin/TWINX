-- Vendéglátás — Beszállító-kereső: KEDVENCEK.
-- A partner egy kattintással kedvencnek jelölhet egy keresést (frisset vagy korábbit),
-- és külön „Kedvencek" mappában látja csak a kedvenceket. Idempotens; Supabase → SQL Editor.

alter table public.supplier_searches
  add column if not exists is_favorite boolean not null default false;

create index if not exists supplier_searches_fav_idx
  on public.supplier_searches (user_id, is_favorite);
