// Az értékbecslés ZÁRÓ lépései — közösen használja a szinkron gyors út
// (gyorsítótárazott comp-ok) és az ASZINKRON státusz-végpont.
//
// KREDIT: a levonás CSAK itt történik, azaz kizárólag KÉSZ riport esetén.
// Így egy időtúllépés, hiba vagy megszakadt job SOHA nem visz el kreditet.
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeCredit } from "@/lib/credits";
import { logCost, perplexityCostUsd } from "@/lib/costs";
import { PERPLEXITY_MODEL, type SonarSource } from "@/lib/perplexity";
import { stripHiddenReportSections } from "@/lib/valuation-engine-server";
import type { EngineResult } from "@/lib/valuation-engine";
import type { ValuationInput } from "@/lib/valuation";

const FEATURE = "valuation";

export type FinalizeResult = { id: string | null; report: string; charged: boolean };

/** A felhasznált források külön szakaszként a riport végén (ellenőrizhetőség). */
export function sourcesSection(sources: SonarSource[]): string {
  if (!sources.length) return "";
  const lines = sources
    .slice(0, 12)
    .map((s) => `- ${s.title}${s.date ? ` (${s.date})` : ""} — ${s.url}`);
  return `\n\n## Felhasznált források\n${lines.join("\n")}`;
}

export async function finalizeValuation(params: {
  userId: string;
  serviceId: string;
  input: ValuationInput;
  report: string;
  engineAudit?: EngineResult | null;
  /** admin/sales: nincs kredit-levonás */
  bypassed: boolean;
  /** hány fotót elemeztünk (költség-logoláshoz) */
  photoCount?: number;
}): Promise<FinalizeResult> {
  const admin = createAdminClient();

  // A partnernek szánt kimenetből kivesszük a belső, módszertani szakaszokat.
  const report = stripHiddenReportSections(params.report);

  // 1) A riport KÉSZ → most vonjuk le a kreditet (admin/sales megkerüli).
  //    Ha közben elfogyott az egyenleg, a riportot NEM dobjuk el, csak nem számlázunk.
  let charged = false;
  if (!params.bypassed) {
    try {
      const c = await chargeCredit({ userId: params.userId, amount: 1 });
      charged = c.ok && !c.bypassed;
    } catch {
      charged = false; // a levonás technikai hibája ne buktassa el a kész riportot
    }
  }

  // 2) Mentés az előzményekbe. A PDF-et a BÖNGÉSZŐ készíti a szerkesztett riportból.
  const { data: hist, error: histError } = await admin
    .from("usage_history")
    .insert({
      user_id: params.userId,
      service_id: params.serviceId,
      feature_used: FEATURE,
      input_data: params.input,
      output_text: report,
      credits_charged: charged ? 1 : 0,
    })
    .select("id")
    .single();
  if (histError) throw new Error(`Előzmény mentés hiba: ${histError.message}`);

  // A motor levezetése (audit) — best-effort (ha a column létezik).
  if (params.engineAudit && hist?.id) {
    try {
      await admin.from("usage_history").update({ valuation_audit: params.engineAudit }).eq("id", hist.id);
    } catch { /* a valuation-engine.sql még nem futott — nem gond */ }
  }

  // 3) Nyers API-önköltség logolása (admin-only, best-effort).
  await logCost({
    userId: params.userId,
    serviceId: params.serviceId,
    feature: FEATURE,
    serviceName: "perplexity",
    units: 1,
    estimatedCostUsd: perplexityCostUsd(PERPLEXITY_MODEL),
  });
  if (params.photoCount && params.photoCount > 0) {
    await logCost({
      userId: params.userId,
      serviceId: params.serviceId,
      feature: FEATURE,
      serviceName: "gemini-vision",
      units: params.photoCount,
      estimatedCostUsd: 0.03,
    });
  }

  return { id: hist?.id ?? null, report, charged };
}
