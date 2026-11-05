-- Admin → AI-ügynökök: az ügynökök állapota és naplója. Az ügynök tölti titokkal védett végponton át, a felület csak olvassa.
-- RLS van, szándékosan policy nélkül: csak a szerver (service_role) éri el. Felhasználói név és e-mail-cím nincs benne;
-- a naplóban legfeljebb maszkolt cím, az összefoglalóban felhasználói azonosító szerepel. Az agent oszlop miatt több ügynökre is jó.
-- Újrafuttatható.

create table if not exists public.agent_status (
  agent        text primary key,
  dry_run      boolean not null,
  last_seen_at timestamptz not null default now(),
  summary      jsonb
);
alter table public.agent_status enable row level security;

-- Az (agent, source_id) egyedi: ha az ügynök újraküld egy naplósort, nem lesz belőle kettő.
create table if not exists public.agent_events (
  id         bigint generated always as identity primary key,
  agent      text not null,
  source_id  bigint not null,
  dry_run    boolean not null,
  kind       text not null,
  message    text,
  data       jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists agent_events_source_uq on public.agent_events (agent, source_id);
create index if not exists agent_events_created_idx on public.agent_events (created_at desc);
alter table public.agent_events enable row level security;
