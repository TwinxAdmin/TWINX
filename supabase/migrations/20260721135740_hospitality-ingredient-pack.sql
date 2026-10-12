-- Vendéglátás — Alapanyag beszerzési ár "csomagban": mennyiség + teljes ár.
-- A partner úgy viszi fel, ahogy vásárol (pl. 100 kg burgonya 15 000 Ft), a rendszer
-- ebből számolja az egységárat (unit_price = pack_price / pack_qty = 150 Ft/kg).
-- Mindkét mező OPCIONÁLIS: a régi tételeknél NULL marad, a számítás továbbra is az
-- unit_price-ból dolgozik. Idempotens; futtatás: Supabase → SQL Editor.

-- Az ár ingadozhat (egyik héten olcsóbb, másik héten drágább), ezért megadható egy
-- legdrágább teljes ár is (pack_price_max). Ilyenkor az unit_price a legolcsóbb és a
-- legdrágább egységár ÁTLAGA. A pack_price a legolcsóbb / egyszeri ár.
alter table public.restaurant_ingredients
  add column if not exists pack_qty numeric,        -- beszerzett mennyiség (alap-egységben)
  add column if not exists pack_price numeric,       -- legolcsóbb / egyszeri teljes ár (Ft) ehhez a mennyiséghez
  add column if not exists pack_price_max numeric;    -- opcionális legdrágább teljes ár (Ft) — ingadozó beszerzésnél
