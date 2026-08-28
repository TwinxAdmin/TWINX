// Hirdetés-ellenőrző könyvtár: mappák és elemzések kezelése.
// POST   ?folder      — új mappa
// PATCH               — elemzés áthelyezése mappába
// DELETE ?id= &kind=  — elemzés vagy mappa törlése
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "reports";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function storagePathFromUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i < 0) return null;
  return decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
}

/** Új mappa. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { name?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }
  const name = String(body.name ?? "").trim();
  if (!name || name.length > 60) {
    return NextResponse.json({ error: "Adj meg mappanevet (max 60 karakter)." }, { status: 422 });
  }

  const { data, error } = await supabase
    .from("ad_check_folders").insert({ user_id: user.id, name }).select("id, name").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, folder: data });
}

/** Elemzés áthelyezése mappába (null = vissza a dátum-mappába). */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { id?: string; folderId?: string | null; title?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }
  const id = String(body.id ?? "");
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Hiányzó vagy hibás azonosító." }, { status: 400 });

  const admin = createAdminClient();

  // --- ÁTNEVEZÉS: a partner saját neve az elemzésnek. ---
  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title || title.length > 120) {
      return NextResponse.json({ error: "Adj meg nevet (max 120 karakter)." }, { status: 422 });
    }
    const { data: renamed, error } = await admin
      .from("ad_checks").update({ title })
      .eq("id", id).eq("user_id", user.id).select("id");
    if (error) return NextResponse.json({ error: "Az átnevezés nem sikerült." }, { status: 500 });
    if (!renamed?.length) return NextResponse.json({ error: "Nem található." }, { status: 404 });
    return NextResponse.json({ ok: true, title });
  }

  const folderId = body.folderId || null;
  if (folderId) {
    if (!UUID_RE.test(folderId)) return NextResponse.json({ error: "Hibás mappa-azonosító." }, { status: 400 });
    const { data: folder } = await admin
      .from("ad_check_folders").select("id").eq("id", folderId).eq("user_id", user.id).single();
    if (!folder) return NextResponse.json({ error: "Nem található ilyen mappád." }, { status: 404 });
  }

  const { data: updated, error } = await admin
    .from("ad_checks").update({ folder_id: folderId })
    .eq("id", id).eq("user_id", user.id).select("id");
  if (error) return NextResponse.json({ error: "Az áthelyezés nem sikerült." }, { status: 500 });
  if (!updated?.length) return NextResponse.json({ error: "Nem található." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/** Elemzés (kind=item) vagy mappa (kind=folder) törlése. */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const id = params.get("id") ?? "";
  const kind = params.get("kind") ?? "item";
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Hiányzó vagy hibás azonosító." }, { status: 400 });

  if (kind === "folder") {
    const { error } = await supabase.from("ad_check_folders").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("ad_checks").select("id, user_id, pdf_url").eq("id", id).single();
  if (!row || row.user_id !== user.id) return NextResponse.json({ error: "Nem található." }, { status: 404 });

  // A PDF törlése is — csak a saját mappájából.
  if (row.pdf_url) {
    const path = storagePathFromUrl(row.pdf_url);
    if (path && path.startsWith(`ad-check/${user.id}/`)) {
      await admin.storage.from(BUCKET).remove([path]);
      await admin.from("usage_history").delete().eq("output_file_url", row.pdf_url).eq("user_id", user.id);
    }
  }

  const { error } = await admin.from("ad_checks").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "A törlés nem sikerült." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
