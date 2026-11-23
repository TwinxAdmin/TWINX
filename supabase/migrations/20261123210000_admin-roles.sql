-- Szerepkörök (D45, terv 12 / 2. szakasz): csak `admin` és `user`; admin jogot csak admin adhat, naplózva;
-- az utolsó admint senki nem veheti le (az adatbázis is védi).
--
-- Additív (D51): új napló-tábla, új függvény, új védő-trigger. A `sales` enum-érték technikailag marad
-- (Postgresben nem törölhető egyszerűen), de senki nem kapja meg; a 2 mostani sales fiók `user` lesz.
-- Visszacsinálás: supabase/down/20261123210000_admin-roles.down.sql
-- Újrafuttatható.

-- 1) Napló: ki, kinek, mikor, mit adott vagy vett el. Csak hozzáfűzhető (nincs update/delete út).
create table if not exists public.role_audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid references public.profiles (id) on delete set null,   -- null = migráció / rendszer
  target_id  uuid references public.profiles (id) on delete set null,
  old_role   text,
  new_role   text not null,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists role_audit_log_created_idx on public.role_audit_log (created_at desc);
alter table public.role_audit_log enable row level security;
drop policy if exists role_audit_log_admin_read on public.role_audit_log;
create policy role_audit_log_admin_read on public.role_audit_log for select using (public.is_admin());

-- 2) Az utolsó admin védelme — bármilyen úton jön a módosítás vagy a törlés.
create or replace function public.profiles_guard_last_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role is distinct from 'admin') then
    if not exists (select 1 from public.profiles where role = 'admin' and id <> old.id) then
      raise exception 'utolso_admin' using errcode = 'P0001';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists profiles_guard_last_admin_trg on public.profiles;
create trigger profiles_guard_last_admin_trg
  before update of role or delete on public.profiles
  for each row execute function public.profiles_guard_last_admin();

-- 3) Szerepkör módosítása (csak a szerver hívja, az API az admin-jogot is ellenőrzi; itt még egyszer).
--    Hibakódok: nem_admin · ervenytelen_szerep · nincs_ilyen · utolso_admin · sajat_admin
create or replace function public.admin_set_role(p_actor uuid, p_target uuid, p_role text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  if not exists (select 1 from public.profiles where id = p_actor and role = 'admin') then
    return jsonb_build_object('ok', false, 'error', 'nem_admin');
  end if;
  if p_role not in ('user', 'admin') then return jsonb_build_object('ok', false, 'error', 'ervenytelen_szerep'); end if;
  if p_actor = p_target and p_role <> 'admin' then return jsonb_build_object('ok', false, 'error', 'sajat_admin'); end if;

  -- Az adminsorok zárolása: két párhuzamos levétel se hagyhassa admin nélkül a rendszert.
  perform 1 from public.profiles where role = 'admin' for update;
  select role::text into v_old from public.profiles where id = p_target for update;
  if v_old is null then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if v_old = p_role then return jsonb_build_object('ok', true, 'unchanged', true); end if;
  if v_old = 'admin' and not exists (select 1 from public.profiles where role = 'admin' and id <> p_target) then
    return jsonb_build_object('ok', false, 'error', 'utolso_admin');
  end if;

  -- A profiles_guard_role trigger csak service_role munkamenetben enged szerepkört váltani.
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  update public.profiles set role = p_role::public.user_role, updated_at = now() where id = p_target;
  insert into public.role_audit_log (actor_id, target_id, old_role, new_role) values (p_actor, p_target, v_old, p_role);
  return jsonb_build_object('ok', true, 'old', v_old, 'new', p_role);
end $$;
revoke all on function public.admin_set_role(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_role(uuid, uuid, text) to service_role;

-- 4) A `sales` fiókok `user`-ek lesznek (D45), naplózva. Az SQL Editorban nincs service_role JWT, ezért
--    erre a tranzakcióra beállítjuk, hogy a profiles_guard_role ne állítsa vissza csendben.
do $$
declare r record;
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  for r in select id from public.profiles where role = 'sales' loop
    update public.profiles set role = 'user', updated_at = now() where id = r.id;
    insert into public.role_audit_log (actor_id, target_id, old_role, new_role, note)
    values (null, r.id, 'sales', 'user', 'D45: a sales szerepkör megszűnt');
  end loop;
end $$;
