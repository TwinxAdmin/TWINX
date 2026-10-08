-- work-folders.sql — SAJÁT munka-mappák a „Korábbi munkák" oldalhoz.
-- Bármelyik modul munkája (videó, értékbecslés, kép…) betehető; egy munka több mappában is lehet.
-- A mappa csak hivatkozás: törlésekor a munka és a fájl megmarad (a tárhelyről nem törlünk).
-- Írás kizárólag a Next.js API-n át (service_role); a felhasználó csak a SAJÁT mappáit olvashatja.

create table if not exists public.work_folders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  created_at  timestamptz not null default now()
);
create index if not exists work_folders_user_idx on public.work_folders (user_id, created_at desc);

create table if not exists public.work_folder_items (
  folder_id   uuid not null references public.work_folders (id) on delete cascade,
  history_id  uuid not null references public.usage_history (id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (folder_id, history_id)
);
create index if not exists work_folder_items_history_idx on public.work_folder_items (history_id);

alter table public.work_folders enable row level security;
alter table public.work_folder_items enable row level security;

drop policy if exists "work_folders_select_own" on public.work_folders;
create policy "work_folders_select_own" on public.work_folders
  for select using (user_id = auth.uid());

drop policy if exists "work_folder_items_select_own" on public.work_folder_items;
create policy "work_folder_items_select_own" on public.work_folder_items
  for select using (exists (select 1 from public.work_folders f where f.id = folder_id and f.user_id = auth.uid()));

-- Írás csak a szerverről (service_role): a kliens közvetlenül nem módosíthat.
create or replace function public.work_folders_guard()
returns trigger
language plpgsql security invoker set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'WORK_FOLDERS_WRITE_FORBIDDEN';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists work_folders_guard_trg on public.work_folders;
create trigger work_folders_guard_trg
  before insert or update or delete on public.work_folders
  for each row execute function public.work_folders_guard();

drop trigger if exists work_folder_items_guard_trg on public.work_folder_items;
create trigger work_folder_items_guard_trg
  before insert or update or delete on public.work_folder_items
  for each row execute function public.work_folders_guard();
