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
  isEnhanceMode, validateImageFiles, enhanceModeLabel, EXTREME_DECLUTTER_SUFFIX,
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

  // defer=1 → az eredmény NEM kerül azonnal az előzményekbe; a partner előbb jóváhagyja.
  const defer = String(form.get("defer") ?? "") === "1";

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
    // Motor a mód szerint:
    //  - feljavitas: fal.ai (felbontás/minőség)
    //  - rendrakas:  Nano Banana (rendrakás)
    // Az "átjátszás" (a másik művelet az elkészült képen) kliensoldalról jön: az eredmény
    // képet új feltöltésként küldi vissza a másik móddal — így itt nincs külön lánc-logika.
    const useFal = mode === "feljavitas";
    const useNano = mode === "rendrakas";
    const falCfg = useFal ? await buildEnhanceFalActive() : null;
    // Extrém rendetlenség (a böngészőoldali zsúfoltság-heurisztika jelzi):
    // ilyenkor a rendrakás promptot megerősítjük az agresszívabb toldalékkal.
    const extreme = String(form.get("extreme") ?? "") === "1";
    const nanoPrompt = useNano
      ? (await buildEnhancePromptActive("rendrakas")) + (extreme ? EXTREME_DECLUTTER_SUFFIX : "")
      : "";

    // Feljavítás = felbontásnövelés: nagyobb upscale_factor, a szerkezet hű marad.
    const upscaleFactor = Number(process.env.FAL_ENHANCE_UPSCALE_HIGH || 4);

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

      // Munkakép — lépésről lépésre halad végig a láncon.
      let workBytes: Uint8Array = inputBytes;
      let workMime = mime;

      // 1) Feljavítás (fal.ai) — élesebb, nagyobb felbontású alap.
      if (falCfg) {
        const dataUri = `data:${workMime};base64,${Buffer.from(workBytes).toString("base64")}`;
        const r = await enhanceImageFal({ dataUri, prompt: falCfg.prompt, negativePrompt: falCfg.negative, upscaleFactor });
        workBytes = new Uint8Array(r.bytes);
        workMime = r.mimeType;
      }

      // 2) Rendrakás (Nano Banana) — a már feljavított képen takarítja el a rendetlenséget.
      let result: { bytes: Buffer; mimeType: string };
      if (useNano) {
        result = await generateImage({ source: { bytes: workBytes, mimeType: workMime }, prompt: nanoPrompt });
      } else {
        result = { bytes: Buffer.from(workBytes), mimeType: workMime };
      }

      const ext = result.mimeType.includes("jpeg") ? "jpg" : "png";
      const filePath = `image-enhance/${user.id}/${randomUUID()}.${ext}`;
      const { error: upErr } = await admin.storage
        .from(BUCKET).upload(filePath, result.bytes, { contentType: result.mimeType, upsert: false });
      if (upErr) throw new Error(`Storage feltöltés hiba: ${upErr.message}`);
      const enhanced = admin.storage.from(BUCKET).getPublicUrl(filePath).data.publicUrl;

      return { original, enhanced };
    }));

    // Job mentése (dátum-mappák + before/after) — halasztott módban csak jóváhagyás után.
    let job = null;
    if (!defer) {
      const { data } = await supabase
        .from("image_enhance_jobs")
        .insert({ user_id: user.id, mode, items })
        .select("id, mode, items, created_at")
        .single();
      job = data;
    }

    await admin.from("usage_history").insert({
      user_id: user.id,
      service_id: service.id,
      feature_used: FEATURE,
      input_data: { mode, mode_label: enhanceModeLabel(mode), image_count: files.length, outputs: items.map((i) => i.enhanced), pending_review: defer },
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
