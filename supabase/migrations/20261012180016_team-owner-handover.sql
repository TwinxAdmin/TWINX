-- =====================================================================
-- Twinx — KÖZÖS MUNKATÉR: gazdaváltás kilépéskor
-- Futtasd a Supabase SQL Editorban a 20261012105023_team-workspace.sql UTÁN. Idempotens.
--
-- Ha a munkateret megnyitó társ (offices.owner_id, role = 'owner') kilép, a LEGRÉGEBBEN
-- csatlakozott megmaradt társ lesz az új gazda (owner_id + role). Így a megnyitó később a
-- fiókját is törölheti, és az admin listán is a valódi tag szerepel.
-- • A két védő trigger (office_members_guard, offices_guard) eddig MINDEN szerep- / gazdacserét
--   tiltott. Mostantól KIZÁRÓLAG a team_leave() függvényen belül engedik — egy tranzakción belüli
--   jelzővel (twx.allow_owner_transfer). Böngészőből továbbra sem írható semmi.
-- • Egyszeri javítás: a már meglévő munkatereknél, ahol a gazda korábban kilépett, most átáll.
-- =====================================================================

-- 1) Védők: a csere csak a jelzővel engedett ---------------------------
create or replace function public.office_members_guard()
returns trigger
language plpgsql security invoker set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'OFFICE_WRITE_FORBIDDEN';
  end if;

  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role
       and coalesce(current_setting('twx.allow_owner_transfer', true), '') <> 'on' then
      raise exception 'OFFICE_ROLE_LOCKED';
    end if;
    if new.unlimited and not old.unlimited and old.allowance > 0 then
      insert into public.office_ledger (office_id, kind, actor_id, member_id, amount, note)
      values (old.office_id, 'allocate', null, old.user_id, -old.allowance,
              'Korlátlan lett — a kerete visszakerült a szabad részbe');
      new.allowance := 0;
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.offices_guard()
returns trigger
language plpgsql security invoker set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'OFFICE_WRITE_FORBIDDEN';
  end if;
  if tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id
     and coalesce(current_setting('twx.allow_owner_transfer', true), '') <> 'on' then
    raise exception 'OFFICE_OWNER_LOCKED';
  end if;
  return coalesce(new, old);
end;
$$;


-- 2) Gazdaváltás segédfüggvény (csak közös munkatérnél) ------------------
-- A legrégebben csatlakozott tag (a p_except kivételével) lesz a gazda. Visszatér: az új gazda (vagy null).
create or replace function public.team_transfer_owner(p_office uuid, p_except uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_new uuid;
begin
  if not exists (select 1 from public.offices where id = p_office and kind = 'team') then
    return null;
  end if;

  select user_id into v_new
    from public.office_members
   where office_id = p_office and user_id <> p_except
   order by joined_at asc
   limit 1;
  if v_new is null then
    return null;   -- nincs megmaradt társ: a gazda marad (üres munkatér)
  end if;

  perform set_config('twx.allow_owner_transfer', 'on', true);   -- csak ebben a tranzakcióban
  update public.office_members set role = 'member' where office_id = p_office and role = 'owner' and user_id <> v_new;
  update public.office_members set role = 'owner'  where office_id = p_office and user_id = v_new;
  update public.offices        set owner_id = v_new where id = p_office;
  perform set_config('twx.allow_owner_transfer', 'off', true);

  return v_new;
end;
$$;


-- 3) Kilépés: ha a gazda lép ki, előbb átadja a gazdaságot --------------
create or replace function public.team_leave(p_office uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.offices where id = p_office and kind = 'team') then
    raise exception 'TEAM_NOT_FOUND';
  end if;
  if not exists (select 1 from public.office_members where office_id = p_office and user_id = p_user) then
    raise exception 'TEAM_NOT_MEMBER';
  end if;

  -- gazdaváltás: ha a kilépő a gazda, a legrégebben csatlakozott megmaradt társ veszi át
  if exists (select 1 from public.offices where id = p_office and owner_id = p_user)
     or exists (select 1 from public.office_members where office_id = p_office and user_id = p_user and role = 'owner') then
    perform public.team_transfer_owner(p_office, p_user);
  end if;

  update public.office_folder_items i
     set expires_at = now() + interval '30 days'
    from public.office_folders f, public.usage_history h
   where i.folder_id = f.id and f.office_id = p_office
     and i.history_id = h.id and h.user_id = p_user
     and i.expires_at is null;

  delete from public.office_folder_members fm
   using public.office_folders f
   where fm.folder_id = f.id and f.office_id = p_office and fm.user_id = p_user;

  update public.user_office_context
     set office_id = null, updated_at = now()
   where user_id = p_user and office_id = p_office;

  delete from public.office_members where office_id = p_office and user_id = p_user;
end;
$$;


-- 4) Egyszeri javítás: meglévő munkaterek, ahol a gazda már nem tag ------
do $$
declare
  o record;
begin
  for o in
    select f.id, f.owner_id from public.offices f
     where f.kind = 'team'
       and not exists (select 1 from public.office_members m where m.office_id = f.id and m.user_id = f.owner_id)
       and exists (select 1 from public.office_members m where m.office_id = f.id)
  loop
    perform public.team_transfer_owner(o.id, o.owner_id);
  end loop;
end $$;


-- 5) Jogosultság ---------------------------------------------------------
revoke execute on function public.team_transfer_owner(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.team_leave(uuid, uuid) from public, anon, authenticated;
grant execute on function public.team_transfer_owner(uuid, uuid) to service_role;
grant execute on function public.team_leave(uuid, uuid) to service_role;
