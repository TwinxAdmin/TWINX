// GET /api/real-estate/video/[id] — egy videó-job státusza (kliens polling).
// RLS: a user csak a saját jobját látja.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  }

  const { data: job, error } = await supabase
    .from("video_jobs")
    .select("id, status, output_url, image_count, clips, error, created_at")
    .eq("id", id)
    .single();

  if (error || !job) {
    return NextResponse.json({ error: "Nem található." }, { status: 404 });
  }

  const clips = (job.clips as Array<{ status: string }>) ?? [];
  const doneClips = clips.filter((c) => c.status === "done").length;

  return NextResponse.json({
    status: job.status,
    outputUrl: job.output_url,
    imageCount: job.image_count,
    clipsDone: doneClips,
    error: job.error,
  });
}
