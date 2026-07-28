-- =====================================================================
-- Twinx — Videó 2.0 (hibrid: Shotstack render + fal.ai AI-klip a PRO-nál)
-- Futtasd a Supabase SQL Editorban. A video_jobs tábla már létezik (video.sql).
-- =====================================================================

-- Csomag: 'alap' (Ken Burns minden képen) | 'pro' (első klip AI-mozgással)
alter table public.video_jobs add column if not exists package text not null default 'alap';

-- A lánc köztes adatai: kártya/keret URL-ek, fal request id, AI-klip URL, render id.
alter table public.video_jobs add column if not exists meta jsonb not null default '{}'::jsonb;
