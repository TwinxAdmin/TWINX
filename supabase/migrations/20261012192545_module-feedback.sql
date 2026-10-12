-- =====================================================================
-- Twinx — MODUL-VISSZAJELZÉS (ME3a, admin „Modul elemzés" → Elégedettség, „Mi hiányzik?")
-- Futtatás: Supabase SQL Editor. Idempotens.
--
-- 1) module_ratings — csillagos értékelés (1–5), felhasználónként és modulonként EGY sor:
--    • a 3. sikeres futtatás után kérdezzük; ha bezárja értékelés nélkül (status = dismissed),
--      a 6. futtatásnál még EGYSZER, utoljára (asked_count = 2) — utána soha többet
--    • 1–3 csillagnál nem kötelező ok(ok) + rövid megjegyzés
-- 2) module_asks — „Mi hiányzik?" (a 3. futtatás nélküli megnyitáskor, modulonként EGYSZER)
-- Írni CSAK a szerver tud (service_role); olvasni a saját sort + admin. Az admin elemzés összesít.
-- =====================================================================

-- 1) Csillagos értékelés -------------------------------------------------
create table if not exists public.module_ratings (
  user_id      uuid not null references auth.users (id) on delete cascade,
  module_href  text not null check (char_length(module_href) between 2 and 200),
  status       text not null check (status in ('rated', 'dismissed')),
  stars        smallint check (stars between 1 and 5),
  reasons      text[] not null default '{}',
  comment      text check (comment is null or char_length(comment) <= 500),
  asked_count  smallint not null default 1 check (asked_count between 1 and 2),
  run_count    integer,                                -- hányadik futtatásnál válaszolt / zárta be
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, module_href),
  constraint module_ratings_stars_chk check ((status = 'rated' and stars is not null) or (status = 'dismissed' and stars is null))
);
create index if not exists module_ratings_module_idx on public.module_ratings (module_href, updated_at desc);

alter table public.module_ratings enable row level security;
drop policy if exists "module_ratings_select" on public.module_ratings;
create policy "module_ratings_select" on public.module_ratings
  for select using (user_id = auth.uid() or public.is_admin());

drop trigger if exists set_module_ratings_updated_at on public.module_ratings;
create trigger set_module_ratings_updated_at
  before update on public.module_ratings
  for each row execute function public.set_updated_at();


-- 2) „Mi hiányzik?" -------------------------------------------------------
create table if not exists public.module_asks (
  user_id      uuid not null references auth.users (id) on delete cascade,
  module_href  text not null check (char_length(module_href) between 2 and 200),
  status       text not null check (status in ('answered', 'dismissed')),
  choice       text check (choice is null or choice in ('unclear', 'expensive', 'missing_data', 'browsing', 'other')),
  comment      text check (comment is null or char_length(comment) <= 500),
  device       text check (device is null or device in ('mobile', 'tablet', 'desktop')),
  created_at   timestamptz not null default now(),
  primary key (user_id, module_href)
);
create index if not exists module_asks_module_idx on public.module_asks (module_href, created_at desc);

alter table public.module_asks enable row level security;
drop policy if exists "module_asks_select" on public.module_asks;
create policy "module_asks_select" on public.module_asks
  for select using (user_id = auth.uid() or public.is_admin());
-- insert / update / delete policy NINCS egyik táblán sem: böngészőből nem írható (csak service_role).
