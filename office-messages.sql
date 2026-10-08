-- =====================================================================
-- Twinx — IRODAI ÜZENETEK ÉS FELADATOK (IF3)
-- Futtasd a Supabase SQL Editorban az office*.sql fájlok UTÁN (office-folders.sql is!).
-- Idempotens: többször is lefuttatható.
--
-- Típusok:
--   • task    — Feladat (határidővel, opcionális modullal); állapota: open → accepted → done
--   • done    — Kész munka (jelzés, hogy valami elkészült — jellemzően mappát / munkát csatolva)
--   • message — Üzenet
--   (A KREDITKÉRÉS a meglévő office_credit_requests táblában marad — a felület együtt mutatja.)
-- Címzett: egy tag (recipient_id) vagy MINDENKI (recipient_id = null).
-- „Mindenki" feladatot az veszi át, aki elsőként rányom az „Elvállalom"-ra.
-- Írás CSAK a szerveren (API route-ok, service_role) — böngészőből semmi.
-- Törlés nincs (CLAUDE.md: soft-listing) — a felület a legutóbbi 50 tételt listázza.
-- =====================================================================

-- 1) Segéd: tagja-e a bejelentkezett felhasználó az irodának (RLS-hez, rekurzió nélkül)
create or replace function public.is_office_member(p_office uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (select 1 from public.office_members where office_id = p_office and user_id = auth.uid());
$$;


-- 2) ÜZENETEK -----------------------------------------------------------------
create table if not exists public.office_messages (
  id            uuid primary key default gen_random_uuid(),
  office_id     uuid not null references public.offices (id) on delete cascade,
  sender_id     uuid references auth.users (id) on delete set null,
  recipient_id  uuid references auth.users (id) on delete cascade,      -- null = Mindenki
  kind          text not null check (kind in ('task', 'done', 'message')),
  body          text not null check (char_length(body) between 1 and 2000),
  due_date      date,                                                    -- csak feladatnál
  module_href   text check (module_href is null or char_length(module_href) <= 200),
  folder_id     uuid references public.office_folders (id) on delete set null,
  history_id    uuid references public.usage_history (id) on delete set null,
  parent_id     uuid references public.office_messages (id) on delete set null,  -- válasz / kapcsolódó feladat
  task_status   text check (task_status in ('open', 'accepted', 'done')),
  assignee_id   uuid references auth.users (id) on delete set null,     -- aki elvállalta
  accepted_at   timestamptz,
  done_at       timestamptz,
  created_at    timestamptz not null default now(),
  -- feladatnak mindig van állapota, másnak soha
  constraint office_messages_task_status_chk check (
    (kind = 'task' and task_status is not null) or (kind <> 'task' and task_status is null)
  )
);

create index if not exists office_messages_office_idx    on public.office_messages (office_id, created_at desc);
create index if not exists office_messages_recipient_idx on public.office_messages (recipient_id, created_at desc);
create index if not exists office_messages_sender_idx    on public.office_messages (sender_id, created_at desc);

alter table public.office_messages enable row level security;

-- Olvasás: az iroda tagja, és ő a címzett / a küldő / „Mindenki" az üzenet.
drop policy if exists "office_messages_select" on public.office_messages;
create policy "office_messages_select" on public.office_messages
  for select using (
    public.is_office_member(office_id)
    and (recipient_id is null or recipient_id = auth.uid() or sender_id = auth.uid())
  );


-- 3) OLVASOTTSÁG -----------------------------------------------------------------
create table if not exists public.office_message_reads (
  message_id  uuid not null references public.office_messages (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  read_at     timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.office_message_reads enable row level security;

drop policy if exists "office_message_reads_select_own" on public.office_message_reads;
create policy "office_message_reads_select_own" on public.office_message_reads
  for select using (user_id = auth.uid());


-- 4) VÉDELEM: böngészőből (anon / authenticated) semmilyen írás -----------------
--    („security invoker": a current_user a hívó valódi szerepe)
create or replace function public.office_messages_guard()
returns trigger
language plpgsql security invoker set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    raise exception 'OFFICE_WRITE_FORBIDDEN';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists office_messages_guard_trg on public.office_messages;
create trigger office_messages_guard_trg
  before insert or update or delete on public.office_messages
  for each row execute function public.office_messages_guard();

drop trigger if exists office_message_reads_guard_trg on public.office_message_reads;
create trigger office_message_reads_guard_trg
  before insert or update or delete on public.office_message_reads
  for each row execute function public.office_messages_guard();


-- 5) Jogok ------------------------------------------------------------------------
revoke execute on function public.is_office_member(uuid) from public, anon;
grant execute on function public.is_office_member(uuid) to authenticated, service_role;
