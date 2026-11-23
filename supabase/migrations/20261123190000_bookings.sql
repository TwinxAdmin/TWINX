-- Ingyenes felmérés: időpontok és foglalások (D33, D37, D48; terv: docs/terv/15-foglalas-terv.md).
--
-- Csak ÚJ táblák és függvények (additív, D51); a meglévő táblák (leads is) érintetlenek.
-- Visszacsinálás: supabase/down/20261123190000_bookings.down.sql
--
-- Biztonság: minden táblán RLS; olvasni csak az admin tud (is_admin()), írni senki közvetlenül.
-- Minden módosítás az alábbi függvényeken át megy, amiket CSAK a szerver (service_role) hívhat;
-- az admin-jogot az API-végpont ellenőrzi, a függvény a műveletet és a naplót egy tranzakcióban végzi.
-- Időzóna: Europe/Budapest (a heti sablon helyi időben számol, óraátállításkor sem csúszik).
-- Újrafuttatható.

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- 1) Gazdák: melyik admin vehet fel időpontot, és milyen néven látja a látogató („Márk", „Tibor").
-- ---------------------------------------------------------------------------
create table if not exists public.booking_hosts (
  user_id      uuid primary key references public.profiles (id) on delete restrict,
  display_name text not null check (char_length(display_name) between 1 and 40),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
alter table public.booking_hosts enable row level security;

-- ---------------------------------------------------------------------------
-- 2) Heti sablon gazdánként (weekday: 1 = hétfő … 7 = vasárnap; helyi idő).
-- ---------------------------------------------------------------------------
create table if not exists public.availability_templates (
  id           uuid primary key default gen_random_uuid(),
  host_id      uuid not null references public.booking_hosts (user_id) on delete cascade,
  weekday      smallint not null check (weekday between 1 and 7),
  start_time   time not null,
  end_time     time not null,
  slot_minutes integer not null default 45 check (slot_minutes between 15 and 240),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  check (end_time > start_time)
);
create index if not exists availability_templates_host_idx on public.availability_templates (host_id);
alter table public.availability_templates enable row level security;

-- ---------------------------------------------------------------------------
-- 3) Konkrét időpontok. Az ends_at-et trigger tölti (index-kifejezésben nem számolhatunk időt).
--    Ugyanannak a gazdának két nem törölt időpontja nem fedheti egymást (kizáró megszorítás).
-- ---------------------------------------------------------------------------
create table if not exists public.availability_slots (
  id           uuid primary key default gen_random_uuid(),
  host_id      uuid not null references public.booking_hosts (user_id) on delete restrict,
  starts_at    timestamptz not null,
  duration_min integer not null default 45 check (duration_min between 15 and 240),
  ends_at      timestamptz not null,
  status       text not null default 'szabad' check (status in ('szabad', 'foglalt', 'torolve')),
  template_id  uuid references public.availability_templates (id) on delete set null,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create or replace function public.availability_slots_set_end()
returns trigger language plpgsql set search_path = public as $$
begin
  new.ends_at := new.starts_at + make_interval(mins => new.duration_min);
  return new;
end $$;
drop trigger if exists availability_slots_set_end_trg on public.availability_slots;
create trigger availability_slots_set_end_trg
  before insert or update of starts_at, duration_min on public.availability_slots
  for each row execute function public.availability_slots_set_end();

do $$ begin
  alter table public.availability_slots add constraint availability_slots_no_overlap
    exclude using gist (host_id with =, tstzrange(starts_at, ends_at) with &&) where (status <> 'torolve');
exception when duplicate_object or duplicate_table then null; end $$;
create index if not exists availability_slots_free_idx on public.availability_slots (starts_at) where status = 'szabad';
alter table public.availability_slots enable row level security;

-- ---------------------------------------------------------------------------
-- 4) Foglalások és visszahívási kérések. A message KÜLSŐ, nem megbízható bemenet.
--    company_id: a Cég-tábla (terv 14) még nincs meg — a külső kulcsot az a migráció adja hozzá.
-- ---------------------------------------------------------------------------
create table if not exists public.bookings (
  id                   uuid primary key default gen_random_uuid(),
  kind                 text not null check (kind in ('idopont', 'visszahivas')),
  slot_id              uuid references public.availability_slots (id) on delete set null,
  host_id              uuid references public.booking_hosts (user_id) on delete set null,
  starts_at            timestamptz,                 -- másolat az időpontról (a levelekhez és a listához)
  name                 text not null check (char_length(name) between 1 and 120),
  company_name         text not null check (char_length(company_name) between 1 and 160),
  email                text not null check (char_length(email) between 3 and 254),
  phone                text not null check (char_length(phone) between 6 and 20),
  message              text check (message is null or char_length(message) <= 1000),
  status               text not null default 'uj'
                       check (status in ('uj', 'egyeztetve', 'megtartva', 'cegge_alakitva', 'elvetve', 'lemondva')),
  user_id              uuid references auth.users (id) on delete set null,
  company_id           uuid,
  source               text not null default 'fooldal' check (source in ('fooldal', 'referencia', 'kezdolap')),
  gdpr_consent_at      timestamptz not null,
  consent_version      text not null,
  cancel_token_hash    text,
  canceled_at          timestamptz,
  canceled_by          text check (canceled_by is null or canceled_by in ('latogato', 'admin')),
  visitor_mail_sent_at timestamptz,
  admin_notified_at    timestamptz,
  admin_note           text check (admin_note is null or char_length(admin_note) <= 2000),
  handled_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check ((kind = 'idopont') = (starts_at is not null))
);
-- Egy e-mail címmel / telefonszámmal egyszerre egy aktív foglalás; egy időponthoz egy aktív foglalás.
create unique index if not exists bookings_active_email_uq on public.bookings (email) where status in ('uj', 'egyeztetve');
create unique index if not exists bookings_active_phone_uq on public.bookings (phone) where status in ('uj', 'egyeztetve');
create unique index if not exists bookings_active_slot_uq  on public.bookings (slot_id) where status in ('uj', 'egyeztetve') and slot_id is not null;
create unique index if not exists bookings_cancel_token_uq on public.bookings (cancel_token_hash) where cancel_token_hash is not null;
create index if not exists bookings_created_idx on public.bookings (created_at desc);
alter table public.bookings enable row level security;

-- A foglalás története (Admin → Foglalások, kibontott sor).
create table if not exists public.booking_events (
  id         bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  actor      text not null,          -- 'latogato' | 'admin' | 'rendszer'
  actor_id   uuid,
  kind       text not null,          -- letrehozva | allapot | lemondva | ertesites | jegyzet
  data       jsonb,
  created_at timestamptz not null default now()
);
create index if not exists booking_events_booking_idx on public.booking_events (booking_id, created_at);
alter table public.booking_events enable row level security;

-- Sebességkorlát a nyilvános foglaláshoz (IP-hash és e-mail szerint; az API számol belőle).
create table if not exists public.booking_attempts (
  id         bigint generated always as identity primary key,
  ip_hash    text not null,
  email      text,
  created_at timestamptz not null default now()
);
create index if not exists booking_attempts_ip_idx on public.booking_attempts (ip_hash, created_at desc);
alter table public.booking_attempts enable row level security;

-- ---------------------------------------------------------------------------
-- RLS: csak az admin olvas (a látogató és a sima felhasználó semmit). Írni senki közvetlenül.
-- A cancel_token_hash a kliens felé sosem megy ki: az admin felület is a szerveren át, oszlop-listával olvas.
-- ---------------------------------------------------------------------------
drop policy if exists booking_hosts_admin_read on public.booking_hosts;
create policy booking_hosts_admin_read on public.booking_hosts for select using (public.is_admin());
drop policy if exists availability_templates_admin_read on public.availability_templates;
create policy availability_templates_admin_read on public.availability_templates for select using (public.is_admin());
drop policy if exists availability_slots_admin_read on public.availability_slots;
create policy availability_slots_admin_read on public.availability_slots for select using (public.is_admin());
drop policy if exists bookings_admin_read on public.bookings;
create policy bookings_admin_read on public.bookings for select using (public.is_admin());
drop policy if exists booking_events_admin_read on public.booking_events;
create policy booking_events_admin_read on public.booking_events for select using (public.is_admin());
-- booking_attempts: policy nélkül, csak a szerver.

-- ---------------------------------------------------------------------------
-- Segédfüggvény: telefonszám normalizálása (+36 20 …, 0620 …, 06 20 …, 36 20 … → +3620…).
-- ---------------------------------------------------------------------------
create or replace function public.booking_normalize_phone(p text)
returns text language plpgsql immutable set search_path = public as $$
declare d text := regexp_replace(coalesce(p, ''), '[^0-9+]', '', 'g');
begin
  if d like '+%' then return '+' || regexp_replace(substr(d, 2), '[^0-9]', '', 'g'); end if;
  d := regexp_replace(d, '[^0-9]', '', 'g');
  if d like '00%' then return '+' || substr(d, 3); end if;
  if d like '06%' then return '+36' || substr(d, 3); end if;
  if d like '36%' and char_length(d) >= 10 then return '+' || d; end if;
  return d;
end $$;

-- ---------------------------------------------------------------------------
-- Nyilvános szabad-időpont lista: csak időpont-kulcs, kezdés, hossz és a gazda megjelenített neve.
-- Legkorábban 24 óra múlva, legfeljebb 30 napra előre.
-- ---------------------------------------------------------------------------
create or replace function public.booking_free_slots()
returns table (slot_id uuid, starts_at timestamptz, duration_min integer, host_name text)
language sql stable security definer set search_path = public as $$
  select s.id, s.starts_at, s.duration_min, h.display_name
  from public.availability_slots s
  join public.booking_hosts h on h.user_id = s.host_id and h.active
  where s.status = 'szabad'
    and s.starts_at >= now() + interval '24 hours'
    and s.starts_at <= now() + interval '30 days'
  order by s.starts_at, h.display_name;
$$;

-- ---------------------------------------------------------------------------
-- Foglalás létrehozása (időpontos vagy visszahívási). Hibakódok:
--   idopont_elkelt · mar_van_foglalas · ervenytelen_idopont
-- ---------------------------------------------------------------------------
create or replace function public.create_booking(
  p_slot_id uuid, p_name text, p_company text, p_email text, p_phone text, p_message text,
  p_user_id uuid, p_source text, p_consent_version text, p_cancel_token_hash text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v_phone text := public.booking_normalize_phone(p_phone);
  v_slot  public.availability_slots%rowtype;
  v_host  text;
  v_id    uuid;
begin
  if exists (select 1 from public.bookings
             where status in ('uj', 'egyeztetve') and (email = v_email or phone = v_phone)) then
    return jsonb_build_object('ok', false, 'error', 'mar_van_foglalas');
  end if;

  if p_slot_id is not null then
    select * into v_slot from public.availability_slots where id = p_slot_id for update;
    if not found then return jsonb_build_object('ok', false, 'error', 'ervenytelen_idopont'); end if;
    if v_slot.status <> 'szabad' then return jsonb_build_object('ok', false, 'error', 'idopont_elkelt'); end if;
    if v_slot.starts_at < now() + interval '24 hours' or v_slot.starts_at > now() + interval '30 days' then
      return jsonb_build_object('ok', false, 'error', 'ervenytelen_idopont');
    end if;
    select display_name into v_host from public.booking_hosts where user_id = v_slot.host_id and active;
    if v_host is null then return jsonb_build_object('ok', false, 'error', 'ervenytelen_idopont'); end if;
  end if;

  insert into public.bookings (kind, slot_id, host_id, starts_at, name, company_name, email, phone, message,
                               user_id, source, gdpr_consent_at, consent_version, cancel_token_hash)
  values (case when p_slot_id is null then 'visszahivas' else 'idopont' end,
          p_slot_id, v_slot.host_id, v_slot.starts_at, trim(p_name), trim(p_company), v_email, v_phone,
          nullif(trim(coalesce(p_message, '')), ''), p_user_id, coalesce(p_source, 'fooldal'), now(),
          p_consent_version, p_cancel_token_hash)
  returning id into v_id;

  if p_slot_id is not null then
    update public.availability_slots set status = 'foglalt' where id = p_slot_id;
  end if;

  insert into public.booking_events (booking_id, actor, actor_id, kind) values (v_id, 'latogato', p_user_id, 'letrehozva');

  return jsonb_build_object('ok', true, 'booking_id', v_id, 'starts_at', v_slot.starts_at,
                            'duration_min', v_slot.duration_min, 'host_name', v_host);
exception when unique_violation then
  -- Párhuzamos kérés: vagy az időpont kelt el, vagy ugyanaz a cím/telefon foglalt közben.
  if p_slot_id is not null and exists (select 1 from public.bookings
       where slot_id = p_slot_id and status in ('uj', 'egyeztetve')) then
    return jsonb_build_object('ok', false, 'error', 'idopont_elkelt');
  end if;
  return jsonb_build_object('ok', false, 'error', 'mar_van_foglalas');
end $$;

-- Közös belső lépés: aktív foglalás lemondása + az időpont felszabadítása (ha még a jövőben van).
create or replace function public.booking_cancel_internal(p_booking_id uuid, p_by text, p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b public.bookings%rowtype;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found or b.status not in ('uj', 'egyeztetve') then
    return jsonb_build_object('ok', false, 'error', 'ervenytelen');
  end if;
  update public.bookings
     set status = 'lemondva', canceled_at = now(), canceled_by = p_by, cancel_token_hash = null, updated_at = now(),
         handled_by = case when p_by = 'admin' then p_actor_id else handled_by end
   where id = b.id;
  if b.slot_id is not null then
    update public.availability_slots set status = 'szabad'
     where id = b.slot_id and status = 'foglalt' and starts_at > now();
  end if;
  insert into public.booking_events (booking_id, actor, actor_id, kind) values (b.id, p_by, p_actor_id, 'lemondva');
  return jsonb_build_object('ok', true, 'booking_id', b.id, 'kind', b.kind, 'starts_at', b.starts_at,
                            'email', b.email, 'name', b.name, 'company_name', b.company_name, 'host_id', b.host_id);
end $$;

-- Lemondás a látogató linkjéből: a token-hash egyezik, a foglalás aktív, az időpont még nem kezdődött el.
create or replace function public.cancel_booking_by_token(p_token_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b public.bookings%rowtype;
begin
  select * into b from public.bookings
   where cancel_token_hash = p_token_hash and status in ('uj', 'egyeztetve') for update;
  if not found or (b.starts_at is not null and b.starts_at <= now()) then
    return jsonb_build_object('ok', false, 'error', 'ervenytelen');
  end if;
  return public.booking_cancel_internal(b.id, 'latogato', null);
end $$;

-- Lemondás az adminból.
create or replace function public.admin_cancel_booking(p_booking_id uuid, p_admin_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return public.booking_cancel_internal(p_booking_id, 'admin', p_admin_id);
end $$;

-- Állapotváltás az állapotgép szerint (a Céggé alakítás külön függvény lesz a Cég-táblával, terv 14).
--   uj → egyeztetve | megtartva | elvetve ;  egyeztetve → megtartva | elvetve ;  megtartva → elvetve
create or replace function public.admin_set_booking_status(p_booking_id uuid, p_status text, p_admin_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b public.bookings%rowtype;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if not ((b.status = 'uj' and p_status in ('egyeztetve', 'megtartva', 'elvetve'))
       or (b.status = 'egyeztetve' and p_status in ('megtartva', 'elvetve'))
       or (b.status = 'megtartva' and p_status = 'elvetve')) then
    return jsonb_build_object('ok', false, 'error', 'tiltott_valtas');
  end if;
  update public.bookings
     set status = p_status, handled_by = p_admin_id, updated_at = now(),
         cancel_token_hash = case when p_status in ('uj', 'egyeztetve') then cancel_token_hash else null end
   where id = b.id;
  -- Elvetéskor a még jövőbeli időpont felszabadul.
  if p_status = 'elvetve' and b.slot_id is not null then
    update public.availability_slots set status = 'szabad'
     where id = b.slot_id and status = 'foglalt' and starts_at > now();
  end if;
  insert into public.booking_events (booking_id, actor, actor_id, kind, data)
  values (b.id, 'admin', p_admin_id, 'allapot', jsonb_build_object('from', b.status, 'to', p_status));
  return jsonb_build_object('ok', true);
end $$;

-- Heti sablon alkalmazása a következő p_weeks hétre (helyi időben). Ismételhető: a meglévőt és az
-- átfedőt kihagyja (ON CONFLICT DO NOTHING a kizáró megszorításra is érvényes), a foglaltakhoz nem nyúl.
create or replace function public.admin_apply_templates(p_admin_id uuid, p_weeks integer default 4)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Europe/Budapest')::date;
  v_day   date;
  t       record;
  v_time  time;
  v_n     integer := 0;
  v_rows  integer;
begin
  for v_day in select v_today + i from generate_series(1, 7 * greatest(1, least(p_weeks, 8))) as i loop
    for t in select tp.* from public.availability_templates tp
             join public.booking_hosts h on h.user_id = tp.host_id and h.active
             where tp.active and tp.weekday = extract(isodow from v_day)::int loop
      v_time := t.start_time;
      while v_time + make_interval(mins => t.slot_minutes) <= t.end_time
            and v_time + make_interval(mins => t.slot_minutes) > v_time loop  -- éjfél-átfordulás ellen
        insert into public.availability_slots (host_id, starts_at, duration_min, template_id, created_by)
        values (t.host_id, (v_day + v_time) at time zone 'Europe/Budapest', t.slot_minutes, t.id, p_admin_id)
        on conflict do nothing;
        get diagnostics v_rows = row_count;
        v_n := v_n + v_rows;
        v_time := v_time + make_interval(mins => t.slot_minutes);
      end loop;
    end loop;
  end loop;
  return v_n;
end $$;

-- Egy időpont kézi felvétele. Hibakód: atfedes, multbeli, nincs_gazda.
create or replace function public.admin_add_slot(p_host_id uuid, p_starts_at timestamptz, p_duration integer, p_admin_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.booking_hosts where user_id = p_host_id) then
    return jsonb_build_object('ok', false, 'error', 'nincs_gazda');
  end if;
  if p_starts_at <= now() then return jsonb_build_object('ok', false, 'error', 'multbeli'); end if;
  insert into public.availability_slots (host_id, starts_at, duration_min, created_by)
  values (p_host_id, p_starts_at, coalesce(p_duration, 45), p_admin_id)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'slot_id', v_id);
exception when exclusion_violation or unique_violation then
  return jsonb_build_object('ok', false, 'error', 'atfedes');
end $$;

-- Időpont törlése. Lefoglalt időpontnál előbb a foglalás lemondása kell (p_cancel_booking = true);
-- ilyenkor a visszaadott booking alapján a szerver értesíti a látogatót.
create or replace function public.admin_delete_slot(p_slot_id uuid, p_admin_id uuid, p_cancel_booking boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.availability_slots%rowtype;
  v_booking uuid;
  v_res jsonb := null;
begin
  select * into s from public.availability_slots where id = p_slot_id for update;
  if not found or s.status = 'torolve' then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if s.status = 'foglalt' then
    select id into v_booking from public.bookings where slot_id = s.id and status in ('uj', 'egyeztetve');
    if v_booking is not null then
      if not p_cancel_booking then return jsonb_build_object('ok', false, 'error', 'foglalt'); end if;
      v_res := public.booking_cancel_internal(v_booking, 'admin', p_admin_id);
    end if;
  end if;
  update public.availability_slots set status = 'torolve' where id = s.id;
  return jsonb_build_object('ok', true, 'canceled', v_res);
end $$;

-- ---------------------------------------------------------------------------
-- Jogok: a függvényeket csak a szerver (service_role) hívhatja.
-- ---------------------------------------------------------------------------
revoke all on function public.booking_free_slots() from public, anon, authenticated;
revoke all on function public.create_booking(uuid, text, text, text, text, text, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.booking_cancel_internal(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.cancel_booking_by_token(text) from public, anon, authenticated;
revoke all on function public.admin_cancel_booking(uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_set_booking_status(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.admin_apply_templates(uuid, integer) from public, anon, authenticated;
revoke all on function public.admin_add_slot(uuid, timestamptz, integer, uuid) from public, anon, authenticated;
revoke all on function public.admin_delete_slot(uuid, uuid, boolean) from public, anon, authenticated;

grant execute on function public.booking_free_slots() to service_role;
grant execute on function public.create_booking(uuid, text, text, text, text, text, uuid, text, text, text) to service_role;
grant execute on function public.booking_cancel_internal(uuid, text, uuid) to service_role;
grant execute on function public.cancel_booking_by_token(text) to service_role;
grant execute on function public.admin_cancel_booking(uuid, uuid) to service_role;
grant execute on function public.admin_set_booking_status(uuid, text, uuid) to service_role;
grant execute on function public.admin_apply_templates(uuid, integer) to service_role;
grant execute on function public.admin_add_slot(uuid, timestamptz, integer, uuid) to service_role;
grant execute on function public.admin_delete_slot(uuid, uuid, boolean) to service_role;
