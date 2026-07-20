// /api/hospitality/supplier-favorites — a partner KEDVENC beszállítói (egyenként).
// GET: kedvenc beszállítók listája. POST: egy beszállító hozzáadása. DELETE (?id= vagy ?name=).
// Az RLS garantálja, hogy mindenki csak a sajátjait éri el. Ingyenes.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const SELECT = "id, name, location, distance, offering, phone, email, website, why, source, source_what, created_at";

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
    .from("supplier_favorites")
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

  const str = (v: unknown, max = 400) => {
    const s = String(v ?? "").trim();
    return s ? s.slice(0, max) : null;
  };
  const name = str(body.name, 200);
  if (!name) return NextResponse.json({ error: "Hiányzó beszállító-név." }, { status: 422 });

  // Ugyanaz a beszállító ne kerüljön be kétszer (unique user_id+name) — upsert.
  const { data, error } = await supabase
    .from("supplier_favorites")
    .upsert(
      {
        user_id: user.id,
        name,
        location: str(body.location),
        distance: str(body.distance, 120),
        offering: str(body.offering),
        phone: str(body.phone, 60),
        email: str(body.email, 160),
        website: str(body.website),
        why: str(body.why),
        source: str(body.source),
        source_what: str(body.source_what, 120),
      },
      { onConflict: "user_id,name" }
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
  const name = url.searchParams.get("name");
  if (!id && !name) return NextResponse.json({ error: "Hiányzó azonosító." }, { status: 400 });

  let q = supabase.from("supplier_favorites").delete();
  q = id ? q.eq("id", id) : q.eq("name", String(name));
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
