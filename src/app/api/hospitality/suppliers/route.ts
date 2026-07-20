// /api/hospitality/suppliers — beszállító-kereső (Perplexity webes kutatás).
// POST: kredit a KÉRT TALÁLATSZÁM szerint (3→1, 6→2, 9→3), élő keresés forrásokkal,
// JSON-válasz feldolgozása, TWINX PDF elérhetőségekkel + kész megkereső üzenettel,
// és a keresés mentése (a visszanézés később INGYENES).
// GET: a korábbi keresések listája.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeCredit } from "@/lib/credits";
import { runSonar, PERPLEXITY_MODEL } from "@/lib/perplexity";
import { buildSupplierPromptActive } from "@/lib/prompts";
import { logCost, perplexityCostUsd } from "@/lib/costs";
import { generateSuppliersPdf } from "@/lib/pdf";
import {
  COUNTIES, SUPPLIER_TYPES, QTY_UNITS, FREQUENCIES,
  creditsForCount, isValidCount, parseSupplierResponse,
  type SupplierQuery,
} from "@/lib/suppliers";

export const runtime = "nodejs";
export const maxDuration = 60;
const FEATURE = "supplier_search";
const BUCKET = "reports";

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
  const what = str(body.what, 120);
  const county = str(body.county, 60);
  const count = Number(body.count);

  if (!what) return NextResponse.json({ error: "Add meg, milyen alapanyagot keresel." }, { status: 422 });
  if (!COUNTIES.includes(county as (typeof COUNTIES)[number])) {
    return NextResponse.json({ error: "Válassz megyét." }, { status: 422 });
  }
  if (!isValidCount(count)) return NextResponse.json({ error: "Érvénytelen találatszám." }, { status: 422 });

  const validTypes = new Set(SUPPLIER_TYPES.map((t) => t.value as string));
  const validUnits = new Set(QTY_UNITS.map((u) => u.value as string));
  const validFreqs = new Set(FREQUENCIES.map((f) => f.value as string));

  const query: SupplierQuery = {
    what,
    county,
    city: str(body.city, 60),
    radius: ["25", "50", "100", "150", "orszagos"].includes(str(body.radius)) ? str(body.radius) : "50",
    types: Array.isArray(body.types)
      ? (body.types as unknown[]).map((t) => String(t)).filter((t) => validTypes.has(t)).slice(0, 5)
      : [],
    // Mennyiség és gyakoriság strukturáltan — így a prompt egyértelmű mondatot kap.
    qty: Math.max(0, Math.floor(Number(body.qty) || 0)),
    qtyUnit: validUnits.has(str(body.qtyUnit)) ? str(body.qtyUnit) : "kg",
    frequency: validFreqs.has(str(body.frequency)) ? str(body.frequency) : "heti",
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
  const credits = creditsForCount(count);

  const charge = await chargeCredit({ userId: user.id, amount: credits });
  if (!charge.ok) {
    return NextResponse.json({ error: `Nincs elég egyenleg (${credits} szükséges).` }, { status: 402 });
  }
  const refund = async () => {
    if (!charge.bypassed && credits > 0) {
      await admin.rpc("wallet_add", { p_user_id: user.id, p_amount: credits });
    }
  };

  try {
    // 1) Élő webes kutatás (a prompt tiltja a kitalált cégeket, forrást kér).
    const prompt = await buildSupplierPromptActive({ ...query, exclude });
    const raw = await runSonar(prompt, PERPLEXITY_MODEL);
    // API-önköltség logolása (admin költség-kimutatáshoz) — best-effort, sosem bukhat.
    await logCost({
      userId: user.id,
      serviceId: null,
      feature: FEATURE,
      serviceName: "perplexity",
      units: 1,
      estimatedCostUsd: perplexityCostUsd(PERPLEXITY_MODEL),
    });
    const result = parseSupplierResponse(raw, count);

    // Ha egyetlen értékelhető találat sincs, ne vegyük el a kreditet.
    if (!result.suppliers.length) {
      await refund();
      return NextResponse.json(
        { error: "Ezekkel a feltételekkel nem találtunk igazolható beszállítót. Próbáld tágabb körzettel vagy más típussal — a kredit nem lett levonva." },
        { status: 422 }
      );
    }

    // 2) TWINX PDF (elérhetőségek + megkereső sablon).
    let pdfUrl: string | null = null;
    try {
      const bytes = await generateSuppliersPdf({ query, result });
      const path = `suppliers/${user.id}/${randomUUID()}.pdf`;
      const { error: upErr } = await admin.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: "application/pdf", upsert: false });
      if (!upErr) pdfUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    } catch {
      pdfUrl = null;
    }

    // 3) Mentés — a visszanézés később ingyenes.
    const { data: saved } = await supabase
      .from("supplier_searches")
      .insert({
        user_id: user.id,
        query,
        results: result.suppliers,
        extras: result.extras,
        raw,
        pdf_url: pdfUrl,
        credits_charged: charge.bypassed ? 0 : credits,
      })
      .select("id, query, results, extras, pdf_url, credits_charged, created_at")
      .single();

    // 4) Előzmény.
    await admin.from("usage_history").insert({
      user_id: user.id,
      service_id: null,
      feature_used: FEATURE,
      input_data: { what, county, city: query.city, radius: query.radius, types: query.types, count },
      output_file_url: pdfUrl,
      credits_charged: charge.bypassed ? 0 : credits,
    });

    return NextResponse.json({
      ok: true,
      search: saved,
      result,
      pdf_url: pdfUrl,
      charged: !charge.bypassed,
      credits: charge.bypassed ? 0 : credits,
    });
  } catch (err) {
    await refund();
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
