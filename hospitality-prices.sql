-- Vendéglátás — árak az ételekhez (darabonkénti profit számításához).
-- Futtatás: Supabase → SQL Editor. Idempotens.

alter table public.restaurant_dishes
  add column if not exists cost_price numeric,   -- előkészítési / önköltségi ár
  add column if not exists sale_price numeric;   -- eladási ár
