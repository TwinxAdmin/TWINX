// Beszállító-keresés véglegesítése — közös a szinkron és az aszinkron (PRO) ágnak.
// A Perplexity nyers válaszából: JSON-parse → TWINX PDF → mentés (supplier_searches) →
// előzmény (usage_history). Üres találatnál { ok:false } (a hívó visszatéríti a kreditet).
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateSuppliersPdf } from "@/lib/pdf";
import { parseSupplierResponse, type SupplierQuery, type SupplierResult } from "@/lib/suppliers";

const BUCKET = "reports";
const FEATURE = "supplier_search";

export type SupplierSearchRow = {
  id: string;
  query: SupplierQuery;
  results: SupplierResult["suppliers"];
  extras: SupplierResult["extras"];
  pdf_url: string | null;
  credits_charged: number;
  created_at: string;
};

export type FinalizeResult =
  | { ok: false }
  | { ok: true; saved: SupplierSearchRow | null; result: SupplierResult; pdfUrl: string | null };

export async function finalizeSupplierSearch(opts: {
  admin: SupabaseClient;
  db: SupabaseClient;     // user-kontextusú kliens az RLS-es beszúráshoz
  userId: string;
  query: SupplierQuery;
  raw: string;
  creditsCharged: number;
}): Promise<FinalizeResult> {
  const { admin, db, userId, query, raw, creditsCharged } = opts;

  const result = parseSupplierResponse(raw, query.count);
  if (!result.suppliers.length) return { ok: false };

  // TWINX PDF (best-effort — ha nem sikerül, PDF nélkül is mentünk).
  let pdfUrl: string | null = null;
  try {
    const bytes = await generateSuppliersPdf({ query, result });
    const path = `suppliers/${userId}/${randomUUID()}.pdf`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (!upErr) pdfUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch {
    pdfUrl = null;
  }

  const { data: saved } = await db
    .from("supplier_searches")
    .insert({
      user_id: userId,
      query,
      results: result.suppliers,
      extras: result.extras,
      raw,
      pdf_url: pdfUrl,
      credits_charged: creditsCharged,
    })
    .select("id, query, results, extras, pdf_url, credits_charged, created_at")
    .single();

  await admin.from("usage_history").insert({
    user_id: userId,
    service_id: null,
    feature_used: FEATURE,
    input_data: {
      what: query.what, county: query.county, city: query.city,
      radius: query.radius, types: query.types, count: query.count,
    },
    output_file_url: pdfUrl,
    credits_charged: creditsCharged,
  });

  return { ok: true, saved: (saved as SupplierSearchRow) ?? null, result, pdfUrl };
}
