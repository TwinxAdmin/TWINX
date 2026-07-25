// GET /api/hospitality/suppliers/status?job=<id> — a PRO (mély kutatás) job állapota.
// A kliens pollingozza. Ha a Perplexity kész, itt véglegesítünk (parse → PDF → mentés).
// Sikertelenségnél / üres találatnál a levont kredit visszajár.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSonarAsync } from "@/lib/perplexity";
import { logCost, perplexityCostUsd } from "@/lib/costs";
import { finalizeSupplierSearch } from "@/lib/supplier-finalize";
import { SUPPLIER_DEEP_MODEL, type SupplierQuery } from "@/lib/suppliers";

export const runtime = "nodejs";
const FEATURE = "supplier_search";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const jobId = new URL(request.url).searchParams.get("job");
  if (!jobId) return NextResponse.json({ error: "Hiányzó job azonosító." }, { status: 400 });

  const admin = createAdminClient();
  const { data: job } = await admin.from("supplier_jobs").select("*").eq("id", jobId).single();
  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: "Nincs ilyen feladat." }, { status: 404 });
  }

  if (job.status === "done") {
    // A kész keresést visszaadjuk (a kliens ugyanúgy jeleníti meg, mint a szinkron eredményt).
    const { data: search } = await supabase
      .from("supplier_searches")
      .select("id, query, results, extras, pdf_url, credits_charged, created_at")
      .eq("id", job.search_id)
      .single();
    return NextResponse.json({ status: "done", search, result: search ? { suppliers: search.results, extras: search.extras } : null, pdf_url: search?.pdf_url ?? null });
  }
  if (job.status === "failed") {
    return NextResponse.json({ status: "failed", error: job.error ?? "Ismeretlen hiba." });
  }
  if (job.status !== "processing") {
    return NextResponse.json({ status: "processing" }); // 'finalizing' — más kérés épp véglegesít
  }

  async function refund() {
    if ((job.credits_charged ?? 0) > 0) {
      await admin.rpc("wallet_add", { p_user_id: job.user_id, p_amount: job.credits_charged });
    }
  }

  // Perplexity állapot lekérdezése.
  let poll;
  try {
    poll = await getSonarAsync(job.request_id as string);
  } catch (err) {
    // Átmeneti hiba — ne bukjon a job, a következő polling újrapróbálja.
    return NextResponse.json({ status: "processing", note: (err as Error).message });
  }

  if (poll.status === "processing") {
    return NextResponse.json({ status: "processing", raw: poll.raw ?? "" });
  }

  if (poll.status === "failed") {
    await admin.from("supplier_jobs").update({ status: "failed", error: poll.error }).eq("id", jobId);
    await refund();
    return NextResponse.json({ status: "failed", error: poll.error });
  }

  // COMPLETED -> igényeljük a véglegesítést (versenyhelyzet ellen: csak egy kérés csinálja).
  const { data: claimed } = await admin
    .from("supplier_jobs")
    .update({ status: "finalizing" })
    .eq("id", jobId)
    .eq("status", "processing")
    .select("id");
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ status: "processing" });
  }

  try {
    await logCost({
      userId: job.user_id as string, serviceId: null, feature: FEATURE, serviceName: "perplexity",
      units: 1, estimatedCostUsd: perplexityCostUsd(SUPPLIER_DEEP_MODEL),
    });
    const fin = await finalizeSupplierSearch({
      admin, db: supabase, userId: job.user_id as string,
      query: job.query as SupplierQuery, raw: poll.content,
      creditsCharged: (job.credits_charged as number) ?? 0,
    });

    if (!fin.ok) {
      await admin.from("supplier_jobs").update({ status: "failed", error: "Nincs igazolható találat." }).eq("id", jobId);
      await refund();
      return NextResponse.json({ status: "failed", error: "Ezekkel a feltételekkel nem találtunk igazolható beszállítót — a kredit visszajár." });
    }

    await admin
      .from("supplier_jobs")
      .update({ status: "done", search_id: fin.saved?.id ?? null })
      .eq("id", jobId);

    return NextResponse.json({ status: "done", search: fin.saved, result: fin.result, pdf_url: fin.pdfUrl });
  } catch (err) {
    await admin.from("supplier_jobs").update({ status: "failed", error: (err as Error).message }).eq("id", jobId);
    await refund();
    return NextResponse.json({ status: "failed", error: (err as Error).message });
  }
}
