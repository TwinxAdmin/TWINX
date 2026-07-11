// POST /api/real-estate/video — videó pipeline indítása.
// Forrás: feltöltött eredeti képek ÉS/VAGY korábbi látványterv-előzmény URL-ek (3-8).
// Kredit a képszám szerint. 1 job/ingatlan. Sikertelen indításnál visszatérítés.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeCredit } from "@/lib/credits";
import {
  MIN_VIDEO_IMAGES,
  MAX_VIDEO_IMAGES,
  creditForImages,
  getFormat,
  isValidMusicStyle,
  lengthBinForImages,
} from "@/lib/video";
import { pickRandomMusic } from "@/lib/music";
import { submitImageToVideo } from "@/lib/luma";
import { getVideoPromptActive } from "@/lib/prompts";

export const runtime = "nodejs";

const SERVICE_SLUG = "real-estate";
const FEATURE = "video";
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

  const format = String(form.get("format") ?? "");
  const musicStyle = String(form.get("musicStyle") ?? "");
  const uploads = form
    .getAll("images")
    .filter((v): v is File => v instanceof File && v.size > 0);
  let historyUrls: string[] = [];
  try {
    historyUrls = JSON.parse(String(form.get("historyUrls") ?? "[]"));
  } catch {
    historyUrls = [];
  }

  if (!getFormat(format)) {
    return NextResponse.json({ error: "Érvénytelen formátum." }, { status: 422 });
  }
  if (!isValidMusicStyle(musicStyle)) {
    return NextResponse.json({ error: "Érvénytelen zenei stílus." }, { status: 422 });
  }

  const admin = createAdminClient();

  // Feltöltött eredeti képek Storage-ba → publikus URL (a Luma URL-t igényel).
  const uploadedUrls: string[] = [];
  for (const file of uploads) {
    const ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
    const path = `video-source/${user.id}/${randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      return NextResponse.json({ error: `Feltöltés hiba: ${error.message}` }, { status: 500 });
    }
    uploadedUrls.push(admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
  }

  const sourceImages = [...historyUrls.filter(Boolean), ...uploadedUrls];
  const count = sourceImages.length;
  if (count < MIN_VIDEO_IMAGES || count > MAX_VIDEO_IMAGES) {
    return NextResponse.json(
      { error: `${MIN_VIDEO_IMAGES}-${MAX_VIDEO_IMAGES} kép szükséges (most: ${count}).` },
      { status: 422 }
    );
  }

  const { data: service } = await admin
    .from("services")
    .select("id")
    .eq("slug", SERVICE_SLUG)
    .single();
  if (!service) {
    return NextResponse.json({ error: "A modul nem található." }, { status: 400 });
  }

  // Kredit a képszám szerint.
  const credits = creditForImages(count);
  const charge = await chargeCredit({
    userId: user.id,
    amount: credits,
  });
  if (!charge.ok) {
    return NextResponse.json(
      { error: `Nincs elég kredit (${credits} szükséges).` },
      { status: 402 }
    );
  }

  try {
    // Random zene a stílusból, a videó hosszához illő bin-ből.
    const musicUrl = await pickRandomMusic(musicStyle, lengthBinForImages(count));
    if (!musicUrl) {
      throw new Error("Nincs elérhető zene ehhez a stílushoz (töltsd fel a music bucketbe).");
    }

    // Job létrehozása.
    const { data: job, error: jobError } = await admin
      .from("video_jobs")
      .insert({
        user_id: user.id,
        service_id: service.id,
        status: "animating",
        format,
        music_style: musicStyle,
        music_url: musicUrl,
        image_count: count,
        // admin/sales-nél nem volt tényleges levonás -> 0 (nincs téves visszatérítés)
        credits_charged: charge.bypassed ? 0 : credits,
        source_images: sourceImages,
        clips: [],
      })
      .select("id")
      .single();
    if (jobError || !job) throw new Error(jobError?.message ?? "Job létrehozás hiba.");

    // Luma indítása képenként (callback a mi webhookunkra).
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const secret = process.env.VIDEO_WEBHOOK_SECRET || "";
    const videoPrompt = await getVideoPromptActive();
    const clips: Array<{ index: number; luma_id: string; status: string; url: string | null }> = [];
    for (let i = 0; i < sourceImages.length; i++) {
      const callbackUrl = `${appUrl}/api/webhooks/luma?job=${job.id}&index=${i}&secret=${secret}`;
      const lumaId = await submitImageToVideo({
        imageUrl: sourceImages[i],
        aspectRatio: format,
        callbackUrl,
        prompt: videoPrompt,
      });
      clips.push({ index: i, luma_id: lumaId, status: "animating", url: null });
    }

    await admin.from("video_jobs").update({ clips }).eq("id", job.id);

    return NextResponse.json({ ok: true, jobId: job.id });
  } catch (err) {
    if (!charge.bypassed) {
      await admin.rpc("wallet_add", {
        p_user_id: user.id,
        p_amount: credits,
      });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
