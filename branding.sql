-- =====================================================================
-- Twinx AI Portal — Arculat-profilok (branding_profiles) a Hirdetéskészítőhöz
-- Futtasd a Supabase SQL Editorban a schema.sql UTÁN.
-- Egy felhasználó (akár céges, közös belépés) TÖBB arculat-profilt is tarthat
-- (pl. "Péter", "Andrea") — generáláskor kiválasztható. A logók a meglévő
-- publikus `reports` bucket `branding/` mappájába kerülnek (nem kell új bucket).
-- Idempotens.
-- =====================================================================

create table if not exists public.branding_profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  label         text not null,                       -- a profil neve (pl. "Péter")
  display_name  text not null default '',            -- a hirdetésen megjelenő név
  title         text not null default '',            -- titulus (pl. ingatlanértékesítő)
  phone         text not null default '',
  email         text not null default '',
  company       text not null default '',            -- cégnév
  website       text not null default '',            -- weboldal / URL
  slogan        text not null default '',            -- jelmondat / megjegyzés
  logo_url      text,
  accent_color  text not null default '#ef7a5a',     -- kiemelő szín (hex)
  font          text not null default 'inter',       -- választott betűtípus (slug)
  theme         text not null default 'light',       -- 'light' | 'dark'
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists branding_profiles_user_idx
  on public.branding_profiles (user_id, created_at desc);

drop trigger if exists set_branding_profiles_updated_at on public.branding_profiles;
create trigger set_branding_profiles_updated_at
  before update on public.branding_profiles
  for each row execute function public.set_updated_at();

-- RLS: a felhasználó a SAJÁT profiljait olvassa; admin mindet. Írás a backendből
-- (service_role) történik, ami megkerüli az RLS-t.
alter table public.branding_profiles enable row level security;

drop policy if exists "branding_select_own" on public.branding_profiles;
create policy "branding_select_own" on public.branding_profiles
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "branding_admin_write" on public.branding_profiles;
create policy "branding_admin_write" on public.branding_profiles
  for all using (public.is_admin()) with check (public.is_admin());
