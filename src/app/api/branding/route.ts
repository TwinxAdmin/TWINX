// /api/branding — arculat-profilok CRUD-ja.
// GET: a saját profilok listája. POST: létrehozás/módosítás (FormData, opcionális logóval).
// DELETE: saját profil törlése (?id=).
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateBrandingInput } from "@/lib/branding";

export const runtime = "nodejs";

const BUCKET = "reports";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branding_profiles")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profiles: data ?? [] });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const form = await request.formData();
  const id = (form.get("id") as string) || null;

  const fields = {
    label: String(form.get("label") ?? "").trim(),
    display_name: String(form.get("display_name") ?? "").trim(),
    title: String(form.get("title") ?? "").trim(),
    phone: String(form.get("phone") ?? "").trim(),
    email: String(form.get("email") ?? "").trim(),
    company: String(form.get("company") ?? "").trim(),
    website: String(form.get("website") ?? "").trim(),
    slogan: String(form.get("slogan") ?? "").trim(),
    accent_color: String(form.get("accent_color") ?? "#ef7a5a").trim(),
    font: String(form.get("font") ?? "inter").trim(),
    theme: String(form.get("theme") ?? "light").trim() === "dark" ? "dark" : "light",
  };

  const { valid, errors } = validateBrandingInput(fields);
  if (!valid) return NextResponse.json({ errors }, { status: 422 });

  const admin = createAdminClient();

  // Módosításnál ellenőrizzük, hogy a profil a felhasználóé.
  if (id) {
    const { data: existing } = await admin
      .from("branding_profiles")
      .select("user_id, logo_url")
      .eq("id", id)
      .single();
    if (!existing || existing.user_id !== user.id) {
      return NextResponse.json({ error: "Nincs ilyen profil." }, { status: 404 });
    }
  }

  // Feltöltés-segéd (logó / ügynök-fotó) — a reports bucketbe, publikus URL-lel.
  async function uploadImage(field: string, label: string): Promise<string | undefined | { error: string }> {
    const entry = form.get(field);
    if (!entry || typeof entry === "string" || (entry as File).size === 0) return undefined;
    const file = entry as File;
    const ext = file.type.includes("png")
      ? "png"
      : file.type.includes("webp")
        ? "webp"
        : file.type.includes("svg")
          ? "svg"
          : "jpg";
    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = `branding/${user!.id}/${randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: file.type || "image/png", upsert: false });
    if (upErr) return { error: `${label} feltöltés hiba: ${upErr.message}` };
    return admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  const logoRes = await uploadImage("logo", "Logó");
  if (logoRes && typeof logoRes === "object") return NextResponse.json({ error: logoRes.error }, { status: 500 });
  const agentRes = await uploadImage("agent_photo", "Ügynök-fotó");
  if (agentRes && typeof agentRes === "object") return NextResponse.json({ error: agentRes.error }, { status: 500 });
  const logoUrl = logoRes as string | undefined;
  const agentUrl = agentRes as string | undefined;

  if (id) {
    const patch: Record<string, unknown> = { ...fields };
    if (logoUrl) patch.logo_url = logoUrl;
    if (agentUrl) patch.agent_photo_url = agentUrl;
    const { error } = await admin.from("branding_profiles").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id });
  }

  const { data, error } = await admin
    .from("branding_profiles")
    .insert({ ...fields, user_id: user.id, logo_url: logoUrl ?? null, agent_photo_url: agentUrl ?? null })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function DELETE(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Hiányzó azonosító." }, { status: 400 });

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("branding_profiles")
    .select("user_id")
    .eq("id", id)
    .single();
  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: "Nincs ilyen profil." }, { status: 404 });
  }
  const { error } = await admin.from("branding_profiles").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
