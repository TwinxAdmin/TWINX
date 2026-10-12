-- =====================================================================
-- Twinx — KEDVENC MODULOK (felhasználónként)
-- Futtasd a Supabase SQL Editorban. Idempotens: többször is lefuttatható.
--
-- A felhasználó csillaggal jelölheti meg a gyakran használt moduljait; az irodai
-- felület aljáról (vezető és kolléga) egy kattintással nyílnak. A kedvenc
-- FELHASZNÁLÓHOZ tartozik (nem irodához) — irodaváltáskor is megmarad.
-- A modul azonosítója az útvonala (pl. /dashboard/real-estate/video); hogy
-- valódi, látható modul-e, azt a szerver a katalógusból ellenőrzi mentés előtt.
-- =====================================================================

create table if not exists public.user_module_favorites (
  user_id     uuid not null references auth.users (id) on delete cascade,
  module_href text not null check (char_length(module_href) between 2 and 200),
  created_at  timestamptz not null default now(),
  primary key (user_id, module_href)
);

alter table public.user_module_favorites enable row level security;

-- Mindenki csak a SAJÁT kedvenceit látja / állítja.
drop policy if exists "user_module_favorites_select_own" on public.user_module_favorites;
create policy "user_module_favorites_select_own" on public.user_module_favorites
  for select using (user_id = auth.uid());

drop policy if exists "user_module_favorites_insert_own" on public.user_module_favorites;
create policy "user_module_favorites_insert_own" on public.user_module_favorites
  for insert with check (user_id = auth.uid());

drop policy if exists "user_module_favorites_delete_own" on public.user_module_favorites;
create policy "user_module_favorites_delete_own" on public.user_module_favorites
  for delete using (user_id = auth.uid());
