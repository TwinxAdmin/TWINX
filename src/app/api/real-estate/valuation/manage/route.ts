// Értékbecslés-könyvtár: mappák és becslések kezelése.
// POST    { name }            — új mappa
// PATCH   { id, folderId }    — becslés áthelyezése mappába (null = dátum-mappa)
// DELETE  ?id=&kind=item|folder — becslés vagy mappa törlése
//
// BIZTONSÁG: a usage_history-ra nincs user-oldali UPDATE/DELETE (lásd
// valuation-library.sql). Ezért service_role klienssel dolgozunk, de minden
// művelet előtt ellenőrizzük a tulajdonost ÉS hogy a sor tényleg értékbecslés.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "reports";
const FEATURE = "valuation";
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
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }
  const name = String(body.name ?? "").trim();
  if (!name || name.length > 60) {
    return NextResponse.json({ error: "Adj meg mappanevet (max 60 karakter)." }, { status: 422 });
  }

  const { data, error } = await supabase
    .from("valuation_folders")
    .insert({ user_id: user.id, name })
    .select("id, name")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, folder: data });
}

/** Mappa átnevezése. */
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { id?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }
  const id = String(body.id ?? "");
  const name = String(body.name ?? "").trim();
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Hibás mappa-azonosító." }, { status: 400 });
  if (!name || name.length > 60) {
    return NextResponse.json({ error: "Adj meg mappanevet (max 60 karakter)." }, { status: 422 });
  }

  // RLS: csak a saját mappáját nevezheti át.
  const { data, error } = await supabase
    .from("valuation_folders").update({ name }).eq("id", id).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "Nem található ilyen mappád." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/**
 * Becslés áthelyezése mappába (null = vissza a dátum-mappába), VAGY átnevezése.
 * Ha a kérésben van `title`, az átnevezés fut le — a partner saját neve az
 * input_data.title mezőbe kerül (nem kell hozzá új oszlop), és ez jelenik meg
 * a könyvtárban a generált cím helyett.
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { id?: string; folderId?: string | null; title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }
  const id = String(body.id ?? "");
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Hibás azonosító." }, { status: 400 });

  const admin = createAdminClient();

  // --- ÁTNEVEZÉS ---
  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title || title.length > 120) {
      return NextResponse.json({ error: "Adj meg nevet (max 120 karakter)." }, { status: 422 });
    }
    // Tulajdonos- és típusellenőrzés, majd a meglévő input_data kiegészítése.
    const { data: row } = await admin
      .from("usage_history")
      .select("id, input_data")
      .eq("id", id).eq("user_id", user.id).eq("feature_used", FEATURE)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "Nem található." }, { status: 404 });

    const input = (row.input_data ?? {}) as Record<string, unknown>;
    const { error } = await admin
      .from("usage_history")
      .update({ input_data: { ...input, title } })
      .eq("id", id).eq("user_id", user.id).eq("feature_used", FEATURE);
    if (error) return NextResponse.json({ error: "Az átnevezés nem sikerült." }, { status: 500 });
    return NextResponse.json({ ok: true, title });
  }

  const folderId = body.folderId || null;
  if (folderId) {
    if (!UUID_RE.test(folderId)) return NextResponse.json({ error: "Hibás mappa-azonosító." }, { status: 400 });
    const { data: folder } = await admin
      .from("valuation_folders").select("id").eq("id", folderId).eq("user_id", user.id).single();
    if (!folder) return NextResponse.json({ error: "Nem található ilyen mappád." }, { status: 404 });
  }

  const { data: updated, error } = await admin
    .from("usage_history")
    .update({ valuation_folder_id: folderId })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("feature_used", FEATURE)
    .select("id");
  if (error) return NextResponse.json({ error: "Az áthelyezés nem sikerült." }, { status: 500 });
  if (!updated?.length) return NextResponse.json({ error: "Nem található." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/** Becslés (kind=item) vagy mappa (kind=folder) törlése. */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const id = params.get("id") ?? "";
  const kind = params.get("kind") ?? "item";
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Hibás azonosító." }, { status: 400 });

  // Mappa törlése: az RLS csak a saját mappát engedi; az elemek folder_id-ja
  // a FK ON DELETE SET NULL miatt automatikusan visszaáll a dátum-mappára.
  if (kind === "folder") {
    const { error } = await supabase.from("valuation_folders").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Becslés törlése: tulajdonos + típus ellenőrzés, majd a PDF is a tárhelyről.
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("usage_history")
    .select("id, user_id, feature_used, output_file_url")
    .eq("id", id)
    .single();
  if (!row || row.user_id !== user.id || row.feature_used !== FEATURE) {
    return NextResponse.json({ error: "Nem található." }, { status: 404 });
  }

  if (row.output_file_url) {
    const path = storagePathFromUrl(row.output_file_url);
    if (path && path.startsWith(`${FEATURE}/${user.id}/`)) {
      await admin.storage.from(BUCKET).remove([path]);
    }
  }

  const { error } = await admin
    .from("usage_history").delete().eq("id", id).eq("user_id", user.id).eq("feature_used", FEATURE);
  if (error) return NextResponse.json({ error: "A törlés nem sikerült." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
