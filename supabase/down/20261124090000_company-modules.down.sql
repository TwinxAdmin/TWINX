-- VISSZACSINÁLÁS: 20261124090000_company-modules.sql
-- FIGYELEM: a cégek moduljai, előfizetései, átadási bejegyzései, meghívói és modul-hozzáférései elvesznek.
-- A cégek, tagságok és a napló (20261123220000_companies.sql) megmaradnak.
-- Újrafuttatható.

drop function if exists public.accept_invitation(uuid, text);
drop function if exists public.remove_access(uuid, uuid, uuid);
drop function if exists public.add_self_access(uuid, uuid);
drop function if exists public.revoke_invitation(uuid, uuid);
drop function if exists public.resend_invitation(uuid, uuid, text, integer);
drop function if exists public.create_invitation(uuid, uuid, text, text, integer);
drop function if exists public.deactivate_company_module(uuid, uuid);
drop function if exists public.activate_company_module(uuid, uuid);
drop function if exists public.revoke_handover(uuid, uuid, text);
drop function if exists public.record_handover(uuid, uuid, text, text, text, date, text, text);
drop function if exists public.admin_update_company_module(uuid, uuid, uuid, text);
drop function if exists public.admin_set_module_subscription(uuid, uuid, integer, date, boolean, integer);
drop function if exists public.admin_set_module_state(uuid, uuid, text);
drop function if exists public.admin_create_company_module(uuid, uuid, text, uuid);

drop table if exists public.module_access;
drop table if exists public.module_invitations;
drop table if exists public.module_handovers;
drop table if exists public.company_modules;

drop function if exists public.module_is_live(uuid);
drop function if exists public.is_head_of(uuid, uuid);
drop function if exists public.user_has_module_access(uuid, uuid);
drop function if exists public.module_seats_used(uuid);
