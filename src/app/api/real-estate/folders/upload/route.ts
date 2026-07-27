// POST /api/real-estate/folders/upload — saját kép feltöltése egy elnevezett mappába.
// FormData: folderId + images[]. A képet a "reports" bucketbe tölti, és a mappához rendeli.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "reports";
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const folderId = String(form.get("folderId") ?? "");
  if (!folderId) return NextResponse.json({ error: "Hiányzó mappa." }, { status: 422 });

  // A mappa a felhasználóé?
  const { data: folder } = await supabase.from("asset_folders").select("id").eq("id", folderId).eq("user_id", user.id).single();
  if (!folder) return NextResponse.json({ error: "A mappa nem található." }, { status: 404 });

  const files = form.getAll("images").filter((v): v is File => v instanceof File && v.size > 0);
  if (!files.length) return NextResponse.json({ error: "Nincs feltöltendő kép." }, { status: 422 });
  if (files.some((f) => !ALLOWED.includes(f.type))) return NextResponse.json({ error: "Csak JPG, PNG vagy WEBP tölthető fel." }, { status: 422 });

  const admin = createAdminClient();
  const urls: string[] = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
    const path = `assets/${user.id}/${randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: false });
    if (upErr) return NextResponse.json({ error: `Feltöltés hiba: ${upErr.message}` }, { status: 500 });
    const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    urls.push(url);
  }

  const rows = urls.map((url) => ({ user_id: user.id, folder_id: folderId, url }));
  const { error: insErr } = await admin.from("asset_folder_items").upsert(rows, { onConflict: "user_id,folder_id,url" });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, urls });
}
