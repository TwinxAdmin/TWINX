// POST /api/webhooks/luma?job=<id>&index=<i>&secret=<s>
// A Luma hívja, ha egy snitt kész/hibás. Mentjük az MP4-et, és ha MIND kész,
// indítjuk a Shotstack rendert.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { submitRender } from "@/lib/shotstack";

export const runtime = "nodejs";

const BUCKET = "reports";

type Clip = { index: number; luma_id: string; status: string; url: string | null };

async function refund(job: { credits_charged: number; user_id: string }) {
  if (job.credits_charged > 0) {
    const admin = createAdminClient();
    await admin.rpc("wallet_add", {
      p_user_id: job.user_id,
      p_amount: job.credits_charged,
    });
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get("job");
  const index = Number(url.searchParams.get("index"));
  const secret = url.searchParams.get("secret");

  if (secret !== (process.env.VIDEO_WEBHOOK_SECRET || "")) {
    return NextResponse.json({ error: "Érvénytelen secret." }, { status: 401 });
  }
  if (!jobId || Number.isNaN(index)) {
    return NextResponse.json({ error: "Hiányzó paraméter." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const state = body?.state as string | undefined;
  const videoUrl = (body?.assets as { video?: string } | undefined)?.video;

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

  const clips = (job.clips as Clip[]) ?? [];
  const clip = clips.find((c) => c.index === index);
  if (!clip) return NextResponse.json({ error: "Nincs ilyen snitt." }, { status: 404 });
  if (clip.status === "done") return NextResponse.json({ received: true }); // idempotens

  // Hiba egy snittnél -> az egész job bukik + visszatérítés.
  if (state === "failed") {
    await admin
      .from("video_jobs")
      .update({ status: "failed", error: `Luma snitt hiba (index ${index}).` })
      .eq("id", jobId);
    await refund(job);
    return NextResponse.json({ received: true });
  }

  // Még nem kész (queued/dreaming) -> nincs teendő.
  if (state !== "completed" || !videoUrl) {
    return NextResponse.json({ received: true });
  }

  // Kész snitt: letöltés + mentés Storage-ba.
  try {
    const resp = await fetch(videoUrl);
    if (!resp.ok) throw new Error(`Snitt letöltés hiba: ${resp.status}`);
    const bytes = Buffer.from(await resp.arrayBuffer());
    const path = `video-clips/${job.user_id}/${randomUUID()}.mp4`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "video/mp4", upsert: false });
    if (upErr) throw new Error(`Storage hiba: ${upErr.message}`);
    clip.url = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    clip.status = "done";
    await admin.from("video_jobs").update({ clips }).eq("id", jobId);
  } catch (err) {
    await admin
      .from("video_jobs")
      .update({ status: "failed", error: (err as Error).message })
      .eq("id", jobId);
    await refund(job);
    return NextResponse.json({ received: true });
  }

  // Ha MIND kész -> Shotstack render.
  const allDone = clips.every((c) => c.status === "done");
  if (allDone) {
    await admin.from("video_jobs").update({ status: "rendering" }).eq("id", jobId);
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const secretQ = process.env.VIDEO_WEBHOOK_SECRET || "";
    const orderedUrls = [...clips]
      .sort((a, b) => a.index - b.index)
      .map((c) => c.url as string);
    try {
      await submitRender({
        clipUrls: orderedUrls,
        musicUrl: job.music_url as string,
        aspectRatio: job.format as string,
        callbackUrl: `${appUrl}/api/webhooks/shotstack?job=${jobId}&secret=${secretQ}`,
      });
    } catch (err) {
      await admin
        .from("video_jobs")
        .update({ status: "failed", error: (err as Error).message })
        .eq("id", jobId);
      await refund(job);
    }
  }

  return NextResponse.json({ received: true });
}
