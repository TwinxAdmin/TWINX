-- =====================================================================
-- Twinx — Hírlevél-hozzájárulás + Brevo-szinkron (2026-10-21)
-- =====================================================================
-- profiles:
--   newsletter                     — kér-e hírlevelet (alapból NEM; regisztrációnál üres pipa)
--   newsletter_at                  — a legutóbbi változás (a hozzájárulás / visszavonás) időpontja
--   newsletter_source              — honnan jött: register / settings / portal / brevo (Brevóban leiratkozott)
--   newsletter_banner_dismissed_at — a Portálközpont „Szeretnél értesülni…?" sávját mikor zárta be
-- brevo_sync_queue: a Brevóba NEM sikerült felvinni (3 próbálkozás után) → a napi ütemezett feladat újrapróbálja.
--   Felhasználónként egy sor; sikeres szinkronnál törlődik. Csak a szerver éri el (RLS, policy nélkül).
-- Újrafuttatható.
-- =====================================================================

alter table public.profiles add column if not exists newsletter boolean not null default false;
alter table public.profiles add column if not exists newsletter_at timestamptz;
alter table public.profiles add column if not exists newsletter_source text;
alter table public.profiles add column if not exists newsletter_banner_dismissed_at timestamptz;

create table if not exists public.brevo_sync_queue (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  attempts   integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.brevo_sync_queue enable row level security;
-- nincs policy: csak a service_role (szerver) olvassa / írja
