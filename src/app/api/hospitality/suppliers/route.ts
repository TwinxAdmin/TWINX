// /api/hospitality/suppliers — beszállító-kereső (Perplexity webes kutatás).
// POST: kredit a KÉRT TALÁLATSZÁM szerint (3→1, 6→2, 9→3), élő keresés forrásokkal,
// JSON-válasz feldolgozása, TWINX PDF elérhetőségekkel + kész megkereső üzenettel,
// és a keresés mentése (a visszanézés később INGYENES).
// GET: a korábbi keresések listája.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeCredit } from "@/lib/credits";
import { runSonar, submitSonarAsync, PERPLEXITY_MODEL } from "@/lib/perplexity";
import { buildSupplierPromptActive } from "@/lib/prompts";
import { logCost, perplexityCostUsd } from "@/lib/costs";
import { finalizeSupplierSearch } from "@/lib/supplier-finalize";
import {
  COUNTIES, SUPPLIER_TYPES, QTY_UNITS, FREQUENCIES,
  CERTIFICATIONS, ORIGIN_OPTIONS, DELIVERY_MODES, MIN_ORDER_OPTIONS,
  PROCESSING_OPTIONS, SEASON_OPTIONS, RANKING_PRIORITIES, COMMON_NEEDS,
  EU_COUNTRIES, SUPPLIER_TYPES_EU, COMMON_NEEDS_EU, isSupplierScope,
  creditsForCountPro, isValidCount, isValidRadius, SUPPLIER_DEEP_MODEL,
  type SupplierQuery, type SupplierScope,
} from "@/lib/suppliers";

export const runtime = "nodejs";
export const maxDuration = 60;
const FEATURE = "supplier_search";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const { data, error } = await supabase
    .from("supplier_searches")
    .select("id, query, results, extras, pdf_url, credits_charged, created_at")
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ searches: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const str = (v: unknown, max = 160) => String(v ?? "").trim().slice(0, max);
  const scope: SupplierScope = isSupplierScope(body.scope) ? body.scope : "domestic";
  const what = str(body.what, 120);
  const county = str(body.county, 60);
  const country = str(body.country, 40);
  const count = Number(body.count);

  if (!what) return NextResponse.json({ error: "Add meg, milyen alapanyagot keresel." }, { status: 422 });
  if (!isValidCount(count)) return NextResponse.json({ error: "Érvénytelen találatszám." }, { status: 422 });
  if (scope === "domestic") {
    if (!COUNTIES.includes(county as (typeof COUNTIES)[number])) {
      return NextResponse.json({ error: "Válassz megyét." }, { status: 422 });
    }
  } else {
    if (!EU_COUNTRIES.some((c) => c.value === country)) {
      return NextResponse.json({ error: "Válassz EU-országot." }, { status: 422 });
    }
  }

  const validUnits = new Set(QTY_UNITS.map((u) => u.value as string));
  const validFreqs = new Set(FREQUENCIES.map((f) => f.value as string));
  const validCerts = new Set(CERTIFICATIONS.map((c) => c.value as string));
  const validOrigin = new Set(ORIGIN_OPTIONS.map((o) => o.value as string));
  const validDelivery = new Set(DELIVERY_MODES.map((d) => d.value as string));
  const validMinOrder = new Set(MIN_ORDER_OPTIONS.map((m) => m.value as string));
  const validProcessing = new Set(PROCESSING_OPTIONS.map((p) => p.value as string));
  const validSeason = new Set(SEASON_OPTIONS.map((s) => s.value as string));
  const validRanking = new Set(RANKING_PRIORITIES.map((r) => r.value as string));
  // A típusok és igények értékkészlete a hatókörtől függ (belföld vs. EU).
  const validTypes = new Set((scope === "eu" ? SUPPLIER_TYPES_EU : SUPPLIER_TYPES).map((t) => t.value as string));
  const validNeeds = new Set((scope === "eu" ? COMMON_NEEDS_EU : COMMON_NEEDS).map((n) => n.value as string));

  const arr = (v: unknown, valid: Set<string>, max = 8) =>
    Array.isArray(v) ? (v as unknown[]).map((x) => String(x)).filter((x) => valid.has(x)).slice(0, max) : [];
  const oneOf = (v: unknown, valid: Set<string>) => (valid.has(str(v)) ? str(v) : "");

  const query: SupplierQuery = {
    scope,
    what,
    county: scope === "domestic" ? county : "",
    city: scope === "domestic" ? str(body.city, 60) : "",
    radius: scope === "domestic" ? (isValidRadius(str(body.radius)) ? str(body.radius) : "50") : "orszagos",
    country: scope === "eu" ? country : undefined,
    region: scope === "eu" ? str(body.region, 60) : undefined,
    types: arr(body.types, validTypes, 5),
    // Mennyiség és gyakoriság strukturáltan — így a prompt egyértelmű mondatot kap.
    qty: Math.max(0, Math.floor(Number(body.qty) || 0)),
    qtyUnit: validUnits.has(str(body.qtyUnit)) ? str(body.qtyUnit) : "kg",
    frequency: validFreqs.has(str(body.frequency)) ? str(body.frequency) : "heti",
    // Bővített szűrők (a belföld-specifikusak EU-nál üresek maradnak).
    certifications: arr(body.certifications, validCerts),
    origin: scope === "domestic" ? oneOf(body.origin, validOrigin) : "",
    deliveryModes: scope === "domestic" ? arr(body.deliveryModes, validDelivery) : [],
    minOrder: oneOf(body.minOrder, validMinOrder),
    processing: arr(body.processing, validProcessing),
    season: scope === "domestic" ? oneOf(body.season, validSeason) : "",
    ranking: validRanking.has(str(body.ranking)) ? str(body.ranking) : "megbizhatosag",
    needs: arr(body.needs, validNeeds),
    customCriteria: Array.isArray(body.customCriteria)
      ? (body.customCriteria as unknown[]).map((c) => String(c).trim().slice(0, 120)).filter(Boolean).slice(0, 10)
      : [],
    notes: str(body.notes, 300),
    count,
  };


  // Amit a partner UGYANERRE az alapanyagra már megtalált, azt nem adjuk vissza újra —
  // így a második keresés valóban ÚJ beszállítókat hoz, nem ugyanazt a listát.
  const { data: prevRows } = await supabase
    .from("supplier_searches")
    .select("query, results")
    .order("created_at", { ascending: false })
    .limit(50);
  const norm = (v: string) => v.trim().toLowerCase();
  const known = new Set<string>();
  for (const row of prevRows ?? []) {
    const q = (row.query ?? {}) as { what?: string };
    if (norm(String(q.what ?? "")) !== norm(what)) continue;
    for (const s of (row.results ?? []) as { name?: string }[]) {
      if (s?.name) known.add(String(s.name).trim());
    }
  }
  const exclude = [...known].slice(0, 40);

  const admin = createAdminClient();
  const pro = Boolean(body.pro);
  const credits = creditsForCountPro(count, pro);

  const charge = await chargeCredit({ userId: user.id, amount: credits });
  if (!charge.ok) {
    return NextResponse.json({ error: `Nincs elég egyenleg (${credits} szükséges).` }, { status: 402 });
  }
  const creditsCharged = charge.bypassed ? 0 : credits;
  const refund = async () => {
    if (!charge.bypassed && credits > 0) {
      await admin.rpc("wallet_add", { p_user_id: user.id, p_amount: credits });
    }
  };

  const prompt = await buildSupplierPromptActive({ ...query, exclude });

  // ---- PRO: mély kutatás, ASZINKRON (több percig futhat, a Vercel nem vágja le) ----
  if (pro) {
    try {
      const requestId = await submitSonarAsync(prompt, SUPPLIER_DEEP_MODEL);
      const { data: job, error: jobErr } = await admin
        .from("supplier_jobs")
        .insert({
          user_id: user.id,
          status: "processing",
          query,
          request_id: requestId,
          credits_charged: creditsCharged,
        })
        .select("id")
        .single();
      if (jobErr || !job) throw new Error(jobErr?.message ?? "A PRO keresés indítása nem sikerült.");
      return NextResponse.json({
        ok: true, async: true, jobId: job.id,
        charged: !charge.bypassed, credits: creditsCharged,
      });
    } catch (err) {
      await refund();
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
  }

  // ---- NORMÁL: szinkron kutatás ----
  try {
    const raw = await runSonar(prompt, PERPLEXITY_MODEL);
    // API-önköltség logolása (admin költség-kimutatáshoz) — best-effort.
    await logCost({
      userId: user.id, serviceId: null, feature: FEATURE, serviceName: "perplexity",
      units: 1, estimatedCostUsd: perplexityCostUsd(PERPLEXITY_MODEL),
    });
    const fin = await finalizeSupplierSearch({ admin, db: supabase, userId: user.id, query, raw, creditsCharged });
    if (!fin.ok) {
      await refund();
      return NextResponse.json(
        { error: "Ezekkel a feltételekkel nem találtunk igazolható beszállítót. Próbáld tágabb körzettel vagy más típussal — a kredit nem lett levonva." },
        { status: 422 }
      );
    }
    return NextResponse.json({
      ok: true, search: fin.saved, result: fin.result, pdf_url: fin.pdfUrl,
      charged: !charge.bypassed, credits: creditsCharged,
    });
  } catch (err) {
    await refund();
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
