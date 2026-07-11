// GET /api/real-estate/land/status?job=<id> — a "magas" szintű telek-job állapota.
// A kliens pollingozza. Ha a Perplexity kész, itt készül el a PDF (finalize).
// Sikertelenségnél a levont kredit visszajár.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSonarAsync } from "@/lib/perplexity";
import { finalizeLandReport } from "@/lib/land-report";
import type { LandInput, LandLevel } from "@/lib/land";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  }

  const jobId = new URL(request.url).searchParams.get("job");
  if (!jobId) {
    return NextResponse.json({ error: "Hiányzó job azonosító." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: job } = await admin.from("land_jobs").select("*").eq("id", jobId).single();
  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: "Nincs ilyen feladat." }, { status: 404 });
  }

  if (job.status === "done") {
    return NextResponse.json({ status: "done", url: job.output_url });
  }
  if (job.status === "failed") {
    return NextResponse.json({ status: "failed", error: job.error ?? "Ismeretlen hiba." });
  }
  if (job.status !== "processing") {
    // pl. 'finalizing' — épp készül a PDF egy párhuzamos kérésben.
    return NextResponse.json({ status: "processing" });
  }

  // Perplexity állapot lekérdezése.
  let result;
  try {
    result = await getSonarAsync(job.request_id as string);
  } catch (err) {
    // Átmeneti hiba — ne bukjon a job, próbálja újra a következő polling.
    return NextResponse.json({ status: "processing", note: (err as Error).message });
  }

  async function refund() {
    if ((job.credits_charged ?? 0) > 0) {
      await admin.rpc("wallet_add", { p_user_id: job.user_id, p_amount: job.credits_charged });
    }
  }

  if (result.status === "processing") {
    return NextResponse.json({ status: "processing" });
  }

  if (result.status === "failed") {
    await admin.from("land_jobs").update({ status: "failed", error: result.error }).eq("id", jobId);
    await refund();
    return NextResponse.json({ status: "failed", error: result.error });
  }

  // COMPLETED -> igényeljük a véglegesítést (versenyhelyzet ellen).
  const { data: claimed } = await admin
    .from("land_jobs")
    .update({ status: "finalizing" })
    .eq("id", jobId)
    .eq("status", "processing")
    .select("id");
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ status: "processing" }); // más kérés épp véglegesít
  }

  try {
    const url = await finalizeLandReport({
      admin,
      userId: job.user_id as string,
      serviceId: job.service_id as string,
      input: job.input_data as LandInput,
      level: job.level as LandLevel,
      report: result.content,
      creditsCharged: (job.credits_charged as number) ?? 0,
    });
    await admin
      .from("land_jobs")
      .update({ status: "done", output_url: url, report: result.content })
      .eq("id", jobId);
    return NextResponse.json({ status: "done", url });
  } catch (err) {
    await admin
      .from("land_jobs")
      .update({ status: "failed", error: (err as Error).message })
      .eq("id", jobId);
    await refund();
    return NextResponse.json({ status: "failed", error: (err as Error).message });
  }
}
