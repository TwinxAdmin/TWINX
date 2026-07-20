// POST /api/hospitality/recipes/apply — a recept szerinti önköltség beírása az ételbe.
// A szerver ÚJRASZÁMOLJA az alapanyag-árlistából (nem a kliens küldi a számot), majd a
// kiválasztott mezőbe írja: 'etlap' → cost_price, 'menu' → menu_cost_price.
// A tárolt ár csak ILYENKOR változik — az áremelés a partner döntése marad. Ingyenes.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recipeCost, type Ingredient, type RecipeItem } from "@/lib/recipes";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const target = String(body.target ?? "etlap") === "menu" ? "menu" : "etlap";
  const dishIds = Array.isArray(body.dish_ids)
    ? (body.dish_ids as unknown[]).map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 200)
    : [];
  if (!dishIds.length) return NextResponse.json({ error: "Nincs kiválasztott étel." }, { status: 422 });

  // Alapanyagok + az érintett receptsorok (RLS: csak a sajátok).
  const [ingRes, itemRes] = await Promise.all([
    supabase.from("restaurant_ingredients").select("id, name, unit, unit_price, waste_pct, category"),
    supabase.from("dish_recipe_items").select("dish_id, ingredient_id, quantity, unit").in("dish_id", dishIds),
  ]);
  if (ingRes.error) return NextResponse.json({ error: ingRes.error.message }, { status: 500 });
  if (itemRes.error) return NextResponse.json({ error: itemRes.error.message }, { status: 500 });

  const ingredients = (ingRes.data ?? []) as Ingredient[];
  const byDish = new Map<string, RecipeItem[]>();
  for (const r of itemRes.data ?? []) {
    const id = String(r.dish_id);
    const arr = byDish.get(id) ?? [];
    arr.push({ ingredient_id: String(r.ingredient_id), quantity: Number(r.quantity), unit: String(r.unit) });
    byDish.set(id, arr);
  }

  const field = target === "menu" ? "menu_cost_price" : "cost_price";
  const updated: { dish_id: string; cost: number }[] = [];

  for (const dishId of dishIds) {
    const items = byDish.get(dishId);
    if (!items?.length) continue; // recept nélkül nincs mit frissíteni
    const cost = Math.round(recipeCost(items, ingredients));
    const { error } = await supabase
      .from("restaurant_dishes")
      .update({ [field]: cost })
      .eq("id", dishId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    updated.push({ dish_id: dishId, cost });
  }

  return NextResponse.json({ ok: true, target, updated });
}
