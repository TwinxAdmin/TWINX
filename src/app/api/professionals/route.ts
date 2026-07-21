// /api/professionals — Szakember-kereső (vendéglátás + ingatlan), Perplexity kutatással.
// POST: kredit a KÉRT TALÁLATSZÁM szerint (3→1, 6→2, 9→3), élő keresés forrásokkal,
// TWINX PDF elérhetőségekkel + kész megkereső üzenettel, keresés mentése.
// GET (?industry=): a korábbi keresések listája.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeCredit } from "@/lib/credits";
import { runSonar, PERPLEXITY_MODEL } from "@/lib/perplexity";
import { buildProfessionalPromptActive } from "@/lib/prompts";
import { logCost, perplexityCostUsd } from "@/lib/costs";
import { generateProfessionalsPdf } from "@/lib/pdf";
import {
  COUNTIES, EMPLOYMENT_TYPES, WORK_ARRANGEMENTS,
  creditsForCount, isValidCount, isIndustry, professionsFor, parseProfessionalResponse, sanitizeDetails,
  type ProfessionalQuery,
} from "@/lib/professionals";

export const runtime = "nodejs";
export const maxDuration = 300; // a Pro (mélykutatás) mód akár 1-2 perc is lehet
const FEATURE = "professional_search";
const DEEP_MODEL = "sonar-deep-research";
const BUCKET = "reports";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const industry = new URL(request.url).searchParams.get("industry");
  let q = supabase
    .from("professional_searches")
    .select("id, industry, query, results, extras, pdf_url, credits_charged, created_at")
    .order("created_at", { ascending: false })
    .limit(60);
  if (industry) q = q.eq("industry", industry);

  const { data, error } = await q;
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

  const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
  const industry = str(body.industry, 20);
  if (!isIndustry(industry)) return NextResponse.json({ error: "Ismeretlen iparág." }, { status: 422 });

  const county = str(body.county, 60);
  if (!COUNTIES.includes(county as (typeof COUNTIES)[number])) {
    return NextResponse.json({ error: "Válassz megyét." }, { status: 422 });
  }

  const profession = str(body.profession, 40);
  const professionCustom = str(body.professionCustom, 120);
  const validProf = professionsFor(industry).some((p) => p.value === profession);
  if (!validProf && !professionCustom) {
    return NextResponse.json({ error: "Válassz szakmát, vagy add meg szabadon." }, { status: 422 });
  }

  const count = Number(body.count);
  if (!isValidCount(count)) return NextResponse.json({ error: "Érvénytelen találatszám." }, { status: 422 });

  const arr = (v: unknown, valid: Set<string>, max = 8) =>
    Array.isArray(v) ? (v as unknown[]).map((x) => String(x)).filter((x) => valid.has(x)).slice(0, max) : [];
  const arrFree = (v: unknown, max = 10) =>
    Array.isArray(v) ? (v as unknown[]).map((x) => String(x).trim().slice(0, 40)).filter(Boolean).slice(0, max) : [];

  const validArr = new Set(WORK_ARRANGEMENTS.map((a) => a.value as string));
  const validEmp = new Set(EMPLOYMENT_TYPES.map((e) => e.value as string));

  const query: ProfessionalQuery = {
    industry,
    profession: validProf ? profession : "egyeb",
    professionCustom: validProf ? "" : professionCustom,
    county,
    city: str(body.city, 60),
    radius: ["25", "50", "100", "150", "orszagos"].includes(str(body.radius)) ? str(body.radius) : "50",
    employment: validEmp.has(str(body.employment)) ? str(body.employment) : "barmelyik",
    arrangement: arr(body.arrangement, validArr),
    experience: str(body.experience, 20),
    availability: str(body.availability, 20),
    languages: arrFree(body.languages),
    rate: str(body.rate, 120),
    styles: industry === "hospitality" ? arrFree(body.styles) : undefined,
    shift: industry === "hospitality" ? str(body.shift, 20) : undefined,
    propertyTypes: industry === "realestate" ? arrFree(body.propertyTypes) : undefined,
    services: industry === "realestate" ? arrFree(body.services) : undefined,
    needCredential: industry === "realestate" ? Boolean(body.needCredential) : undefined,
    details: sanitizeDetails(validProf ? profession : "egyeb", body.details),
    customCriteria: Array.isArray(body.customCriteria)
      ? (body.customCriteria as unknown[]).map((c) => String(c).trim().slice(0, 120)).filter(Boolean).slice(0, 10)
      : [],
    notes: str(body.notes, 300),
    count,
  };

  // Amit ugyanERRE a szakmára már megtalált, azt nem adjuk vissza újra.
  const { data: prevRows } = await supabase
    .from("professional_searches")
    .select("query, results")
    .eq("industry", industry)
    .order("created_at", { ascending: false })
    .limit(50);
  const norm = (v: string) => v.trim().toLowerCase();
  const profKey = validProf ? profession : norm(professionCustom);
  const known = new Set<string>();
  for (const row of prevRows ?? []) {
    const rq = (row.query ?? {}) as { profession?: string; professionCustom?: string };
    const rk = rq.profession === "egyeb" ? norm(String(rq.professionCustom ?? "")) : String(rq.profession ?? "");
    if (rk !== profKey) continue;
    for (const s of (row.results ?? []) as { name?: string }[]) {
      if (s?.name) known.add(String(s.name).trim());
    }
  }
  const exclude = [...known].slice(0, 40);

  // Pro (mélykutatás) mód: dupla kredit + legmélyebb Perplexity modell.
  const deep = Boolean(body.deep);
  const model = deep ? DEEP_MODEL : PERPLEXITY_MODEL;

  const admin = createAdminClient();
  const credits = creditsForCount(count) * (deep ? 2 : 1);

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
    const prompt = await buildProfessionalPromptActive({ ...query, exclude });
    const raw = await runSonar(prompt, model);
    await logCost({
      userId: user.id, serviceId: null, feature: FEATURE, serviceName: "perplexity",
      units: 1, estimatedCostUsd: perplexityCostUsd(model),
    });
    const result = parseProfessionalResponse(raw, count);

    if (!result.professionals.length) {
      await refund();
      return NextResponse.json(
        { error: "Ezekkel a feltételekkel nem találtunk igazolható szakembert. Próbáld tágabb körzettel vagy kevesebb szűrővel — a kredit nem lett levonva." },
        { status: 422 }
      );
    }

    let pdfUrl: string | null = null;
    try {
      const bytes = await generateProfessionalsPdf({ query, result });
      const path = `professionals/${user.id}/${randomUUID()}.pdf`;
      const { error: upErr } = await admin.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: "application/pdf", upsert: false });
      if (!upErr) pdfUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    } catch {
      pdfUrl = null;
    }

    const { data: saved } = await supabase
      .from("professional_searches")
      .insert({
        user_id: user.id,
        industry,
        query,
        results: result.professionals,
        extras: result.extras,
        raw,
        pdf_url: pdfUrl,
        credits_charged: charge.bypassed ? 0 : credits,
      })
      .select("id, industry, query, results, extras, pdf_url, credits_charged, created_at")
      .single();

    await admin.from("usage_history").insert({
      user_id: user.id,
      service_id: null,
      feature_used: FEATURE,
      input_data: { industry, profession: query.profession, professionCustom: query.professionCustom, county, city: query.city, radius: query.radius, count, deep },
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
