-- Vendéglátás — EGYEDI (csak egy ételhez tartozó) hozzávalók a receptben.
-- Cél: a partner akkor is fel tudjon vinni egy hozzávalót az ételhez, ha az nincs benne a
-- közös alapanyag-árlistában (pl. oregánó a pizzához). Ilyenkor MEGADJA az árat, és az az
-- ár CSAK erre az ételre érvényes — a közös listába nem kerül be, hacsak külön nem kéri.
-- Idempotens; futtatás: Supabase → SQL Editor.

-- 1) A recept-sor mostantól kétféle lehet:
--    a) árlistás alapanyag  → ingredient_id ki van töltve
--    b) egyedi hozzávaló    → custom_name + custom_unit + custom_unit_price
alter table public.dish_recipe_items alter column ingredient_id drop not null;

alter table public.dish_recipe_items
  add column if not exists custom_name text,
  add column if not exists custom_unit text,
  add column if not exists custom_unit_price numeric,
  add column if not exists custom_waste_pct numeric not null default 0;

-- 2) Egy sor vagy árlistás, vagy egyedi — de valamelyiknek lennie kell.
alter table public.dish_recipe_items drop constraint if exists recipe_items_source_check;
alter table public.dish_recipe_items
  add constraint recipe_items_source_check check (
    ingredient_id is not null
    or (custom_name is not null and length(btrim(custom_name)) > 0)
  );

-- 3) Az egyedi hozzávaló alap-egysége ugyanaz a készlet, mint az árlistánál.
alter table public.dish_recipe_items drop constraint if exists recipe_items_custom_unit_check;
alter table public.dish_recipe_items
  add constraint recipe_items_custom_unit_check check (
    custom_unit is null or custom_unit in ('kg', 'dkg', 'l', 'db')
  );
