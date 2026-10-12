-- =====================================================================
-- Twinx — Partner-adatok a profilban: teljes név + cég
-- Futtasd a Supabase SQL Editorban.
-- =====================================================================

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists company   text;

-- A regisztrációkor megadott név/cég átkerül a profilba (auth metadata-ból).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, company)
  values (
    new.id,
    'user',
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'company', '')), '')
  );
  return new;
end;
$$;

-- A MEGLÉVŐ felhasználók nevét feltöltjük az auth metadata alapján (egyszeri).
update public.profiles p
set full_name = nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), '')
from auth.users u
where u.id = p.id and (p.full_name is null or p.full_name = '');

-- A felhasználó a SAJÁT profilját szerkesztheti (név, cég).
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
