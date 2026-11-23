-- VISSZACSINÁLÁS: 20261123190000_bookings.sql (foglalás és időpontok).
-- FIGYELEM: a foglalások és időpontok adatai elvesznek. Csak akkor futtasd, ha tényleg vissza kell állni.
-- A btree_gist bővítményt szándékosan nem töröljük (más is használhatja, ártalmatlan).
-- Újrafuttatható.

drop function if exists public.admin_delete_slot(uuid, uuid, boolean);
drop function if exists public.admin_add_slot(uuid, timestamptz, integer, uuid);
drop function if exists public.admin_apply_templates(uuid, integer);
drop function if exists public.admin_set_booking_status(uuid, text, uuid);
drop function if exists public.admin_cancel_booking(uuid, uuid);
drop function if exists public.cancel_booking_by_token(text);
drop function if exists public.booking_cancel_internal(uuid, text, uuid);
drop function if exists public.create_booking(uuid, text, text, text, text, text, uuid, text, text, text);
drop function if exists public.booking_free_slots();
drop function if exists public.booking_normalize_phone(text);

drop table if exists public.booking_attempts;
drop table if exists public.booking_events;
drop table if exists public.bookings;
drop table if exists public.availability_slots;
drop function if exists public.availability_slots_set_end();
drop table if exists public.availability_templates;
drop table if exists public.booking_hosts;
