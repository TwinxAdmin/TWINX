// POST /api/real-estate/video — Videó 2.0 indítása (hibrid pipeline).
// 1) kredit levonás (admin/sales bypass) → 2) Satori képkockák (nyitó/záró kártya +
// fotó-keretek felirat-sávval) a Storage-ba → 3) Alap: Shotstack render (Ken Burns +
// zene + webhook); PRO: előbb fal.ai AI-klip az 1. fotóból (webhook), majd a
// fal-webhook indítja a Shotstack rendert. Hibánál automatikus kredit-visszatérítés.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeCredit } from "@/lib/credits";
import {
  MIN_VIDEO_IMAGES, MAX_VIDEO_IMAGES,
  CARD_OPEN_SECONDS, CARD_CLOSE_SECONDS, PHOTO_SECONDS,
  creditsForPackage, getFormat, isValidMusicStyle, captionForPhoto,
  type VideoPackage, type VideoCaptionFacts, EMPTY_VIDEO_FACTS,
} from "@/lib/video";
import { pickMusic } from "@/lib/music";
import { submitVideoRender, type TimelineClip, type OverlayClip } from "@/lib/shotstack";
import { submitImageToVideoFal } from "@/lib/fal";
import { loadVideoFonts, renderOpeningCard, renderClosingCard, renderPhotoFrame, renderCaptionOverlay } from "@/lib/video-frames";
import { logCost, shotstackRenderCostUsd } from "@/lib/costs";
import type { FlyerProfileData } from "@/lib/flyer-template";

export const runtime = "nodejs";
export const maxDuration = 60;

const SERVICE_SLUG = "real-estate";
const BUCKET = "reports";
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

function baseUrl(request: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (env) return env.replace(/\/$/, "");
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const format = getFormat(String(form.get("format") ?? ""));
  if (!format) return NextResponse.json({ error: "Érvénytelen formátum." }, { status: 422 });
  const musicStyle = String(form.get("musicStyle") ?? "");
  if (!isValidMusicStyle(musicStyle)) return NextResponse.json({ error: "Érvénytelen zenei stílus." }, { status: 422 });
  const pkg: VideoPackage = String(form.get("package") ?? "alap") === "pro" ? "pro" : "alap";

  const files = form.getAll("images").filter((v): v is File => v instanceof File && v.size > 0);
  if (files.length < MIN_VIDEO_IMAGES || files.length > MAX_VIDEO_IMAGES) {
    return NextResponse.json({ error: `${MIN_VIDEO_IMAGES}-${MAX_VIDEO_IMAGES} kép szükséges.` }, { status: 422 });
  }
  if (files.some((f) => !ALLOWED.includes(f.type))) {
    return NextResponse.json({ error: "Csak JPG, PNG vagy WEBP használható." }, { status: 422 });
  }

  let profile: FlyerProfileData;
  try { profile = JSON.parse(String(form.get("profile") ?? "{}")) as FlyerProfileData; }
  catch { return NextResponse.json({ error: "Hibás arculat." }, { status: 400 }); }

  let facts: VideoCaptionFacts = { ...EMPTY_VIDEO_FACTS };
  try { facts = { ...EMPTY_VIDEO_FACTS, ...(JSON.parse(String(form.get("facts") ?? "{}")) as Partial<VideoCaptionFacts>) }; }
  catch { /* üres adatokkal is megy */ }
  const title = String(form.get("title") ?? "").trim() || "Eladó ingatlan";

  const admin = createAdminClient();
  const { data: service } = await admin.from("services").select("id").eq("slug", SERVICE_SLUG).single();

  // 1) Kredit (admin/sales bypass). Hibánál a lánc bármely pontján visszatérítjük.
  const credits = creditsForPackage(pkg);
  const charge = credits > 0 ? await chargeCredit({ userId: user.id, amount: credits }) : null;
  if (charge && !charge.ok) {
    return NextResponse.json({ error: `Nincs elég egyenleg (${credits} szükséges).` }, { status: 402 });
  }
  const refund = async () => {
    if (charge && !charge.bypassed) await admin.rpc("wallet_add", { p_user_id: user.id, p_amount: credits });
  };

  try {
    // 2) Job létrehozása.
    const { data: job, error: jobErr } = await admin
      .from("video_jobs")
      .insert({
        user_id: user.id,
        service_id: service?.id ?? null,
        status: "rendering",
        format: format.value,
        music_style: musicStyle,
        image_count: files.length,
        credits_charged: charge && !charge.bypassed ? credits : 0,
        package: pkg,
        meta: { title },
      })
      .select("id")
      .single();
    if (jobErr || !job) throw new Error("A videó-job létrehozása nem sikerült.");
    const jobId = job.id as string;

    // 3) Forrásfotók feltöltése (a Shotstack/fal publikus URL-ről olvas).
    const photoUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const bytes = new Uint8Array(await files[i].arrayBuffer());
      const path = `video-src/${user.id}/${jobId}/${i}.jpg`;
      const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: files[i].type, upsert: true });
      if (error) throw new Error(`Fotó mentés hiba: ${error.message}`);
      photoUrls.push(admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
    }

    // 4) Satori képkockák: nyitó/záró kártya + fotó-keretek (alsó felirat-sáv).
    const captions = photoUrls.map((_, i) => captionForPhoto(i, facts));
    const fontPack = await loadVideoFonts(profile, [
      title, facts.location, facts.price,
      profile.display_name, profile.company, profile.title, profile.phone, profile.email, profile.website,
      ...captions,
    ]);
    const ctx = { width: format.width, height: format.height, profile, ...fontPack };

    const frames: Array<{ name: string; buf: Buffer }> = [];
    frames.push({ name: "open.png", buf: await renderOpeningCard(ctx, { title, location: facts.location, price: facts.price }) });
    for (let i = 0; i < photoUrls.length; i++) {
      // A fotó-keret TISZTA (a felirat külön, felső rétegen megy rá → nem zoomol el).
      frames.push({ name: `photo-${i}.png`, buf: await renderPhotoFrame(ctx, { photoUrl: photoUrls[i] }) });
      if (captions[i]) {
        frames.push({ name: `cap-${i}.png`, buf: await renderCaptionOverlay(ctx, { caption: captions[i] }) });
      }
    }
    frames.push({ name: "close.png", buf: await renderClosingCard(ctx) });

    const frameUrls: Record<string, string> = {};
    for (const f of frames) {
      const path = `video-frames/${user.id}/${jobId}/${f.name}`;
      const { error } = await admin.storage.from(BUCKET).upload(path, f.buf, { contentType: "image/png", upsert: true });
      if (error) throw new Error(`Képkocka mentés hiba: ${error.message}`);
      frameUrls[f.name] = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }

    // 5) Zene sorsolása a stílus-mappából.
    const musicUrl = await pickMusic(musicStyle);

    const secret = process.env.VIDEO_WEBHOOK_SECRET || "";
    const site = baseUrl(request);

    if (pkg === "pro") {
      // PRO: előbb az 1. fotó AI-klipje (fal, webhook) — a rendert a webhook indítja.
      const falWebhook = `${site}/api/webhooks/fal?job=${jobId}&token=${encodeURIComponent(secret)}`;
      const requestId = await submitImageToVideoFal({
        imageUrl: photoUrls[0],
        aspectRatio: format.value as "1:1" | "9:16",
        webhookUrl: falWebhook,
      });
      await admin.from("video_jobs").update({
        status: "animating",
        source_images: photoUrls,
        music_url: musicUrl,
        meta: { title, frames: frameUrls, captions, fal_request_id: requestId },
      }).eq("id", jobId);
      return NextResponse.json({ ok: true, jobId, status: "animating" });
    }

    // ALAP: közvetlen Shotstack render — kártyák + fotó-keretek Ken Burns-szel,
    // a feliratok KÜLÖN felső rétegen (nem zoomolnak, végig látszanak).
    const clips: TimelineClip[] = [
      { kind: "image", src: frameUrls["open.png"], length: CARD_OPEN_SECONDS },
      ...photoUrls.map((_, i): TimelineClip => ({
        kind: "image", src: frameUrls[`photo-${i}.png`], length: PHOTO_SECONDS, zoom: true,
      })),
      { kind: "image", src: frameUrls["close.png"], length: CARD_CLOSE_SECONDS },
    ];
    const overlays: OverlayClip[] = [];
    photoUrls.forEach((_, i) => {
      const src = frameUrls[`cap-${i}.png`];
      if (src) overlays.push({ src, start: CARD_OPEN_SECONDS + i * PHOTO_SECONDS, length: PHOTO_SECONDS });
    });
    const callback = `${site}/api/webhooks/shotstack?job=${jobId}&token=${encodeURIComponent(secret)}`;
    const renderId = await submitVideoRender({
      clips, overlays, musicUrl, width: format.width, height: format.height, callbackUrl: callback,
    });

    await admin.from("video_jobs").update({
      source_images: photoUrls,
      music_url: musicUrl,
      meta: { title, frames: frameUrls, captions, render_id: renderId },
    }).eq("id", jobId);

    if (service) {
      await logCost({
        userId: user.id, serviceId: service.id, feature: "video",
        serviceName: "shotstack", units: 1, estimatedCostUsd: shotstackRenderCostUsd(1),
      });
    }

    return NextResponse.json({ ok: true, jobId, status: "rendering" });
  } catch (err) {
    await refund();
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
