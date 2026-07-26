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
import { buildEnhancePromptActive, buildEnhanceFalActive } from "@/lib/prompts";
import { enhanceImageFal } from "@/lib/fal";
import {
  isEnhanceMode, isEnhanceOption, ENHANCE_UPSCALE_OPTION, ENHANCE_STYLE_OPTIONS,
  validateImageFiles, enhanceModeLabel, type EnhanceOption,
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

  // Bekapcsolt feljavítás-opciók (csak Feljavítás módban van jelentőségük).
  let enabledOptions: EnhanceOption[] = [];
  try {
    const raw = JSON.parse(String(form.get("options") ?? "[]"));
    if (Array.isArray(raw)) enabledOptions = raw.map(String).filter(isEnhanceOption);
  } catch {
    enabledOptions = [];
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
    // Motor a mód szerint: Feljavítás = fal.ai (clarity-upscaler), Rendrakás = Nano Banana.
    const nanoPrompt = mode === "rendrakas" ? await buildEnhancePromptActive("rendrakas") : "";
    const falCfg = mode === "feljavitas" ? await buildEnhanceFalActive() : null;

    // Végleges fal prompt: bázis + a bekapcsolt opciók prompt-rétegei.
    const falPrompt = falCfg
      ? [falCfg.prompt, ...enabledOptions.map((v) => falCfg.options[v]).filter(Boolean)].join(", ")
      : "";
    // AI Upscaler opció → valódi felbontás-növelés (nagyobb upscale_factor).
    const upscaleFactor = enabledOptions.includes(ENHANCE_UPSCALE_OPTION)
      ? Number(process.env.FAL_ENHANCE_UPSCALE_HIGH || 4)
      : undefined;
    // Látvány-módosító opció (fény/elegáns/hangulat) → több szabadság, hogy a fény
    // ténylegesen változzon (a szerkezetet a negatív prompt védi).
    const hasStyle = enabledOptions.some((v) => ENHANCE_STYLE_OPTIONS.includes(v));
    const creativity = hasStyle ? Number(process.env.FAL_ENHANCE_CREATIVITY_STYLE || 0.55) : undefined;
    const resemblance = hasStyle ? Number(process.env.FAL_ENHANCE_RESEMBLANCE_STYLE || 0.5) : undefined;

    // Párhuzamos feldolgozás — a 4 kép ne fusson a 60 mp-es limitbe egymás után.
    const items = await Promise.all(files.map(async (file) => {
      const inputBytes = new Uint8Array(await file.arrayBuffer());
      const mime = file.type || "image/jpeg";

      // Eredeti kép mentése (before/after + előzmény).
      const origPath = `image-enhance/${user.id}/orig-${randomUUID()}.jpg`;
      const { error: origErr } = await admin.storage
        .from(BUCKET).upload(origPath, inputBytes, { contentType: mime, upsert: false });
      if (origErr) throw new Error(`Storage feltöltés hiba: ${origErr.message}`);
      const original = admin.storage.from(BUCKET).getPublicUrl(origPath).data.publicUrl;

      // Javítás a mód szerinti motorral.
      let result: { bytes: Buffer; mimeType: string };
      if (falCfg) {
        const dataUri = `data:${mime};base64,${Buffer.from(inputBytes).toString("base64")}`;
        result = await enhanceImageFal({ dataUri, prompt: falPrompt, negativePrompt: falCfg.negative, upscaleFactor, creativity, resemblance });
      } else {
        result = await generateImage({ source: { bytes: inputBytes, mimeType: mime }, prompt: nanoPrompt });
      }

      const ext = result.mimeType.includes("jpeg") ? "jpg" : "png";
      const filePath = `image-enhance/${user.id}/${randomUUID()}.${ext}`;
      const { error: upErr } = await admin.storage
        .from(BUCKET).upload(filePath, result.bytes, { contentType: result.mimeType, upsert: false });
      if (upErr) throw new Error(`Storage feltöltés hiba: ${upErr.message}`);
      const enhanced = admin.storage.from(BUCKET).getPublicUrl(filePath).data.publicUrl;

      return { original, enhanced };
    }));

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
      input_data: { mode, mode_label: enhanceModeLabel(mode), options: mode === "feljavitas" ? enabledOptions : [], image_count: files.length, outputs: items.map((i) => i.enhanced) },
      output_file_url: items[0]?.enhanced ?? null,
      credits_charged: charge.bypassed ? 0 : 1,
    });

    await logCost({
      userId: user.id,
      serviceId: service.id,
      feature: FEATURE,
      serviceName: mode === "feljavitas" ? "fal" : "google-studio",
      units: files.length,
      estimatedCostUsd: mode === "feljavitas" ? 0.05 * files.length : googleImageCostUsd(files.length),
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
