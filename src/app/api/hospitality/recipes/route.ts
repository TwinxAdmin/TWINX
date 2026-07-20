// /api/hospitality/recipes — ételek receptjei (adagonkénti alapanyag-mennyiségek). Ingyenes.
// GET: minden recept-sor (vagy ?dish_id= szerint szűrve).
// POST: egy étel receptjének mentése — az adott étel sorait felülírja (delete + insert).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const SELECT = "id, dish_id, ingredient_id, quantity, unit";

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

  const rows = Array.isArray(body.items)
    ? (body.items as unknown[])
        .map((e) => {
          const o = (e ?? {}) as Record<string, unknown>;
          return {
            user_id: user.id,
            dish_id: dishId,
            ingredient_id: String(o.ingredient_id ?? "").trim(),
            quantity: Math.max(0, Number(String(o.quantity ?? "").replace(",", ".")) || 0),
            unit: String(o.unit ?? "g").slice(0, 8),
          };
        })
        .filter((r) => r.ingredient_id && r.quantity > 0)
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
