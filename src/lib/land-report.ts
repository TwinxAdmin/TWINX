// Telek értékbecslés véglegesítése: a nyers AI-szövegből PDF -> Storage ->
// usage_history + költséglogolás. Közös a "normál" (szinkron) és a "magas"
// (async job) ágban is. Szerveroldali (service_role admin klienssel hívandó).
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateReportPdf } from "@/lib/report-pdf";
import { logCost, perplexityCostUsd } from "@/lib/costs";
import { LAND_LEVELS, type LandInput, type LandLevel } from "@/lib/land";

const BUCKET = "reports";
export const LAND_FEATURE = "land-valuation";

export async function finalizeLandReport(params: {
  admin: SupabaseClient;
  userId: string;
  serviceId: string;
  input: LandInput;
  level: LandLevel;
  report: string;
}): Promise<string> {
  const { admin, userId, serviceId, input, level, report } = params;

  // 1) PDF
  const pdfBytes = await generateReportPdf({
    title: "Telek beépíthetőségi jelentés",
    meta: [
      `Cím: ${input.telepules}${input.utca ? ", " + input.utca : ""}`,
      `Helyrajzi szám: ${input.hrsz}`,
      `Építési övezet: ${input.ovezet} · Besorolás: ${input.besorolas}`,
      `Kutatási szint: ${LAND_LEVELS[level].label}`,
      `Készült: ${new Date().toLocaleString("hu-HU")}`,
    ],
    body: report,
  });

  // 2) Feltöltés Storage-ba
  const filePath = `land/${userId}/${randomUUID()}.pdf`;
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(filePath, pdfBytes, { contentType: "application/pdf", upsert: false });
  if (uploadError) throw new Error(`Storage feltöltés hiba: ${uploadError.message}`);

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(filePath);

  // 3) Előzmény
  const { error: histError } = await admin.from("usage_history").insert({
    user_id: userId,
    service_id: serviceId,
    feature_used: LAND_FEATURE,
    input_data: { ...input, level },
    output_file_url: pub.publicUrl,
  });
  if (histError) throw new Error(`Előzmény mentés hiba: ${histError.message}`);

  // 4) Költséglogolás (best-effort)
  await logCost({
    userId,
    serviceId,
    feature: LAND_FEATURE,
    serviceName: "perplexity",
    units: 1,
    estimatedCostUsd: perplexityCostUsd(LAND_LEVELS[level].model),
  });

  return pub.publicUrl;
}
