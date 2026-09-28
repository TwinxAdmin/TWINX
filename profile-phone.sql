-- =====================================================================
-- Twinx — Opcionális telefonszám a profilban (regisztrációkor megadható).
-- Futtasd a Supabase SQL Editorban (a landing-signup-credits.sql UTÁN,
-- mert azt a trigger-verziót bővíti ki a telefonszámmal).
--
-- MIÉRT: a regisztrációs űrlapon (ingatlan landing + főoldal) opcionálisan
-- megadható a telefonszám. Ez a Supabase signUp metaadatában érkezik
-- (`phone`), a trigger pedig a profiles.phone oszlopba írja.
-- =====================================================================

-- 1) Telefon-oszlop a profilokon.
alter table public.profiles
  add column if not exists phone text;

comment on column public.profiles.phone is
  'Opcionális telefonszám a regisztrációból. NULL = nem adta meg.';

-- 2) Trigger: a landing-kredit logika VÁLTOZATLAN, kiegészítve a telefonnal.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default_welcome  constant integer := 3;   -- közvetlen regisztráció (welcome-credits.sql)
  v_landing_welcome  constant integer := 10;  -- ingatlan landingről
  v_landing_cap      constant integer := 50;  -- ennyi partner kap 10-et, utána 3
  v_landing_source   constant text    := 'ingatlan-landing';
  v_source           text;
  v_welcome          integer := v_default_welcome;
  v_landing_count    integer;
  v_note             text := 'Regisztrációs próbakredit';
begin
  v_source := nullif(trim(coalesce(new.raw_user_meta_data ->> 'signup_source', '')), '');

  -- Landingről érkezett? Akkor a keret erejéig 10 kredit.
  if v_source = v_landing_source then
    select count(*) into v_landing_count
    from public.profiles
    where signup_source = v_landing_source;

    if v_landing_count < v_landing_cap then
      v_welcome := v_landing_welcome;
      v_note := 'Ingatlan landing — 10 kezdőkredit';
    else
      v_note := 'Ingatlan landing (keret betelt) — 3 kredit';
    end if;
  end if;

  insert into public.profiles (id, role, full_name, company, phone, signup_source)
  values (
    new.id,
    'user',
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'company', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), ''),
    v_source
  );

  insert into public.wallets (user_id, balance)
  values (new.id, v_welcome)
  on conflict (user_id) do nothing;

  insert into public.credit_grants (admin_id, admin_email, user_id, user_email, amount, note)
  values (null, 'rendszer', new.id, new.email, v_welcome, v_note);

  return new;
end;
$$;
