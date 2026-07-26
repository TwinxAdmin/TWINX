// /api/real-estate/image-enhance/favorites — kedvenc feljavított képek (egyenként).
// GET: lista. POST: hozzáadás (upsert user_id+enhanced). DELETE (?id= vagy ?enhanced=).
// RLS: mindenki csak a sajátját éri el. Ingyenes.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const SELECT = "id, original, enhanced, mode, created_at";

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
    .from("image_enhance_favorites")
    .select(SELECT)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ favorites: data ?? [] });
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

  const str = (v: unknown, max = 1000) => {
    const s = String(v ?? "").trim();
    return s ? s.slice(0, max) : null;
  };
  const enhanced = str(body.enhanced);
  if (!enhanced) return NextResponse.json({ error: "Hiányzó kép." }, { status: 422 });

  const { data, error } = await supabase
    .from("image_enhance_favorites")
    .upsert(
      { user_id: user.id, enhanced, original: str(body.original), mode: str(body.mode, 40) },
      { onConflict: "user_id,enhanced" }
    )
    .select(SELECT)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, favorite: data });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const enhanced = url.searchParams.get("enhanced");
  if (!id && !enhanced) return NextResponse.json({ error: "Hiányzó azonosító." }, { status: 400 });

  let q = supabase.from("image_enhance_favorites").delete();
  q = id ? q.eq("id", id) : q.eq("enhanced", String(enhanced));
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
