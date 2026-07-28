// POST /api/webhooks/shotstack?job=<id>&token=<s>
// A Shotstack hívja, ha a render kész/hibás. A kész mp4-et letöltjük, a Storage-ba
// mentjük (így nem függünk a Shotstack ideiglenes URL-jétől), usage_history-t írunk.
// Hibánál automatikus kredit-visszatérítés.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logCost, shotstackRenderCostUsd } from "@/lib/costs";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "reports";
const FEATURE = "video";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("job") ?? "";
  // Kompatibilitás: token VAGY secret paraméternév.
  const token = url.searchParams.get("token") ?? url.searchParams.get("secret") ?? "";
  const secret = process.env.VIDEO_WEBHOOK_SECRET || "";
  if (!jobId || (secret && token !== secret)) {
    return NextResponse.json({ error: "Érvénytelen webhook." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: job } = await admin
    .from("video_jobs")
    .select("id, user_id, service_id, status, package, credits_charged, meta")
    .eq("id", jobId)
    .single();
  if (!job) return NextResponse.json({ error: "Nem található." }, { status: 404 });
  if (job.status === "done" || job.status === "failed") return NextResponse.json({ ok: true });

  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { body = {}; }

  const fail = async (msg: string) => {
    await admin.from("video_jobs").update({ status: "failed", error: msg }).eq("id", jobId);
    if (job.credits_charged > 0) {
      await admin.rpc("wallet_add", { p_user_id: job.user_id, p_amount: job.credits_charged });
    }
    return NextResponse.json({ ok: true });
  };

  // Shotstack payload: { type: "render", action, id, status: "done"|"failed", url, error }
  const status = String(body.status ?? "");
  if (status === "failed") return fail(String(body.error ?? "A videó renderelése nem sikerült."));
  if (status !== "done") return NextResponse.json({ ok: true }); // köztes állapot — várunk

  const renderUrl = String(body.url ?? "");
  if (!renderUrl) return fail("A kész videó URL-je hiányzik.");

  try {
    // A videót SAJÁT tárhelyre mentjük (a Shotstack URL-je ideiglenes).
    const videoRes = await fetch(renderUrl);
    if (!videoRes.ok) throw new Error("A kész videó letöltése nem sikerült.");
    const bytes = Buffer.from(await videoRes.arrayBuffer());
    const path = `video/${job.user_id}/${jobId}.mp4`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: "video/mp4",
      upsert: true,
    });
    if (upErr) throw new Error(`Videó mentés hiba: ${upErr.message}`);
    const publicUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

    const meta = (job.meta ?? {}) as { title?: string };
    await admin.from("video_jobs").update({ status: "done", output_url: publicUrl, error: null }).eq("id", jobId);

    await admin.from("usage_history").insert({
      user_id: job.user_id,
      service_id: job.service_id,
      feature_used: FEATURE,
      input_data: { title: meta.title ?? "Ingatlan videó", package: job.package },
      output_file_url: publicUrl,
      credits_charged: job.credits_charged,
    });

    if (job.service_id) {
      await logCost({
        userId: job.user_id, serviceId: job.service_id, feature: FEATURE,
        serviceName: "shotstack", units: 1, estimatedCostUsd: shotstackRenderCostUsd(1),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail((err as Error).message);
  }
}
