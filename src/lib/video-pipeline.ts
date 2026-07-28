// A videó idővonalának összeállítása és Shotstack-render indítása.
// KÖZÖS: a fal-webhook és a státusz-lekérdezéses biztonsági háló is ezt hívja,
// így a két út mindig ugyanazt a videót építi.
import { createAdminClient } from "@/lib/supabase/admin";
import { CARD_OPEN_SECONDS, CARD_CLOSE_SECONDS, PHOTO_SECONDS, AI_CLIP_SECONDS, getFormat } from "@/lib/video";
import { submitVideoRender, type TimelineClip, type OverlayClip } from "@/lib/shotstack";

export type VideoJobRow = {
  id: string;
  format: string;
  music_url: string | null;
  source_images: unknown;
  meta: unknown;
};

/** A PRO ág: nyitókártya + AI-klip + a többi fotó + zárókártya, feliratokkal. */
export async function startRenderWithAiClip(
  job: VideoJobRow,
  aiClipUrl: string,
  site: string,
  secret: string
): Promise<string> {
  const meta = (job.meta ?? {}) as { frames?: Record<string, string>; title?: string };
  const frames = meta.frames ?? {};
  const photos = (job.source_images ?? []) as string[];
  const format = getFormat(String(job.format));
  if (!format) throw new Error("Hibás formátum a jobon.");

  const clips: TimelineClip[] = [
    { kind: "image", src: frames["open.png"], length: CARD_OPEN_SECONDS },
    { kind: "video", src: aiClipUrl, length: AI_CLIP_SECONDS },
    ...photos.slice(1).map((_, i): TimelineClip => ({
      kind: "image", src: frames[`photo-${i + 1}.png`], length: PHOTO_SECONDS, zoom: true,
    })),
    { kind: "image", src: frames["close.png"], length: CARD_CLOSE_SECONDS },
  ];

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

  const callback = `${site}/api/webhooks/shotstack?job=${job.id}&token=${encodeURIComponent(secret)}`;
  const renderId = await submitVideoRender({
    clips, overlays,
    musicUrl: job.music_url ?? null,
    width: format.width,
    height: format.height,
    callbackUrl: callback,
  });

  const admin = createAdminClient();
  await admin.from("video_jobs").update({
    status: "rendering",
    meta: { ...meta, ai_clip_url: aiClipUrl, render_id: renderId },
  }).eq("id", job.id);

  return renderId;
}
