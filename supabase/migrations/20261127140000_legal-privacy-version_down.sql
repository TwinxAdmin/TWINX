-- Visszaállítás: 20261127140000_legal-privacy-version.sql
-- Az őr visszakerül az eredeti (csak terms_* mezőket védő) formájába, majd a privacy_version oszlop törlődik.
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

alter table public.profiles drop column if exists privacy_version;
