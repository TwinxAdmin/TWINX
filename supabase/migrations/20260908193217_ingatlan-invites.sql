-- Ingatlanos ajándékkredit-kampány (/ingatlan landing).
--
-- Folyamat: a landingen valaki JELENTKEZIK → minden admin e-mailt kap → az admin
-- ELFOGADJA → a rendszer egyszer használatos KÓDOT generál és kiküldi →
-- a jelentkező a regisztrációnál (vagy utólag a fiókjában) BEVÁLTJA →
-- a kerete 10 kreditre egészül ki (a 3 regisztrációs benne van, tehát SOHA nem 13).
--
-- Egyszer kell lefuttatni a Supabase SQL editorban.

-- 1) Jelentkezések + kiadott kódok egy táblában (a kód a jelentkezéshez tartozik)
create table if not exists public.ingatlan_invites (
  id uuid primary key default gen_random_uuid(),
  -- A jelentkező adatai a landingről
  name text not null,
  email text not null,
  phone text not null,
  office text not null,
  intent text,                       -- 'kreditek' | 'bemutato'
  -- Állapot: uj → elfogadva (kóddal) | elutasitva
  status text not null default 'uj' check (status in ('uj', 'elfogadva', 'elutasitva')),
  code text unique,                  -- csak elfogadás után kap értéket
  credits integer not null default 10,   -- ennyi kreditre egészít ki a beváltás
  -- Ki és mikor bírálta el
  decided_by uuid references auth.users(id) on delete set null,
  decided_by_email text,
  decided_at timestamptz,
  admin_note text,
  -- Beváltás
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Kereséshez / listázáshoz
create index if not exists ingatlan_invites_status_idx on public.ingatlan_invites(status, created_at desc);
create index if not exists ingatlan_invites_email_idx on public.ingatlan_invites(lower(email));

-- 2) RLS: a táblához KÖZVETLENÜL senki nem fér hozzá.
--    A landing beküldés, az admin elbírálás és a beváltás mind service_role
--    kulccsal, szerveroldali API-n keresztül történik (ott van a jogosultság-
--    ellenőrzés is). Így egy bejelentkezett felhasználó nem tudja kilistázni
--    vagy kitalálni mások kódját.
alter table public.ingatlan_invites enable row level security;
drop policy if exists "ingatlan_invites_no_direct_access" on public.ingatlan_invites;
-- (Szándékosan NINCS engedélyező policy: RLS mellett minden user-kliens kérés tiltott.)

-- 3) A felhasználó megjelölése: honnan jött és milyen kóddal
alter table public.profiles
  add column if not exists signup_source text,      -- pl. 'ingatlan-landing'
  add column if not exists invite_code text;        -- a beváltott kód

create index if not exists profiles_signup_source_idx on public.profiles(signup_source);

comment on column public.profiles.signup_source is
  'Honnan érkezett a felhasználó (pl. ingatlan-landing). Az ajándékkód beváltásakor töltjük.';
comment on column public.profiles.invite_code is
  'A beváltott ingatlanos ajándékkód (ingatlan_invites.code).';
