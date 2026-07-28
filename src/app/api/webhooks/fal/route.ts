// POST /api/webhooks/fal?job=...&token=... — a PRO AI-klip elkészült (fal.ai queue).
// Siker: a klip URL-jét elmentjük, és indítjuk a Shotstack rendert (közös pipeline).
// Hiba: job failed + automatikus kredit-visszatérítés.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { startRenderWithAiClip } from "@/lib/video-pipeline";

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
  if (job.status === "done" || job.status === "failed" || job.status === "rendering") {
    return NextResponse.json({ ok: true }); // már továbbment (pl. a lekérdezéses háló)
  }

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
  if (status && status !== "OK") return fail("Az AI-klip generálása nem sikerült.");

  const inner = (payload as { payload?: Record<string, unknown> }).payload ?? payload;
  const clipUrl =
    ((inner as { video?: { url?: string } }).video?.url) ??
    ((inner as { url?: string }).url) ??
    null;
  if (!clipUrl) return fail("Az AI-klip URL-je hiányzik a válaszból.");

  try {
    await startRenderWithAiClip(job, clipUrl, baseUrl(request), secret);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail((err as Error).message);
  }
}
