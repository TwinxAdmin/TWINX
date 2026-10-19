-- =====================================================================
-- Twinx — Videósablonok ki-be kapcsolása (Admin → Videólabor)
-- Futtasd a Supabase SQL Editorban. Újrafuttatható.
--
-- video_template_availability: sablononként (sablon-család: aurora, skandi, prestige, mozaik, polaroid…)
--   enabled = true  → minden felhasználónak megjelenik és választható
--   enabled = false → rejtett (a sablon NEM törlődik; az admin továbbra is látja és tesztelheti)
--   NINCS SOR      → rejtett — így egy új sablon alapból rejtett, amíg az admin be nem pipálja.
-- video_template_availability_log: ki és mikor kapcsolta ki / be.
-- Írás és olvasás csak adminnak (RLS); a partnerek a szerveren át (service_role) kapják a listát.
-- =====================================================================

create table if not exists public.video_template_availability (
  template_id text primary key,
  enabled     boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);

create table if not exists public.video_template_availability_log (
  id          bigint generated always as identity primary key,
  template_id text not null,
  enabled     boolean not null,
  changed_by  uuid references auth.users(id) on delete set null,
  changed_at  timestamptz not null default now()
);

create index if not exists video_template_availability_log_template_idx
  on public.video_template_availability_log (template_id, changed_at desc);

alter table public.video_template_availability enable row level security;
alter table public.video_template_availability_log enable row level security;

drop policy if exists "video_template_availability_admin_all" on public.video_template_availability;
create policy "video_template_availability_admin_all" on public.video_template_availability
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "video_template_availability_log_admin_all" on public.video_template_availability_log;
create policy "video_template_availability_log_admin_all" on public.video_template_availability_log
  for all using (public.is_admin()) with check (public.is_admin());

-- A MOST ÉLŐ sablonok elérhetők maradnak (a későbbi újak sor nélkül = rejtettek).
insert into public.video_template_availability (template_id, enabled)
values ('aurora', true), ('skandi', true), ('prestige', true), ('mozaik', true), ('polaroid', true)
on conflict (template_id) do nothing;
