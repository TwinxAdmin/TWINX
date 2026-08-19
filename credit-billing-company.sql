-- =====================================================================
-- Twinx — Céges számlázás: a vásárló ADATAI + a CÉG adatai külön
-- Futtasd a Supabase SQL Editorban (a credit-billing.sql UTÁN).
--
-- Miért: könyvelői visszajelzés szerint ha cég vagy egyéni vállalkozó kér
-- számlát, akkor a CÉG neve, címe és adószáma kell — a vásárló saját adatain
-- FELÜL, nem helyette. Ezért a modell:
--
--   • Mindig megadja a SAJÁT adatait   → billing_name, billing_zip/city/address,
--                                        billing_country, billing_email
--   • Ha bepipálja a „cég nevében vásárolok" mezőt (billing_type = 'company'),
--     akkor jönnek a CÉG adatai       → billing_company_* és billing_tax_number
--
-- A számla ilyenkor a cégre készül, a személy a kapcsolattartó.
-- =====================================================================

alter table public.profiles add column if not exists billing_company_name    text;
alter table public.profiles add column if not exists billing_company_country text;
alter table public.profiles add column if not exists billing_company_zip     text;
alter table public.profiles add column if not exists billing_company_city    text;
alter table public.profiles add column if not exists billing_company_address text;
-- Az adószám marad a meglévő `billing_tax_number` oszlopban (úgyis csak cégnél van).

-- ---------------------------------------------------------------------
-- ÁTKÖLTÖZTETÉS: a korábbi modellben a céges soroknál a `billing_name` és a
-- cím MÁR a cég adatait tartalmazta. Ezeket áttesszük a céges mezőkbe, hogy a
-- számla adatai ne vesszenek el; a személyes mezők ürülnek, azokat a partner
-- a következő belépéskor kitölti (az űrlap kéri).
--
-- Csak ott fut, ahol a céges mezők még üresek — így többszöri futtatás sem árt.
-- ---------------------------------------------------------------------
update public.profiles
   set billing_company_name    = billing_name,
       billing_company_country = billing_country,
       billing_company_zip     = billing_zip,
       billing_company_city    = billing_city,
       billing_company_address = billing_address,
       billing_name            = null,
       billing_zip             = null,
       billing_city            = null,
       billing_address         = null
 where billing_type = 'company'
   and billing_company_name is null
   and billing_name is not null;

-- A már BEADOTT kérések `billing_snapshot` mezőjéhez nem nyúlunk: az a
-- kiállításkori állapot hiteles másolata, azt szándékosan nem írjuk át.
