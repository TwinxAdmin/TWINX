// POST /api/hospitality/costing — teljes önköltség & profit RIPORT (kredit alapú).
// Folyamat: kredit levonás -> a partner ételei (ár + önköltség) + fix költség-profil
// beolvasása -> determinisztikus önköltség + árbevétel-arányos rezsi-allokáció ->
// AI-javaslat (Perplexity, szinkron) -> usage_history + eredmény.
// A beviteli/mentési műveletek (cost-profile, sales) INGYENESEK; itt csak a riport díjas.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeCredit } from "@/lib/credits";
import { runSonar, PERPLEXITY_MODEL } from "@/lib/perplexity";
import { buildCostingPromptActive } from "@/lib/prompts";
import { generateCostingPdf } from "@/lib/pdf";
import {
  normalizeCostProfile,
  costProfileTotal,
  computeCosting,
  costingSummaryText,
  periodDays,
  proratedOverhead,
  COSTING_CREDITS,
  COSTING_MIN_DISHES,
  type CostingDishInput,
} from "@/lib/costing";

export const runtime = "nodejs";
export const maxDuration = 60;
const FEATURE = "cost_analysis";
const MAX_DISHES = 40;
const BUCKET = "reports";

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

  // Vizsgált időszak (induló + záró dátum). Ebből arányosítjuk a havi rezsit,
  // és ebbe az intervallumba eső, KORÁBBAN RÖGZÍTETT eladásokból aggregálunk.
  const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
  const start = String(body.start ?? "").trim();
  const end = String(body.end ?? "").trim();
  if (!isDate(start) || !isDate(end)) {
    return NextResponse.json({ error: "Hiányzó vagy hibás időszak (induló/záró dátum)." }, { status: 422 });
  }
  const days = periodDays(start, end);
  if (days <= 0) {
    return NextResponse.json({ error: "A záró dátum nem lehet korábbi az induló dátumnál." }, { status: 422 });
  }

  const admin = createAdminClient();

  // A rögzített eladások az időszakon belül (period_start >= start ÉS period_end <= end),
  // ételenként összegezve. Így 2 napra és 2 hónapra is ugyanabból az adatból megy a riport.
  const { data: saleRows, error: saleErr } = await admin
    .from("dish_sales")
    .select("dish_id, qty")
    .eq("user_id", user.id)
    .gte("period_start", start)
    .lte("period_end", end);
  if (saleErr) return NextResponse.json({ error: saleErr.message }, { status: 500 });

  const qtyById = new Map<string, number>();
  for (const r of saleRows ?? []) {
    const id = String(r.dish_id);
    qtyById.set(id, (qtyById.get(id) ?? 0) + (Number(r.qty) || 0));
  }
  const ids = [...qtyById.keys()].slice(0, MAX_DISHES);
  if (ids.length < COSTING_MIN_DISHES) {
    return NextResponse.json(
      { error: "Ebben az időszakban nincs rögzített eladás. Előbb vidd fel az eladott adagokat az Eladások fülön." },
      { status: 422 }
    );
  }

  // Kredit levonás (admin/sales megkerüli). Hibánál visszatérítjük.
  const credits = COSTING_CREDITS;
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
    // 1) Fix költség-profil -> havi összes rezsi -> az időszakra arányosítva.
    const { data: profileRow } = await admin
      .from("restaurant_cost_profile")
      .select("rent, wages, utilities, insurance, accounting, marketing, depreciation, bank_fees, delivery_fees, other, extra_items")
      .eq("user_id", user.id)
      .maybeSingle();
    const monthlyOverhead = costProfileTotal(normalizeCostProfile((profileRow ?? null) as Record<string, unknown> | null));
    const proratedFix = proratedOverhead(monthlyOverhead, days);

    // Egyszeri kiadások, amelyek dátuma az időszakba esik -> teljes összegük hozzáadódik.
    const { data: otRows } = await admin
      .from("restaurant_one_time_costs")
      .select("amount")
      .eq("user_id", user.id)
      .gte("spent_on", start)
      .lte("spent_on", end);
    const oneTimeTotal = (otRows ?? []).reduce((s, r) => s + (Number(r.amount) || 0), 0);

    const overhead = proratedFix + oneTimeTotal;

    // 2) A kiválasztott ételek árai a DB-ből (csak árazott ételek).
    const { data: dishRows, error: dishErr } = await admin
      .from("restaurant_dishes")
      .select("id, name, category, cost_price, sale_price")
      .eq("user_id", user.id)
      .in("id", ids);
    if (dishErr) throw new Error(dishErr.message);

    const inputs: CostingDishInput[] = (dishRows ?? [])
      .filter((d) => d.cost_price != null && d.sale_price != null)
      .map((d) => ({
        dish_id: d.id as string,
        name: d.name as string,
        category: (d.category as string) ?? null,
        cost_price: Number(d.cost_price),
        sale_price: Number(d.sale_price),
        monthly_qty: qtyById.get(d.id as string) ?? 0,
      }));

    if (inputs.length < COSTING_MIN_DISHES) {
      await refund();
      return NextResponse.json(
        { error: "A kiválasztott ételeknél nincs megadva ár. Adj meg előkészítési + eladási árat a Kínálat kezelőben." },
        { status: 422 }
      );
    }

    // 3) Determinisztikus számítás (árbevétel-arányos rezsi-allokáció, időszakra arányosítva).
    const result = computeCosting(inputs, overhead, "revenue");
    const periodLabel = `${start} – ${end} (${days} nap)`;

    // 4) AI-javaslat (a számokat készen kapja).
    const prompt = await buildCostingPromptActive(costingSummaryText(result, periodLabel, oneTimeTotal));
    let narrative = "";
    try {
      narrative = await runSonar(prompt, PERPLEXITY_MODEL);
    } catch {
      narrative = ""; // AI-hiba nem bukatja a riportot; a számok mennek.
    }

    // 5) Letölthető PDF-riport (pdf-lib, magyar font) -> Storage (reports bucket).
    //    PDF-hiba nem bukatja a riportot; a számok + AI-szöveg akkor is mennek.
    let pdfUrl: string | null = null;
    try {
      const bytes = await generateCostingPdf({ result, narrative, period: periodLabel, oneTimeTotal });
      const path = `costing/${user.id}/${randomUUID()}.pdf`;
      const { error: upErr } = await admin.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: "application/pdf", upsert: false });
      if (!upErr) pdfUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    } catch {
      pdfUrl = null;
    }

    // 6) Előzmény.
    await admin.from("usage_history").insert({
      user_id: user.id,
      service_id: null,
      feature_used: FEATURE,
      input_data: { start, end, days, monthly_overhead: monthlyOverhead, one_time_total: oneTimeTotal, overhead, dish_count: inputs.length },
      output_file_url: pdfUrl,
      credits_charged: charge.bypassed ? 0 : credits,
    });

    return NextResponse.json({
      ok: true,
      result,
      narrative,
      pdf_url: pdfUrl,
      charged: !charge.bypassed,
      credits: charge.bypassed ? 0 : credits,
    });
  } catch (err) {
    await refund();
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
