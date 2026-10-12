-- Vendéglátás — Alapanyag-árlista + ételreceptek (önköltség-kalkulátor).
-- Cél: a partner egyszer felviszi, mennyiért szerzi be az alapanyagokat, majd az ételhez
-- megadja a mennyiségeket (pl. 10 dkg burgonya) — a rendszer kiszámolja az adagonkénti
-- alapanyagköltséget. Itt KIZÁRÓLAG az alapanyag számít — semmilyen más költség (rezsi,
-- bér, csomagolás, amortizáció stb.) nem tartozik ide, azokat a riport vetíti rá.
-- Idempotens; futtatás: Supabase → SQL Editor.

-- 1) Alapanyag-árlista. Az egységár mindig az ALAP-egységre értendő (kg / l / db).
create table if not exists public.restaurant_ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  unit text not null default 'kg',           -- 'kg' | 'l' | 'db'
  unit_price numeric not null default 0,     -- Ft / alap-egység
  waste_pct numeric not null default 0,      -- tisztítási/hulladék veszteség (%)
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Megengedett alap-egységek (a dkg főleg fűszereknél hasznos).
alter table public.restaurant_ingredients drop constraint if exists ingredients_unit_check;
alter table public.restaurant_ingredients
  add constraint ingredients_unit_check check (unit in ('kg', 'dkg', 'l', 'db'));

-- Kategória (zöldség, hús, tejtermék…) — a felületen kategória-kockákba rendezve.
alter table public.restaurant_ingredients
  add column if not exists category text not null default 'egyeb';

create index if not exists ingredients_user_idx on public.restaurant_ingredients (user_id);
create index if not exists ingredients_user_cat_idx on public.restaurant_ingredients (user_id, category);

alter table public.restaurant_ingredients enable row level security;

drop policy if exists "ingredients_select_own" on public.restaurant_ingredients;
create policy "ingredients_select_own" on public.restaurant_ingredients
  for select using (auth.uid() = user_id);

drop policy if exists "ingredients_insert_own" on public.restaurant_ingredients;
create policy "ingredients_insert_own" on public.restaurant_ingredients
  for insert with check (auth.uid() = user_id);

drop policy if exists "ingredients_update_own" on public.restaurant_ingredients;
create policy "ingredients_update_own" on public.restaurant_ingredients
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "ingredients_delete_own" on public.restaurant_ingredients;
create policy "ingredients_delete_own" on public.restaurant_ingredients
  for delete using (auth.uid() = user_id);

-- 2) Recept-sorok: egy ételhez mely alapanyagból mennyi kell (EGY adagra).
--    A mennyiséget a bevitt egységben tároljuk (g/dkg/kg/ml/dl/l/db), a számításkor váltunk.
create table if not exists public.dish_recipe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dish_id uuid not null references public.restaurant_dishes(id) on delete cascade,
  ingredient_id uuid not null references public.restaurant_ingredients(id) on delete cascade,
  quantity numeric not null default 0,
  unit text not null default 'g',            -- ahogy a partner beírta
  created_at timestamptz not null default now()
);

create index if not exists recipe_items_dish_idx on public.dish_recipe_items (user_id, dish_id);

alter table public.dish_recipe_items enable row level security;

drop policy if exists "recipe_items_select_own" on public.dish_recipe_items;
create policy "recipe_items_select_own" on public.dish_recipe_items
  for select using (auth.uid() = user_id);

drop policy if exists "recipe_items_insert_own" on public.dish_recipe_items;
create policy "recipe_items_insert_own" on public.dish_recipe_items
  for insert with check (auth.uid() = user_id);

drop policy if exists "recipe_items_update_own" on public.dish_recipe_items;
create policy "recipe_items_update_own" on public.dish_recipe_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "recipe_items_delete_own" on public.dish_recipe_items;
create policy "recipe_items_delete_own" on public.dish_recipe_items
  for delete using (auth.uid() = user_id);
