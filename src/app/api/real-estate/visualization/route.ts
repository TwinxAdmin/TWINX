// POST /api/real-estate/visualization — Látványtervező teljes lánc (köteg).
// Üzleti szabály: 1 ingatlan = 1 kredit, max. 8 kép. 1 kredit CSAK ha MIND sikerül,
// különben teljes visszatérítés. Sorrend: validáció -> kredit -> köteg generálás
// (Nano Banana) -> Storage -> 1 usage_history sor.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MAX_NOTE_LENGTH,
  isValidStyle,
  validateImageFiles,
  buildVisualizationPrompt,
} from "@/lib/visualization";
import { chargeCredit } from "@/lib/credits";
import { generateImage } from "@/lib/nanobanana";

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
  const style = String(form.get("style") ?? "");
  const note = String(form.get("note") ?? "");

  // Validáció
  const errors: Record<string, string> = {};
  const imagesError = validateImageFiles(files);
  if (imagesError) errors.images = imagesError;
  if (!isValidStyle(style)) errors.style = "Érvénytelen stílus.";
  if (note.length > MAX_NOTE_LENGTH) {
    errors.note = `A megjegyzés legfeljebb ${MAX_NOTE_LENGTH} karakter lehet.`;
  }
  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 422 });
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

  // 1 kredit az egész ingatlanra (köteg). Ha bármelyik kép hibázik -> visszatérítés.
  const charge = await chargeCredit({
    userId: user.id,
    serviceId: service.id,
    amount: 1,
  });
  if (!charge.ok) {
    return NextResponse.json(
      { error: "Nincs elég kredit ehhez a modulhoz." },
      { status: 402 }
    );
  }

  try {
    const prompt = buildVisualizationPrompt(style, note);
    const outputUrls: string[] = [];

    // Köteg: minden képet legeneráljuk. Bármelyik hiba -> az egész köteg bukik.
    for (const file of files) {
      const inputBytes = new Uint8Array(await file.arrayBuffer());

      const result = await generateImage({
        source: { bytes: inputBytes, mimeType: file.type },
        prompt,
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
      outputUrls.push(pub.publicUrl);
    }

    // 1 usage_history sor az ingatlanra (a kimeneti képek listája az input_data-ban).
    const { error: histError } = await admin.from("usage_history").insert({
      user_id: user.id,
      service_id: service.id,
      feature_used: FEATURE,
      input_data: { style, note, image_count: files.length, outputs: outputUrls },
      output_file_url: outputUrls[0] ?? null,
    });
    if (histError) throw new Error(`Előzmény mentés hiba: ${histError.message}`);

    return NextResponse.json({
      ok: true,
      urls: outputUrls,
      charged: !charge.bypassed,
    });
  } catch (err) {
    // Nem sikerült MIND -> teljes visszatérítés (admin/sales-nél nem volt levonás).
    if (!charge.bypassed) {
      await admin.rpc("add_credits", {
        p_user_id: user.id,
        p_service_id: service.id,
        p_amount: 1,
      });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
