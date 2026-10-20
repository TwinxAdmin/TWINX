-- =====================================================================
-- Twinx — Prémium 3D („Alaprajzból 3D") — Hamarosan állapot + várólista
-- Futtasd a Supabase SQL Editorban. Újrafuttatható.
--
-- app_settings.premium3d_status: "hidden" | "coming_soon" | "available"
--   hidden       — a menüpont csak az adminnak látszik
--   coming_soon  — mindenki látja „Hamarosan" jelvénnyel; megnyitva a bemutató + várólista; 3D-generálás NEM indítható
--   available    — előkészítve (külön feladat köti be élesre)
--   Az admin minden állapotban használhatja a modult (fejlesztés, teszt).
-- premium3d_waitlist: „Értesíts, ha elérhető" — felhasználónként egy sor.
-- =====================================================================

insert into public.app_settings (key, value)
values ('premium3d_status', '"coming_soon"'::jsonb)
on conflict (key) do nothing;

create table if not exists public.premium3d_waitlist (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.premium3d_waitlist enable row level security;

-- A felhasználó a saját sorát láthatja (a feliratkozás a szerveren át, service_role-lal megy); az admin mindent.
drop policy if exists "premium3d_waitlist_own_select" on public.premium3d_waitlist;
create policy "premium3d_waitlist_own_select" on public.premium3d_waitlist
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "premium3d_waitlist_admin_all" on public.premium3d_waitlist;
create policy "premium3d_waitlist_admin_all" on public.premium3d_waitlist
  for all using (public.is_admin()) with check (public.is_admin());
