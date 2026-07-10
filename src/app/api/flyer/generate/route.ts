// POST /api/flyer/generate — a hirdetés összeállítása és renderelése (PDF/PNG).
// FormData: payload (JSON), libraryImages (JSON URL-lista), files (feltöltött képek).
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeCredit } from "@/lib/credits";
import { FLYER_FORMATS, FLYER_CREDITS, type FlyerText } from "@/lib/flyer";
import { buildFlyerHtml, type FlyerSections, type FlyerProfileData } from "@/lib/flyer-template";
import { renderFlyer } from "@/lib/flyer-render";

export const runtime = "nodejs";
const BUCKET = "reports";
const FEATURE = "flyer";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const form = await request.formData();
  let payload: {
    profileId?: string;
    format?: string;
    sections?: FlyerSections;
    text?: FlyerText;
  };
  try {
    payload = JSON.parse(String(form.get("payload") ?? "{}"));
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const format = FLYER_FORMATS.find((f) => f.value === payload.format) ?? FLYER_FORMATS[0];

  const admin = createAdminClient();

  // Előzményhez service (a usage_history.service_id NOT NULL) — egyelőre az ingatlan modul.
  const { data: service } = await admin.from("services").select("id").eq("slug", "real-estate").single();

  // Arculat-profil (a felhasználóé).
  const { data: profile } = await admin
    .from("branding_profiles")
    .select("*")
    .eq("id", payload.profileId ?? "")
    .single();
  if (!profile || profile.user_id !== user.id) {
    return NextResponse.json({ error: "Válassz érvényes arculatot." }, { status: 400 });
  }

  // Képek: könyvtári URL-ek + feltöltött fájlok.
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

  // Kredit (induláskor 0). >0 esetén levonás + hibánál visszatérítés.
  const charge = FLYER_CREDITS > 0 ? await chargeCredit({ userId: user.id, amount: FLYER_CREDITS }) : null;
  if (charge && !charge.ok) {
    return NextResponse.json({ error: `Nincs elég egyenleg (${FLYER_CREDITS} szükséges).` }, { status: 402 });
  }

  try {
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
      title: "",
      subtitle: "",
      price: "",
      highlights: [],
      characteristics: [],
      infra: "",
      transport: "",
    };

    const html = buildFlyerHtml({ format, profile: profileData, text, images, sections });
    const { bytes, ext, contentType } = await renderFlyer(html, format);

    const path = `flyer/${user.id}/${randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType });
    if (upErr) throw new Error(`Mentés hiba: ${upErr.message}`);
    const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    await admin.from("usage_history").insert({
      user_id: user.id,
      service_id: service?.id ?? null,
      feature_used: FEATURE,
      input_data: { title: text.title, format: format.value, profile: profile.label },
      output_file_url: url,
    });

    return NextResponse.json({ ok: true, url, kind: format.kind });
  } catch (err) {
    if (charge && !charge.bypassed) {
      await admin.rpc("wallet_add", { p_user_id: user.id, p_amount: FLYER_CREDITS });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
