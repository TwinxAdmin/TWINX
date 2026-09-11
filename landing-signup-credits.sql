-- =====================================================================
-- Twinx — Ingatlan landing: azonnali 10 kredit regisztrációkor
-- Futtasd a Supabase SQL Editorban (a welcome-credits.sql UTÁN).
--
-- MIÉRT: aki a twinx.hu/ingatlan landingről regisztrál (megbízható, sales
-- által célzott ingatlanos partner), az a szokásos 3 helyett 10 kredittel
-- indul — kód és kézi jóváhagyás nélkül. A régi, jóváhagyós/ajándékkódos út
-- (invites) megmarad, csak nem ez a fő folyamat.
--
-- HOGYAN: a regisztráció a Supabase signUp metaadatában elküld egy
-- `signup_source = 'ingatlan-landing'` jelölést. A trigger ebből dönt:
--   • ha a forrás a landing ÉS még nem telt be az első 50 hely → 10 kredit,
--   • egyébként → a szokásos 3 kredit.
-- A forrás minden esetben a profiles-ba kerül, így az admin látja, ki
-- honnan érkezett (akkor is, ha már a 3 kredites sávba esett).
--
-- A számokat a lib/onboarding.ts is tartalmazza — ha itt módosítasz,
-- ott is írd át (LANDING_WELCOME_CREDITS, LANDING_CREDITS_CAP).
-- =====================================================================

-- 1) Forrás-oszlop a profilokon.
alter table public.profiles
  add column if not exists signup_source text;

comment on column public.profiles.signup_source is
  'Honnan regisztrált a felhasználó (pl. ''ingatlan-landing''). NULL = közvetlen twinx.hu.';

-- 2) Trigger: forrás-alapú kezdőkredit + a forrás mentése.
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
      -- Betelt a keret: marad a szokásos 3, de a forrás így is látszik.
      v_note := 'Ingatlan landing (keret betelt) — 3 kredit';
    end if;
  end if;

  insert into public.profiles (id, role, full_name, company, signup_source)
  values (
    new.id,
    'user',
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'company', '')), ''),
    v_source
  );

  -- Kezdőkredit. `on conflict do nothing`, hogy egy esetleges újrafutás ne adjon duplán.
  insert into public.wallets (user_id, balance)
  values (new.id, v_welcome)
  on conflict (user_id) do nothing;

  -- Nyoma legyen a kredit-naplóban (rendszer-bejegyzésként).
  insert into public.credit_grants (admin_id, admin_email, user_id, user_email, amount, note)
  values (null, 'rendszer', new.id, new.email, v_welcome, v_note);

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Megjegyzés: a visszamenőleges feltöltést szándékosan NEM ismételjük meg —
-- azt a welcome-credits.sql már elvégezte. Ez a fájl csak az új, forrás-alapú
-- logikát vezeti be a mostantól érkező regisztrációkra.
-- ---------------------------------------------------------------------
