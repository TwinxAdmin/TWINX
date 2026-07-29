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

/** Egy AI-klip állapota a jobon (fotónként egy). */
export type AiClipState = {
  requestId: string;
  statusUrl: string | null;
  responseUrl: string | null;
  videoUrl?: string | null;   // kész
  failed?: boolean;           // nem sikerült → az adott snitt Ken Burns fotó lesz
};

export type VideoMeta = {
  title?: string;
  frames?: Record<string, string>;
  captions?: unknown;
  ai_clips?: AiClipState[];
  render_id?: string;
};

/** Készen áll-e a render: minden AI-klip lezárult (kész VAGY véglegesen hibás). */
export function allClipsSettled(clips: AiClipState[] | undefined): boolean {
  if (!clips?.length) return false;
  return clips.every((c) => Boolean(c.videoUrl) || c.failed === true);
}

/** Egy AI-klip eredményének ATOMI beírása (a párhuzamos webhookok nem írják felül egymást).
 *  A visszatérési érték a job teljes, friss klip-listája. */
export async function saveClipResult(
  jobId: string,
  index: number,
  result: { videoUrl?: string | null; failed?: boolean }
): Promise<AiClipState[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("video_clip_result", {
    p_job: jobId,
    p_index: index,
    p_url: result.videoUrl ?? null,
    p_failed: result.failed === true,
  });
  // Ha az SQL-migráció nem futott le, ezt NE nyeljük el — különben a job
  // némán, örökre „készül" állapotban ragadna.
  if (error) throw new Error(`video_clip_result: ${error.message}`);
  return (data ?? []) as AiClipState[];
}

/** A klipek beküldési azonosítóinak mentése — a már beérkezett eredményeket
 *  megtartva (összefésülés, nem felülírás). */
export async function initClips(jobId: string, clips: AiClipState[]): Promise<AiClipState[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("video_clips_init", { p_job: jobId, p_clips: clips });
  if (error) throw new Error(`video_clips_init: ${error.message}`);
  return (data ?? []) as AiClipState[];
}

/** A render indításának elkapása: csak EGY hívó kapja meg (animating → rendering).
 *  Így a webhook és a lekérdezéses biztonsági háló nem indíthat két (fizetős) rendert. */
export async function claimRender(jobId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("video_job_claim_render", { p_job: jobId });
  if (error) throw new Error(`video_job_claim_render: ${error.message}`);
  return data === true;
}

/** Job bukása EGYSZER + kredit-visszatérítés. Ha másik szál már megbuktatta,
 *  ez a hívás nem térít vissza újra. */
export async function failJobOnce(
  jobId: string,
  userId: string,
  creditsCharged: number,
  message: string
): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("video_job_fail_once", { p_job: jobId, p_error: message });
  if (error) {
    // Végszükség: ha a migráció hiányzik, a kredit akkor se vesszen el.
    await admin.from("video_jobs").update({ status: "failed", error: message }).eq("id", jobId);
    if (creditsCharged > 0) await admin.rpc("wallet_add", { p_user_id: userId, p_amount: creditsCharged });
    return;
  }
  if (data === true && creditsCharged > 0) {
    await admin.rpc("wallet_add", { p_user_id: userId, p_amount: creditsCharged });
  }
}

/**
 * PRO render: nyitókártya + snittenként AI-klip (ahol van) + zárókártya, feliratokkal.
 * Ha egy klip nem sikerült, az a snitt visszaesik a Ken Burns fotó-keretre — így egy
 * hibás klip miatt sem vész el a teljes videó (és a partner nem marad videó nélkül).
 */
export async function startRenderWithAiClips(
  job: VideoJobRow,
  site: string,
  secret: string
): Promise<string> {
  const meta = (job.meta ?? {}) as VideoMeta;
  const frames = meta.frames ?? {};
  const aiClips = meta.ai_clips ?? [];
  const photos = (job.source_images ?? []) as string[];
  const format = getFormat(String(job.format));
  if (!format) throw new Error("Hibás formátum a jobon.");

  // Snittenként: AI-klip, ha van; különben a fotó Ken Burns-szel.
  const segments = photos.map((_, i) => {
    const url = aiClips[i]?.videoUrl;
    return url
      ? { clip: { kind: "video" as const, src: url, length: AI_CLIP_SECONDS }, length: AI_CLIP_SECONDS }
      : { clip: { kind: "image" as const, src: frames[`photo-${i}.png`], length: PHOTO_SECONDS, zoom: true }, length: PHOTO_SECONDS };
  });

  const clips: TimelineClip[] = [
    { kind: "image", src: frames["open.png"], length: CARD_OPEN_SECONDS },
    ...segments.map((s) => s.clip),
    { kind: "image", src: frames["close.png"], length: CARD_CLOSE_SECONDS },
  ];

  // A feliratok a snittek tényleges hosszához igazodnak (AI-klip 5 mp, fotó 4 mp).
  const overlays: OverlayClip[] = [];
  let cursor = CARD_OPEN_SECONDS;
  segments.forEach((s, i) => {
    const src = frames[`cap-${i}.png`];
    if (src) overlays.push({ src, start: cursor, length: s.length });
    cursor += s.length;
  });

  const callback = `${site}/api/webhooks/shotstack?job=${job.id}&token=${encodeURIComponent(secret)}`;
  const renderId = await submitVideoRender({
    clips, overlays,
    musicUrl: job.music_url ?? null,
    width: format.width,
    height: format.height,
    callbackUrl: callback,
  });

  // A státuszt a hívó már 'rendering'-re váltotta (claimRender) — itt csak a render_id kell.
  // Ha ez nem íródik be, a lekérdezéses háló nem találná a rendert → jelezzük.
  const admin = createAdminClient();
  const { error: metaErr } = await admin.from("video_jobs").update({
    meta: { ...meta, render_id: renderId },
  }).eq("id", job.id);
  if (metaErr) throw new Error(`A render azonosítójának mentése nem sikerült: ${metaErr.message}`);

  return renderId;
}
