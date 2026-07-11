// POST /api/flyer/accept — a hirdetés ELFOGADÁSA: 1 kredit levonása, tiszta (vízjel nélküli)
// render, mentés + előzmény. A képek már URL-ek (a /generate feltöltötte). Hibánál visszatérít.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeCredit } from "@/lib/credits";
import { FLYER_FORMATS, FLYER_CREDITS, type FlyerText } from "@/lib/flyer";
import { buildFlyerHtml, type FlyerSections, type FlyerProfileData } from "@/lib/flyer-template";
import { renderFlyer } from "@/lib/flyer-render";

export const runtime = "nodejs";
export const maxDuration = 60; // hirdetés renderelése (Chromium)
const BUCKET = "reports";
const FEATURE = "flyer";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: {
    profileId?: string;
    format?: string;
    layout?: string;
    sections?: FlyerSections;
    text?: FlyerText;
    images?: string[];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const format = FLYER_FORMATS.find((f) => f.value === body.format) ?? FLYER_FORMATS[0];
  const admin = createAdminClient();

  const { data: service } = await admin.from("services").select("id").eq("slug", "real-estate").single();
  const { data: profile } = await admin
    .from("branding_profiles")
    .select("*")
    .eq("id", body.profileId ?? "")
    .single();
  if (!profile || profile.user_id !== user.id) {
    return NextResponse.json({ error: "Válassz érvényes arculatot." }, { status: 400 });
  }

  // 1) Kredit (admin/sales megkerüli). Hibánál visszatérítjük.
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
      highlights: body.sections?.highlights ?? true,
      characteristics: body.sections?.characteristics ?? true,
      gallery: body.sections?.gallery ?? true,
      infra: body.sections?.infra ?? true,
      transport: body.sections?.transport ?? true,
    };
    const text: FlyerText = body.text ?? {
      title: "", subtitle: "", price: "", highlights: [], characteristics: [], infra: "", transport: "",
    };

    const html = buildFlyerHtml({ format, profile: profileData, text, images: body.images ?? [], sections, layout: body.layout });
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
      credits_charged: charge && !charge.bypassed ? FLYER_CREDITS : 0,
    });

    return NextResponse.json({ ok: true, url, kind: format.kind, charged: charge ? !charge.bypassed : false });
  } catch (err) {
    if (charge && !charge.bypassed) {
      await admin.rpc("wallet_add", { p_user_id: user.id, p_amount: FLYER_CREDITS });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
