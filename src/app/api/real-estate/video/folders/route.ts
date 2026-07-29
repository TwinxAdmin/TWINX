// POST /api/real-estate/video/folders — új saját mappa (a partneré).
// DELETE ?id=... — mappa törlése (a benne lévő videók megmaradnak, mappa nélkül).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { name?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }
  const name = String(body.name ?? "").trim();
  if (!name || name.length > 60) return NextResponse.json({ error: "Adj meg mappanevet (max 60 karakter)." }, { status: 422 });

  const { data, error } = await supabase
    .from("video_folders")
    .insert({ user_id: user.id, name })
    .select("id, name")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, folder: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Hiányzó azonosító." }, { status: 400 });

  const { error } = await supabase.from("video_folders").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
