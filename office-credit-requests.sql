-- =====================================================================
-- Twinx — „KREDIT KÉRÉSE A VEZETŐTŐL" (IR6c)
-- Futtasd a Supabase SQL Editorban az office.sql UTÁN. Idempotens.
--
-- Az irodai tag keretet kér; a létrehozó vagy a kiosztó jogú tag jóváhagyja
-- (ekkor office_allocate-tel nő a kerete) vagy elutasítja.
-- =====================================================================

create table if not exists public.office_credit_requests (
  id          uuid primary key default gen_random_uuid(),
  office_id   uuid not null references public.offices (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  amount      integer not null check (amount between 1 and 1000),
  note        text,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  granted     integer,
  decided_by  uuid references auth.users (id) on delete set null,
  decided_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists office_credit_requests_office_idx
  on public.office_credit_requests (office_id, status, created_at desc);

-- Egy tagnak irodánként egyszerre csak EGY függő kérése lehet.
create unique index if not exists office_credit_requests_one_pending_per_office
  on public.office_credit_requests (office_id, user_id) where status = 'pending';

alter table public.office_credit_requests enable row level security;

-- Olvasás: a saját kérések; az iroda összes kérése a létrehozónak/kiosztónak.
-- Írás: csak a szerver (service_role) — a route ellenőrzi a jogosultságot.
drop policy if exists "office_credit_requests_select" on public.office_credit_requests;
create policy "office_credit_requests_select" on public.office_credit_requests
  for select using (
    user_id = auth.uid()
    or public.is_office_manager(office_id)
    or public.is_admin()
  );
