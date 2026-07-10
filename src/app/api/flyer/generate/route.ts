// POST /api/flyer/generate — ELŐNÉZET a hirdetésről (vízjeles, INGYENES).
// A feltöltött képeket Storage-ba tölti, vízjeles előnézetet renderel, és visszaadja a
// végleges rendereléshez szükséges adatokat (kép-URL-ek + payload). Nem terhel kreditet,
// nem ír előzményt — az az elfogadáskor (/api/flyer/accept) történik.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FLYER_FORMATS, type FlyerText } from "@/lib/flyer";
import { buildFlyerHtml, type FlyerSections, type FlyerProfileData } from "@/lib/flyer-template";
import { renderFlyer } from "@/lib/flyer-render";

export const runtime = "nodejs";
const BUCKET = "reports";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const form = await request.formData();
  let payload: { profileId?: string; format?: string; layout?: string; sections?: FlyerSections; text?: FlyerText };
  try {
    payload = JSON.parse(String(form.get("payload") ?? "{}"));
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const format = FLYER_FORMATS.find((f) => f.value === payload.format) ?? FLYER_FORMATS[0];
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("branding_profiles")
    .select("*")
    .eq("id", payload.profileId ?? "")
    .single();
  if (!profile || profile.user_id !== user.id) {
    return NextResponse.json({ error: "Válassz érvényes arculatot." }, { status: 400 });
  }

  // Képek: könyvtári URL-ek + feltöltött fájlok (utóbbiakat feltöltjük, hogy URL legyen).
  let libraryImages: string[] = [];
  try {
    libraryImages = JSON.parse(String(form.get("libraryImages") ?? "[]"));
  } catch {
    libraryImages = [];
  }
  const uploadedUrls: string[] = [];
  for (const entry of form.getAll("files")) {
    if (typeof entry === "string" || (entry as File).size === 0) continue;
    const file = entry as File;
    const ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = `flyer-src/${user.id}/${randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: file.type || "image/jpeg" });
    if (!upErr) uploadedUrls.push(admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
  }
  const images = [...libraryImages, ...uploadedUrls];

  const profileData: FlyerProfileData = {
    display_name: profile.display_name,
    title: profile.title,
    phone: profile.phone,
    email: profile.email,
    company: profile.company,
    website: profile.website,
    slogan: profile.slogan,
    logo_url: profile.logo_url,
    accent_color: profile.accent_color,
    font: profile.font,
    theme: profile.theme === "dark" ? "dark" : "light",
  };
  const sections: FlyerSections = {
    highlights: payload.sections?.highlights ?? true,
    characteristics: payload.sections?.characteristics ?? true,
    gallery: payload.sections?.gallery ?? true,
    infra: payload.sections?.infra ?? true,
    transport: payload.sections?.transport ?? true,
  };
  const text: FlyerText = payload.text ?? {
    title: "", subtitle: "", price: "", highlights: [], characteristics: [], infra: "", transport: "",
  };

  try {
    const html = buildFlyerHtml({ format, profile: profileData, text, images, sections, layout: payload.layout, watermark: true });
    const { bytes, ext, contentType } = await renderFlyer(html, format);
    const path = `flyer-preview/${user.id}/${randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType });
    if (upErr) throw new Error(`Mentés hiba: ${upErr.message}`);
    const previewUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    // A véglegesítéshez (accept) kellő adatok — a képek már URL-ek.
    const renderData = { profileId: profile.id, format: format.value, layout: payload.layout, sections, text, images };
    return NextResponse.json({ ok: true, previewUrl, kind: format.kind, renderData });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
