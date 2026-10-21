-- =====================================================================
-- Twinx — Sales hívásnapló (Sales → Felhasználók → „Részletek" → Hívásnapló)
-- Futtasd a Supabase SQL Editorban. Újrafuttatható.
--
-- Ügyfelenként időrendi bejegyzések: ki, mikor, milyen eredménnyel hívta, megjegyzés, és (ha kell) visszahívás napja.
-- A táblát CSAK a szerver éri el (service_role, a /api/sales/users/:id/calls végponton át, admin / sales ellenőrzéssel):
-- RLS bekapcsolva, policy NINCS → a böngészőből közvetlenül senki nem olvashatja / írhatja.
--
-- Visszavonás (ha valaha kell):  drop table if exists public.customer_call_notes;
-- =====================================================================

create table if not exists public.customer_call_notes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,   -- az ügyfél
  author_id    uuid references auth.users(id) on delete set null,          -- a sales / admin, aki rögzítette
  author_name  text,                                                       -- a rögzítő neve (pillanatkép)
  status       text not null
               check (status in ('talked', 'no_answer', 'callback', 'interested', 'not_interested')),
  note         text,
  callback_on  date,                                                       -- visszahívás napja (csak „Visszahívni"-nál)
  created_at   timestamptz not null default now()
);

create index if not exists customer_call_notes_user_idx
  on public.customer_call_notes (user_id, created_at desc);

alter table public.customer_call_notes enable row level security;
