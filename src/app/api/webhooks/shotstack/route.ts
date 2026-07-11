// POST /api/webhooks/shotstack?job=<id>&secret=<s>
// A Shotstack hívja, ha a render kész/hibás. A végleges videót mentjük Storage-ba,
// beírjuk a usage_history-ba, és logoljuk a költséget (Luma snittek + Shotstack render).
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { logCost, lumaCostUsd, shotstackRenderCostUsd } from "@/lib/costs";

export const runtime = "nodejs";

const BUCKET = "reports";
const FEATURE = "video";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("job");
  const secret = url.searchParams.get("secret");

  if (secret !== (process.env.VIDEO_WEBHOOK_SECRET || "")) {
    return NextResponse.json({ error: "Érvénytelen secret." }, { status: 401 });
  }
  if (!jobId) {
    return NextResponse.json({ error: "Hiányzó job." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const status = body?.status as string | undefined; // 'done' | 'failed'
  const renderUrl = body?.url as string | undefined;

  const admin = createAdminClient();
  const { data: job } = await admin
    .from("video_jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  if (!job) return NextResponse.json({ error: "Nincs ilyen job." }, { status: 404 });
  if (job.status === "done" || job.status === "failed") {
    return NextResponse.json({ received: true }); // már lezárt
  }

  // Render hiba -> job bukik + visszatérítés.
  if (status === "failed") {
    await admin
      .from("video_jobs")
      .update({ status: "failed", error: "Shotstack render hiba." })
      .eq("id", jobId);
    if (job.credits_charged > 0) {
      await admin.rpc("wallet_add", {
        p_user_id: job.user_id,
        p_amount: job.credits_charged,
      });
    }
    return NextResponse.json({ received: true });
  }

  if (status !== "done" || !renderUrl) {
    return NextResponse.json({ received: true }); // köztes állapot
  }

  try {
    // Végleges videó letöltés + mentés.
    const resp = await fetch(renderUrl);
    if (!resp.ok) throw new Error(`Videó letöltés hiba: ${resp.status}`);
    const bytes = Buffer.from(await resp.arrayBuffer());
    const path = `video/${job.user_id}/${randomUUID()}.mp4`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "video/mp4", upsert: false });
    if (upErr) throw new Error(`Storage hiba: ${upErr.message}`);
    const outputUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    await admin
      .from("video_jobs")
      .update({ status: "done", output_url: outputUrl })
      .eq("id", jobId);

    // Előzmény (megjelenik a dashboardon, letöltési linkkel).
    await admin.from("usage_history").insert({
      user_id: job.user_id,
      service_id: job.service_id,
      feature_used: FEATURE,
      credits_charged: job.credits_charged ?? 0,
      input_data: {
        format: job.format,
        music_style: job.music_style,
        image_count: job.image_count,
      },
      output_file_url: outputUrl,
    });

    // Költséglogolás: Luma snittek + Shotstack render (admin-only).
    await logCost({
      userId: job.user_id,
      serviceId: job.service_id,
      feature: FEATURE,
      serviceName: "luma",
      units: job.image_count,
      estimatedCostUsd: lumaCostUsd(job.image_count),
    });
    await logCost({
      userId: job.user_id,
      serviceId: job.service_id,
      feature: FEATURE,
      serviceName: "shotstack",
      units: 1,
      estimatedCostUsd: shotstackRenderCostUsd(1),
    });
  } catch (err) {
    await admin
      .from("video_jobs")
      .update({ status: "failed", error: (err as Error).message })
      .eq("id", jobId);
    if (job.credits_charged > 0) {
      await admin.rpc("wallet_add", {
        p_user_id: job.user_id,
        p_amount: job.credits_charged,
      });
    }
  }

  return NextResponse.json({ received: true });
}
