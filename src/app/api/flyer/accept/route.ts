// POST /api/flyer/accept — a hirdetés ELFOGADÁSA: 1 kredit levonása + a BÖNGÉSZŐBEN
// már elkészített (vízjel nélküli) kép feltöltése + előzmény. A renderelés kliensoldali
// (html2canvas), így nincs szükség szerver-Chromiumra. Hibánál a kredit visszajár.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeCredit } from "@/lib/credits";
import { FLYER_FORMATS, FLYER_CREDITS } from "@/lib/flyer";

export const runtime = "nodejs";
const BUCKET = "reports";
const FEATURE = "flyer";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const image = form.get("image");
  if (!image || typeof image === "string" || (image as File).size === 0) {
    return NextResponse.json({ error: "Hiányzó hirdetéskép." }, { status: 400 });
  }
  const file = image as File;
  const profileId = String(form.get("profileId") ?? "");
  const format = FLYER_FORMATS.find((f) => f.value === String(form.get("format") ?? "")) ?? FLYER_FORMATS[0];
  const title = String(form.get("title") ?? "");

  const admin = createAdminClient();
  const { data: service } = await admin.from("services").select("id").eq("slug", "real-estate").single();

  // Az arculat a felhasználóé-e (címke az előzményhez).
  const { data: profile } = await admin
    .from("branding_profiles")
    .select("id, label, user_id")
    .eq("id", profileId)
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
    const ext = file.type.includes("pdf") ? "pdf" : "png";
    const contentType = file.type || (ext === "pdf" ? "application/pdf" : "image/png");
    const bytes = new Uint8Array(await file.arrayBuffer());

    const path = `flyer/${user.id}/${randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType });
    if (upErr) throw new Error(`Mentés hiba: ${upErr.message}`);
    const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    await admin.from("usage_history").insert({
      user_id: user.id,
      service_id: service?.id ?? null,
      feature_used: FEATURE,
      input_data: { title, format: format.value, profile: profile.label },
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
