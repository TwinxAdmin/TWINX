-- Vendéglátás — MENÜS ételek külön kezelése.
-- Koncepció: az étlapos és a menüs ételek teljesen külön entitások.
--   - Étlapos étel: kis széria, adagonkénti önköltség (cost_price) + eladási ár (sale_price).
--   - Menüs étel: nagy szériában készül. A partner megadja, hogy X adaghoz mennyi alapanyag
--     kell, és abból HÁNY adag menüs étel jön ki (menu_yield). Egy adag önköltsége =
--     a köteg alapanyagköltsége ÷ menu_yield → ez kerül a menu_cost_price-ba.
-- A menüs étel NEM jelenik meg az étlapos "ételeim" listában (is_menu = true).
-- A batch-recept ugyanazt a dish_recipe_items táblát használja (a mennyiségek a KÖTEGRE
-- értendők, nem egy adagra). Idempotens; futtatás: Supabase → SQL Editor.

alter table public.restaurant_dishes
  add column if not exists is_menu boolean not null default false,
  add column if not exists menu_yield integer;

-- Gyors szűrés étlapos / menüs bontásban.
create index if not exists dishes_user_ismenu_idx
  on public.restaurant_dishes (user_id, is_menu);

-- A menu_yield csak menüs ételnél értelmezett és pozitív.
alter table public.restaurant_dishes drop constraint if exists dishes_menu_yield_check;
alter table public.restaurant_dishes
  add constraint dishes_menu_yield_check check (
    menu_yield is null or menu_yield > 0
  );
