-- Visszacsinálás: 20261124200000_package-caps.sql (Ingatlan csomag havi kerete, terv 27).
-- FIGYELEM: a keretek és a havi használat adatai elvesznek. Előtte mentés (D51).
-- A company_access (Ingatlan-hozzáférés) és az access_audit_log sorai megmaradnak.
drop function if exists public.package_mark_notified(uuid, text, integer, integer);
drop function if exists public.package_thresholds_due();
drop function if exists public.package_grant_estate_access(uuid, uuid, integer);
drop function if exists public.package_cap_set(uuid, uuid, text, integer, text);
drop function if exists public.package_usage_release_stale(integer);
drop function if exists public.package_usage_release(uuid);
drop function if exists public.package_usage_settle(uuid, integer, text);
drop function if exists public.package_cap_room(uuid, text, integer);
drop function if exists public.package_usage_reserve(uuid, text, text, integer, text, integer, boolean, boolean);
drop function if exists public.package_cap_status(text);
drop function if exists public.package_cap_for_user(uuid, text);
drop function if exists public.package_period_usage(uuid, text);
drop table if exists public.package_cap_notifications;
drop table if exists public.package_usage_events;
drop table if exists public.package_caps;
