-- =====================================================================
-- Twinx — Értékbecslés-könyvtár: saját mappák + áthelyezés + törlés
-- Futtasd a Supabase SQL Editorban.
--
-- Miért külön oszlop? A usage_history.folder_id már a HIRDETÉS-mappákra
-- (flyer_folders) mutató idegen kulcs. Az értékbecslés mappái másik táblában
-- vannak, ezért külön `valuation_folder_id` oszlopot kap — így a két modul
-- nem ütközik.
--
-- BIZTONSÁG: a usage_history-ra SZÁNDÉKOSAN nincs user-oldali UPDATE/DELETE
-- policy (a policy sort szűr, oszlopot nem — különben a partner átírhatná a
-- credits_charged mezőt vagy törölhetne idegen előzményt). Az áthelyezést és a
-- törlést a szerver végzi (service_role), miután ellenőrizte, hogy a sor a
-- hívóé ÉS tényleg értékbecslés.
-- =====================================================================

create table if not exists public.valuation_folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create index if not exists valuation_folders_user_idx
  on public.valuation_folders (user_id, name);

alter table public.valuation_folders enable row level security;

-- A partner a SAJÁT mappáit kezelheti.
drop policy if exists "valuation_folders_own" on public.valuation_folders;
create policy "valuation_folders_own" on public.valuation_folders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Az értékbecslések a usage_history-ban vannak (feature_used = 'valuation').
-- Mappába sorolás: null = csak a dátum-mappában látszik.
alter table public.usage_history
  add column if not exists valuation_folder_id uuid
    references public.valuation_folders (id) on delete set null;

create index if not exists usage_history_valuation_folder_idx
  on public.usage_history (user_id, valuation_folder_id);
