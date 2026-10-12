-- =====================================================================
-- Twinx — ÁSZF-ELFOGADÁS RÖGZÍTÉSE (regisztrációs kiegészítés)
-- Futtasd a Supabase SQL Editorban. Idempotens.
--
-- A profilon rögzítjük, a partner MELYIK ÁSZF-változatot fogadta el és MIKOR (src/lib/legal.ts → TERMS_VERSION).
--   • e-mailes regisztráció: a kötelező jelölőnégyzettel, a regisztrációkor
--   • Google-regisztráció: a jelölőnégyzet után, a visszatéréskor (/auth/callback)
--   • meglévő partnerek és ÁSZF-módosítás: belépés után egy elfogadó ablak (amíg el nem fogadja)
-- Írni csak a szerver tud (a profiles böngészős frissítése ezeket az oszlopokat nem érinti — a szerver admin klienssel ír).
-- =====================================================================

alter table public.profiles add column if not exists terms_version     text;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;

comment on column public.profiles.terms_version is 'Az elfogadott ÁSZF változata (pl. 1.0). NULL = még nem fogadta el.';
comment on column public.profiles.terms_accepted_at is 'Az ÁSZF elfogadásának időpontja.';

-- Védelem: a felhasználó a saját profilját (név, cég) böngészőből szerkesztheti — az ÁSZF-elfogadás mezőit viszont
-- NEM írhatja át (csak a szerver, service_role). „security invoker": a current_user a hívó valódi szerepe.
create or replace function public.profiles_terms_guard()
returns trigger
language plpgsql security invoker set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated')
     and (new.terms_version is distinct from old.terms_version or new.terms_accepted_at is distinct from old.terms_accepted_at) then
    raise exception 'TERMS_WRITE_FORBIDDEN';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_terms_guard_trg on public.profiles;
create trigger profiles_terms_guard_trg
  before update on public.profiles
  for each row execute function public.profiles_terms_guard();
