-- =====================================================================
-- Twinx AI Portal — Kedvenc videósablonok (partnerenként)
-- Futtasd a Supabase SQL Editorban (egyszer). Újrafuttatható.
--
-- A videó-szerkesztő sablonkártyáin a csillag ide ment; a „Kedvencek” szűrő
-- ebből dolgozik. Egy sor = egy partner egy kedvenc sablonja (pl. 'mozaik').
-- =====================================================================

create table if not exists public.video_template_favorites (
  user_id     uuid not null references auth.users(id) on delete cascade,
  template_id text not null check (template_id ~ '^[a-z0-9-]{1,40}$'),
  created_at  timestamptz not null default now(),
  primary key (user_id, template_id)
);

alter table public.video_template_favorites enable row level security;

-- Mindenki csak a SAJÁT kedvenceit látja és kezeli.
drop policy if exists "vtf_select_own" on public.video_template_favorites;
create policy "vtf_select_own" on public.video_template_favorites
  for select using (auth.uid() = user_id);

drop policy if exists "vtf_insert_own" on public.video_template_favorites;
create policy "vtf_insert_own" on public.video_template_favorites
  for insert with check (auth.uid() = user_id);

drop policy if exists "vtf_delete_own" on public.video_template_favorites;
create policy "vtf_delete_own" on public.video_template_favorites
  for delete using (auth.uid() = user_id);
