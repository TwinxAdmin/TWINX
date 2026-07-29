// GET /api/real-estate/video/[id] — egy videó-job státusza (kliens polling).
// BIZTONSÁGI HÁLÓ: ha a job 'rendering' és van render_id, itt is lekérdezzük a
// Shotstack állapotát. Így akkor is elkészül a videó, ha a webhook nem érkezik meg
// (pl. localhoston fejlesztés közben, vagy elveszett callback élesben).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRenderStatus } from "@/lib/shotstack";
import { getFalVideoResult } from "@/lib/fal";
import {
  startRenderWithAiClips, allClipsSettled, saveClipResult, claimRender, failJobOnce,
  type AiClipState, type VideoMeta,
} from "@/lib/video-pipeline";
import { logCost, shotstackRenderCostUsd } from "@/lib/costs";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "reports";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const { data: job, error } = await supabase
    .from("video_jobs")
    .select("id, user_id, service_id, status, output_url, image_count, package, credits_charged, meta, error, format, music_url, source_images")
    .eq("id", id)
    .single();
  if (error || !job) return NextResponse.json({ error: "Nem található." }, { status: 404 });

  let status = job.status as string;
  let outputUrl = job.output_url as string | null;
  let jobError = job.error as string | null;

  let meta = (job.meta ?? {}) as VideoMeta;

  // 1) PRO: ha az AI-klipekre várunk, de a webhookok nem jöttek meg (pl. localhost),
  // MINDEN függőben lévő klipet lekérdezünk a fal.ai-tól. Ha mind lezárult, indul a render.
  if (status === "animating" && meta.ai_clips?.length) {
    try {
      let clips: AiClipState[] = meta.ai_clips;
      for (let i = 0; i < clips.length; i++) {
        const c = clips[i];
        if (c.videoUrl || c.failed || !c.requestId) continue;
        const r = await getFalVideoResult({
          requestId: c.requestId, statusUrl: c.statusUrl, responseUrl: c.responseUrl,
        });
        // ATOMI beírás (a webhook is írhatja ugyanezt a mezőt).
        if (r.status === "done" && r.videoUrl) clips = await saveClipResult(job.id, i, { videoUrl: r.videoUrl });
        else if (r.status === "failed") clips = await saveClipResult(job.id, i, { failed: true });
      }
      meta = { ...meta, ai_clips: clips };

      if (allClipsSettled(clips)) {
        if (clips.every((c) => c.failed)) {
          status = "failed";
          jobError = "Az AI-klipek generálása nem sikerült.";
          await failJobOnce(job.id, job.user_id, job.credits_charged, jobError);
        } else if (await claimRender(job.id)) {
          // Csak akkor rendereltünk, ha MI kaptuk meg a jogot (a webhook is versenyben van).
          const site = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || new URL(_request.url).origin;
          try {
            await startRenderWithAiClips({ ...job, meta }, site.replace(/\/$/, ""), process.env.VIDEO_WEBHOOK_SECRET || "");
            status = "rendering";
          } catch (err) {
            status = "failed";
            jobError = (err as Error).message;
            await failJobOnce(job.id, job.user_id, job.credits_charged, jobError);
          }
        } else {
          status = "rendering"; // a másik szál indította el
        }
      }
    } catch {
      /* a következő polling újrapróbálja */
    }
  }

  // 2) Tartalék lekérdezés a renderre, ha a Shotstack-webhook nem futott le.
  // A render_id-t frissen olvassuk, mert az 1) lépés épp most írhatta be.
  if (status === "rendering") {
    try {
      const admin0 = createAdminClient();
      const { data: fresh } = await admin0.from("video_jobs").select("meta").eq("id", job.id).single();
      const renderId = ((fresh?.meta ?? meta) as VideoMeta).render_id;
      if (!renderId) throw new Error("nincs render_id");
      const r = await getRenderStatus(renderId);
      const admin = createAdminClient();
      if (r.status === "done" && r.url) {
        const videoRes = await fetch(r.url);
        if (videoRes.ok) {
          const bytes = Buffer.from(await videoRes.arrayBuffer());
          const path = `video/${job.user_id}/${job.id}.mp4`;
          const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
            contentType: "video/mp4", upsert: true,
          });
          if (!upErr) {
            outputUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
            status = "done";
            // Feltételes lezárás: csak az EGYIK szál (webhook vagy polling) írjon
            // előzményt és költséget — a másik már 'done'-t lát és nem érint sort.
            const { data: closed } = await admin
              .from("video_jobs")
              .update({ status, output_url: outputUrl, error: null })
              .eq("id", job.id)
              .eq("status", "rendering")
              .select("id");
            if (closed?.length) {
              await admin.from("usage_history").insert({
                user_id: job.user_id,
                service_id: job.service_id,
                feature_used: "video",
                input_data: { title: meta.title ?? "Ingatlan videó", package: job.package },
                output_file_url: outputUrl,
                credits_charged: job.credits_charged,
              });
              if (job.service_id) {
                await logCost({
                  userId: job.user_id, serviceId: job.service_id, feature: "video",
                  serviceName: "shotstack", units: 1, estimatedCostUsd: shotstackRenderCostUsd(1),
                });
              }
            }
          }
        }
      } else if (r.status === "failed") {
        status = "failed";
        jobError = r.error ?? "A videó renderelése nem sikerült.";
        await failJobOnce(job.id, job.user_id, job.credits_charged, jobError);
      }
    } catch {
      /* a következő polling újrapróbálja */
    }
  }

  return NextResponse.json({
    status,
    output_url: outputUrl,
    imageCount: job.image_count,
    error: jobError,
  });
}
