-- „Alaprajzból bejárható 3D lakás" modul — 4. lépés (F4b): megosztható bejárás-link.
-- A link egy KITALÁLHATATLAN azonosító (token, 32 karakter, véletlen) → nyilvános oldal belépés nélkül: /3d/<token>.
-- Lejárat: létrehozáskor + linkDays (config, alapból 30 nap); kreditért meghosszabbítható (config: creditsExtend).
-- Visszavonás = revoked_at (a sor és a projekt megmarad, semmit nem törlünk). Projektenként egyszerre egy élő link.
-- Írás és a nyilvános olvasás CSAK a szerveren (service role); a tulajdonos a saját sorait olvashatja. Újrafuttatható.

create table if not exists public.floorplan_shares (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.floorplan_projects(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  token           text not null unique,
  expires_at      timestamptz not null,
  revoked_at      timestamptz,
  extend_count    integer not null default 0,
  views           integer not null default 0,
  last_viewed_at  timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists floorplan_shares_project_idx on public.floorplan_shares (project_id, created_at desc);

alter table public.floorplan_shares enable row level security;

drop policy if exists floorplan_shares_select_own on public.floorplan_shares;
create policy floorplan_shares_select_own on public.floorplan_shares
  for select to authenticated using (user_id = auth.uid());
-- insert / update / delete és a nyilvános (token szerinti) olvasás: nincs policy → csak a szerver (service role)

-- megnyitás-számláló (atomikusan, a nyilvános oldal hívja service role-lal)
create or replace function public.floorplan_share_viewed(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.floorplan_shares
     set views = views + 1, last_viewed_at = now()
   where token = p_token and revoked_at is null and expires_at > now();
$$;

revoke all on function public.floorplan_share_viewed(text) from public, anon, authenticated;
