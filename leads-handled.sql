-- =====================================================================
-- TWINX — beérkező megkeresések lezárása (admin „kipipálás")
-- Futtasd a Supabase SQL Editorban a b2b.sql UTÁN.
--
-- Miért: az admin Megkeresések oldalán minden üzenet mellett van egy pipa.
-- Amíg nincs bepipálva, a megkeresés NYITOTT: külön jelzést kap a listában,
-- és beleszámít a fejlécben megjelenő számlálóba.
-- =====================================================================

alter table public.leads add column if not exists handled_at    timestamptz;
alter table public.leads add column if not exists handled_by    uuid references auth.users(id) on delete set null;
alter table public.leads add column if not exists handled_email text;

-- A nyitott megkeresések gyors leszámolásához (fejléc-jelvény).
create index if not exists leads_open_idx
  on public.leads (created_at desc)
  where handled_at is null;

-- ---------------------------------------------------------------------
-- Munkatársi jegyzet a megkereséshez: mit beszéltek meg, miben egyeztek meg.
-- A megkereső NEM látja, ez belső feljegyzés (admin/sales).
-- ---------------------------------------------------------------------
alter table public.leads add column if not exists note            text;
alter table public.leads add column if not exists note_updated_at timestamptz;
alter table public.leads add column if not exists note_email      text;
