// GET /api/real-estate/valuation/status?job=<id> — az aszinkron értékbecslés állapota.
//
// A kliens ezt pollingozza. Amíg a Perplexity dolgozik, "processing" jön vissza —
// a partner tehát SOHA nem ütközik HTTP-időkorlátba, és el is navigálhat.
// Amikor a kutatás kész:
//   - comps szakasz: a comp-lista feldolgozása → determinisztikus motor → riport.
//     Ha kevés a használható comp, MÁSODIK async kérés indul (AI-tartalék),
//     és a job "processing" marad tovább.
//   - ai szakasz: a kapott szöveg lesz a riport.
// Végül: kredit levonása (CSAK itt, kész riportnál) + mentés az előzményekbe.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkCreditAvailable } from "@/lib/credits";
import {
  getSonarAsync, submitSonarAsync, PERPLEXITY_MODEL,
  HU_PROPERTY_DOMAINS, VALUATION_RECENCY, type SonarSource,
} from "@/lib/perplexity";
import { buildValuationPromptActive } from "@/lib/prompts";
import { finalizeValuation, sourcesSection } from "@/lib/valuation-finalize";
import { computeValuation, type RawComp } from "@/lib/valuation-engine";
import {
  loadActiveEngineConfig, buildSubject, parseCompsJson, composeEngineReport,
  compsCacheKey, setCachedComps,
} from "@/lib/valuation-engine-server";
import type { ValuationInput } from "@/lib/valuation";

export const runtime = "nodejs";
export const maxDuration = 60; // itt már csak rövid lekérdezés + riport-összeállítás fut

type JobInput = {
  input: ValuationInput;
  conditionText: string | null;
  stage: "comps" | "ai";
  photoCount?: number;
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const jobId = new URL(request.url).searchParams.get("job");
  if (!jobId) return NextResponse.json({ error: "Hiányzó job azonosító." }, { status: 400 });

  const admin = createAdminClient();
  const { data: job, error: jobErr } = await admin
    .from("valuation_jobs")
    .select("id, user_id, service_id, status, input_data, request_id, report, error")
    .eq("id", jobId)
    .single();
  if (jobErr || !job) return NextResponse.json({ error: "A job nem található." }, { status: 404 });
  if (job.user_id !== user.id) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });

  // Már lezárt job: az eltárolt eredményt adjuk vissza.
  if (job.status === "done") {
    return NextResponse.json({ status: "done", report: job.report ?? "", id: job.id });
  }
  if (job.status === "failed") {
    return NextResponse.json({ status: "failed", error: job.error ?? "A becslés nem sikerült." });
  }

  const meta = (job.input_data ?? {}) as JobInput;
  const input = meta.input;
  const stage = meta.stage ?? "ai";

  const fail = async (message: string) => {
    await admin.from("valuation_jobs").update({ status: "failed", error: message }).eq("id", job.id);
    return NextResponse.json({ status: "failed", error: message });
  };

  try {
    if (!job.request_id) return await fail("Hiányzó kutatás-azonosító.");
    const res = await getSonarAsync(job.request_id);

    if (res.status === "processing") {
      return NextResponse.json({ status: "processing" });
    }
    if (res.status === "failed") {
      return await fail(res.error);
    }

    // --- A kutatás KÉSZ ---
    const engineCfg = await loadActiveEngineConfig();
    let report = "";
    let engineAudit: Parameters<typeof finalizeValuation>[0]["engineAudit"] = null;
    const sources: SonarSource[] = res.sources ?? [];

    if (stage === "comps") {
      const comps: RawComp[] = parseCompsJson(res.content);
      if (comps.length) {
        try { await setCachedComps(compsCacheKey(input), comps); } catch { /* cache best-effort */ }
      }
      const calc = computeValuation(comps, buildSubject(input), engineCfg);
      if (calc.ok) {
        engineAudit = calc;
        report = composeEngineReport(calc, input, engineCfg) + sourcesSection(sources);
      } else {
        // Kevés használható comp → MÁSODIK async kérés: AI-tartalék becslés.
        const prompt = await buildValuationPromptActive(input, meta.conditionText ?? undefined);
        const requestId = await submitSonarAsync(prompt, PERPLEXITY_MODEL, {
          temperature: 0.1,
          domains: HU_PROPERTY_DOMAINS,
          recency: VALUATION_RECENCY || undefined,
        });
        await admin.from("valuation_jobs").update({
          request_id: requestId,
          input_data: { ...meta, stage: "ai" },
        }).eq("id", job.id);
        return NextResponse.json({ status: "processing", phase: "ai-fallback" });
      }
    } else {
      report = res.content + sourcesSection(sources);
    }

    // --- Kész riport → kredit (csak most!) + mentés az előzményekbe ---
    // admin/sales: nincs levonás. (Ha az egyenleg időközben elfogyott, a riportot
    // NEM dobjuk el — a finalizáló ilyenkor egyszerűen nem számláz.)
    const avail = await checkCreditAvailable({ userId: user.id, amount: 1 });
    const bypassed = avail.ok ? avail.bypassed : false;
    const fin = await finalizeValuation({
      userId: user.id,
      serviceId: job.service_id as string,
      input,
      report,
      engineAudit,
      bypassed,
      photoCount: meta.photoCount ?? 0,
    });

    await admin.from("valuation_jobs").update({
      status: "done",
      report: fin.report,
      credits_charged: fin.charged ? 1 : 0,
    }).eq("id", job.id);

    return NextResponse.json({ status: "done", report: fin.report, id: fin.id, charged: fin.charged });
  } catch (err) {
    return await fail((err as Error).message);
  }
}
