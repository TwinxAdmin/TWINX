// /api/hospitality/recipes — ételek receptjei (adagonkénti alapanyag-mennyiségek). Ingyenes.
// GET: minden recept-sor (vagy ?dish_id= szerint szűrve).
// POST: egy étel receptjének mentése — az adott étel sorait felülírja (delete + insert).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const SELECT =
  "id, dish_id, ingredient_id, quantity, unit, custom_name, custom_unit, custom_unit_price, custom_waste_pct";
const BASE_UNITS = ["kg", "dkg", "l", "db"];

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const dishId = new URL(request.url).searchParams.get("dish_id");
  let q = supabase.from("dish_recipe_items").select(SELECT).limit(5000);
  if (dishId) q = q.eq("dish_id", dishId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const dishId = String(body.dish_id ?? "").trim();
  if (!dishId) return NextResponse.json({ error: "Hiányzó étel-azonosító." }, { status: 400 });

  // Egy sor vagy árlistás (ingredient_id), vagy EGYEDI: a partner ehhez az ételhez adta meg
  // a nevet és az árat, mert az alapanyag nincs a közös listában.
  const num = (v: unknown) => Math.max(0, Number(String(v ?? "").replace(",", ".")) || 0);
  const rows = Array.isArray(body.items)
    ? (body.items as unknown[])
        .map((e) => {
          const o = (e ?? {}) as Record<string, unknown>;
          const ingredientId = String(o.ingredient_id ?? "").trim();
          const customName = String(o.custom_name ?? "").trim().slice(0, 120);
          const customUnit = String(o.custom_unit ?? "kg");
          return {
            user_id: user.id,
            dish_id: dishId,
            ingredient_id: ingredientId || null,
            quantity: num(o.quantity),
            unit: String(o.unit ?? "g").slice(0, 8),
            custom_name: ingredientId ? null : customName || null,
            custom_unit: ingredientId ? null : (BASE_UNITS.includes(customUnit) ? customUnit : "kg"),
            custom_unit_price: ingredientId ? null : num(o.custom_unit_price),
            custom_waste_pct: ingredientId ? 0 : num(o.custom_waste_pct),
          };
        })
        .filter((r) => (r.ingredient_id || r.custom_name) && r.quantity > 0)
        .slice(0, 100)
    : [];

  // Az étel korábbi recept-sorai törlődnek, majd az újak beszúródnak.
  const del = await supabase.from("dish_recipe_items").delete().eq("dish_id", dishId);
  if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 });

  if (rows.length) {
    const { error } = await supabase.from("dish_recipe_items").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, saved: rows.length });
}
