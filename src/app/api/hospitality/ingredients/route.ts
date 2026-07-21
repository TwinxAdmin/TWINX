// /api/hospitality/ingredients — alapanyag-árlista (a partner beszerzési árai). Ingyenes.
// GET: saját lista. POST: új tétel. PATCH: módosítás. DELETE (?id=): törlés.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateIngredient } from "@/lib/recipes";

export const runtime = "nodejs";
const SELECT = "id, name, unit, unit_price, waste_pct, category, pack_qty, pack_price";

// A "csomagos" bevitelből (mennyiség + teljes ár) számolt egységár. Ha nincs mennyiség/ár,
// az explicit unit_price-t használjuk (kompatibilis a régi bevitellel).
const numOrNull = (v: unknown): number | null => {
  const s = String(v ?? "").trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return isNaN(n) || n < 0 ? null : n;
};
function derivePricing(body: Record<string, unknown>) {
  const packQty = numOrNull(body.pack_qty);
  const packPrice = numOrNull(body.pack_price);
  const unitPrice =
    packQty != null && packQty > 0 && packPrice != null ? packPrice / packQty : num(body.unit_price);
  return { pack_qty: packQty, pack_price: packPrice, unit_price: unitPrice };
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const num = (v: unknown, min = 0) => {
  const n = Number(String(v ?? "").trim().replace(",", "."));
  return isNaN(n) || n < min ? min : n;
};

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const { data, error } = await supabase
    .from("restaurant_ingredients")
    .select(SELECT)
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ingredients: data ?? [] });
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

  const err = validateIngredient(body as { name?: string; unit?: string; unit_price?: unknown });
  if (err) return NextResponse.json({ error: err }, { status: 422 });

  const pricing = derivePricing(body);
  const { data, error } = await supabase
    .from("restaurant_ingredients")
    .insert({
      user_id: user.id,
      name: String(body.name).trim().slice(0, 120),
      unit: String(body.unit),
      unit_price: pricing.unit_price,
      pack_qty: pricing.pack_qty,
      pack_price: pricing.pack_price,
      waste_pct: Math.min(90, num(body.waste_pct)),
      category: String(body.category ?? "egyeb").slice(0, 30),
    })
    .select(SELECT)
    .single();
  if (error) {
    const msg = error.code === "23505" ? "Ilyen nevű alapanyag már van a listádban." : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ingredient: data });
}

export async function PATCH(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "Hiányzó azonosító." }, { status: 400 });
  const err = validateIngredient(body as { name?: string; unit?: string; unit_price?: unknown });
  if (err) return NextResponse.json({ error: err }, { status: 422 });

  const pricing = derivePricing(body);
  const { data, error } = await supabase
    .from("restaurant_ingredients")
    .update({
      name: String(body.name).trim().slice(0, 120),
      unit: String(body.unit),
      unit_price: pricing.unit_price,
      pack_qty: pricing.pack_qty,
      pack_price: pricing.pack_price,
      waste_pct: Math.min(90, num(body.waste_pct)),
      category: String(body.category ?? "egyeb").slice(0, 30),
    })
    .eq("id", id)
    .select(SELECT)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ingredient: data });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Hiányzó azonosító." }, { status: 400 });

  const { error } = await supabase.from("restaurant_ingredients").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
