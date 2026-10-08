-- =====================================================================
-- Twinx — IRODAI MAPPÁK + MEGOSZTÁS (IR7)
-- Futtasd a Supabase SQL Editorban az office.sql + office-mode.sql UTÁN. Idempotens.
--
-- • usage_history.office_id: az IRODAI módban készült munka megjelölése
--   (a beszúráskor automatikusan, a felhasználó munkamódja alapján).
-- • office_folders: közös irodai mappák; „everyone" = az egész iroda látja,
--   különben csak a létrehozó + a kiválasztott tagok (office_folder_members).
-- • office_folder_items: a mappába tett munkák — HIVATKOZÁS a usage_history
--   sorra (nem másolat): a munka a készítőjénél marad.
-- Írás/olvasás kizárólag a szerveren (service_role) át — a route-ok ellenőrzik
-- a jogosultságot, ezért itt nincs böngészős (RLS) olvasási szabály.
-- =====================================================================

-- 1) Irodai munka megjelölése ------------------------------------------
alter table public.usage_history
  add column if not exists office_id uuid references public.offices (id) on delete set null;

create or replace function public.usage_history_mark_office()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.office_id is null then
    select m.office_id into new.office_id
      from public.office_members m
     where m.user_id = new.user_id and m.work_mode = 'office';
  end if;
  return new;
end;
$$;

drop trigger if exists usage_history_mark_office on public.usage_history;
create trigger usage_history_mark_office
  before insert on public.usage_history
  for each row execute function public.usage_history_mark_office();


-- 2) Irodai mappák -------------------------------------------------------
create table if not exists public.office_folders (
  id          uuid primary key default gen_random_uuid(),
  office_id   uuid not null references public.offices (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  created_by  uuid references auth.users (id) on delete set null,
  everyone    boolean not null default false,   -- az egész iroda látja
  created_at  timestamptz not null default now()
);
create index if not exists office_folders_office_idx on public.office_folders (office_id, created_at desc);

create table if not exists public.office_folder_members (
  folder_id  uuid not null references public.office_folders (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  primary key (folder_id, user_id)
);

create table if not exists public.office_folder_items (
  folder_id   uuid not null references public.office_folders (id) on delete cascade,
  history_id  uuid not null references public.usage_history (id) on delete cascade,
  added_by    uuid references auth.users (id) on delete set null,
  added_at    timestamptz not null default now(),
  primary key (folder_id, history_id)
);
create index if not exists office_folder_items_folder_idx on public.office_folder_items (folder_id, added_at desc);

alter table public.office_folders        enable row level security;
alter table public.office_folder_members enable row level security;
alter table public.office_folder_items   enable row level security;
