-- =====================================================================
-- Twinx — LinkedIn bemutatkozó oldal (twinx.hu/bemutatkozas): 10 kezdőkredit, saját jelöléssel
-- Futtasd a Supabase SQL Editorban (a 20260928085945_profile-phone.sql UTÁN). Újrafuttatható.
--
-- MIÉRT: aki a LinkedInen kiküldött oldalról regisztrál, az a szokásos 3 helyett 10 kredittel indul, és az
-- adminban „LinkedIn" jelölést kap. Saját keret (első 50), így nem fogyasztja az ingatlan landing keretét.
-- A számokat a lib/onboarding.ts is tartalmazza — ha itt módosítasz, ott is írd át
-- (LANDING_WELCOME_CREDITS, LINKEDIN_CREDITS_CAP).
-- A futtatás előtt az oldalról regisztráló a jelölést már megkapja, de csak 3 kredittel indul.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default_welcome  constant integer := 3;
  v_landing_welcome  constant integer := 10;
  v_landing_cap      constant integer := 50;
  v_landing_source   constant text    := 'ingatlan-landing';
  v_linkedin_cap     constant integer := 50;
  v_linkedin_source  constant text    := 'linkedin-bemutatkozas';
  v_source           text;
  v_welcome          integer := v_default_welcome;
  v_landing_count    integer;
  v_note             text := 'Regisztrációs próbakredit';
begin
  v_source := nullif(trim(coalesce(new.raw_user_meta_data ->> 'signup_source', '')), '');

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
  elsif v_source = v_linkedin_source then
    select count(*) into v_landing_count
    from public.profiles
    where signup_source = v_linkedin_source;

    if v_landing_count < v_linkedin_cap then
      v_welcome := v_landing_welcome;
      v_note := 'LinkedIn — 10 kezdőkredit';
    else
      v_note := 'LinkedIn (keret betelt) — 3 kredit';
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
