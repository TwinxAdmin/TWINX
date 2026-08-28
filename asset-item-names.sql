-- Képek saját elnevezése a „Korábbi munkák" tálcán.
--
-- Miért kell: a képek nem adatbázis-sorok, hanem URL-ek (feljavított képek,
-- látványtervek). Eddig nem volt hova elmenteni a partner által adott nevet.
-- Ez a tábla felhasználónként és képenként EGY nevet tárol.
--
-- Egyszer kell lefuttatni a Supabase SQL editorban.

create table if not exists public.asset_item_names (
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  name text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, url)
);

alter table public.asset_item_names enable row level security;

-- Mindenki KIZÁRÓLAG a saját elnevezéseit látja és írja.
drop policy if exists "asset_item_names own" on public.asset_item_names;
create policy "asset_item_names own" on public.asset_item_names
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists asset_item_names_user_idx on public.asset_item_names(user_id);
