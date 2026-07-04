-- =====================================================================
-- Twinx AI Portal — Adatbázis séma (1. fázis)
-- Supabase PostgreSQL. Másold be a Supabase Dashboard > SQL Editor-ba és futtasd.
--
-- Tartalom:
--   1) ENUM típusok
--   2) Táblák (profiles, services, company_access, user_credits, usage_history)
--   3) Trigger-függvények (új user -> profil, updated_at karbantartás)
--   4) Segédfüggvény (is_admin) + Row Level Security (RLS) policy-k
--
-- Megjegyzés: a `users` a Supabase Auth törzstáblája (auth.users), azt NEM hozzuk
-- létre, csak hivatkozunk rá. A `profiles` az auth.users-hez 1:1 kapcsolódik.
-- =====================================================================


-- =====================================================================
-- 1) ENUM TÍPUSOK
-- =====================================================================
-- Idempotens enum-létrehozás (újrafuttatható marad).
do $$ begin
  create type public.user_role as enum ('user', 'sales', 'admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.service_status as enum ('public', 'private');
exception when duplicate_object then null;
end $$;


-- =====================================================================
-- 2) TÁBLÁK
-- =====================================================================

-- profiles: az auth.users kiegészítése szerepkörrel ---------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  role       public.user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- services: iparági / B2B modulok --------------------------------------
create table public.services (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,                    -- pl. 'real-estate'
  status     public.service_status not null default 'private',
  created_at timestamptz not null default now()
);

-- company_access: B2B ügyfelek hozzáférése privát modulokhoz -----------
create table public.company_access (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, service_id)
);

-- user_credits: felhasználónkénti + modulonkénti kredit egyenleg -------
create table public.user_credits (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  service_id        uuid not null references public.services (id) on delete cascade,
  remaining_credits integer not null default 0 check (remaining_credits >= 0),
  updated_at        timestamptz not null default now(),
  unique (user_id, service_id)                        -- 1 egyenleg / user / modul
);

-- usage_history: generálási előzmények --------------------------------
create table public.usage_history (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  service_id      uuid not null references public.services (id) on delete cascade,
  feature_used    text not null,                      -- pl. 'visualization', 'valuation'
  input_data      jsonb,
  output_file_url text,
  created_at      timestamptz not null default now()
);

-- Gyors lekérdezés a "legutóbbi 50 elem" listához
create index usage_history_user_created_idx
  on public.usage_history (user_id, created_at desc);


-- =====================================================================
-- 3) TRIGGER-FÜGGVÉNYEK
-- =====================================================================

-- Új auth.users beszúrásakor automatikusan létrejön a profil (role='user').
-- SECURITY DEFINER: a trigger megkerüli az RLS-t a beszúráshoz.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'user');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at automatikus frissítése minden UPDATE-nél
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_user_credits_updated_at
  before update on public.user_credits
  for each row execute function public.set_updated_at();


-- =====================================================================
-- 4) SEGÉDFÜGGVÉNY + ROW LEVEL SECURITY
-- =====================================================================

-- Admin-ellenőrzés RLS-hez. SECURITY DEFINER, hogy elkerüljük a
-- profiles-on belüli rekurzív policy-kiértékelést.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- RLS bekapcsolása minden táblán
alter table public.profiles       enable row level security;
alter table public.services       enable row level security;
alter table public.company_access enable row level security;
alter table public.user_credits   enable row level security;
alter table public.usage_history  enable row level security;

-- --- profiles ---------------------------------------------------------
-- A felhasználó a saját profilját olvassa; admin mindent lát.
-- Szándékosan NINCS user-oldali UPDATE policy: így a 'role' mező nem
-- eszkalálható. Szerepkört csak admin vagy service_role módosít.
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- --- services ---------------------------------------------------------
-- Publikus modult mindenki lát; privátot csak admin vagy akinek
-- company_access rekordja van rá. Írás csak admin.
create policy "services_select_visible" on public.services
  for select using (
    status = 'public'
    or public.is_admin()
    or exists (
      select 1 from public.company_access ca
      where ca.service_id = services.id and ca.user_id = auth.uid()
    )
  );

create policy "services_admin_write" on public.services
  for all using (public.is_admin()) with check (public.is_admin());

-- --- company_access ---------------------------------------------------
create policy "company_access_select_own" on public.company_access
  for select using (user_id = auth.uid() or public.is_admin());

create policy "company_access_admin_write" on public.company_access
  for all using (public.is_admin()) with check (public.is_admin());

-- --- user_credits -----------------------------------------------------
-- A felhasználó a saját egyenlegét olvassa. Kredit jóváírás/levonás a
-- backend API route-okban service_role kulccsal történik (megkerüli az RLS-t),
-- ezért nincs user-oldali write policy.
create policy "user_credits_select_own" on public.user_credits
  for select using (user_id = auth.uid() or public.is_admin());

create policy "user_credits_admin_write" on public.user_credits
  for all using (public.is_admin()) with check (public.is_admin());

-- --- usage_history ----------------------------------------------------
-- A felhasználó a saját előzményeit olvassa. Beszúrás a backendből
-- (service_role) történik a generálás után.
create policy "usage_history_select_own" on public.usage_history
  for select using (user_id = auth.uid() or public.is_admin());

create policy "usage_history_admin_write" on public.usage_history
  for all using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- VÉGE
-- =====================================================================
