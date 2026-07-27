// POST /api/real-estate/image-enhance/regenerate
// INGYENES újragenerálás, ha a partner nem fogadja el az eredményt (pl. az AI odatett
// egy nem létező tárgyat). Kreditet NEM von. Az indokot naplózzuk az adminnak.
// Body: { mode, original, rejected, reason }
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateImage } from "@/lib/nanobanana";
import { enhanceImageFal } from "@/lib/fal";
import { buildEnhancePromptActive, buildEnhanceFalActive } from "@/lib/prompts";
import { logCost, googleImageCostUsd } from "@/lib/costs";
import { isEnhanceMode } from "@/lib/image-enhance";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "reports";
const SERVICE_SLUG = "real-estate";
const FEATURE = "image_enhance_regenerate";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const mode = String(body?.mode ?? "");
  const original = String(body?.original ?? "");
  const rejected = String(body?.rejected ?? "");
  const reason = String(body?.reason ?? "").trim().slice(0, 500);
  if (!isEnhanceMode(mode)) return NextResponse.json({ error: "Érvénytelen mód." }, { status: 422 });
  if (!original) return NextResponse.json({ error: "Hiányzik az eredeti kép." }, { status: 422 });

  const admin = createAdminClient();
  try {
    // Az eredeti kép letöltése (publikus Storage URL).
    const srcRes = await fetch(original);
    if (!srcRes.ok) throw new Error("Az eredeti kép nem érhető el.");
    const srcBytes = new Uint8Array(await srcRes.arrayBuffer());
    const srcMime = srcRes.headers.get("content-type") ?? "image/jpeg";

    // Újragenerálás ugyanazzal a motorral. A partner indoklását finoman hozzáfűzzük.
    let result: { bytes: Buffer; mimeType: string };
    if (mode === "feljavitas") {
      const cfg = await buildEnhanceFalActive();
      const dataUri = `data:${srcMime};base64,${Buffer.from(srcBytes).toString("base64")}`;
      result = await enhanceImageFal({
        dataUri,
        prompt: cfg.prompt,
        negativePrompt: cfg.negative,
        upscaleFactor: Number(process.env.FAL_ENHANCE_UPSCALE_HIGH || 4),
      });
    } else {
      const base = await buildEnhancePromptActive("rendrakas");
      const extra = reason
        ? `\n\nIMPORTANT — the previous attempt was rejected by the user for this reason: "${reason}". Do NOT repeat that mistake. Never invent, add or hallucinate any object, furniture or decoration that is not present in the input photo.`
        : "\n\nIMPORTANT: never invent, add or hallucinate any object, furniture or decoration that is not present in the input photo.";
      result = await generateImage({ source: { bytes: srcBytes, mimeType: srcMime }, prompt: base + extra });
    }

    const ext = result.mimeType.includes("jpeg") ? "jpg" : "png";
    const path = `image-enhance/${user.id}/${randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, result.bytes, { contentType: result.mimeType, upsert: false });
    if (upErr) throw new Error(`Storage feltöltés hiba: ${upErr.message}`);
    const enhanced = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    // Napló az adminnak (mi és miért nem felelt meg).
    await admin.from("enhance_rejections").insert({
      user_id: user.id,
      mode,
      original_url: original,
      rejected_url: rejected || original,
      replacement_url: enhanced,
      reason: reason || null,
    });

    // Költség-logolás (a partnernek ingyenes, nekünk költség).
    const { data: service } = await admin.from("services").select("id").eq("slug", SERVICE_SLUG).single();
    if (service) {
      await logCost({
        userId: user.id,
        serviceId: service.id,
        feature: FEATURE,
        serviceName: mode === "feljavitas" ? "fal" : "google-studio",
        units: 1,
        estimatedCostUsd: mode === "feljavitas" ? 0.05 : googleImageCostUsd(1),
      });
    }

    return NextResponse.json({ ok: true, item: { original, enhanced } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
