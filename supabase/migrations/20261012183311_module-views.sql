-- =====================================================================
-- Twinx — MODUL-MEGNYITÁSOK NAPLÓJA (MH1, admin „Modul-használat" fül)
-- Futtasd a Supabase SQL Editorban. Idempotens.
--
-- Mit mér: melyik bejelentkezett felhasználó melyik modul oldalát nyitotta meg — fejenként,
-- modulonként NAPONTA EGY sor (a többszöri megnyitás ugyanazon a napon nem növeli a táblát).
-- Így látszik az érdeklődés akkor is, ha a megnyitásból nem lett futtatás.
-- • module_href: a modul útvonala a katalógusból (pl. /dashboard/real-estate/valuation) — iparág-független kulcs
-- • Írni CSAK a szerver tud (service_role, /api/track/module-view); olvasni a saját sorokat + admin.
-- =====================================================================

create table if not exists public.module_views (
  user_id      uuid not null references auth.users (id) on delete cascade,
  module_href  text not null check (char_length(module_href) between 2 and 200),
  day          date not null default (now() at time zone 'Europe/Budapest')::date,
  first_at     timestamptz not null default now(),
  primary key (user_id, module_href, day)
);

-- az admin-összesítőhöz: időszak + modul szerinti lekérdezés
create index if not exists module_views_day_idx on public.module_views (day desc, module_href);

alter table public.module_views enable row level security;

drop policy if exists "module_views_select_own" on public.module_views;
create policy "module_views_select_own" on public.module_views
  for select using (user_id = auth.uid() or public.is_admin());
-- insert / update / delete policy NINCS: böngészőből nem írható (csak service_role).
