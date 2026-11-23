-- Ajánlat, fizetési napló és lejárati figyelmeztetés (terv 19, D52).
--
-- Additív (D51): új táblák és függvények; a régi kredit-/Stripe-táblák érintetlenek. A pluszcsomag (terv 20)
-- mostantól a fizetési tételt is létrehozza, egy tranzakcióban (cap_add_pack új változata).
-- Csak admin látja (RLS + API). Minden pénzügyi állapotváltás egy tranzakcióban, naplózva (access_audit_log).
-- Visszacsinálás: supabase/down/20261124150000_finance.down.sql
-- Újrafuttatható.

-- ---------------------------------------------------------------------------
-- 1) Táblák
-- ---------------------------------------------------------------------------
create table if not exists public.company_quotes (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete cascade,
  company_module_id uuid references public.company_modules (id) on delete set null,
  title             text not null check (char_length(title) between 1 and 200),
  amount_net        integer not null check (amount_net >= 0),
  vat_rate          numeric(5, 2) not null default 27 check (vat_rate >= 0 and vat_rate <= 100),
  currency          text not null default 'HUF' check (currency = 'HUF'),
  valid_until       date,
  status            text not null default 'vazlat' check (status in ('vazlat', 'elkuldve', 'elfogadva', 'elutasitva', 'lejart')),
  sent_at           timestamptz,
  accepted_at       timestamptz,
  note              text check (note is null or char_length(note) <= 2000),
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists company_quotes_company_idx on public.company_quotes (company_id, created_at desc);
alter table public.company_quotes enable row level security;

create table if not exists public.company_payments (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid not null references public.companies (id) on delete cascade,
  company_module_id        uuid references public.company_modules (id) on delete set null,
  quote_id                 uuid references public.company_quotes (id) on delete set null,
  kind                     text not null check (kind in ('fejlesztesi_dij', 'havi_dij', 'egyeb')),
  milestone                text check (milestone is null or milestone in ('eloleg', 'maradek', 'atadaskor')),
  description              text not null check (char_length(description) between 1 and 300),
  amount_net               integer not null check (amount_net >= 0),
  vat_rate                 numeric(5, 2) not null default 27,
  amount_gross             integer not null check (amount_gross >= 0),
  status                   text not null default 'esedekes' check (status in ('esedekes', 'kiszamlazva', 'fizetve', 'visszateritve', 'torolve')),
  due_date                 date,
  invoice_number           text,
  invoice_issued_at        date,
  paid_at                  date,
  payment_method           text check (payment_method is null or payment_method in ('atutalas', 'keszpenz', 'kartya', 'stripe')),
  period_from              date,
  period_to                date,
  billing_snapshot         jsonb,
  stripe_payment_intent_id text,
  stripe_invoice_id        text,
  status_reason            text,
  created_by               uuid references public.profiles (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  check (kind <> 'havi_dij' or (period_from is not null and period_to is not null and period_to >= period_from))
);
create unique index if not exists company_payments_invoice_uq on public.company_payments (invoice_number) where invoice_number is not null;
create index if not exists company_payments_company_idx on public.company_payments (company_id, created_at desc);
create index if not exists company_payments_status_idx on public.company_payments (status, due_date);
alter table public.company_payments enable row level security;

create table if not exists public.expiry_notifications (
  id                uuid primary key default gen_random_uuid(),
  company_module_id uuid not null references public.company_modules (id) on delete cascade,
  valid_until       date not null,
  days_before       integer not null check (days_before in (1, 3)),
  sent_at           timestamptz not null default now(),
  unique (company_module_id, valid_until, days_before)
);
alter table public.expiry_notifications enable row level security;

-- A pluszcsomag fizetési tétele (terv 20 ↔ 19).
do $$ begin
  alter table public.module_cap_adjustments add constraint module_cap_adjustments_payment_fk
    foreign key (payment_id) references public.company_payments (id) on delete set null;
exception when duplicate_object then null; when undefined_table then null; end $$;

drop policy if exists company_quotes_admin on public.company_quotes;
create policy company_quotes_admin on public.company_quotes for select using (public.is_admin());
drop policy if exists company_payments_admin on public.company_payments;
create policy company_payments_admin on public.company_payments for select using (public.is_admin());
drop policy if exists expiry_notifications_admin on public.expiry_notifications;
create policy expiry_notifications_admin on public.expiry_notifications for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 2) Segéd: a cég számlázási adatainak pillanatképe
-- ---------------------------------------------------------------------------
create or replace function public.company_billing_snapshot(p_company uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('name', coalesce(billing_name, name), 'tax_number', billing_tax_number,
                            'address', billing_address, 'email', billing_email)
  from public.companies where id = p_company;
$$;

-- ---------------------------------------------------------------------------
-- 3) Ajánlat
--    Hibakódok: nem_admin · nincs_ilyen · hianyzo_mezo · tiltott_allapot · osszeg_elter · ures_tetelek
-- ---------------------------------------------------------------------------
create or replace function public.quote_create(p_actor uuid, p_company uuid, p_cm uuid, p_title text, p_amount_net integer,
  p_vat numeric, p_valid_until date, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  if coalesce(trim(p_title), '') = '' or p_amount_net is null or p_amount_net < 0 then return jsonb_build_object('ok', false, 'error', 'hianyzo_mezo'); end if;
  if not exists (select 1 from public.companies where id = p_company) then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  insert into public.company_quotes (company_id, company_module_id, title, amount_net, vat_rate, valid_until, note, created_by)
  values (p_company, p_cm, trim(p_title), p_amount_net, coalesce(p_vat, 27), p_valid_until, nullif(trim(coalesce(p_note, '')), ''), p_actor)
  returning id into v_id;
  insert into public.access_audit_log (actor_id, action, company_id, details)
  values (p_actor, 'ajanlat_letrehozva', p_company, jsonb_build_object('quote_id', v_id, 'amount_net', p_amount_net));
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- Vázlat → Elküldve; Elküldve → Elutasítva / Lejárt; Vázlat → Elutasítva. Az Elfogadva csak a quote_accept-tel.
create or replace function public.quote_update_status(p_actor uuid, p_quote uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare q public.company_quotes%rowtype;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  select * into q from public.company_quotes where id = p_quote for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if not ((q.status = 'vazlat' and p_status in ('elkuldve', 'elutasitva'))
       or (q.status = 'elkuldve' and p_status in ('elutasitva', 'lejart'))) then
    return jsonb_build_object('ok', false, 'error', 'tiltott_allapot');
  end if;
  update public.company_quotes set status = p_status, updated_at = now(),
         sent_at = case when p_status = 'elkuldve' then now() else sent_at end
   where id = p_quote;
  insert into public.access_audit_log (actor_id, action, company_id, details)
  values (p_actor, 'ajanlat_allapot', q.company_id, jsonb_build_object('quote_id', p_quote, 'from', q.status, 'to', p_status));
  return jsonb_build_object('ok', true);
end $$;

-- Elfogadás + a fizetési tételek létrehozása egy tranzakcióban. p_items: [{kind, milestone, description, amount_net,
-- due_date, period_from, period_to}]. A tételek nettó összege egyezzen az ajánlatéval.
create or replace function public.quote_accept(p_actor uuid, p_quote uuid, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare q public.company_quotes%rowtype; it jsonb; v_sum integer := 0; v_snap jsonb; v_net integer;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  select * into q from public.company_quotes where id = p_quote for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if q.status not in ('vazlat', 'elkuldve') then return jsonb_build_object('ok', false, 'error', 'tiltott_allapot'); end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'error', 'ures_tetelek');
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    v_sum := v_sum + coalesce((it ->> 'amount_net')::int, 0);
  end loop;
  if v_sum <> q.amount_net then return jsonb_build_object('ok', false, 'error', 'osszeg_elter', 'sum', v_sum, 'quote', q.amount_net); end if;
  v_snap := public.company_billing_snapshot(q.company_id);
  for it in select * from jsonb_array_elements(p_items) loop
    v_net := (it ->> 'amount_net')::int;
    insert into public.company_payments (company_id, company_module_id, quote_id, kind, milestone, description, amount_net, vat_rate,
      amount_gross, due_date, period_from, period_to, billing_snapshot, created_by)
    values (q.company_id, q.company_module_id, q.id, coalesce(it ->> 'kind', 'fejlesztesi_dij'), nullif(it ->> 'milestone', ''),
      coalesce(nullif(trim(it ->> 'description'), ''), q.title), v_net, q.vat_rate, round(v_net * (1 + q.vat_rate / 100))::int,
      nullif(it ->> 'due_date', '')::date, nullif(it ->> 'period_from', '')::date, nullif(it ->> 'period_to', '')::date, v_snap, p_actor);
  end loop;
  update public.company_quotes set status = 'elfogadva', accepted_at = now(), updated_at = now() where id = p_quote;
  insert into public.access_audit_log (actor_id, action, company_id, details)
  values (p_actor, 'ajanlat_elfogadva', q.company_id, jsonb_build_object('quote_id', p_quote, 'items', jsonb_array_length(p_items)));
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- 4) Fizetési tételek
--    Hibakódok: nem_admin · nincs_ilyen · hianyzo_mezo · tiltott_allapot · szamlaszam_foglalt
-- ---------------------------------------------------------------------------
-- Kézi tétel (pl. havi díj a következő időszakra, vagy egyéb).
create or replace function public.payment_add(p_actor uuid, p_company uuid, p_cm uuid, p_kind text, p_description text,
  p_amount_net integer, p_vat numeric, p_due date, p_period_from date, p_period_to date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_vat numeric := coalesce(p_vat, 27);
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  if coalesce(trim(p_description), '') = '' or p_amount_net is null or p_amount_net < 0 or p_kind not in ('fejlesztesi_dij', 'havi_dij', 'egyeb') then
    return jsonb_build_object('ok', false, 'error', 'hianyzo_mezo');
  end if;
  if p_kind = 'havi_dij' and (p_cm is null or p_period_from is null or p_period_to is null or p_period_to < p_period_from) then
    return jsonb_build_object('ok', false, 'error', 'hianyzo_mezo');
  end if;
  insert into public.company_payments (company_id, company_module_id, kind, description, amount_net, vat_rate, amount_gross,
    due_date, period_from, period_to, billing_snapshot, created_by)
  values (p_company, p_cm, p_kind, trim(p_description), p_amount_net, v_vat, round(p_amount_net * (1 + v_vat / 100))::int,
    p_due, p_period_from, p_period_to, public.company_billing_snapshot(p_company), p_actor)
  returning id into v_id;
  insert into public.access_audit_log (actor_id, action, company_id, details)
  values (p_actor, 'fizetesi_tetel_letrehozva', p_company, jsonb_build_object('payment_id', v_id, 'kind', p_kind, 'amount_net', p_amount_net));
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.payment_set_invoiced(p_actor uuid, p_payment uuid, p_invoice text, p_issued date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.company_payments%rowtype;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  if coalesce(trim(p_invoice), '') = '' then return jsonb_build_object('ok', false, 'error', 'hianyzo_mezo'); end if;
  select * into p from public.company_payments where id = p_payment for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if p.status <> 'esedekes' then return jsonb_build_object('ok', false, 'error', 'tiltott_allapot'); end if;
  update public.company_payments set status = 'kiszamlazva', invoice_number = trim(p_invoice),
         invoice_issued_at = coalesce(p_issued, (now() at time zone 'Europe/Budapest')::date), updated_at = now()
   where id = p_payment;
  insert into public.access_audit_log (actor_id, action, company_id, details)
  values (p_actor, 'kiszamlazva', p.company_id, jsonb_build_object('payment_id', p_payment, 'invoice', trim(p_invoice)));
  return jsonb_build_object('ok', true);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'error', 'szamlaszam_foglalt');
end $$;

-- Fizetve (idempotens). Havi díjnál ugyanebben a tranzakcióban nő a modul érvényessége a tétel időszakának
-- hosszával, a mostani lejárat vagy a mai nap közül a későbbitől számítva.
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

-- Visszatérítve / Törölve, indoklással. Az érvényességet NEM vonja vissza automatikusan (az admin dönt).
create or replace function public.payment_close(p_actor uuid, p_payment uuid, p_status text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.company_payments%rowtype;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  if coalesce(trim(p_reason), '') = '' or p_status not in ('visszateritve', 'torolve') then return jsonb_build_object('ok', false, 'error', 'hianyzo_mezo'); end if;
  select * into p from public.company_payments where id = p_payment for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if (p_status = 'visszateritve' and p.status <> 'fizetve') or (p_status = 'torolve' and p.status not in ('esedekes', 'kiszamlazva')) then
    return jsonb_build_object('ok', false, 'error', 'tiltott_allapot');
  end if;
  update public.company_payments set status = p_status, status_reason = trim(p_reason), updated_at = now() where id = p_payment;
  insert into public.access_audit_log (actor_id, action, company_id, details)
  values (p_actor, p_status, p.company_id, jsonb_build_object('payment_id', p_payment, 'reason', trim(p_reason)));
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- 5) Pluszcsomag + fizetési tétel egy tranzakcióban (terv 20 / 2., cap_add_pack új változata)
-- ---------------------------------------------------------------------------
create or replace function public.cap_add_pack(p_actor uuid, p_cm uuid, p_extra_cost_ft integer, p_extra_units integer,
  p_price_net integer, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cm public.company_modules%rowtype; v_period text := public.budapest_period(); v_id uuid; v_pay uuid;
begin
  if not public.require_admin(p_actor) then return jsonb_build_object('ok', false, 'error', 'nem_admin'); end if;
  if coalesce(p_extra_cost_ft, 0) <= 0 or coalesce(trim(p_reason), '') = '' then return jsonb_build_object('ok', false, 'error', 'hianyzo_mezo'); end if;
  select * into cm from public.company_modules where id = p_cm for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'nincs_ilyen'); end if;
  if cm.monthly_cap is null then return jsonb_build_object('ok', false, 'error', 'nincs_keret'); end if;
  if coalesce(p_price_net, 0) > 0 then
    insert into public.company_payments (company_id, company_module_id, kind, description, amount_net, vat_rate, amount_gross,
      due_date, billing_snapshot, created_by)
    values (cm.company_id, p_cm, 'egyeb', 'Pluszcsomag ' || v_period, p_price_net, 27, round(p_price_net * 1.27)::int,
      (now() at time zone 'Europe/Budapest')::date + 8, public.company_billing_snapshot(cm.company_id), p_actor)
    returning id into v_pay;
  end if;
  insert into public.module_cap_adjustments (company_module_id, period, extra_cost_ft, extra_units, price_net, reason, payment_id, created_by)
  values (p_cm, v_period, p_extra_cost_ft, p_extra_units, p_price_net, trim(p_reason), v_pay, p_actor) returning id into v_id;
  insert into public.access_audit_log (actor_id, action, company_id, module_key, details)
  values (p_actor, 'pluszcsomag_hozzaadva', cm.company_id, cm.module_key,
          jsonb_build_object('period', v_period, 'extra_cost_ft', p_extra_cost_ft, 'extra_units', p_extra_units, 'payment_id', v_pay));
  return jsonb_build_object('ok', true, 'id', v_id, 'payment_id', v_pay);
end $$;

-- ---------------------------------------------------------------------------
-- 6) Lejárati figyelmeztetés (3 és 1 nappal előtte, budapesti idő; szünetelő/lemondott modulról nem)
-- ---------------------------------------------------------------------------
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

create or replace function public.expiry_mark_notified(p_cm uuid, p_valid_until date, p_days integer)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into public.expiry_notifications (company_module_id, valid_until, days_before) values (p_cm, p_valid_until, p_days)
  on conflict do nothing;
  return found;
end $$;

-- ---------------------------------------------------------------------------
-- 7) Jogok
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'company_billing_snapshot(uuid)', 'quote_create(uuid, uuid, uuid, text, integer, numeric, date, text)',
    'quote_update_status(uuid, uuid, text)', 'quote_accept(uuid, uuid, jsonb)',
    'payment_add(uuid, uuid, uuid, text, text, integer, numeric, date, date, date)',
    'payment_set_invoiced(uuid, uuid, text, date)', 'payment_mark_paid(uuid, uuid, date, text)',
    'payment_close(uuid, uuid, text, text)', 'cap_add_pack(uuid, uuid, integer, integer, integer, text)',
    'expiry_notifications_due()', 'expiry_mark_notified(uuid, date, integer)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
