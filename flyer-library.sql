-- =====================================================================
-- Twinx — Hirdetés-könyvtár: saját mappák + áthelyezés + törlés
-- Futtasd a Supabase SQL Editorban.
--
-- BIZTONSÁGI DÖNTÉS: a `usage_history` táblára SZÁNDÉKOSAN nem adunk
-- user-oldali UPDATE/DELETE policy-t. A policy csak SORT tud szűrni,
-- OSZLOPOT nem — így a partner a publikus anon kulccsal közvetlenül az
-- adatbázishoz fordulva átírhatná a saját sorában a `credits_charged`-ot
-- vagy törölhetne bármelyik előzményt (értékbecslést, kredit-nyomot is).
-- Helyette az áthelyezést és a törlést a szerver végzi (service_role),
-- miután ellenőrizte, hogy a sor a hívóé ÉS tényleg hirdetés.
-- =====================================================================

-- Saját mappák a hirdetésekhez (a hónap-mappák automatikusak, ezek a partneréi).
create table if not exists public.flyer_folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create index if not exists flyer_folders_user_idx on public.flyer_folders (user_id, name);

alter table public.flyer_folders enable row level security;

-- Mappát a partner maga kezelhet (ez csak a saját mappáira vonatkozik).
drop policy if exists "flyer_folders_own" on public.flyer_folders;
create policy "flyer_folders_own" on public.flyer_folders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- A hirdetések a usage_history-ban vannak (feature_used = 'flyer').
-- Mappába sorolás: null = csak a dátum-mappában látszik.
alter table public.usage_history
  add column if not exists folder_id uuid references public.flyer_folders (id) on delete set null;

create index if not exists usage_history_folder_idx on public.usage_history (user_id, folder_id);

-- Ha egy korábbi futtatás létrehozta volna a tág policy-kat, vegyük vissza őket.
drop policy if exists "usage_history_update_own" on public.usage_history;
drop policy if exists "usage_history_delete_own" on public.usage_history;
