// POST /api/webhooks/fal?job=...&token=... — a PRO AI-klip elkészült (fal.ai queue).
// Siker: a klip URL-jét elmentjük, és indítjuk a Shotstack rendert (AI-klip + fotók + kártyák).
// Hiba: job failed + automatikus kredit-visszatérítés.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CARD_OPEN_SECONDS, CARD_CLOSE_SECONDS, PHOTO_SECONDS, AI_CLIP_SECONDS, getFormat } from "@/lib/video";
import { submitVideoRender, type TimelineClip, type OverlayClip } from "@/lib/shotstack";

export const runtime = "nodejs";
export const maxDuration = 60;

function baseUrl(request: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (env) return env.replace(/\/$/, "");
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}`;
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("job") ?? "";
  const token = url.searchParams.get("token") ?? "";
  const secret = process.env.VIDEO_WEBHOOK_SECRET || "";
  if (!jobId || (secret && token !== secret)) {
    return NextResponse.json({ error: "Érvénytelen webhook." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: job } = await admin
    .from("video_jobs")
    .select("id, user_id, status, format, music_url, source_images, credits_charged, meta")
    .eq("id", jobId)
    .single();
  if (!job) return NextResponse.json({ error: "Nem található." }, { status: 404 });
  if (job.status === "done" || job.status === "failed") return NextResponse.json({ ok: true });

  let payload: Record<string, unknown> = {};
  try { payload = await request.json(); } catch { payload = {}; }

  const fail = async (msg: string) => {
    await admin.from("video_jobs").update({ status: "failed", error: msg }).eq("id", jobId);
    if (job.credits_charged > 0) {
      await admin.rpc("wallet_add", { p_user_id: job.user_id, p_amount: job.credits_charged });
    }
    return NextResponse.json({ ok: true });
  };

  // A fal webhook payloadja: { request_id, status: "OK"|"ERROR", payload: {...} }
  const status = String((payload as { status?: string }).status ?? "");
  if (status && status !== "OK") {
    return fail("Az AI-klip generálása nem sikerült.");
  }
  const inner = (payload as { payload?: Record<string, unknown> }).payload ?? payload;
  const clipUrl =
    ((inner as { video?: { url?: string } }).video?.url) ??
    ((inner as { url?: string }).url) ??
    null;
  if (!clipUrl) return fail("Az AI-klip URL-je hiányzik a válaszból.");

  try {
    const meta = (job.meta ?? {}) as { frames?: Record<string, string>; title?: string };
    const frames = meta.frames ?? {};
    const photos = (job.source_images ?? []) as string[];
    const format = getFormat(String(job.format));
    if (!format) throw new Error("Hibás formátum a jobon.");

    // Idővonal: nyitókártya + AI-klip (1. fotó) + a többi fotó-keret + zárókártya.
    const clips: TimelineClip[] = [
      { kind: "image", src: frames["open.png"], length: CARD_OPEN_SECONDS },
      { kind: "video", src: clipUrl, length: AI_CLIP_SECONDS },
      ...photos.slice(1).map((_, i): TimelineClip => ({
        kind: "image", src: frames[`photo-${i + 1}.png`], length: PHOTO_SECONDS, zoom: true,
      })),
      { kind: "image", src: frames["close.png"], length: CARD_CLOSE_SECONDS },
    ];

    // Feliratok külön felső rétegen (az AI-klip fölött is) — nem zoomolnak.
    const overlays: OverlayClip[] = [];
    if (frames["cap-0.png"]) {
      overlays.push({ src: frames["cap-0.png"], start: CARD_OPEN_SECONDS, length: AI_CLIP_SECONDS });
    }
    photos.slice(1).forEach((_, i) => {
      const src = frames[`cap-${i + 1}.png`];
      if (src) {
        overlays.push({
          src,
          start: CARD_OPEN_SECONDS + AI_CLIP_SECONDS + i * PHOTO_SECONDS,
          length: PHOTO_SECONDS,
        });
      }
    });

    const site = baseUrl(request);
    const callback = `${site}/api/webhooks/shotstack?job=${jobId}&token=${encodeURIComponent(secret)}`;
    const renderId = await submitVideoRender({
      clips,
      overlays,
      musicUrl: (job.music_url as string) ?? null,
      width: format.width,
      height: format.height,
      callbackUrl: callback,
    });

    await admin.from("video_jobs").update({
      status: "rendering",
      meta: { ...meta, ai_clip_url: clipUrl, render_id: renderId },
    }).eq("id", jobId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail((err as Error).message);
  }
}
