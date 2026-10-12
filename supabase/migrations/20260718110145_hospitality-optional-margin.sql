-- Vendéglátás — a profitmarzs opcionálissá tétele (a konyhatípus lett a kötelező).
-- Futtatás: Supabase → SQL Editor. Idempotens.

alter table public.restaurant_dishes
  alter column profit_margin drop not null;
