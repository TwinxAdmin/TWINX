-- VISSZACSINÁLÁS: 20261124180000_closure.sql
-- FIGYELEM: a törlési kérések és a jóváhagyók listája elvesz. A lezárt cégek és lemondott modulok ÁLLAPOTA marad
-- (a mezők a korábbi migrációkhoz tartoznak). A módosított függvények visszaállnak a korábbi változatra.
-- Újrafuttatható.

drop function if exists public.set_deletion_approver(uuid, uuid, boolean);
drop function if exists public.complete_customer_data_deletion(uuid, uuid, jsonb, boolean);
drop function if exists public.withdraw_customer_data_deletion(uuid, uuid);
drop function if exists public.decide_customer_data_deletion(uuid, uuid, boolean, text);
drop function if exists public.request_customer_data_deletion(uuid, uuid, text, text, boolean);
drop function if exists public.record_customer_data_export(uuid, uuid, text, text);
drop function if exists public.delete_company_permanently(uuid, uuid, text);
drop function if exists public.reopen_company(uuid, uuid);
drop function if exists public.close_company(uuid, uuid, text, boolean);
drop function if exists public.reopen_company_module(uuid, uuid);
drop function if exists public.finalize_cancelled_modules();
drop function if exists public.cancel_company_module(uuid, uuid, date, text);
drop table if exists public.customer_data_requests;
drop table if exists public.deletion_approvers;

-- A korábbi függvény-változatok:
create or replace function public.module_is_live(p_cm uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_modules cm join public.companies c on c.id = cm.company_id and c.status = 'aktiv'
                 where cm.id = p_cm and cm.state = 'aktiv'
                   and cm.valid_until is not null and cm.valid_until >= (now() at time zone 'Europe/Budapest')::date);
$$;

create or replace function public.user_has_module_access(p_user uuid, p_cm uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.module_access a
    join public.company_modules cm on cm.id = a.company_module_id
    join public.company_members m on m.company_id = cm.company_id and m.user_id = a.user_id and m.status = 'aktiv'
    join public.companies c on c.id = cm.company_id and c.status = 'aktiv'
    where a.company_module_id = p_cm and a.user_id = p_user and a.status = 'aktiv'
      and cm.state = 'aktiv' and cm.valid_until is not null and cm.valid_until >= (now() at time zone 'Europe/Budapest')::date
  );
$$;

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
  if p.kind = 'havi_dij' and p.company_module_id is not null then
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
  where cm.state = 'aktiv' and cm.valid_until is not null
    and cm.valid_until - (now() at time zone 'Europe/Budapest')::date = d.n
    and not exists (select 1 from public.expiry_notifications e
                    where e.company_module_id = cm.id and e.valid_until = cm.valid_until and e.days_before = d.n);
$$;

do $$
declare f text;
begin
  foreach f in array array['module_is_live(uuid)', 'user_has_module_access(uuid, uuid)', 'create_invitation(uuid, uuid, text, text, integer)',
    'resend_invitation(uuid, uuid, text, integer)', 'add_self_access(uuid, uuid)', 'payment_mark_paid(uuid, uuid, date, text)',
    'expiry_notifications_due()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
