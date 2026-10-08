-- =====================================================================
-- Twinx — IRODAI FIÓK: FOGLALÁSOS KERET-MODELL (Irodai felület 1. fázis, 1. lépés)
-- Futtasd a Supabase SQL Editorban az office*.sql fájlok UTÁN (office-multi.sql is!).
-- Idempotens: többször is lefuttatható.
--
-- Eddig a kolléga kerete csak egy PLAFON volt: az egyenlegből semmi nem volt
-- félretéve, így többet is ki lehetett osztani, mint amennyi az irodában van.
-- Mostantól a keret FOGLALÁS:
--   • Kiosztva          = a nem korlátlan, nem létrehozó tagok kereteinek összege
--   • Szabadon kiosztható = irodai egyenleg − kiosztva
--   • Kiosztani csak a szabad részből lehet; visszavenni a tag maradék keretéig.
--   • A tag a saját (lefoglalt) keretéből költ; a létrehozó és a „korlátlan" tag
--     CSAK a szabad részből — így soha nem éli fel a kollégáknak foglalt kreditet.
--   • Tag eltávolításakor / korlátlanná tételekor a maradék kerete visszakerül
--     a szabad részbe — naplózva.
-- A védő triggerek SZÁNDÉKOSAN „security invoker"-ek: így a current_user a hívó
-- valódi szerepe (anon / authenticated / service_role / postgres).
-- Zárolási sorrend MINDEN függvényben: előbb az iroda sora, utána a tag sora
-- (így két egyidejű művelet nem akad össze).
-- =====================================================================


-- 0) Takarítás: a létrehozó és a korlátlan tag kerete eddig sem számított —
--    nullázzuk, hogy a foglalásba se számítson bele, ha később változik a joga.
--    (A trigger létrehozása ELŐTT, a napló bejegyzéssel együtt.)
insert into public.office_ledger (office_id, kind, actor_id, member_id, amount, note)
select office_id, 'allocate', null, user_id, -allowance,
       'Átállás foglalásos keretre: korlátlan / létrehozó kerete nullázva'
  from public.office_members
 where allowance > 0 and (role = 'owner' or unlimited);

update public.office_members set allowance = 0
 where allowance > 0 and (role = 'owner' or unlimited);


-- 1) Összesítő: egyenleg, kiosztva, szabad — egy helyen számolva -----------
create or replace function public.office_free(p_office uuid)
returns table (balance integer, allocated integer, free integer)
language sql security definer stable set search_path = public
as $$
  select o.balance,
         coalesce(a.s, 0)::integer,
         (o.balance - coalesce(a.s, 0))::integer
    from public.offices o
    left join lateral (
      select sum(m.allowance) as s
        from public.office_members m
       where m.office_id = o.id and m.role <> 'owner' and not m.unlimited
    ) a on true
   where o.id = p_office;
$$;


-- 2) Keret kiosztása / visszavétele egy MEGADOTT irodában ------------------
--    Hibák (exception üzenet — az API ezekből ad érthető választ):
--      OFFICE_NOT_ALLOWED      — nincs joga / nem tag / magának nem adhat
--      OFFICE_TARGET_UNLIMITED — létrehozónak / korlátlan tagnak nem kell keret
--      OFFICE_FREE_INSUFFICIENT — nincs ennyi szabadon kiosztható kredit
--      OFFICE_ALLOWANCE_LOW    — ennyit nem lehet visszavenni (a keret 0 alá menne)
--    Visszatér: a tag új kerete.
create or replace function public.office_allocate_in(
  p_office uuid, p_actor uuid, p_member uuid, p_delta integer, p_note text default null
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_actor  public.office_members%rowtype;
  v_target public.office_members%rowtype;
  v_free   integer;
  v_note   text := nullif(left(trim(coalesce(p_note, '')), 200), '');
begin
  if p_delta is null or p_delta = 0 then raise exception 'OFFICE_NOT_ALLOWED'; end if;

  -- 1. az iroda sora (zárolás) — a szabad rész számolásához
  perform 1 from public.offices where id = p_office for update;
  if not found then raise exception 'OFFICE_NOT_ALLOWED'; end if;

  -- 2. jogosultság
  select * into v_actor from public.office_members where user_id = p_actor and office_id = p_office;
  if not found or not (v_actor.role = 'owner' or v_actor.can_allocate) then raise exception 'OFFICE_NOT_ALLOWED'; end if;
  if p_actor = p_member and v_actor.role <> 'owner' then raise exception 'OFFICE_NOT_ALLOWED'; end if;

  -- 3. a cél-tag (zárolás)
  select * into v_target from public.office_members
   where user_id = p_member and office_id = p_office for update;
  if not found then raise exception 'OFFICE_NOT_ALLOWED'; end if;
  if v_target.role = 'owner' or v_target.unlimited then raise exception 'OFFICE_TARGET_UNLIMITED'; end if;

  -- 4. fedezet
  if p_delta > 0 then
    select f.free into v_free from public.office_free(p_office) f;
    if coalesce(v_free, 0) < p_delta then raise exception 'OFFICE_FREE_INSUFFICIENT'; end if;
  elsif v_target.allowance + p_delta < 0 then
    raise exception 'OFFICE_ALLOWANCE_LOW';
  end if;

  update public.office_members set allowance = allowance + p_delta
   where office_id = p_office and user_id = p_member;

  insert into public.office_ledger (office_id, kind, actor_id, member_id, amount, note)
  values (p_office, 'allocate', p_actor, p_member, p_delta, v_note);

  return v_target.allowance + p_delta;
end;
$$;

-- A régi, egy-irodás változat: mostantól a kiválasztott irodára továbbít,
-- ugyanazokkal a szabályokkal (nincs megkerülő út).
create or replace function public.office_allocate(
  p_actor uuid, p_member uuid, p_delta integer, p_note text default null
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_office uuid;
begin
  select c.office_id into v_office from public.user_office_context c where c.user_id = p_actor;
  if v_office is null then
    select office_id into v_office from public.office_members where user_id = p_actor order by joined_at limit 1;
  end if;
  if v_office is null then raise exception 'OFFICE_NOT_ALLOWED'; end if;
  return public.office_allocate_in(v_office, p_actor, p_member, p_delta, p_note);
end;
$$;


-- 3) Költés a KIVÁLASZTOTT irodából ----------------------------------------
--    Tag: a saját (lefoglalt) keretéből — az egyenleg és a keret is csökken.
--    Létrehozó / korlátlan: csak a SZABAD részből.
--    Visszatér: true = sikeres, false = nincs elég keret / szabad kredit.
create or replace function public.office_deduct(
  p_user uuid, p_amount integer, p_service text default null
)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_office uuid;
  v_bal    integer;
  v_m      public.office_members%rowtype;
  v_free   integer;
begin
  if p_amount is null or p_amount <= 0 then return false; end if;

  select office_id into v_office from public.user_office_context
   where user_id = p_user and use_office;
  if v_office is null then return false; end if;

  -- 1. iroda (zárolás), 2. tag (zárolás)
  select balance into v_bal from public.offices where id = v_office for update;
  if not found then return false; end if;
  select * into v_m from public.office_members
   where user_id = p_user and office_id = v_office for update;
  if not found then return false; end if;

  if v_m.role = 'owner' or v_m.unlimited then
    select f.free into v_free from public.office_free(v_office) f;
    if coalesce(v_free, 0) < p_amount then return false; end if;
  else
    if v_m.allowance < p_amount or v_bal < p_amount then return false; end if;
    update public.office_members set allowance = allowance - p_amount
     where office_id = v_office and user_id = p_user;
  end if;

  update public.offices set balance = balance - p_amount where id = v_office;

  insert into public.office_ledger (office_id, kind, actor_id, member_id, amount, service_id)
  values (v_office, 'spend', p_user, p_user, -p_amount, p_service);

  return true;
end;
$$;


-- 4) VÉDELEM + automatikus visszafoglalás az office_members táblán -----------
--    • Böngészőből (anon / authenticated szerep) semmilyen írás nem mehet át —
--      akkor sem, ha később valaki tévedésből írási policy-t adna a táblára.
--      (A szerver service_role-lal, a függvények SECURITY DEFINER-rel futnak.)
--    • Korlátlanná tételkor a maradék keret visszakerül a szabad részbe (naplózva).
--    • A létrehozó szerepe nem változtatható, és senki nem lehet „owner" utólag.
create or replace function public.office_members_guard()
returns trigger
language plpgsql security invoker set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'OFFICE_WRITE_FORBIDDEN';
  end if;

  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role then
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

drop trigger if exists office_members_guard_trg on public.office_members;
create trigger office_members_guard_trg
  before insert or update on public.office_members
  for each row execute function public.office_members_guard();

-- Segéd: létezik-e még a felhasználó (auth séma — definer joggal olvasva).
create or replace function public.office_user_exists(p_user uuid)
returns boolean
language sql security definer stable set search_path = public
as $$ select exists (select 1 from auth.users where id = p_user); $$;
revoke execute on function public.office_user_exists(uuid) from public, anon, authenticated;
grant execute on function public.office_user_exists(uuid) to service_role;

-- Eltávolításkor: a maradék keret visszakerül (naplózva). Ha maga az iroda
-- törlődik (kaszkád), nem naplózunk — akkor az iroda sora már nincs meg.
create or replace function public.office_members_on_delete()
returns trigger
language plpgsql security invoker set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'OFFICE_WRITE_FORBIDDEN';
  end if;
  if old.allowance > 0 and old.role <> 'owner' and not old.unlimited
     and exists (select 1 from public.offices where id = old.office_id) then
    insert into public.office_ledger (office_id, kind, actor_id, member_id, amount, note)
    -- Ha a felhasználói fiók törlése miatt tűnik el a tag, a user már nincs meg:
    -- akkor név nélkül naplózunk (különben a törlés elakadna).
    values (old.office_id, 'allocate', null,
            case when public.office_user_exists(old.user_id) then old.user_id end,
            -old.allowance,
            'Tag eltávolítva — a kerete visszakerült a szabad részbe');
  end if;
  return old;
end;
$$;

drop trigger if exists office_members_on_delete_trg on public.office_members;
create trigger office_members_on_delete_trg
  before delete on public.office_members
  for each row execute function public.office_members_on_delete();

-- Az iroda sora (egyenleg, kód) sem írható böngészőből.
create or replace function public.offices_guard()
returns trigger
language plpgsql security invoker set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'OFFICE_WRITE_FORBIDDEN';
  end if;
  if tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id then
    raise exception 'OFFICE_OWNER_LOCKED';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists offices_guard_trg on public.offices;
create trigger offices_guard_trg
  before insert or update or delete on public.offices
  for each row execute function public.offices_guard();

-- A napló csak bővülhet: böngészőből semmi, és utólag senki nem írhatja át
-- az összeget / szereplőket (a visszatérítés csak a megjegyzést jelöli).
create or replace function public.office_ledger_guard()
returns trigger
language plpgsql security invoker set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'OFFICE_WRITE_FORBIDDEN';
  end if;
  -- (A szereplő mezők NULL-ra állhatnak: ez a fiók-törlés „on delete set null" hatása.)
  if tg_op = 'UPDATE' and (new.amount is distinct from old.amount
       or new.office_id is distinct from old.office_id
       or (new.member_id is not null and new.member_id is distinct from old.member_id)
       or (new.actor_id  is not null and new.actor_id  is distinct from old.actor_id)
       or new.kind      is distinct from old.kind) then
    raise exception 'OFFICE_LEDGER_IMMUTABLE';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists office_ledger_guard_trg on public.office_ledger;
create trigger office_ledger_guard_trg
  before insert or update or delete on public.office_ledger
  for each row execute function public.office_ledger_guard();


-- 5) Olvasási jog: a VEZETŐ (kiosztó jogú tag) is látja az iroda sorát ------
--    (egyenleg + csatlakozási kód). Feltölteni továbbra is csak a létrehozó tud
--    — azt az API dönti el, az írás pedig csak szerverről mehet.
drop policy if exists "offices_select_owner" on public.offices;
drop policy if exists "offices_select_managers" on public.offices;
create policy "offices_select_managers" on public.offices
  for select using (owner_id = auth.uid() or public.is_office_manager(id) or public.is_admin());


-- 6) Index a tagonkénti napló-lekérdezésekhez ---------------------------------
create index if not exists office_ledger_member_idx
  on public.office_ledger (office_id, member_id, created_at desc);


-- 7) Jogok: csak a szerver hívhatja -----------------------------------------
revoke execute on function public.office_free(uuid) from public, anon, authenticated;
revoke execute on function public.office_allocate_in(uuid, uuid, uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.office_allocate(uuid, uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.office_deduct(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.office_free(uuid) to service_role;
grant execute on function public.office_allocate_in(uuid, uuid, uuid, integer, text) to service_role;
grant execute on function public.office_allocate(uuid, uuid, integer, text) to service_role;
grant execute on function public.office_deduct(uuid, integer, text) to service_role;


-- 8) Ellenőrzés: van-e olyan iroda, ahol a kiosztott keretek többek az egyenlegnél?
--    (Ott a „szabadon kiosztható" negatív — új kiosztás feltöltésig / visszavételig nem megy.)
select o.name, f.balance, f.allocated, f.free
  from public.offices o, lateral public.office_free(o.id) f
 where f.free < 0;
