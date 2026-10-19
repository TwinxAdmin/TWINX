-- =====================================================================
-- Twinx — Korábbi munkák: LOMTÁR + VÉGLEGES TÖRLÉS
-- Futtasd a Supabase SQL Editorban. Újrafuttatható.
--
-- A lomtár a meglévő hidden_at oszlop (usage_history, video_jobs, ad_checks): az időpont = mikor került a
-- lomtárba. WORKS_TRASH_DAYS (alap 30) nap után a napi ütemezett takarítás (Vercel Cron → /api/cron/purge-trash)
-- véglegesen törli a munkát és a fájljait a Storage-ból.
--
-- 1) Egyszeri óraindítás: a MÁR elrejtett munkák lomtár-órája az élesítéskor indul (Márk döntése, 2026-10-20),
--    hogy senki ne veszítsen el váratlanul semmit. Egy jelző (app_settings) gondoskodik róla, hogy újrafuttatáskor
--    ne induljon újra az óra.
-- 2) work_purge_log: ki, mit, mikor törölt véglegesen, és mennyi tárhely szabadult fel.
-- 3) work_storage_sizes(): a törlendő fájlok mérete (storage.objects) — csak a szerver (service_role) hívhatja.
-- 4) work_paths_in_use(): melyik fájlra hivatkozik még MÁSIK munka (pl. irodai munkaátadás másolata ugyanazt a
--    fájlt használja) — ezeket a végleges törlés NEM törli a Storage-ból.
-- =====================================================================

-- 1) Egyszeri óraindítás
do $$
begin
  if not exists (select 1 from public.app_settings where key = 'works_trash_clock_reset') then
    update public.usage_history set hidden_at = now() where hidden_at is not null;
    update public.video_jobs    set hidden_at = now() where hidden_at is not null;
    update public.ad_checks     set hidden_at = now() where hidden_at is not null;
    insert into public.app_settings (key, value) values ('works_trash_clock_reset', to_jsonb(now()::text));
  end if;
end $$;

-- A napi takarítás gyors kereséséhez (csak a lomtárban lévő sorok).
create index if not exists usage_history_trash_idx on public.usage_history (hidden_at) where hidden_at is not null;

-- 2) Törlési napló
create table if not exists public.work_purge_log (
  id            bigint generated always as identity primary key,
  history_id    uuid not null,
  owner_id      uuid,
  deleted_by    uuid references auth.users(id) on delete set null,  -- null = automatikus (lejárt lomtár)
  feature       text,
  title         text,
  reason        text not null default 'manual',                    -- 'manual' | 'auto'
  files_deleted integer not null default 0,
  files_kept    integer not null default 0,                         -- más munka is használja → maradt
  bytes_freed   bigint not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists work_purge_log_created_idx on public.work_purge_log (created_at desc);
alter table public.work_purge_log enable row level security;
drop policy if exists "work_purge_log_admin_all" on public.work_purge_log;
create policy "work_purge_log_admin_all" on public.work_purge_log
  for all using (public.is_admin()) with check (public.is_admin());

-- 3) Fájlméretek (a megadott pontos utak + a megadott előtagok alatti összes fájl)
create or replace function public.work_storage_sizes(p_bucket text, p_paths text[], p_prefixes text[])
returns table (name text, size bigint)
language sql
security definer
set search_path = public, storage
as $$
  select o.name, coalesce((o.metadata->>'size')::bigint, 0)
    from storage.objects o
   where o.bucket_id = p_bucket
     and (o.name = any(coalesce(p_paths, '{}'))
          or exists (select 1 from unnest(coalesce(p_prefixes, '{}')) pre where o.name like pre || '%'));
$$;
revoke all on function public.work_storage_sizes(text, text[], text[]) from public, anon, authenticated;

-- 4) Mely utakra hivatkozik még MÁSIK munka (vagy egy másik munka korábbi verziója)?
create or replace function public.work_paths_in_use(p_paths text[], p_exclude uuid[])
returns table (path text)
language sql
security definer
set search_path = public
as $$
  select distinct p
    from unnest(coalesce(p_paths, '{}')) p
   where exists (
           select 1 from public.usage_history h
            where not (h.id = any(coalesce(p_exclude, '{}')))
              and (coalesce(h.output_file_url, '') like '%' || p or coalesce(h.input_data::text, '') like '%' || p || '%'))
      or exists (
           select 1 from public.work_versions v
            where not (v.history_id = any(coalesce(p_exclude, '{}')))
              and coalesce(v.output_file_url, '') like '%' || p);
$$;
revoke all on function public.work_paths_in_use(text[], uuid[]) from public, anon, authenticated;
