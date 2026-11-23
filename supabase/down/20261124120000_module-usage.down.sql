-- VISSZACSINÁLÁS: 20261124120000_module-usage.sql
-- FIGYELEM: a használati napló, a pluszcsomagok és a küszöb-értesítések elvesznek. A company_modules keret-oszlopai
-- (monthly_cap stb.) megmaradnak (azok a 20261124090000 migrációhoz tartoznak).
-- Újrafuttatható.
drop function if exists public.cap_mark_notified(uuid, text, integer, integer);
drop function if exists public.cap_thresholds_due();
drop function if exists public.cap_set(uuid, uuid, integer, text);
drop function if exists public.cap_add_pack(uuid, uuid, integer, integer, integer, text);
drop function if exists public.usage_release_stale(integer);
drop function if exists public.usage_release(uuid);
drop function if exists public.usage_settle(uuid, integer, text);
drop function if exists public.usage_reserve(uuid, uuid, text, integer, text, integer);
drop function if exists public.module_cap_status(text);
drop function if exists public.module_period_usage(uuid, text);
drop function if exists public.module_effective_cap(uuid, text);
drop table if exists public.cap_notifications;
drop table if exists public.module_cap_adjustments;
drop table if exists public.module_usage_events;
drop function if exists public.budapest_period(timestamptz);
