-- =====================================================================
-- Twinx AI Portal — Egyedi modul igénylése: telefonszám + visszahívási időpont
-- Futtasd a Supabase SQL Editorban (egyszer). Újrafuttatható.
--
-- A `leads` tábla (b2b.sql) két új mezőt kap:
--   phone          — KÖTELEZŐ az új igényléseknél (a régi sorok miatt a DB-ben nullázható)
--   callback_time  — opcionális: mikor kereshetjük (pl. „Hétköznap délután 14–17”)
-- =====================================================================

alter table public.leads add column if not exists phone text;
alter table public.leads add column if not exists callback_time text;
