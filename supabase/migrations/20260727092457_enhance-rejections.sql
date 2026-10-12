-- Nem elfogadott (újragenerálásra küldött) képjavító-eredmények naplója.
-- A partner ingyenes újragenerálást kér; az admin itt látja, mi és miért nem sikerült.
-- Egyszer kell lefuttatni a Supabase SQL editorban.

create table if not exists public.enhance_rejections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null,                 -- feljavitas | rendrakas
  original_url text,                  -- a feltöltött eredeti kép
  rejected_url text not null,         -- a nem elfogadott generált kép
  replacement_url text,               -- az újragenerált kép (ha elkészült)
  reason text,                        -- a partner indoklása
  created_at timestamptz not null default now()
);

alter table public.enhance_rejections enable row level security;

-- A felhasználó a sajátját írhatja/olvashatja
drop policy if exists "enhance_rejections own" on public.enhance_rejections;
create policy "enhance_rejections own" on public.enhance_rejections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Admin mindent lát (profiles.role = 'admin')
drop policy if exists "enhance_rejections admin read" on public.enhance_rejections;
create policy "enhance_rejections admin read" on public.enhance_rejections
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create index if not exists enhance_rejections_created_idx on public.enhance_rejections(created_at desc);
