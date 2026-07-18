// /api/hospitality/dishes — a partner saját étel-adatbázisa (restaurant_dishes).
// GET: saját ételek listája. POST: új étel. DELETE (?id=): saját étel törlése.
// Az RLS garantálja, hogy mindenki csak a saját sorait érje el.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateDishInput, parsePrice } from "@/lib/hospitality";

export const runtime = "nodejs";
const BUCKET = "reports";

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
    .select("id, name, description, category, cuisine_style, profit_margin, cost_price, sale_price, image_url, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ dishes: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const input = {
    name: String(form.get("name") ?? "").trim(),
    description: String(form.get("description") ?? "").trim(),
    category: String(form.get("category") ?? ""),
    cuisine_style: String(form.get("cuisine_style") ?? "").trim(),
    profit_margin: String(form.get("profit_margin") ?? ""),
    cost_price: String(form.get("cost_price") ?? ""),
    sale_price: String(form.get("sale_price") ?? ""),
  };

  const { valid, errors } = validateDishInput(input);
  if (!valid) return NextResponse.json({ errors }, { status: 422 });

  // Opcionális ételfotó -> Storage (reports bucket), publikus URL az ételhez.
  let imageUrl: string | null = null;
  const entry = form.get("image");
  if (entry && typeof entry !== "string" && (entry as File).size > 0) {
    const file = entry as File;
    const ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
    const admin = createAdminClient();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = `dishes/${user.id}/${randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.type || "image/jpeg", upsert: false });
    if (upErr) return NextResponse.json({ error: `Kép feltöltés hiba: ${upErr.message}` }, { status: 500 });
    imageUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  const { data, error } = await supabase
    .from("restaurant_dishes")
    .insert({
      user_id: user.id,
      name: input.name,
      description: input.description || null,
      category: input.category,
      cuisine_style: input.cuisine_style || null,
      profit_margin: input.profit_margin || null,
      cost_price: parsePrice(input.cost_price),
      sale_price: parsePrice(input.sale_price),
      image_url: imageUrl,
    })
    .select("id, name, description, category, cuisine_style, profit_margin, cost_price, sale_price, image_url, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, dish: data });
}

export async function PATCH(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const id = String(form.get("id") ?? "");
  if (!id) return NextResponse.json({ error: "Hiányzó azonosító." }, { status: 400 });

  const input = {
    name: String(form.get("name") ?? "").trim(),
    description: String(form.get("description") ?? "").trim(),
    category: String(form.get("category") ?? ""),
    cuisine_style: String(form.get("cuisine_style") ?? "").trim(),
    profit_margin: String(form.get("profit_margin") ?? ""),
    cost_price: String(form.get("cost_price") ?? ""),
    sale_price: String(form.get("sale_price") ?? ""),
  };
  const { valid, errors } = validateDishInput(input);
  if (!valid) return NextResponse.json({ errors }, { status: 422 });

  const patch: Record<string, unknown> = {
    name: input.name,
    description: input.description || null,
    category: input.category,
    cuisine_style: input.cuisine_style || null,
    profit_margin: input.profit_margin || null,
    cost_price: parsePrice(input.cost_price),
    sale_price: parsePrice(input.sale_price),
  };

  // Kép: új feltöltés felülírja; a "remove_image=1" törli; egyébként marad a régi.
  const entry = form.get("image");
  if (entry && typeof entry !== "string" && (entry as File).size > 0) {
    const file = entry as File;
    const ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
    const admin = createAdminClient();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = `dishes/${user.id}/${randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.type || "image/jpeg", upsert: false });
    if (upErr) return NextResponse.json({ error: `Kép feltöltés hiba: ${upErr.message}` }, { status: 500 });
    patch.image_url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } else if (String(form.get("remove_image") ?? "") === "1") {
    patch.image_url = null;
  }

  const { data, error } = await supabase
    .from("restaurant_dishes")
    .update(patch)
    .eq("id", id)
    .select("id, name, description, category, cuisine_style, profit_margin, cost_price, sale_price, image_url, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Nincs ilyen étel." }, { status: 404 });
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
