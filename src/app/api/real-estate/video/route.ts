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
  CARD_OPEN_SECONDS, CARD_CLOSE_SECONDS, PHOTO_SECONDS, AI_CLIP_SECONDS,
  creditsForPackage, getFormat, isValidMusicStyle, captionForPhoto,
  type VideoPackage, type VideoCaptionFacts, EMPTY_VIDEO_FACTS,
} from "@/lib/video";
import {
  getDesign, aspectAvailable, variantJson, imageCountOk, imageCountLabel,
  VIDEO_DESIGNS, type VideoAspect,
} from "@/lib/video-templates";
import { pickMusic } from "@/lib/music";
import { submitVideoRender, submitTemplateRender, type TimelineClip, type OverlayClip } from "@/lib/shotstack";
import { buildMergeRenderBody } from "@/lib/video-merge";
import { submitImageToVideoFal, videoClipPrompt } from "@/lib/fal";
import { failJobOnce, initClips, type AiClipState } from "@/lib/video-pipeline";
import { loadVideoFonts, renderOpeningCard, renderClosingCard, renderPhotoFrame, renderCaptionOverlay } from "@/lib/video-frames";
import { logCost, shotstackRenderCostUsd, falVideoCostUsd } from "@/lib/costs";
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

  // A dizájn + méret köti a formátumot és a képszámot. Visszafelé kompatibilis.
  const design = getDesign(String(form.get("designId") ?? "")) ?? VIDEO_DESIGNS[0];
  const aspect = (aspectAvailable(design, String(form.get("aspect") ?? "")) ? String(form.get("aspect")) : design.aspects[0]) as VideoAspect;
  const format = getFormat(aspect);
  if (!format) return NextResponse.json({ error: "Érvénytelen méret." }, { status: 422 });
  const musicStyle = String(form.get("musicStyle") ?? "");
  if (!isValidMusicStyle(musicStyle)) return NextResponse.json({ error: "Érvénytelen zenei stílus." }, { status: 422 });
  const pkg: VideoPackage = String(form.get("package") ?? "alap") === "pro" ? "pro" : "alap";

  const files = form.getAll("images").filter((v): v is File => v instanceof File && v.size > 0);
  if (!imageCountOk(design, aspect, files.length)) {
    return NextResponse.json(
      { error: `Ehhez a mérethez ${imageCountLabel(design, aspect).toLowerCase()} szükséges.` },
      { status: 422 }
    );
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
  // A könyvtárban ez lesz a videó neve (az ingatlan címe); ha nincs, a főcím.
  const propertyAddress = String(form.get("propertyAddress") ?? "").trim() || title;

  // ELŐELLENŐRZÉS: ha a szolgáltatás nincs beállítva, ne is vonjunk kreditet, és
  // a partner ne nyers technikai üzenetet lásson.
  const missingConfig: string[] = [];
  if (!process.env.SHOTSTACK_API_KEY) missingConfig.push("SHOTSTACK_API_KEY");
  if (pkg === "pro" && !process.env.FAL_KEY) missingConfig.push("FAL_KEY");
  if (missingConfig.length) {
    console.error("[video] Hiányzó beállítás:", missingConfig.join(", "));
    return NextResponse.json({
      error: "A videó szolgáltatás jelenleg nem elérhető (hiányzó beállítás). Szólj az adminnak — kredit nem került levonásra.",
    }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: service } = await admin.from("services").select("id").eq("slug", SERVICE_SLUG).single();

  // 1) Kredit (admin/sales bypass). Hibánál a lánc bármely pontján visszatérítjük.
  const credits = creditsForPackage(pkg);
  const charge = credits > 0 ? await chargeCredit({ userId: user.id, amount: credits }) : null;
  if (charge && !charge.ok) {
    return NextResponse.json({ error: `Nincs elég egyenleg (${credits} szükséges).` }, { status: 402 });
  }
  // Ha már létrejött a job, a bukást + visszatérítést az EGYSZERI úton intézzük,
  // hogy egy később beérkező webhook ne térítsen vissza másodszor is.
  let createdJobId: string | null = null;
  const refund = async (message: string) => {
    if (!charge || charge.bypassed) return;
    if (createdJobId) await failJobOnce(createdJobId, user.id, credits, message);
    else await admin.rpc("wallet_add", { p_user_id: user.id, p_amount: credits });
  };

  try {
    // 2) Job létrehozása.
    const { data: job, error: jobErr } = await admin
      .from("video_jobs")
      .insert({
        user_id: user.id,
        service_id: service?.id ?? null,
        // PRO-nál rögtön 'animating': ha egy fal-webhook nagyon gyorsan visszaér,
        // ne dobjuk el amiatt, hogy a job még 'rendering' állapotban áll.
        status: pkg === "pro" ? "animating" : "rendering",
        format: format.value,
        music_style: musicStyle,
        image_count: files.length,
        credits_charged: charge && !charge.bypassed ? credits : 0,
        package: pkg,
        title: propertyAddress, // a könyvtárban ez a videó neve
        meta: { title },
      })
      .select("id")
      .single();
    if (jobErr || !job) throw new Error("A videó-job létrehozása nem sikerült.");
    const jobId = job.id as string;
    createdJobId = jobId;

    // 3) Forrásfotók feltöltése (a Shotstack/fal publikus URL-ről olvas).
    const photoUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const bytes = new Uint8Array(await files[i].arrayBuffer());
      const path = `video-src/${user.id}/${jobId}/${i}.jpg`;
      const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: files[i].type, upsert: true });
      if (error) throw new Error(`Fotó mentés hiba: ${error.message}`);
      photoUrls.push(admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
    }

    // 3/B) JSON-SABLON ÁG: kész Shotstack template merge-mezőkkel (a választott mérethez).
    //      A dizájn a JSON-ban van; mi csak a helyőrzőket töltjük ki + a zenét cseréljük.
    const designJson = design.kind === "json" ? variantJson(design, aspect) : null;
    if (designJson) {
      const musicUrl = await pickMusic(musicStyle);
      const digits = (s: string) => (String(s).match(/\d+/)?.[0] ?? "");
      const clean = (s: string | undefined) => String(s ?? "").trim();
      // Összevont adatsor a zárókártyához: méret · szoba · fürdő · emelet (üres kimarad).
      const specs = [
        clean(facts.size),
        clean(facts.rooms),
        clean(facts.bathrooms),
        clean(facts.floor),
      ].filter(Boolean).join("   ·   ");
      const values: Record<string, string> = {
        ADDRESS: facts.address || propertyAddress,
        SUBURB: facts.location,
        STATE: "",
        POSTCODE: "",
        BEDROOMS: digits(facts.rooms),
        BATHROOMS: digits(facts.bathrooms),
        CARPORTS: "",
        TYPE: (clean((facts as { propertyType?: string }).propertyType) || "ELADÓ").toUpperCase(),
        PRICE: clean(facts.price),
        SIZE: clean(facts.size),
        FLOOR: clean(facts.floor),
        SPECS: specs,
        AGENT_NAME: (profile.display_name || profile.company || "").toUpperCase(),
        AGENT_EMAIL: profile.email || profile.phone || "",
        AGENT_PICTURE: profile.agent_photo_url || "",
        AGENCY_LOGO: profile.logo_url || "",
      };
      const secret = process.env.VIDEO_WEBHOOK_SECRET || "";
      const callback = `${baseUrl(request)}/api/webhooks/shotstack?job=${jobId}&token=${encodeURIComponent(secret)}`;
      const body = buildMergeRenderBody(designJson, {
        images: photoUrls, musicUrl, values, callbackUrl: callback,
      });
      const renderId = await submitTemplateRender(body);

      await admin.from("video_jobs").update({
        source_images: photoUrls,
        music_url: musicUrl,
        poster_url: photoUrls[0], // előkép: az első fotó
        meta: { title, template: design.id, aspect, render_id: renderId },
      }).eq("id", jobId);

      if (service) {
        await logCost({
          userId: user.id, serviceId: service.id, feature: "video",
          serviceName: "shotstack", units: 1, estimatedCostUsd: shotstackRenderCostUsd(1),
        });
      }
      return NextResponse.json({ ok: true, jobId, status: "rendering" });
    }

    // 4) Satori képkockák: nyitó/záró kártya + fotó-keretek (alsó felirat-sáv).
    const captions = photoUrls.map((_, i) => captionForPhoto(i, facts));
    const fontPack = await loadVideoFonts(profile, [
      title, facts.location, facts.address, facts.price,
      profile.display_name, profile.company, profile.title, profile.phone, profile.email, profile.website,
      ...captions.flatMap((c) => [c.line1, c.line2]),
    ]);
    const ctx = { width: format.width, height: format.height, profile, ...fontPack };

    const frames: Array<{ name: string; buf: Buffer }> = [];
    frames.push({ name: "open.png", buf: await renderOpeningCard(ctx, { title, location: facts.location, price: facts.price }) });
    for (let i = 0; i < photoUrls.length; i++) {
      // A fotó-keret TISZTA (a felirat külön, felső rétegen megy rá → nem zoomol el).
      frames.push({ name: `photo-${i}.png`, buf: await renderPhotoFrame(ctx, { photoUrl: photoUrls[i] }) });
      if (captions[i]?.line1 || captions[i]?.line2) {
        frames.push({ name: `cap-${i}.png`, buf: await renderCaptionOverlay(ctx, captions[i]) });
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
      // PRO: MINDEN fotóból AI-klip (napszak-ív: reggel → déli sugarak → aranyló este).
      // A klipek párhuzamosan futnak; a rendert az indítja, amelyik utoljára készül el
      // (webhook, illetve localhoston a státusz-lekérdezéses biztonsági háló).
      // FONTOS a sorrend: előbb létrehozzuk az ÜRES kliplistát, és csak utána küldjük
      // be a fal-jobokat. Így egy nagyon gyorsan visszaérő webhook is talál helyet
      // magának a meta.ai_clips tömbben (különben az eredménye elveszne).
      const { error: initErr } = await admin.from("video_jobs").update({
        source_images: photoUrls,
        music_url: musicUrl,
        poster_url: frameUrls["open.png"], // előkép: a nyitókártya
        meta: {
          title, frames: frameUrls, captions,
          ai_clips: photoUrls.map(() => ({ requestId: "", statusUrl: null, responseUrl: null })),
        },
      }).eq("id", jobId);
      if (initErr) throw new Error(`A videó-job mentése nem sikerült: ${initErr.message}`);

      // A beküldések PÁRHUZAMOSAN futnak — így a szerveridő nem lépi túl a limitet.
      const aiClips: AiClipState[] = await Promise.all(
        photoUrls.map(async (photoUrl, i): Promise<AiClipState> => {
          const falWebhook = `${site}/api/webhooks/fal?job=${jobId}&clip=${i}&token=${encodeURIComponent(secret)}`;
          try {
            const fal = await submitImageToVideoFal({
              imageUrl: photoUrl,
              aspectRatio: format.value as "1:1" | "9:16",
              webhookUrl: falWebhook,
              prompt: videoClipPrompt(i, photoUrls.length),
            });
            return { requestId: fal.requestId, statusUrl: fal.statusUrl, responseUrl: fal.responseUrl };
          } catch {
            // Ez a snitt Ken Burns fotó lesz — a videó ettől még elkészül.
            return { requestId: "", statusUrl: null, responseUrl: null, failed: true };
          }
        })
      );
      if (aiClips.every((c) => c.failed)) throw new Error("Az AI-mozgás indítása nem sikerült.");

      // Az azonosítók ÖSSZEFÉSÜLÉSE: ha egy klip már vissza is ért, az eredménye marad.
      const savedClips = await initClips(jobId, aiClips);
      // Ellenőrzés: ha az azonosítók nem mentődtek el, a klipek eredménye sosem
      // jutna vissza (a job örökre „készül" maradna) → inkább bukjon most.
      const expected = aiClips.filter((c) => !c.failed).length;
      const saved = savedClips.filter((c) => c.requestId).length;
      if (saved < expected) {
        throw new Error("A beküldési azonosítók mentése nem sikerült (futtasd a video-pro-clips.sql-t).");
      }

      if (service) {
        await logCost({
          userId: user.id, serviceId: service.id, feature: "video",
          serviceName: "fal-i2v", units: aiClips.filter((c) => !c.failed).length,
          estimatedCostUsd: falVideoCostUsd(aiClips.filter((c) => !c.failed).length, AI_CLIP_SECONDS),
        });
      }
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
      poster_url: frameUrls["open.png"], // előkép: a nyitókártya
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
    await refund((err as Error).message);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
