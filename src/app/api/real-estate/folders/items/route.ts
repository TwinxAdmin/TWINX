// Kép hozzárendelése elnevezett mappához (címkézés) / eltávolítása onnan.
// POST   { folderId, url }        -> hozzáadás a mappához
// DELETE ?folderId=...&url=...    -> eltávolítás a mappából
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function POST(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const folderId = String(body?.folderId ?? "");
  const url = String(body?.url ?? "");
  if (!folderId || !url) return NextResponse.json({ error: "Hiányzó adat." }, { status: 422 });
  const { error } = await supabase
    .from("asset_folder_items")
    .upsert({ user_id: user.id, folder_id: folderId, url }, { onConflict: "user_id,folder_id,url" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const sp = new URL(request.url).searchParams;
  const folderId = sp.get("folderId");
  const url = sp.get("url");
  if (!folderId || !url) return NextResponse.json({ error: "Hiányzó adat." }, { status: 422 });
  const { error } = await supabase
    .from("asset_folder_items")
    .delete()
    .eq("user_id", user.id)
    .eq("folder_id", folderId)
    .eq("url", url);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
