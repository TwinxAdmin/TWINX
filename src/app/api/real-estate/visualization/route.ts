// POST /api/real-estate/visualization — Látványtervező (helységenkénti konfig).
// 1 ingatlan = 1 kredit, max. 8 kép. Minden kép saját helység + változók + prompt.
// Stílus esetén [stílus][helység] referenciakép is megy a Nano Bananának.
// 1 kredit CSAK ha MIND sikerül, különben teljes visszatérítés.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MAX_IMAGES,
  ROOM_TYPES,
  validateImageFiles,
  validateRoomConfig,
  buildRoomPrompt,
  type RoomConfig,
} from "@/lib/visualization";
import { chargeCredit } from "@/lib/credits";
import { generateImage } from "@/lib/nanobanana";
import { getReferenceImage } from "@/lib/references";
import { logCost, googleImageCostUsd } from "@/lib/costs";

export const runtime = "nodejs";

const SERVICE_SLUG = "real-estate";
const FEATURE = "visualization";
const BUCKET = "reports";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const files = form
    .getAll("images")
    .filter((v): v is File => v instanceof File && v.size > 0);

  let configs: RoomConfig[];
  try {
    configs = JSON.parse(String(form.get("configs") ?? "[]"));
  } catch {
    return NextResponse.json({ error: "Érvénytelen konfiguráció." }, { status: 400 });
  }

  // Validáció
  const imagesError = validateImageFiles(files);
  if (imagesError) {
    return NextResponse.json({ errors: { images: imagesError } }, { status: 422 });
  }
  if (!Array.isArray(configs) || configs.length !== files.length) {
    return NextResponse.json(
      { error: "A képek és a beállítások száma nem egyezik." },
      { status: 422 }
    );
  }
  for (let i = 0; i < configs.length; i++) {
    const err = validateRoomConfig(configs[i]);
    if (err) {
      return NextResponse.json(
        { error: `${i + 1}. kép: ${err}` },
        { status: 422 }
      );
    }
  }

  const admin = createAdminClient();

  const { data: service } = await admin
    .from("services")
    .select("id")
    .eq("slug", SERVICE_SLUG)
    .single();
  if (!service) {
    return NextResponse.json({ error: "A modul nem található." }, { status: 400 });
  }

  // 1 kredit az egész generálásra (all-or-nothing), a közös egyenlegből.
  const charge = await chargeCredit({
    userId: user.id,
    amount: 1,
  });
  if (!charge.ok) {
    return NextResponse.json(
      { error: "Nincs elég kredit ehhez a modulhoz." },
      { status: 402 }
    );
  }

  try {
    const results: Array<{ url: string; config: RoomConfig }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const config = configs[i];
      const { prompt, useReference } = buildRoomPrompt(config);

      const inputBytes = new Uint8Array(await file.arrayBuffer());

      // Stílus esetén a [stílus][helység] referenciakép is megy.
      let reference: { bytes: Uint8Array; mimeType: string } | undefined;
      if (useReference) {
        const room = ROOM_TYPES.find((r) => r.value === config.roomType);
        const ref = await getReferenceImage(config.style, room?.slug ?? "");
        if (ref) reference = ref;
      }

      const result = await generateImage({
        source: { bytes: inputBytes, mimeType: file.type },
        prompt,
        reference,
      });

      const ext = result.mimeType.includes("jpeg") ? "jpg" : "png";
      const filePath = `visualization/${user.id}/${randomUUID()}.${ext}`;
      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(filePath, result.bytes, {
          contentType: result.mimeType,
          upsert: false,
        });
      if (uploadError) throw new Error(`Storage feltöltés hiba: ${uploadError.message}`);

      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(filePath);
      results.push({ url: pub.publicUrl, config });
    }

    // 1 usage_history sor az ingatlanra (helységenkénti konfig + kimenetek).
    const { error: histError } = await admin.from("usage_history").insert({
      user_id: user.id,
      service_id: service.id,
      feature_used: FEATURE,
      input_data: {
        image_count: files.length,
        rooms: results.map((r) => ({ ...r.config, output: r.url })),
      },
      output_file_url: results[0]?.url ?? null,
      credits_charged: charge.bypassed ? 0 : 1,
    });
    if (histError) throw new Error(`Előzmény mentés hiba: ${histError.message}`);

    // Nyers API-önköltség logolása (admin-only, best-effort). Kép/darab alapján.
    await logCost({
      userId: user.id,
      serviceId: service.id,
      feature: FEATURE,
      serviceName: "google-studio",
      units: files.length,
      estimatedCostUsd: googleImageCostUsd(files.length),
    });

    return NextResponse.json({
      ok: true,
      urls: results.map((r) => r.url),
      charged: !charge.bypassed,
    });
  } catch (err) {
    // Nem sikerült MIND -> teljes visszatérítés.
    if (!charge.bypassed) {
      await admin.rpc("wallet_add", {
        p_user_id: user.id,
        p_amount: 1,
      });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
