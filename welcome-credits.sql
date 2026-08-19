-- =====================================================================
-- Twinx — 3 ingyenes próbakredit regisztrációkor
-- Futtasd a Supabase SQL Editorban (a wallet.sql és a credit-grants.sql UTÁN).
--
-- Miért: az új felhasználó eddig 0 kredittel érkezett, vagyis az első élménye
-- egy fizetési fal volt. 3 kredittel viszont azonnal ki tud próbálni valamit
-- (pl. egy fotó feljavítása + egy hirdetéskép), és az első élménye egy KÉSZ
-- eredmény lesz. A jóváírás bekerül a kredit-naplóba is, hogy az admin lássa.
-- =====================================================================

-- Regisztrációkor: profil + pénztárca 3 kredittel + napló-bejegyzés.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_welcome constant integer := 3;   -- ha változtatod, a lib/onboarding.ts-ben is írd át
begin
  insert into public.profiles (id, role, full_name, company)
  values (
    new.id,
    'user',
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'company', '')), '')
  );

  -- Próbakredit. `on conflict do nothing`, hogy egy esetleges újrafutás ne adjon duplán.
  insert into public.wallets (user_id, balance)
  values (new.id, v_welcome)
  on conflict (user_id) do nothing;

  -- Nyoma legyen a kredit-naplóban (admin nélkül, rendszer-bejegyzésként).
  insert into public.credit_grants (admin_id, admin_email, user_id, user_email, amount, note)
  values (null, 'rendszer', new.id, new.email, v_welcome, 'Regisztrációs próbakredit');

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Visszamenőleg: aki már regisztrált, de MÉG NINCS pénztárca sora, az is
-- megkapja a 3 kreditet. Akinek már van sora (vásárolt vagy kapott), ahhoz
-- nem nyúlunk — így a többszöri futtatás sem ad duplán.
-- ---------------------------------------------------------------------
with uj as (
  insert into public.wallets (user_id, balance)
  select u.id, 3
  from auth.users u
  where not exists (select 1 from public.wallets w where w.user_id = u.id)
  returning user_id
)
insert into public.credit_grants (admin_id, admin_email, user_id, user_email, amount, note)
select null, 'rendszer', uj.user_id, u.email, 3, 'Regisztrációs próbakredit (visszamenőleg)'
from uj
join auth.users u on u.id = uj.user_id;
