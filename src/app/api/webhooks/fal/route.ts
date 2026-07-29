// POST /api/webhooks/fal?job=...&clip=N&token=... — egy PRO AI-klip elkészült (fal.ai queue).
// A klipek párhuzamosan futnak, így a webhookok is szinte egyszerre érkeznek: az eredményt
// ATOMI adatbázis-hívás írja be (video_clip_result), különben az egyik felülírná a másikat.
// Amikor MINDEN klip lezárult, a render indítását EGY hívó kapja meg (video_job_claim_render).
// Egy hibás klip esetén az a snitt Ken Burns fotó lesz — a videó ettől még elkészül.
// Csak akkor bukik a job (és jár vissza a kredit), ha egyetlen klip sem sikerült.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  startRenderWithAiClips, allClipsSettled, saveClipResult, claimRender, failJobOnce,
  type VideoMeta,
} from "@/lib/video-pipeline";

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
  const clipIndex = Number(url.searchParams.get("clip") ?? "0");
  const token = url.searchParams.get("token") ?? "";
  const secret = process.env.VIDEO_WEBHOOK_SECRET || "";
  if (!jobId || !Number.isInteger(clipIndex) || clipIndex < 0 || (secret && token !== secret)) {
    return NextResponse.json({ error: "Érvénytelen webhook." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: job } = await admin
    .from("video_jobs")
    .select("id, user_id, status, format, music_url, source_images, credits_charged, meta")
    .eq("id", jobId)
    .single();
  if (!job) return NextResponse.json({ error: "Nem található." }, { status: 404 });
  if (job.status === "done" || job.status === "failed") {
    return NextResponse.json({ ok: true }); // már lezárult
  }

  let payload: Record<string, unknown> = {};
  try { payload = await request.json(); } catch { payload = {}; }

  // A fal webhook payloadja: { request_id, status: "OK"|"ERROR", payload: {...} }
  const status = String((payload as { status?: string }).status ?? "");
  const inner = (payload as { payload?: Record<string, unknown> }).payload ?? payload;
  const clipUrl =
    ((inner as { video?: { url?: string } }).video?.url) ??
    ((inner as { url?: string }).url) ??
    null;

  // ATOMI beírás — a friss, teljes kliplistát kapjuk vissza.
  const clips = await saveClipResult(
    jobId,
    clipIndex,
    (status && status !== "OK") || !clipUrl ? { failed: true } : { videoUrl: clipUrl }
  );

  if (!allClipsSettled(clips)) return NextResponse.json({ ok: true }); // várunk a többire

  // Egyetlen klip sem sikerült → bukó + egyszeri visszatérítés.
  if (clips.every((c) => c.failed)) {
    await failJobOnce(jobId, job.user_id, job.credits_charged, "Az AI-klipek generálása nem sikerült.");
    return NextResponse.json({ ok: true });
  }

  // A rendert csak EGY hívó indíthatja (a lekérdezéses háló is versenyben van).
  if (!(await claimRender(jobId))) return NextResponse.json({ ok: true });

  try {
    const meta: VideoMeta = { ...((job.meta ?? {}) as VideoMeta), ai_clips: clips };
    await startRenderWithAiClips({ ...job, meta }, baseUrl(request), secret);
    return NextResponse.json({ ok: true });
  } catch (err) {
    await failJobOnce(jobId, job.user_id, job.credits_charged, (err as Error).message);
    return NextResponse.json({ ok: true });
  }
}
