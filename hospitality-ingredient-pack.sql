-- Vendéglátás — Alapanyag beszerzési ár "csomagban": mennyiség + teljes ár.
-- A partner úgy viszi fel, ahogy vásárol (pl. 100 kg burgonya 15 000 Ft), a rendszer
-- ebből számolja az egységárat (unit_price = pack_price / pack_qty = 150 Ft/kg).
-- Mindkét mező OPCIONÁLIS: a régi tételeknél NULL marad, a számítás továbbra is az
-- unit_price-ból dolgozik. Idempotens; futtatás: Supabase → SQL Editor.

alter table public.restaurant_ingredients
  add column if not exists pack_qty numeric,     -- beszerzett mennyiség (alap-egységben)
  add column if not exists pack_price numeric;    -- a teljes beszerzési ár (Ft) ehhez a mennyiséghez
