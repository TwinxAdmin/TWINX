-- =====================================================================
-- Twinx AI Portal — Rendszer-beállítások (kulcs → érték)
-- Futtasd a Supabase SQL Editorban (egyszer). Újrafuttatható.
--
-- Első használat: a videómotor kapcsolója.
--   key = 'video_renderer', value = '"twinx"' vagy '"shotstack"'
-- Az admin a Videólaborban állítja; a partnerek videói ez alapján készülnek.
-- =====================================================================

create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.app_settings enable row level security;

-- Csak admin olvashatja/írhatja közvetlenül. A szerver (service_role) megkerüli
-- az RLS-t — a partnerek videó-útvonala így olvassa a kapcsolót.
drop policy if exists "app_settings_admin_all" on public.app_settings;
create policy "app_settings_admin_all" on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- Alapállapot: a SAJÁT TWINX motor generálja a videókat (a Shotstack tartalék).
insert into public.app_settings (key, value)
values ('video_renderer', '"twinx"'::jsonb)
on conflict (key) do nothing;
