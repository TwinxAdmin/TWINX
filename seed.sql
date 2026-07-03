-- =====================================================================
-- Twinx AI Portal — Kezdő adatok (seed)
-- Futtasd a Supabase SQL Editorban a schema.sql UTÁN.
-- =====================================================================

-- Ingatlan modul (publikus). A visualization / valuation al-funkciók a
-- usage_history.feature_used mezőn keresztül különülnek el.
insert into public.services (name, slug, status)
values ('Ingatlan', 'real-estate', 'public')
on conflict (slug) do nothing;


-- --- Teszt kredit adása (opcionális) ---------------------------------
-- Prezentációhoz / teszteléshez adhatsz kézzel kreditet egy fióknak.
-- Cseréld a '<USER_ID>'-t a saját Auth user UUID-dre (Authentication > Users).
--
-- insert into public.user_credits (user_id, service_id, remaining_credits)
-- select '<USER_ID>', id, 10
-- from public.services
-- where slug = 'real-estate'
-- on conflict (user_id, service_id) do update
--   set remaining_credits = excluded.remaining_credits;
