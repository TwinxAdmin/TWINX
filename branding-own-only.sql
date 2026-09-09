-- Arculat-profilok: az admin NEM látja a partnerek arculatát.
-- Minden profil kizárólag a létrehozó felhasználóhoz tartozik.
-- Futtasd a Supabase SQL Editorban.

drop policy if exists "branding_select_own" on public.branding_profiles;
create policy "branding_select_own" on public.branding_profiles
  for select using (user_id = auth.uid());

drop policy if exists "branding_admin_write" on public.branding_profiles;
drop policy if exists "branding_write_own" on public.branding_profiles;
create policy "branding_write_own" on public.branding_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- branding_assets: a "branding_assets own" policy már csak a sajátra enged, marad.
