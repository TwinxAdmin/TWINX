-- Modul lemondása, cég lezárása, ügyféladat törlése / visszaadása, újranyitás (terv 21, D54).
--
-- Additív (D51): új táblák (customer_data_requests, deletion_approvers) és függvények; a companies / company_modules
-- lezárási és lemondási oszlopai már megvannak (20261123220000, 20261124090000). Néhány meglévő függvény új
-- változatot kap (lemondott modulnál nincs új meghívó / „Használom én is”, nem hosszabbít a „Fizetve”, nincs
-- lejárati figyelmeztetés; a hozzáférés a lemondás hatályos napjáig él).
-- Alapelv: lemondás / lezárás SOHA nem töröl kódot, regisztert vagy modul-konfigurációt; csak a cég-hozzárendelést
-- (archív állapot) és — kétlépéses jóváhagyással — az ügyféladatot.
-- Visszacsinálás: supabase/down/20261124180000_closure.down.sql
-- Újrafuttatható.

-- ---------------------------------------------------------------------------
-- 1) Táblák
-- ---------------------------------------------------------------------------
create table if not exists public.deletion_approvers (
  user_id  uuid primary key references public.profiles (id) on delete cascade,
  active   boolean not null default true,
  added_by uuid references public.profiles (id) on delete set null,
  added_at timestamptz not null default now()
);
alter table public.deletion_approvers enable row level security;

create table if not exists public.customer_data_requests (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  mode            text not null default 'torles' check (mode = 'torles'),
  status          text not null default 'kerve'
                  check (status in ('kerve', 'jovahagyva', 'elutasitva', 'visszavonva', 'reszben_vegrehajtva', 'vegrehajtva')),
  reason          text not null check (char_length(reason) between 1 and 1000),
  before_deadline boolean not null default false,
  requested_by    uuid references public.profiles (id) on delete set null,
  requested_at    timestamptz not null default now(),
  approved_by     uuid references public.profiles (id) on delete set null,
  approved_at     timestamptz,
  rejected_reason text,
  executed_at     timestamptz,
  result_summary  jsonb               -- modulonként mit töröltünk / mit nem — ügyféladatot NEM tartalmaz
);
create unique index if not exists customer_data_requests_open_uq on public.customer_data_requests (company_id)
  where status in ('kerve', 'jovahagyva', 'reszben_vegrehajtva');
alter table public.customer_data_requests enable row level security;

drop policy if exists deletion_approvers_admin on public.deletion_approvers;
create policy deletion_approvers_admin on public.deletion_approvers for select using (public.is_admin());
drop policy if exists customer_data_requests_admin on public.customer_data_requests;
create policy customer_data_requests_admin on public.customer_data_requests for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 2) A hozzáférés a lemondás hatályos napjáig él (module_is_live és user_has_module_access új változata)
-- ---------------------------------------------------------------------------
create or replace function public.module_is_live(p_cm uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_modules cm join public.companies c on c.id = cm.company_id and c.status = 'aktiv'
                 where cm.id = p_cm and cm.state = 'aktiv'
                   and cm.valid_until is not null and cm.valid_until >= (now() at time zone 'Europe/Budapest')::date
                   and (cm.cancel_effective_on is null or cm.cancel_effective_on >= (now() at time zone 'Europe/Budapest')::date));
$$;

create or replace function public.user_has_module_access(p_user uuid, p_cm uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.module_is_live(p_cm) and exists (
    select 1 from public.module_access a
    join public.company_modules cm on cm.id = a.company_module_id
    join public.company_members m on m.company_id = cm.company_id and m.user_id = a.user_id and m.status = 'aktiv'
    where a.company_module_id = p_cm and a.user_id = p_user and a.status = 'aktiv'
  );
$$;

-- ---------------------------------------------------------------------------
-- 3) Meglévő függvények új változata (lemondott modul)
-- ---------------------------------------------------------------------------
create or replace function public.create_invitation(p_actor uuid, p_cm uuid, p_email text, p_token_hash text, p_days integer default 7)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cm public.company_modules%rowtype; v_email text := lower(trim(p_email)); v_id uuid; v_recent integer;
begin
  select * into cm from public.company_modules where id = p_cm for update;   -- zárolás: helyszámítás tranzakcióban
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if not (public.require_admin(p_actor) or public.is_head_of(p_actor, cm.company_id)) then
    return jsonb_build_object('ok', false, 'error', 'nem_cegvezeto');
  end if;
  if not public.module_is_live(p_cm) then return jsonb_build_object('ok', false, 'error', 'modul_nem_aktiv'); end if;
  if cm.cancel_requested_at is not null then return jsonb_build_object('ok', false, 'error', 'modul_lemondva'); end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' or char_length(v_email) > 254 then
    return jsonb_build_object('ok', false, 'error', 'ervenytelen_email');
  end if;
  -- Küldési korlát: cégenként óránként legfeljebb 20 meghívó (újraküldéssel együtt).
  select count(*) into v_recent from public.module_invitations
   where company_id = cm.company_id and (created_at > now() - interval '1 hour' or last_sent_at > now() - interval '1 hour');
  if v_recent >= 20 then return jsonb_build_object('ok', false, 'error', 'tul_sok_meghivo'); end if;
  if exists (select 1 from public.module_access a join auth.users u on u.id = a.user_id
             where a.company_module_id = p_cm and a.status = 'aktiv' and lower(u.email) = v_email) then
    return jsonb_build_object('ok', false, 'error', 'mar_hozzafer');
  end if;
  -- A lejárt, még „meghivva" státuszú meghívót lezárjuk, hogy ne akadályozza az újat.
  update public.module_invitations set status = 'lejart'
   where company_module_id = p_cm and email = v_email and status = 'meghivva' and expires_at <= now();
  if exists (select 1 from public.module_invitations where company_module_id = p_cm and email = v_email and status = 'meghivva') then
    return jsonb_build_object('ok', false, 'error', 'mar_meghivva');
  end if;
  if public.module_seats_used(p_cm) >= cm.seats then return jsonb_build_object('ok', false, 'error', 'nincs_szabad_hely'); end if;
  insert into public.module_invitations (company_module_id, company_id, module_key, email, token_hash, invited_by, expires_at, last_sent_at)
  values (p_cm, cm.company_id, cm.module_key, v_email, p_token_hash, p_actor,
          now() + make_interval(days => greatest(1, least(coalesce(p_days, 7), 30))), now())
  returning id into v_id;
  insert into public.access_audit_log (actor_id, action, company_id, module_key, target_email)
  values (p_actor, 'meghivva', cm.company_id, cm.module_key, v_email);
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.resend_invitation(p_actor uuid, p_inv uuid, p_token_hash text, p_days integer default 7)
returns jsonb language plpgsql security definer set search_path = public as $$
declare i public.module_invitations%rowtype; cm public.company_modules%rowtype; v_recent integer;
begin
  select * into i from public.module_invitations where id = p_inv;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  select * into cm from public.company_modules where id = i.company_module_id for update;
  select * into i from public.module_invitations where id = p_inv for update;
  if not (public.require_admin(p_actor) or public.is_head_of(p_actor, cm.company_id)) then
    return jsonb_build_object('ok', false, 'error', 'nem_cegvezeto');
  end if;
  if i.status not in ('meghivva', 'lejart') then return jsonb_build_object('ok', false, 'error', 'meghivo_ervenytelen'); end if;
  if not public.module_is_live(cm.id) then return jsonb_build_object('ok', false, 'error', 'modul_nem_aktiv'); end if;
  if cm.cancel_requested_at is not null then return jsonb_build_object('ok', false, 'error', 'modul_lemondva'); end if;
  select count(*) into v_recent from public.module_invitations
   where company_id = cm.company_id and (created_at > now() - interval '1 hour' or last_sent_at > now() - interval '1 hour');
  if v_recent >= 20 then return jsonb_build_object('ok', false, 'error', 'tul_sok_meghivo'); end if;
  -- Ha a meghívó már nem foglal helyet (lejárt), újranyitáskor szabad hely kell.
  if (i.status = 'lejart' or i.expires_at <= now()) and public.module_seats_used(cm.id) >= cm.seats then
    return jsonb_build_object('ok', false, 'error', 'nincs_szabad_hely');
  end if;
  update public.module_invitations
     set token_hash = p_token_hash, status = 'meghivva', last_sent_at = now(), resend_count = resend_count + 1,
         expires_at = now() + make_interval(days => greatest(1, least(coalesce(p_days, 7), 30)))
   where id = p_inv;
  insert into public.access_audit_log (actor_id, action, company_id, module_key, target_email)
  values (p_actor, 'meghivo_ujrakuldve', cm.company_id, cm.module_key, i.email);
  return jsonb_build_object('ok', true, 'email', i.email);
end $$;

create or replace function public.add_self_access(p_actor uuid, p_cm uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cm public.company_modules%rowtype;
begin
  select * into cm from public.company_modules where id = p_cm for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if not public.is_head_of(p_actor, cm.company_id) then return jsonb_build_object('ok', false, 'error', 'nem_cegvezeto'); end if;
  if not public.module_is_live(p_cm) then return jsonb_build_object('ok', false, 'error', 'modul_nem_aktiv'); end if;
  if cm.cancel_requested_at is not null then return jsonb_build_object('ok', false, 'error', 'modul_lemondva'); end if;
  if exists (select 1 from public.module_access where company_module_id = p_cm and user_id = p_actor and status = 'aktiv') then
    return jsonb_build_object('ok', false, 'error', 'mar_hozzafer');
  end if;
  if public.module_seats_used(p_cm) >= cm.seats then return jsonb_build_object('ok', false, 'error', 'nincs_szabad_hely'); end if;
  insert into public.module_access (company_module_id, company_id, module_key, user_id, granted_via)
  values (p_cm, cm.company_id, cm.module_key, p_actor, 'head_self');
  insert into public.access_audit_log (actor_id, action, company_id, module_key, target_user_id, details)
  values (p_actor, 'hozzaferes_megadva', cm.company_id, cm.module_key, p_actor, jsonb_build_object('via', 'head_self'));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.payment_mark_paid(p_actor uuid, p_payment uuid, p_paid date, p_method text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.company_payments%rowtype; v_today date := (now() at time zone 'Europe/Budapest')::date;
        v_base date; v_new date; v_old date;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  if p_method not in ('atutalas', 'keszpenz', 'kartya', 'stripe') then return jsonb_build_object('ok', false, 'error', 'hianyzo_mezo'); end if;
  select * into p from public.company_payments where id = p_payment for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if p.status = 'fizetve' then return jsonb_build_object('ok', true, 'unchanged', true); end if;
  if p.status not in ('esedekes', 'kiszamlazva') then return jsonb_build_object('ok', false, 'error', 'tiltott_allapot'); end if;
  update public.company_payments set status = 'fizetve', paid_at = coalesce(p_paid, v_today), payment_method = p_method, updated_at = now()
   where id = p_payment;
  -- Lemondott modulnál a „Fizetve” nem hosszabbít érvényességet (terv 21 / 3.).
  if p.kind = 'havi_dij' and p.company_module_id is not null
     and not exists (select 1 from public.company_modules where id = p.company_module_id and cancel_requested_at is not null) then
    select valid_until into v_old from public.company_modules where id = p.company_module_id for update;
    v_base := greatest(coalesce(v_old, v_today), v_today);
    v_new := v_base + (p.period_to - p.period_from + 1);
    update public.company_modules set valid_until = v_new, updated_at = now() where id = p.company_module_id;
    insert into public.access_audit_log (actor_id, action, company_id, details)
    values (p_actor, 'ervenyesseg_modositva', p.company_id, jsonb_build_object('from', v_old, 'to', v_new, 'payment_id', p_payment));
  end if;
  insert into public.access_audit_log (actor_id, action, company_id, details)
  values (p_actor, 'fizetve', p.company_id, jsonb_build_object('payment_id', p_payment, 'method', p_method));
  return jsonb_build_object('ok', true, 'valid_until', v_new);
end $$;

create or replace function public.expiry_notifications_due()
returns table (company_module_id uuid, valid_until date, days_before integer)
language sql stable security definer set search_path = public as $$
  select cm.id, cm.valid_until, d.n
  from public.company_modules cm
  cross join (values (3), (1)) as d(n)
  where cm.state = 'aktiv' and cm.valid_until is not null and cm.cancel_requested_at is null
    and cm.valid_until - (now() at time zone 'Europe/Budapest')::date = d.n
    and not exists (select 1 from public.expiry_notifications e
                    where e.company_module_id = cm.id and e.valid_until = cm.valid_until and e.days_before = d.n);
$$;

-- ---------------------------------------------------------------------------
-- 4) Modul lemondása, rendrakás, újranyitás
--    Hibakódok: nem_admin · nincs_ilyen · hianyzo_mezo · tiltott_allapot · mar_lemondva · nincs_lemondas
-- ---------------------------------------------------------------------------
-- Lemondás rögzítése: a modul a hatályos napig (alapból az érvényesség vége) működik; a nyitott meghívók
-- azonnal visszavonódnak (a helyek felszabadulnak); új meghívó és „Használom én is” nem adható.
create or replace function public.cancel_company_module(p_actor uuid, p_cm uuid, p_effective date, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cm public.company_modules%rowtype; v_eff date; v_today date := (now() at time zone 'Europe/Budapest')::date;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  if coalesce(trim(p_reason), '') = '' then return jsonb_build_object('ok', false, 'error', 'hianyzo_mezo'); end if;
  select * into cm from public.company_modules where id = p_cm for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if cm.state = 'lemondva' or cm.cancel_requested_at is not null then return jsonb_build_object('ok', false, 'error', 'mar_lemondva'); end if;
  v_eff := coalesce(p_effective, cm.valid_until, v_today);
  update public.company_modules set cancel_requested_at = now(), cancel_effective_on = v_eff, cancel_reason = trim(p_reason), updated_at = now()
   where id = p_cm;
  -- Nem élő (még nem aktivált / szünetelő) modul azonnal lemondott állapotba kerül.
  if cm.state <> 'aktiv' or v_eff < v_today then
    update public.company_modules set state = 'lemondva' where id = p_cm;
  end if;
  update public.module_invitations set status = 'visszavonva' where company_module_id = p_cm and status = 'meghivva';
  insert into public.access_audit_log (actor_id, action, company_id, module_key, details)
  values (p_actor, 'modul_lemondva', cm.company_id, cm.module_key, jsonb_build_object('effective_on', v_eff, 'reason', trim(p_reason)));
  return jsonb_build_object('ok', true, 'effective_on', v_eff);
end $$;

-- Rendrakás (napi cron): a hatályos nap után lemondott állapot; a le nem zárt foglalások feloldása.
create or replace function public.finalize_cancelled_modules()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0; v_today date := (now() at time zone 'Europe/Budapest')::date;
begin
  for r in select id, company_id, module_key from public.company_modules
           where cancel_effective_on is not null and cancel_effective_on < v_today and state <> 'lemondva' for update loop
    update public.company_modules set state = 'lemondva', updated_at = now() where id = r.id;
    update public.module_usage_events set status = 'feloldott', settled_at = now() where company_module_id = r.id and status = 'foglalt';
    insert into public.access_audit_log (action, company_id, module_key) values ('modul_lemondas_hatalyba_lepett', r.company_id, r.module_key);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Újranyitás: a lemondás visszavonása (ha még nem lépett hatályba) vagy a lemondott modul Szünetel állapotba
-- hozása — innen az Aktiválás szabályaival kapcsolható vissza. A tagok hozzáférése nem áll vissza automatikusan.
create or replace function public.reopen_company_module(p_actor uuid, p_cm uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cm public.company_modules%rowtype;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  select * into cm from public.company_modules where id = p_cm for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if cm.cancel_requested_at is null and cm.state <> 'lemondva' then return jsonb_build_object('ok', false, 'error', 'nincs_lemondas'); end if;
  update public.company_modules set cancel_requested_at = null, cancel_effective_on = null, cancel_reason = null,
         state = case when state = 'lemondva' then 'szunetel' else state end, updated_at = now()
   where id = p_cm;
  insert into public.access_audit_log (actor_id, action, company_id, module_key)
  values (p_actor, 'modul_ujraaktivalva', cm.company_id, cm.module_key);
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- 5) Cég lezárása (archiválás), újranyitás, végleges törlés (csak fizetési tétel nélkül)
--    Hibakódok: van_elo_modul · van_fizetesi_tetel · nem_lezart · nev_nem_egyezik
-- ---------------------------------------------------------------------------
create or replace function public.close_company(p_actor uuid, p_company uuid, p_reason text, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.companies%rowtype; v_today date := (now() at time zone 'Europe/Budapest')::date;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  if coalesce(trim(p_reason), '') = '' then return jsonb_build_object('ok', false, 'error', 'hianyzo_mezo'); end if;
  select * into c from public.companies where id = p_company for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if c.status = 'lezart' then return jsonb_build_object('ok', false, 'error', 'tiltott_allapot'); end if;
  if not coalesce(p_force, false) and exists (select 1 from public.company_modules where company_id = p_company and state <> 'lemondva') then
    return jsonb_build_object('ok', false, 'error', 'van_elo_modul');
  end if;
  -- Előbb a cég státusza (a cégvezető-védő trigger lezárt cégnél átenged), utána a tagok és a hozzáférések.
  update public.companies set status = 'lezart', closed_at = now(), closed_reason = trim(p_reason), updated_at = now() where id = p_company;
  update public.company_modules
     set state = 'lemondva', cancel_requested_at = coalesce(cancel_requested_at, now()),
         cancel_effective_on = coalesce(least(cancel_effective_on, v_today), v_today),
         cancel_reason = coalesce(cancel_reason, 'Cég lezárása: ' || trim(p_reason)), updated_at = now()
   where company_id = p_company and state <> 'lemondva';
  update public.module_invitations set status = 'visszavonva' where company_id = p_company and status = 'meghivva';
  update public.module_access set status = 'eltavolitva', removed_at = now(), removed_by = p_actor where company_id = p_company and status = 'aktiv';
  update public.module_usage_events set status = 'feloldott', settled_at = now()
   where status = 'foglalt' and company_module_id in (select id from public.company_modules where company_id = p_company);
  update public.company_members set status = 'eltavolitva', is_company_head = false, removed_at = now()
   where company_id = p_company and status = 'aktiv';
  insert into public.access_audit_log (actor_id, action, company_id, details)
  values (p_actor, 'ceg_lezarva', p_company, jsonb_build_object('reason', trim(p_reason), 'force', coalesce(p_force, false)));
  return jsonb_build_object('ok', true);
end $$;

-- Újranyitás: a cég újra Aktív; a tagokat újra fel kell venni / meg kell hívni, a modulokat újra aktiválni.
create or replace function public.reopen_company(p_actor uuid, p_company uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.companies%rowtype;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  select * into c from public.companies where id = p_company for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if c.status <> 'lezart' then return jsonb_build_object('ok', false, 'error', 'nem_lezart'); end if;
  if exists (select 1 from public.customer_data_requests where company_id = p_company and status in ('jovahagyva', 'reszben_vegrehajtva', 'vegrehajtva')) then
    return jsonb_build_object('ok', false, 'error', 'adat_torolve');
  end if;
  update public.companies set status = 'aktiv', closed_at = null, closed_reason = null, updated_at = now() where id = p_company;
  insert into public.access_audit_log (actor_id, action, company_id) values (p_actor, 'ceg_ujranyitva', p_company);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.delete_company_permanently(p_actor uuid, p_company uuid, p_confirm_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.companies%rowtype;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  select * into c from public.companies where id = p_company for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if lower(trim(coalesce(p_confirm_name, ''))) <> lower(trim(c.name)) then return jsonb_build_object('ok', false, 'error', 'nev_nem_egyezik'); end if;
  if exists (select 1 from public.company_payments where company_id = p_company) then
    return jsonb_build_object('ok', false, 'error', 'van_fizetesi_tetel');
  end if;
  insert into public.access_audit_log (actor_id, action, details)
  values (p_actor, 'ceg_veglegesen_torolve', jsonb_build_object('company_id', p_company, 'name', c.name));
  -- A cégvezető-védő trigger a cég törlésekor (kaszkád) átenged.
  delete from public.companies where id = p_company;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- 6) Ügyféladat: visszaadás (napló) és törlés (kérés → másik, kijelölt admin jóváhagyása → végrehajtás)
--    Hibakódok: nem_lezart · nev_nem_egyezik · hatarido_elott · nem_jovahagyo · sajat_keres · mar_van_keres
-- ---------------------------------------------------------------------------
create or replace function public.record_customer_data_export(p_actor uuid, p_company uuid, p_module_key text, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  insert into public.access_audit_log (actor_id, action, company_id, module_key, details)
  values (p_actor, 'ugyfeladat_visszaadva', p_company, nullif(p_module_key, ''), jsonb_build_object('note', left(coalesce(p_note, ''), 300)));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.request_customer_data_deletion(p_actor uuid, p_company uuid, p_reason text, p_confirm_name text,
  p_before_deadline boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.companies%rowtype; v_id uuid;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  if coalesce(trim(p_reason), '') = '' then return jsonb_build_object('ok', false, 'error', 'hianyzo_mezo'); end if;
  select * into c from public.companies where id = p_company for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if c.status <> 'lezart' then return jsonb_build_object('ok', false, 'error', 'nem_lezart'); end if;
  if lower(trim(coalesce(p_confirm_name, ''))) <> lower(trim(c.name)) then return jsonb_build_object('ok', false, 'error', 'nev_nem_egyezik'); end if;
  -- A megőrzési határidő előtt csak kifejezett jelöléssel (az ügyfél írásbeli kérésére) — a határidő amíg nincs
  -- eldöntve (üres), szintén csak így kérhető.
  if (c.data_retention_until is null or c.data_retention_until > (now() at time zone 'Europe/Budapest')::date)
     and not coalesce(p_before_deadline, false) then
    return jsonb_build_object('ok', false, 'error', 'hatarido_elott');
  end if;
  insert into public.customer_data_requests (company_id, reason, before_deadline, requested_by)
  values (p_company, trim(p_reason), coalesce(p_before_deadline, false), p_actor) returning id into v_id;
  insert into public.access_audit_log (actor_id, action, company_id, details)
  values (p_actor, 'ugyfeladat_torles_kerve', p_company, jsonb_build_object('request_id', v_id));
  return jsonb_build_object('ok', true, 'id', v_id);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'mar_van_keres');
end $$;

create or replace function public.decide_customer_data_deletion(p_actor uuid, p_request uuid, p_approve boolean, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.customer_data_requests%rowtype;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  if not exists (select 1 from public.deletion_approvers where user_id = p_actor and active) then
    return jsonb_build_object('ok', false, 'error', 'nem_jovahagyo');
  end if;
  select * into r from public.customer_data_requests where id = p_request for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if r.status <> 'kerve' then return jsonb_build_object('ok', false, 'error', 'tiltott_allapot'); end if;
  if r.requested_by = p_actor then return jsonb_build_object('ok', false, 'error', 'sajat_keres'); end if;
  if not p_approve and coalesce(trim(p_reason), '') = '' then return jsonb_build_object('ok', false, 'error', 'hianyzo_mezo'); end if;
  update public.customer_data_requests
     set status = case when p_approve then 'jovahagyva' else 'elutasitva' end,
         approved_by = p_actor, approved_at = now(), rejected_reason = case when p_approve then null else trim(p_reason) end
   where id = p_request;
  insert into public.access_audit_log (actor_id, action, company_id, details)
  values (p_actor, case when p_approve then 'ugyfeladat_torles_jovahagyva' else 'ugyfeladat_torles_elutasitva' end, r.company_id,
          jsonb_build_object('request_id', p_request));
  return jsonb_build_object('ok', true);
end $$;

-- A kérő visszavonhatja a még el nem bírált kérését.
create or replace function public.withdraw_customer_data_deletion(p_actor uuid, p_request uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  update public.customer_data_requests set status = 'visszavonva' where id = p_request and status = 'kerve';
  return jsonb_build_object('ok', found);
end $$;

-- A szerver a modulonkénti törlés után hívja (idempotens: részleges eredmény után újraindítható).
create or replace function public.complete_customer_data_deletion(p_actor uuid, p_request uuid, p_summary jsonb, p_partial boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.customer_data_requests%rowtype;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  select * into r from public.customer_data_requests where id = p_request for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if r.status not in ('jovahagyva', 'reszben_vegrehajtva') then return jsonb_build_object('ok', false, 'error', 'tiltott_allapot'); end if;
  update public.customer_data_requests
     set status = case when p_partial then 'reszben_vegrehajtva' else 'vegrehajtva' end, executed_at = now(), result_summary = p_summary
   where id = p_request;
  insert into public.access_audit_log (actor_id, action, company_id, details)
  values (p_actor, 'ugyfeladat_torolve', r.company_id, jsonb_build_object('request_id', p_request, 'partial', p_partial));
  return jsonb_build_object('ok', true);
end $$;

-- Jóváhagyók listája (csak admin, naplózva). Alapból Radics Tibor — az admin veszi fel a felületen.
create or replace function public.set_deletion_approver(p_actor uuid, p_user uuid, p_active boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  if not public.require_admin(p_user) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  insert into public.deletion_approvers (user_id, active, added_by) values (p_user, p_active, p_actor)
  on conflict (user_id) do update set active = excluded.active, added_by = excluded.added_by, added_at = now();
  insert into public.access_audit_log (actor_id, action, target_user_id, details)
  values (p_actor, 'jovahagyo_modositva', p_user, jsonb_build_object('active', p_active));
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- 7) Jogok
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'module_is_live(uuid)', 'user_has_module_access(uuid, uuid)',
    'create_invitation(uuid, uuid, text, text, integer)', 'resend_invitation(uuid, uuid, text, integer)', 'add_self_access(uuid, uuid)',
    'payment_mark_paid(uuid, uuid, date, text)', 'expiry_notifications_due()',
    'cancel_company_module(uuid, uuid, date, text)', 'finalize_cancelled_modules()', 'reopen_company_module(uuid, uuid)',
    'close_company(uuid, uuid, text, boolean)', 'reopen_company(uuid, uuid)', 'delete_company_permanently(uuid, uuid, text)',
    'record_customer_data_export(uuid, uuid, text, text)',
    'request_customer_data_deletion(uuid, uuid, text, text, boolean)', 'decide_customer_data_deletion(uuid, uuid, boolean, text)',
    'withdraw_customer_data_deletion(uuid, uuid)', 'complete_customer_data_deletion(uuid, uuid, jsonb, boolean)',
    'set_deletion_approver(uuid, uuid, boolean)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
