// /api/hospitality/dishes — a partner saját étel-adatbázisa (restaurant_dishes).
// GET: saját ételek listája. POST: új étel. DELETE (?id=): saját étel törlése.
// Az RLS garantálja, hogy mindenki csak a saját sorait érje el.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateDishInput } from "@/lib/hospitality";

export const runtime = "nodejs";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const { data, error } = await supabase
    .from("restaurant_dishes")
    .select("id, name, description, category, cuisine_style, profit_margin, image_url, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ dishes: data ?? [] });
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

  const input = {
    name: String(body.name ?? "").trim(),
    description: String(body.description ?? "").trim(),
    category: String(body.category ?? ""),
    cuisine_style: String(body.cuisine_style ?? "").trim(),
    profit_margin: String(body.profit_margin ?? ""),
  };

  const { valid, errors } = validateDishInput(input);
  if (!valid) return NextResponse.json({ errors }, { status: 422 });

  const { data, error } = await supabase
    .from("restaurant_dishes")
    .insert({
      user_id: user.id,
      name: input.name,
      description: input.description || null,
      category: input.category,
      cuisine_style: input.cuisine_style || null,
      profit_margin: input.profit_margin,
    })
    .select("id, name, description, category, cuisine_style, profit_margin, image_url, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, dish: data });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Hiányzó azonosító." }, { status: 400 });

  const { error } = await supabase.from("restaurant_dishes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
