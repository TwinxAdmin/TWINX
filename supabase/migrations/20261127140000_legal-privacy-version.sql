-- =====================================================================
-- Twinx — ÁSZF + ADATKEZELÉSI TÁJÉKOZTATÓ ELFOGADÁSA (D74, 9. lépés)
-- Futtasd a Supabase SQL Editorban. Idempotens, ADDITÍV (új oszlop, a meglévők változatlanok).
-- Előtte (D51): Database → Backups, vagy legalább:  create table public.profiles_backup_20261127 as table public.profiles;
-- Visszaállítás: 20261127140000_legal-privacy-version_down.sql
--
-- A profilon eddig: terms_version (ÁSZF) + terms_accepted_at. Új: privacy_version — az Adatkezelési tájékoztató
-- megismert változata. A változatok a src/lib/legal.ts-ből jönnek (LEGAL_VERSION = '2026-12-v1'); ha bármelyik eltér
-- az aktuálistól, belépéskor elfogadó ablak jön (az admin csak bezárható jelzést kap).
-- Írni csak a szerver tud (service_role): a böngészőből a profil többi mezője szerkeszthető, ezek nem.
-- =====================================================================

alter table public.profiles add column if not exists privacy_version text;
comment on column public.profiles.privacy_version is 'Az Adatkezelési tájékoztató megismert változata (pl. 2026-12-v1). NULL = még nem fogadta el.';

-- A meglévő őr kibővítése: a privacy_version-t sem írhatja át a böngésző.
create or replace function public.profiles_terms_guard()
returns trigger
language plpgsql security invoker set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated')
     and (new.terms_version is distinct from old.terms_version
          or new.terms_accepted_at is distinct from old.terms_accepted_at
          or new.privacy_version is distinct from old.privacy_version) then
    raise exception 'TERMS_WRITE_FORBIDDEN';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_terms_guard_trg on public.profiles;
create trigger profiles_terms_guard_trg
  before update on public.profiles
  for each row execute function public.profiles_terms_guard();
