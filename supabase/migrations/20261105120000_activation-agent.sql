-- Aktiváló ügynök, első kör: visszajelzések, leiratkozások, heti jelentések.
-- Mindhárom táblán RLS van, szándékosan policy nélkül: csak a szerver (service_role) éri el, a felhasználó soha közvetlenül.
-- Újrafuttatható.

-- Levélből érkező visszajelzés. A source_email_id egyedi: egy levélre egy válasz rögzül, a link második kattintása nem ír újat.
create table if not exists public.activation_feedback (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  question_id     text not null,
  category        text not null,
  free_text       text,
  text_at         timestamptz,
  source_email_id text not null,
  user_state      text,
  created_at      timestamptz not null default now()
);
create unique index if not exists activation_feedback_source_email_uq on public.activation_feedback (source_email_id);
create index if not exists activation_feedback_created_idx on public.activation_feedback (created_at desc);
create index if not exists activation_feedback_text_at_idx on public.activation_feedback (text_at desc) where text_at is not null;
alter table public.activation_feedback enable row level security;

-- Leiratkozás az aktiváló levelekről. Külön a profiles.newsletter mezőtől: az csak a marketing-hozzájárulás, ami a legtöbb
-- felhasználónál eleve „nem", mégis kaphatnak szolgáltatási levelet. Az e-mail a kulcs, a fiók törlése után is érvényes marad.
create table if not exists public.email_optout (
  email      text primary key check (email = lower(email)),
  user_id    uuid references auth.users (id) on delete set null,
  source     text not null default 'activation',
  created_at timestamptz not null default now()
);
create index if not exists email_optout_user_idx on public.email_optout (user_id);
alter table public.email_optout enable row level security;

-- Heti jelentés az admin felületre (az ügynök küldi hétfőnként, ugyanaz megy Telegramra is).
create table if not exists public.activation_reports (
  week_start date primary key,
  summary    text not null,
  data       jsonb,
  created_at timestamptz not null default now()
);
alter table public.activation_reports enable row level security;
