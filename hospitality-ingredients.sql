-- Vendéglátás — fő alapanyagok az ételekhez (alapanyag-alapú menü-összeállításhoz).
-- Vesszővel elválasztott lista szövegként (pl. "burgonya, marhahús, paprika").
-- Futtatás: Supabase → SQL Editor. Idempotens.

alter table public.restaurant_dishes
  add column if not exists main_ingredients text;
