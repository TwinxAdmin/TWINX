-- =====================================================================
-- Twinx — KÖZÖS MUNKATÉR (KM1): az irodai fiók második formája
-- Futtasd a Supabase SQL Editorban a 20261008104953_office-reserve.sql + 20261008121637_work-folders.sql UTÁN. Idempotens.
--
-- • offices.kind: 'office' (vezetős iroda, a mostani) / 'team' (közös munkatér, egyenrangú társak).
--   A közös munkatér azonnal létrejön (nincs office_requests sor), állandó kóddal, 2–5 taggal.
-- • office_transfers + team_wallet_transfer(): kredit ÁTADÁSA egy társnak a SAJÁT pénztárcából
--   (wallets) — atomikus, naplózott, visszavétel nincs.
-- • office_folder_items.expires_at: kilépés után a kilépő megosztott munkái 30 napig olvashatók
--   (soft-listing: a lista szűr rá, semmit nem törlünk).
-- • office_work_handovers + team_handover_works(): kilépés előtti munka-átadás — minden kipipált
--   társ SAJÁT PÉLDÁNYT kap (új usage_history sor, ugyanaz a fájl; a tárhelyről semmi nem törlődik).
-- • team_leave(): önkéntes kilépés a munkatérből (lejárat beállítása + tagság megszüntetése).
-- Minden függvény CSAK a szerverről (service_role) hívható — a route-ok ellenőrzik a hívót.
-- =====================================================================

-- 1) Az iroda formája ----------------------------------------------------
alter table public.offices add column if not exists kind text not null default 'office';
alter table public.offices drop constraint if exists offices_kind_chk;
alter table public.offices add constraint offices_kind_chk check (kind in ('office', 'team'));

-- Közös munkatér: legfeljebb 5 tag (a szerver is ellenőrzi, ez a végső védelem).
create or replace function public.office_team_size_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.offices where id = new.office_id and kind = 'team')
     and (select count(*) from public.office_members where office_id = new.office_id) >= 5 then
    raise exception 'TEAM_FULL';
  end if;
  return new;
end;
$$;

drop trigger if exists office_team_size_guard_trg on public.office_members;
create trigger office_team_size_guard_trg
  before insert on public.office_members
  for each row execute function public.office_team_size_guard();


-- 2) Kredit átadása társnak (saját pénztárcából) ------------------------
create table if not exists public.office_transfers (
  id          bigint generated always as identity primary key,
  office_id   uuid references public.offices (id) on delete set null,
  from_user   uuid references auth.users (id) on delete set null,
  to_user     uuid references auth.users (id) on delete set null,
  amount      integer not null check (amount > 0),
  note        text check (note is null or char_length(note) <= 200),
  created_at  timestamptz not null default now()
);
create index if not exists office_transfers_from_idx on public.office_transfers (from_user, created_at desc);
create index if not exists office_transfers_to_idx on public.office_transfers (to_user, created_at desc);

alter table public.office_transfers enable row level security;
-- Mindenki csak a SAJÁT átadásait látja (amit adott vagy kapott); írni csak a szerver tud.
drop policy if exists "office_transfers_select_own" on public.office_transfers;
create policy "office_transfers_select_own" on public.office_transfers
  for select using (from_user = auth.uid() or to_user = auth.uid() or public.is_admin());

-- Visszatér: a küldő új egyenlege. Hibakódok: TEAM_NOT_FOUND, TEAM_NOT_MEMBER, TEAM_SELF,
-- TEAM_AMOUNT, TEAM_NO_FUNDS — a szerver magyar üzenetre fordítja.
create or replace function public.team_wallet_transfer(
  p_office  uuid,
  p_from    uuid,
  p_to      uuid,
  p_amount  integer,
  p_note    text default null
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_left integer;
begin
  if not exists (select 1 from public.offices where id = p_office and kind = 'team') then
    raise exception 'TEAM_NOT_FOUND';
  end if;
  if p_from = p_to then
    raise exception 'TEAM_SELF';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 9999 then
    raise exception 'TEAM_AMOUNT';
  end if;
  if (select count(*) from public.office_members
       where office_id = p_office and user_id in (p_from, p_to)) < 2 then
    raise exception 'TEAM_NOT_MEMBER';
  end if;

  -- levonás csak akkor, ha van elég (sorzár: két egyidejű átadás sem viheti mínuszba)
  update public.wallets
     set balance = balance - p_amount, updated_at = now()
   where user_id = p_from and balance >= p_amount
  returning balance into v_left;
  if v_left is null then
    raise exception 'TEAM_NO_FUNDS';
  end if;

  perform public.wallet_add(p_to, p_amount);

  insert into public.office_transfers (office_id, from_user, to_user, amount, note)
  values (p_office, p_from, p_to, p_amount, nullif(left(trim(coalesce(p_note, '')), 200), ''));

  return v_left;
end;
$$;


-- 3) Kilépés után 30 napig olvasható megosztások -----------------------
alter table public.office_folder_items add column if not exists expires_at timestamptz;
create index if not exists office_folder_items_expires_idx
  on public.office_folder_items (expires_at) where expires_at is not null;


-- 4) Munka-átadás kilépés előtt (saját példány minden kipipált társnak) --
create table if not exists public.office_work_handovers (
  id              bigint generated always as identity primary key,
  office_id       uuid references public.offices (id) on delete set null,
  from_user       uuid references auth.users (id) on delete set null,
  to_user         uuid references auth.users (id) on delete set null,
  source_history  uuid references public.usage_history (id) on delete set null,
  new_history     uuid references public.usage_history (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists office_work_handovers_to_idx on public.office_work_handovers (to_user, created_at desc);

alter table public.office_work_handovers enable row level security;
drop policy if exists "office_work_handovers_select_own" on public.office_work_handovers;
create policy "office_work_handovers_select_own" on public.office_work_handovers
  for select using (from_user = auth.uid() or to_user = auth.uid() or public.is_admin());

-- Visszatér: hány új példány készült. Csak a kilépő SAJÁT, nem elrejtett munkái adhatók át,
-- csak a munkatér tagjainak (önmagának nem). Max. 50 munka × 4 társ egy hívásban.
create or replace function public.team_handover_works(
  p_office      uuid,
  p_from        uuid,
  p_history_ids uuid[],
  p_recipients  uuid[]
)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  r      public.usage_history%rowtype;
  c      public.usage_history%rowtype;
  v_to   uuid;
  v_new  uuid;
  v_cnt  integer := 0;
begin
  if not exists (select 1 from public.offices where id = p_office and kind = 'team') then
    raise exception 'TEAM_NOT_FOUND';
  end if;
  if not exists (select 1 from public.office_members where office_id = p_office and user_id = p_from) then
    raise exception 'TEAM_NOT_MEMBER';
  end if;
  if coalesce(array_length(p_history_ids, 1), 0) = 0 or coalesce(array_length(p_recipients, 1), 0) = 0 then
    return 0;
  end if;
  if array_length(p_history_ids, 1) > 50 or array_length(p_recipients, 1) > 4 then
    raise exception 'TEAM_HANDOVER_LIMIT';
  end if;
  if p_from = any (p_recipients)
     or (select count(*) from public.office_members
          where office_id = p_office and user_id = any (p_recipients)) <> (select count(distinct x) from unnest(p_recipients) x) then
    raise exception 'TEAM_NOT_MEMBER';
  end if;

  for r in
    select * from public.usage_history
     where id = any (p_history_ids) and user_id = p_from and hidden_at is null
  loop
    foreach v_to in array (select array_agg(distinct x) from unnest(p_recipients) x)
    loop
      -- a teljes sor másolata (minden oszlop, a későbbiek is), új azonosítóval és gazdával;
      -- a küldő saját könyvtár-mappáira mutató hivatkozások nem jönnek át
      v_new := gen_random_uuid();
      c := r;
      c.id := v_new;
      c.user_id := v_to;
      c.created_at := now();
      c.hidden_at := null;
      c.folder_id := null;
      c.valuation_folder_id := null;
      c.office_id := p_office;
      insert into public.usage_history select c.*;
      insert into public.office_work_handovers (office_id, from_user, to_user, source_history, new_history)
      values (p_office, p_from, v_to, r.id, v_new);
      v_cnt := v_cnt + 1;
    end loop;
  end loop;

  return v_cnt;
end;
$$;


-- 5) Önkéntes kilépés a közös munkatérből --------------------------------
-- A kilépő közös mappákba tett munkái 30 napig még látszanak (expires_at), a mappa-tagságai
-- és a tagsága megszűnnek, a kiválasztott iroda nála törlődik. Az iroda sora marad.
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


-- 6) Jogosultság: a függvényeket csak a szerver hívhatja ----------------
revoke execute on function public.team_wallet_transfer(uuid, uuid, uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.team_handover_works(uuid, uuid, uuid[], uuid[]) from public, anon, authenticated;
revoke execute on function public.team_leave(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.office_team_size_guard() from public, anon, authenticated;
grant execute on function public.team_wallet_transfer(uuid, uuid, uuid, integer, text) to service_role;
grant execute on function public.team_handover_works(uuid, uuid, uuid[], uuid[]) to service_role;
grant execute on function public.team_leave(uuid, uuid) to service_role;
