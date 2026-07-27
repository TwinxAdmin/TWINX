-- Arculati képtár: több logó és több fotó egy profilhoz, közülük egy az aktív.
-- Az AKTÍV kép továbbra is a branding_profiles.logo_url / agent_photo_url mezőben van
-- (így a hirdetés- és videó-generálás változatlanul működik) — ez a tábla a választékot tárolja.
-- Egyszer kell lefuttatni a Supabase SQL editorban.

create table if not exists public.branding_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references public.branding_profiles(id) on delete cascade,
  kind text not null check (kind in ('logo', 'agent')),
  url text not null,
  created_at timestamptz not null default now()
);

alter table public.branding_assets enable row level security;

drop policy if exists "branding_assets own" on public.branding_assets;
create policy "branding_assets own" on public.branding_assets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists branding_assets_profile_idx on public.branding_assets(profile_id, kind);
