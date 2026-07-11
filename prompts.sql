-- prompts.sql — verziózott AI-promptok (finomítható szegmensek).
-- A promptok VÁLTOZÓ-blokkja NEM itt tárolódik: azt a kód rakja össze (zárolt).
-- Itt csak a szerkeszthető (finomítható) szövegtömbök élnek, verziónként.
--
-- segments: jsonb, szegmens-id -> szöveg (pl. { "intro": "...", "task": "..." }).
-- Modulonként pontosan egy aktív verzió lehet (ai_prompts_active_uniq).
-- Ha egy modulhoz nincs aktív sor, a rendszer a kódban lévő alapértelmezett
-- szövegekkel dolgozik (így egy korábbi/alap prompt sosem veszik el).

create table if not exists public.ai_prompts (
  id         uuid primary key default gen_random_uuid(),
  module     text not null,                       -- pl. 'land'
  version    integer not null,                    -- modulonként növekvő
  name       text,                                -- opcionális címke, pl. 'v2 — óvatosabb hangnem'
  segments   jsonb not null default '{}'::jsonb,  -- { "intro": "...", "task": "..." }
  is_active  boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists ai_prompts_module_idx
  on public.ai_prompts (module, version desc);

-- Modulonként legfeljebb egy aktív verzió.
create unique index if not exists ai_prompts_active_uniq
  on public.ai_prompts (module) where is_active;

-- Csak a service_role (admin API-k) érik el; nincs publikus policy.
alter table public.ai_prompts enable row level security;
