// POST /api/flyer/compose — AI hirdetés-háttér a partner fotóiból (Nano Banana).
// A kimenet SZÖVEG NÉLKÜLI kompozíció; a feliratokat a böngészőben írjuk rá élesen.
// Ingyenes (előnézet-jellegű lépés), a költséget viszont logoljuk.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateImage } from "@/lib/nanobanana";
import { buildComposePrompt } from "@/lib/flyer-compose";
import { logCost, googleImageCostUsd } from "@/lib/costs";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "reports";
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const files = form.getAll("images").filter((v): v is File => v instanceof File && v.size > 0).slice(0, 4);
  if (!files.length) return NextResponse.json({ error: "Adj hozzá legalább egy képet." }, { status: 422 });
  if (files.some((f) => !ALLOWED.includes(f.type))) {
    return NextResponse.json({ error: "Csak JPG, PNG vagy WEBP használható." }, { status: 422 });
  }

  const accent = String(form.get("accent") ?? "#ef7a5a");
  const mood = String(form.get("mood") ?? "luxus");
  const ratioLabel = String(form.get("ratioLabel") ?? "square 1:1");

  try {
    const inputs = await Promise.all(
      files.map(async (f) => ({ bytes: new Uint8Array(await f.arrayBuffer()), mimeType: f.type || "image/jpeg" }))
    );

    const prompt = buildComposePrompt({ imageCount: inputs.length, accent, mood, ratioLabel });
    const result = await generateImage({
      source: inputs[0],
      extra: inputs.slice(1),
      prompt,
    });

    const admin = createAdminClient();
    const ext = result.mimeType.includes("jpeg") ? "jpg" : "png";
    const path = `flyer-bg/${user.id}/${randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, result.bytes, { contentType: result.mimeType });
    if (upErr) throw new Error(`Mentés hiba: ${upErr.message}`);
    const url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    const { data: service } = await admin.from("services").select("id").eq("slug", "real-estate").single();
    if (service) {
      await logCost({
        userId: user.id,
        serviceId: service.id,
        feature: "flyer_compose",
        serviceName: "google-studio",
        units: 1,
        estimatedCostUsd: googleImageCostUsd(1),
      });
    }

    return NextResponse.json({ ok: true, url });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
