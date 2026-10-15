-- „Alaprajzból bejárható 3D lakás" modul — 1. lépés: a feltöltött alaprajz és a szerkeszthető lakásleírás mentése.
-- A lakásleírás (plan, JSON) az EGYETLEN igazságforrás; a 3D, az alaprajz-ábra és a videó is ebből készül.
-- Írás CSAK a szerveren (API route, service role) — a felhasználó a saját sorait olvashatja.
-- „Törlés" = elrejtés (hidden_at), a tárhelyről nem törlünk. Újrafuttatható.

create table if not exists public.floorplan_projects (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  title           text not null default 'Alaprajz',
  source_kind     text not null default 'digital' check (source_kind in ('digital', 'hand')),
  style           text not null default 'japandi',
  source_path     text,                 -- a feltöltött eredeti a 'floorplans' tárhelyen
  source_mime     text,
  plan            jsonb not null,       -- FloorPlan (lib/floorplan3d/plan.ts)
  digitize_stats  jsonb,                -- lépték, idő, költség, modell (mérés a prototípus-jelentéshez)
  hand_accepted   boolean not null default false,  -- kézi rajz: a pontosság a felhasználó felelőssége
  status          text not null default 'draft' check (status in ('draft', 'approved', 'building', 'ready', 'failed')),
  approved_at     timestamptz,
  hidden_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists floorplan_projects_user_idx on public.floorplan_projects (user_id, created_at desc);

alter table public.floorplan_projects enable row level security;

drop policy if exists floorplan_projects_select_own on public.floorplan_projects;
create policy floorplan_projects_select_own on public.floorplan_projects
  for select to authenticated using (user_id = auth.uid());
-- insert / update / delete: nincs policy → csak a szerver (service role) írhat

-- privát tárhely az eredeti alaprajzoknak (a szerver aláírt linkkel adja ki)
insert into storage.buckets (id, name, public)
values ('floorplans', 'floorplans', false)
on conflict (id) do nothing;
