-- VISSZACSINÁLÁS: 20261123210000_admin-roles.sql
-- A volt sales fiókokat a napló alapján visszaállítja `sales`-re, majd eltávolítja a függvényt, a triggert és a naplót.
-- Újrafuttatható.

do $$
declare r record;
begin
  if to_regclass('public.role_audit_log') is not null then
    perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
    for r in select target_id from public.role_audit_log where note = 'D45: a sales szerepkör megszűnt' and target_id is not null loop
      update public.profiles set role = 'sales' where id = r.target_id and role = 'user';
    end loop;
  end if;
end $$;

drop function if exists public.admin_set_role(uuid, uuid, text);
drop trigger if exists profiles_guard_last_admin_trg on public.profiles;
drop function if exists public.profiles_guard_last_admin();
drop table if exists public.role_audit_log;
