// PATCH /api/flyer/manage — hirdetés áthelyezése mappába (vagy átnevezése).
// DELETE ?id=... — hirdetés VÉGLEGES törlése (a tárhelyről is).
//
// BIZTONSÁG: a usage_history-n NINCS user-oldali UPDATE/DELETE policy (különben a
// partner az anon kulccsal átírhatná a saját sorában a kredit-mezőt vagy törölhetne
// bármilyen előzményt). Ezért az írást a service_role végzi, de CSAK azután, hogy
// a route ellenőrizte: a sor a hívóé, és tényleg hirdetés.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "reports";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A publikus Storage URL-ből visszafejti a bucketen belüli útvonalat. */
function storagePathFromUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i < 0) return null;
  return decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
}

/** A sor betöltése + tulajdonjog és típus ellenőrzése. */
async function loadOwnFlyer(id: string, userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("usage_history")
    .select("id, user_id, feature_used, input_data, output_file_url")
    .eq("id", id)
    .single();
  if (!data || data.user_id !== userId) return { row: null, error: "Nem található." };
  if (data.feature_used !== "flyer") return { row: null, error: "Ez a művelet csak hirdetésre használható." };
  return { row: data, error: null };
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { id?: string; folderId?: string | null; title?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }
  const id = String(body.id ?? "");
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Hiányzó vagy hibás azonosító." }, { status: 400 });

  const { row, error: ownErr } = await loadOwnFlyer(id, user.id);
  if (!row) return NextResponse.json({ error: ownErr }, { status: 404 });

  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};

  if ("folderId" in body) {
    const folderId = body.folderId || null;
    if (folderId) {
      if (!UUID_RE.test(folderId)) return NextResponse.json({ error: "Hibás mappa-azonosító." }, { status: 400 });
      // A mappa a hívóé kell legyen — különben „eltűnne" az elem.
      const { data: folder } = await admin
        .from("flyer_folders").select("id").eq("id", folderId).eq("user_id", user.id).single();
      if (!folder) return NextResponse.json({ error: "Nem található ilyen mappád." }, { status: 404 });
    }
    patch.folder_id = folderId;
  }

  // A cím az input_data-ban van, ezért azt összefésülve írjuk vissza.
  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (t.length > 120) return NextResponse.json({ error: "Túl hosszú cím." }, { status: 422 });
    const input = row.input_data && typeof row.input_data === "object" && !Array.isArray(row.input_data)
      ? (row.input_data as Record<string, unknown>)
      : {};
    patch.input_data = { ...input, title: t };
  }

  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nincs mit módosítani." }, { status: 400 });

  const { error } = await admin.from("usage_history").update(patch).eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "A módosítás nem sikerült." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Hiányzó vagy hibás azonosító." }, { status: 400 });

  const { row, error: ownErr } = await loadOwnFlyer(id, user.id);
  if (!row) return NextResponse.json({ error: ownErr }, { status: 404 });

  const admin = createAdminClient();

  // A fájl törlése — CSAK a saját mappájából (`flyer/<user>/…`), hogy egy
  // manipulált URL ne törölhessen idegen fájlt a bucketből.
  if (row.output_file_url) {
    const path = storagePathFromUrl(row.output_file_url);
    if (path && path.startsWith(`flyer/${user.id}/`)) {
      await admin.storage.from(BUCKET).remove([path]);
    }
  }

  const { error } = await admin
    .from("usage_history").delete().eq("id", id).eq("user_id", user.id).eq("feature_used", "flyer");
  if (error) return NextResponse.json({ error: "A törlés nem sikerült." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
