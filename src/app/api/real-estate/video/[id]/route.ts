// GET /api/real-estate/video/[id] — egy videó-job státusza (kliens polling).
// BIZTONSÁGI HÁLÓ: ha a job 'rendering' és van render_id, itt is lekérdezzük a
// Shotstack állapotát. Így akkor is elkészül a videó, ha a webhook nem érkezik meg
// (pl. localhoston fejlesztés közben, vagy elveszett callback élesben).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRenderStatus } from "@/lib/shotstack";
import { getFalVideoResult } from "@/lib/fal";
import { startRenderWithAiClip } from "@/lib/video-pipeline";
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

  const meta = (job.meta ?? {}) as {
    render_id?: string; title?: string;
    fal_request_id?: string; fal_status_url?: string; fal_response_url?: string;
  };

  // 1) PRO: ha az AI-klipre várunk, de a webhook nem jött meg (pl. localhost),
  // lekérdezzük a fal.ai-tól, és ha kész, elindítjuk a Shotstack rendert.
  if (status === "animating" && meta.fal_request_id) {
    try {
      const r = await getFalVideoResult({
        requestId: meta.fal_request_id,
        statusUrl: meta.fal_status_url,
        responseUrl: meta.fal_response_url,
      });
      if (r.status === "done" && r.videoUrl) {
        const site = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || new URL(_request.url).origin;
        await startRenderWithAiClip(job, r.videoUrl, site.replace(/\/$/, ""), process.env.VIDEO_WEBHOOK_SECRET || "");
        status = "rendering";
      } else if (r.status === "failed") {
        const admin = createAdminClient();
        status = "failed";
        jobError = "Az AI-klip generálása nem sikerült.";
        await admin.from("video_jobs").update({ status, error: jobError }).eq("id", job.id);
        if (job.credits_charged > 0) {
          await admin.rpc("wallet_add", { p_user_id: job.user_id, p_amount: job.credits_charged });
        }
      }
    } catch {
      /* a következő polling újrapróbálja */
    }
  }

  // 2) Tartalék lekérdezés a renderre, ha a Shotstack-webhook nem futott le.
  if (status === "rendering" && meta.render_id) {
    try {
      const r = await getRenderStatus(meta.render_id);
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
            await admin.from("video_jobs").update({ status, output_url: outputUrl, error: null }).eq("id", job.id);
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
      } else if (r.status === "failed") {
        status = "failed";
        jobError = r.error ?? "A videó renderelése nem sikerült.";
        await admin.from("video_jobs").update({ status, error: jobError }).eq("id", job.id);
        if (job.credits_charged > 0) {
          await admin.rpc("wallet_add", { p_user_id: job.user_id, p_amount: job.credits_charged });
        }
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
