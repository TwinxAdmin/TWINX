// POST /api/real-estate/image-enhance — Egyszerű képjavító.
// Max 4 kép, 1 kredit / feldolgozás (all-or-nothing). A kép TARTALMÁN nem változtatunk,
// csak a minőségén (mód szerint enyhe rendrakással). Nano Banana image-to-image.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeCredit } from "@/lib/credits";
import { generateImage } from "@/lib/nanobanana";
import { logCost, googleImageCostUsd } from "@/lib/costs";
import {
  ENHANCE_PROMPTS, isEnhanceMode, validateImageFiles, enhanceModeLabel,
} from "@/lib/image-enhance";

export const runtime = "nodejs";
export const maxDuration = 60; // több kép egymás után

const SERVICE_SLUG = "real-estate";
const FEATURE = "image_enhance";
const BUCKET = "reports";

// Korábbi képjavító feldolgozások (dátum-mappákhoz).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const { data, error } = await supabase
    .from("image_enhance_jobs")
    .select("id, mode, items, created_at")
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data ?? [] });
}

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

  const mode = String(form.get("mode") ?? "");
  if (!isEnhanceMode(mode)) {
    return NextResponse.json({ error: "Válassz feldolgozási módot." }, { status: 422 });
  }

  const files = form.getAll("images").filter((v): v is File => v instanceof File && v.size > 0);
  const imagesError = validateImageFiles(files);
  if (imagesError) {
    return NextResponse.json({ errors: { images: imagesError } }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data: service } = await admin.from("services").select("id").eq("slug", SERVICE_SLUG).single();
  if (!service) return NextResponse.json({ error: "A modul nem található." }, { status: 400 });

  // 1 kredit az egész feldolgozásra (all-or-nothing), a közös egyenlegből.
  const charge = await chargeCredit({ userId: user.id, amount: 1 });
  if (!charge.ok) {
    return NextResponse.json({ error: "Nincs elég kredit ehhez a modulhoz." }, { status: 402 });
  }

  try {
    const prompt = ENHANCE_PROMPTS[mode];
    const items: Array<{ original: string; enhanced: string }> = [];

    for (const file of files) {
      const inputBytes = new Uint8Array(await file.arrayBuffer());

      // Eredeti kép mentése (a before/after nézethez és az előzményhez).
      const origPath = `image-enhance/${user.id}/orig-${randomUUID()}.jpg`;
      const { error: origErr } = await admin.storage
        .from(BUCKET)
        .upload(origPath, inputBytes, { contentType: file.type || "image/jpeg", upsert: false });
      if (origErr) throw new Error(`Storage feltöltés hiba: ${origErr.message}`);
      const originalUrl = admin.storage.from(BUCKET).getPublicUrl(origPath).data.publicUrl;

      const result = await generateImage({
        source: { bytes: inputBytes, mimeType: file.type },
        prompt,
      });

      const ext = result.mimeType.includes("jpeg") ? "jpg" : "png";
      const filePath = `image-enhance/${user.id}/${randomUUID()}.${ext}`;
      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(filePath, result.bytes, { contentType: result.mimeType, upsert: false });
      if (uploadError) throw new Error(`Storage feltöltés hiba: ${uploadError.message}`);

      const enhancedUrl = admin.storage.from(BUCKET).getPublicUrl(filePath).data.publicUrl;
      items.push({ original: originalUrl, enhanced: enhancedUrl });
    }

    // Job mentése (dátum-mappák + before/after) — a saját sorába (RLS).
    const { data: job } = await supabase
      .from("image_enhance_jobs")
      .insert({ user_id: user.id, mode, items })
      .select("id, mode, items, created_at")
      .single();

    await admin.from("usage_history").insert({
      user_id: user.id,
      service_id: service.id,
      feature_used: FEATURE,
      input_data: { mode, mode_label: enhanceModeLabel(mode), image_count: files.length, outputs: items.map((i) => i.enhanced) },
      output_file_url: items[0]?.enhanced ?? null,
      credits_charged: charge.bypassed ? 0 : 1,
    });

    await logCost({
      userId: user.id,
      serviceId: service.id,
      feature: FEATURE,
      serviceName: "google-studio",
      units: files.length,
      estimatedCostUsd: googleImageCostUsd(files.length),
    });

    return NextResponse.json({ ok: true, job, items, charged: !charge.bypassed });
  } catch (err) {
    // Nem sikerült MIND -> teljes visszatérítés.
    if (!charge.bypassed) {
      await admin.rpc("wallet_add", { p_user_id: user.id, p_amount: 1 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
