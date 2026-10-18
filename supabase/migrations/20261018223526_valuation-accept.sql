-- =====================================================================
-- Twinx — értékbecslés: szerkesztés (ár, sáv, cím, indoklás) + KÖTELEZŐ elfogadás a letöltés előtt
-- Futtasd a Supabase SQL Editorban. Újrafuttatható.
--
-- A partner módosításait KÜLÖN tároljuk (valuation_overrides) — az AI eredeti szövege (output_text) és a motor
-- levezetése (valuation_audit) érintetlen marad: ez az „eredeti TWINX-becslés" a belső naplóhoz.
-- PDF CSAK elfogadáskor készül (output_file_url) → piszkozatból nem lehet PDF-et letölteni sehonnan.
-- =====================================================================

alter table public.usage_history add column if not exists valuation_overrides  jsonb;
alter table public.usage_history add column if not exists valuation_accepted_at timestamptz;
alter table public.usage_history add column if not exists valuation_accepted_by uuid references auth.users (id) on delete set null;

-- A már letölthető (PDF-fel rendelkező) régi becslések elfogadottnak számítanak — a partnerek eddig is így adták tovább.
update public.usage_history
   set valuation_accepted_at = coalesce(edited_at, created_at),
       valuation_accepted_by = user_id
 where feature_used = 'valuation'
   and output_file_url is not null
   and valuation_accepted_at is null;
