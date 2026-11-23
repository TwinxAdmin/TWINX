-- VISSZACSINÁLÁS: 20261123220000_companies.sql
-- FIGYELEM: a cégek, a cég-tagságok és a hozzáférési napló adatai elvesznek. A foglalások megmaradnak
-- (a company_id kapcsolat megszűnik; a „Céggé alakítva" állapotú foglalások állapota nem változik).
-- Újrafuttatható.

drop function if exists public.remove_company_head(uuid, uuid, uuid);
drop function if exists public.appoint_company_head(uuid, uuid, uuid);
drop function if exists public.admin_remove_company_member(uuid, uuid, uuid);
drop function if exists public.admin_add_company_member(uuid, uuid, text);
drop function if exists public.admin_update_company(uuid, uuid, text, text);
drop function if exists public.admin_create_company_from_booking(uuid, uuid);
drop function if exists public.admin_create_company(uuid, text, text);
drop function if exists public.require_admin(uuid);

alter table if exists public.bookings drop constraint if exists bookings_company_fk;

drop table if exists public.access_audit_log;
drop function if exists public.access_audit_log_append_only();
drop table if exists public.company_members;
drop function if exists public.company_members_guard_last_head();
drop table if exists public.companies;
drop function if exists public.is_company_member(uuid);
drop function if exists public.is_company_head(uuid);
