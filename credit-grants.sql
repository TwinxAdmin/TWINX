-- =====================================================================
-- Twinx — Kredit-napló: ki, kinek, mikor, mennyi kreditet adott
-- Futtasd a Supabase SQL Editorban.
--
-- Miért kell: az admin kézzel is adhat kreditet (értékesítés, prezentáció,
-- kárpótlás). Ez pénzértékű művelet, ezért nyomon követhetőnek kell lennie —
-- főleg, ha több admin dolgozik a rendszerben.
-- =====================================================================

create table if not exists public.credit_grants (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid references auth.users (id) on delete set null,
  admin_email  text,                      -- a napló akkor is olvasható marad,
  user_id      uuid references auth.users (id) on delete set null,
  user_email   text,                      -- ha a fiók később törlődik
  amount       integer not null check (amount > 0),
  note         text,                      -- miért adta (opcionális)
  created_at   timestamptz not null default now()
);

create index if not exists credit_grants_created_idx on public.credit_grants (created_at desc);
create index if not exists credit_grants_user_idx on public.credit_grants (user_id, created_at desc);

alter table public.credit_grants enable row level security;

-- A naplót CSAK admin olvashatja; írni kizárólag a szerver (service_role) tud.
drop policy if exists "credit_grants_admin_read" on public.credit_grants;
create policy "credit_grants_admin_read" on public.credit_grants
  for select using (public.is_admin());
