-- =====================================================================
-- Twinx — Számlázási adatok + számla-alapú kredit-kérés
-- Futtasd a Supabase SQL Editorban (a credit-requests.sql UTÁN).
--
-- Miért kell: amíg a Stripe vásárlás nincs bekötve, MINDENKI az admintól
-- igényel kreditet. A sales kollégák INGYEN kapják (belső keret), a sima
-- felhasználóknak viszont SZÁMLÁT állítunk ki. Ehhez kell:
--   1) számlázási adat a profilban,
--   2) fix csomag + nettó ár a kérésen (ne kézzel számoljunk),
--   3) számla-státusz, hogy a kredit CSAK befizetés után íródjon jóvá.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) SZÁMLÁZÁSI ADATOK a profilban
-- Egy helyen, egyszer kell megadni; a kérés beadásakor pillanatképet
-- készítünk róla (lásd lentebb), így egy későbbi adatmódosítás nem írja
-- felül a már kiállított számlához tartozó adatokat.
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists billing_type       text;   -- 'company' | 'individual'
alter table public.profiles add column if not exists billing_name       text;   -- cégnév vagy magánszemély neve
alter table public.profiles add column if not exists billing_tax_number text;   -- adószám (cégnél kötelező)
alter table public.profiles add column if not exists billing_country    text;
alter table public.profiles add column if not exists billing_zip        text;
alter table public.profiles add column if not exists billing_city       text;
alter table public.profiles add column if not exists billing_address    text;   -- utca, házszám
alter table public.profiles add column if not exists billing_email      text;   -- ide megy a számla

-- Csak érvényes érték kerülhessen be (a null megengedett: még nem töltötte ki).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_billing_type_check'
  ) then
    alter table public.profiles
      add constraint profiles_billing_type_check
      check (billing_type is null or billing_type in ('company', 'individual'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1/b) BIZTONSÁGI JAVÍTÁS a számlázási adatok mellé
--
-- A profile-company.sql felvett egy "profiles_update_own" policy-t, hogy a
-- partner szerkeszthesse a saját nevét/cégét (és most a számlázási adatait).
-- Csakhogy ez a policy MINDEN oszlopra vonatkozik — így a böngészőből
-- elvileg a saját 'role' mező is átírható lenne 'admin'-ra.
--
-- Ez a trigger ezt lezárja: a szerepkört CSAK a szerver (service_role)
-- módosíthatja; felhasználói munkamenetben a régi érték marad.
-- ---------------------------------------------------------------------
create or replace function public.profiles_guard_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and coalesce(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
           ''
         ) <> 'service_role'
  then
    new.role := old.role;   -- csendben visszaállítjuk
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role_trg on public.profiles;
create trigger profiles_guard_role_trg
  before update on public.profiles
  for each row execute function public.profiles_guard_role();

-- ---------------------------------------------------------------------
-- 2) A KÉRÉS kiegészítése: melyik csomag, mennyi pénz, kell-e számla
--
-- billing_kind:
--   'free'    — sales kolléga belső kerete, nincs számlázás
--   'invoice' — sima felhasználó, számlát állítunk ki
--
-- invoice_status (csak 'invoice' esetén értelmes):
--   'none'     — nem számlázandó (free)
--   'to_issue' — számlázandó, még nincs kiállítva
--   'issued'   — számla kiállítva, fizetésre vár
--   'paid'     — befizetve → EKKOR írjuk jóvá a kreditet
-- ---------------------------------------------------------------------
alter table public.credit_requests add column if not exists package_id       text;
alter table public.credit_requests add column if not exists net_huf          integer;   -- nettó ár Ft-ban
alter table public.credit_requests add column if not exists billing_kind     text not null default 'invoice';
alter table public.credit_requests add column if not exists invoice_status   text not null default 'none';
alter table public.credit_requests add column if not exists invoice_number   text;
alter table public.credit_requests add column if not exists invoice_issued_at timestamptz;
alter table public.credit_requests add column if not exists paid_at          timestamptz;
alter table public.credit_requests add column if not exists billing_snapshot jsonb;     -- a számlázási adat pillanatképe

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'credit_requests_billing_kind_check') then
    alter table public.credit_requests
      add constraint credit_requests_billing_kind_check
      check (billing_kind in ('free', 'invoice'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'credit_requests_invoice_status_check') then
    alter table public.credit_requests
      add constraint credit_requests_invoice_status_check
      check (invoice_status in ('none', 'to_issue', 'issued', 'paid'));
  end if;
end $$;

-- A RÉGI (migráció előtti) kérések maradjanak "ingyenes" logikán: azokhoz nem
-- készült számlázási adat, ne kerüljenek véletlenül a számlázandó listába.
update public.credit_requests
   set billing_kind = 'free', invoice_status = 'none'
 where package_id is null and billing_kind = 'invoice';

create index if not exists credit_requests_invoice_idx
  on public.credit_requests (invoice_status, created_at desc)
  where status = 'pending';

-- ---------------------------------------------------------------------
-- 3) SZÁMLA KIÁLLÍTÁSA — csak státuszt és számlaszámot ír, kreditet NEM.
-- A kredit a befizetéskor (credit_request_approve) érkezik.
-- ---------------------------------------------------------------------
create or replace function public.credit_request_mark_issued(
  p_id             uuid,
  p_invoice_number text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok uuid;
begin
  update public.credit_requests
     set invoice_status    = 'issued',
         invoice_number    = nullif(trim(coalesce(p_invoice_number, '')), ''),
         invoice_issued_at = now()
   where id = p_id
     and status = 'pending'
     and billing_kind = 'invoice'
     and invoice_status = 'to_issue'
   returning id into v_ok;

  return v_ok is not null;
end;
$$;

revoke all on function public.credit_request_mark_issued(uuid, text) from public, anon, authenticated;
grant execute on function public.credit_request_mark_issued(uuid, text) to service_role;

-- ---------------------------------------------------------------------
-- 4) JÓVÁHAGYÁS = "megjött a pénz" (számlás ág) VAGY "megadom a keretet"
--    (sales ág). A korábbi függvény bővítése: számlás kérésnél a befizetést
--    is rögzíti, hogy egyetlen tranzakcióban legyen minden.
-- ---------------------------------------------------------------------
create or replace function public.credit_request_approve(
  p_id          uuid,
  p_admin       uuid,
  p_admin_email text,
  p_amount      integer,   -- null vagy 0 = a kért mennyiség
  p_note        text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid;
  v_email   text;
  v_granted integer;
  v_kind    text;
begin
  -- A kérés "elkapása": csak EGY hívó nyerhet (a sor zárolva van az UPDATE alatt).
  update public.credit_requests
     set status           = 'approved',
         decided_by       = p_admin,
         decided_by_email = p_admin_email,
         decided_at       = now(),
         decision_note    = p_note,
         granted_amount   = coalesce(nullif(p_amount, 0), amount),
         -- Számlás kérésnél a jóváhagyás egyben a befizetés rögzítése is.
         invoice_status   = case when billing_kind = 'invoice' then 'paid' else invoice_status end,
         paid_at          = case when billing_kind = 'invoice' then now() else paid_at end
   where id = p_id
     and status = 'pending'
   returning user_id, user_email, granted_amount, billing_kind
        into v_user, v_email, v_granted, v_kind;

  if v_user is null then
    return 0;  -- már elbírálták
  end if;

  -- Jóváírás UGYANEBBEN a tranzakcióban.
  insert into public.wallets (user_id, balance)
  values (v_user, v_granted)
  on conflict (user_id) do update
    set balance = public.wallets.balance + excluded.balance,
        updated_at = now();

  -- A kredit-naplóba is bekerül, hogy egy helyen látszódjon minden jóváírás.
  insert into public.credit_grants (admin_id, admin_email, user_id, user_email, amount, note)
  values (p_admin, p_admin_email, v_user, v_email, v_granted,
          case when v_kind = 'invoice' then 'Befizetett számla' else 'Kredit-kérés jóváhagyva' end
          || coalesce(' — ' || nullif(trim(p_note), ''), ''));

  return v_granted;
end;
$$;

revoke all on function public.credit_request_approve(uuid, uuid, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.credit_request_approve(uuid, uuid, text, integer, text)
  to service_role;
