-- =====================================================================
-- Twinx AI Portal — modul-szintű kredit-fogyasztás követése
-- Futtasd a Supabase SQL Editorban a schema.sql UTÁN.
-- A usage_history minden generálásnál rögzíti, hány kreditet vontunk le
-- (admin/sales bypassnál 0). Ebből számol a modul-figyelő. Idempotens.
-- A régi sorok credits_charged értéke 0 marad (visszamenőleg nem tudjuk).
-- =====================================================================

alter table public.usage_history
  add column if not exists credits_charged integer not null default 0;
