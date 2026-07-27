// Arculati képtár: több logó / fotó egy profilhoz, közülük egy az aktív.
// GET    ?profileId=...        -> a profil képei (logó + fotó)
// POST   FormData: profileId, kind (logo|agent), image  -> feltöltés a képtárba (+ aktívvá tesz)
// PATCH  { profileId, kind, url }  -> a megadott kép aktívvá tétele
// DELETE ?id=...               -> kép eltávolítása a képtárból (a fájl a tárhelyen marad)
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "branding";
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const profileId = new URL(request.url).searchParams.get("profileId");
  if (!profileId) return NextResponse.json({ assets: [] });

  const { data, error } = await supabase
    .from("branding_assets")
    .select("id, kind, url, created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assets: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const profileId = String(form.get("profileId") ?? "");
  const kind = String(form.get("kind") ?? "");
  const file = form.get("image");
  if (!profileId || (kind !== "logo" && kind !== "agent")) {
    return NextResponse.json({ error: "Hiányzó adat." }, { status: 422 });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Nincs feltöltött kép." }, { status: 422 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Csak PNG, JPG, WEBP vagy SVG tölthető fel." }, { status: 422 });
  }

  // A profil a felhasználóé?
  const { data: profile } = await supabase.from("branding_profiles").select("id").eq("id", profileId).single();
  if (!profile) return NextResponse.json({ error: "A profil nem található." }, { status: 404 });

  const admin = createAdminClient();
  const ext = file.type.includes("svg") ? "svg" : file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
  const path = `${user.id}/${kind}-${randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: false });
  if (upErr) return NextResponse.json({ error: `Feltöltés hiba: ${upErr.message}` }, { status: 500 });
  const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  const { data: asset, error } = await supabase
    .from("branding_assets")
    .insert({ user_id: user.id, profile_id: profileId, kind, url })
    .select("id, kind, url, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Az újonnan feltöltött kép egyből az aktív.
  await admin.from("branding_profiles")
    .update(kind === "logo" ? { logo_url: url } : { agent_photo_url: url })
    .eq("id", profileId);

  return NextResponse.json({ ok: true, asset });
}

export async function PATCH(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const profileId = String(body?.profileId ?? "");
  const kind = String(body?.kind ?? "");
  const url = String(body?.url ?? "");
  if (!profileId || !url || (kind !== "logo" && kind !== "agent")) {
    return NextResponse.json({ error: "Hiányzó adat." }, { status: 422 });
  }
  const { error } = await supabase
    .from("branding_profiles")
    .update(kind === "logo" ? { logo_url: url } : { agent_photo_url: url })
    .eq("id", profileId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Hiányzó azonosító." }, { status: 422 });
  const { error } = await supabase.from("branding_assets").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
