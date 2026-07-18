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
import { generateValuationPdf } from "@/lib/pdf";
import { formatHuf } from "@/lib/hospitality";
import {
  normalizeCostProfile,
  costProfileTotal,
  computeCosting,
  costingSummaryText,
  COSTING_CREDITS,
  COSTING_MIN_DISHES,
  type CostingResult,
  type CostingDishInput,
  type AllocationMethod,
} from "@/lib/costing";

export const runtime = "nodejs";
export const maxDuration = 60;
const FEATURE = "cost_analysis";
const MAX_DISHES = 40;
const BUCKET = "reports";

// A PDF-riport törzsének felépítése (olvasható, tagolt szöveg).
function buildPdfBody(result: CostingResult, narrative: string): string {
  const t = result.totals;
  const lines: string[] = [];
  lines.push("ÖSSZEGZÉS");
  lines.push(`Havi árbevétel: ${formatHuf(t.revenue)}`);
  lines.push(`Alapanyagköltség: ${formatHuf(t.ingredientCost)}`);
  lines.push(`Rávetített rezsi (havi fix költség): ${formatHuf(t.overhead)}`);
  lines.push(`Étterem havi valós profit: ${formatHuf(t.netProfit)}`);
  lines.push(`Rezsi-allokáció: ${result.method === "revenue" ? "árbevétel-arányos" : "darab-arányos"}`);
  lines.push("");
  lines.push("ÉTELENKÉNTI BONTÁS");
  for (const d of result.dishes) {
    lines.push("");
    lines.push(d.name);
    lines.push(`  Havi darab: ${d.monthly_qty} db  |  Eladási ár: ${formatHuf(d.sale_price)}/adag`);
    lines.push(`  Teljes önköltség: ${formatHuf(d.fullUnitCost)}/adag (alapanyag ${formatHuf(d.cost_price)} + rezsi ${formatHuf(d.overheadPerUnit)})`);
    lines.push(`  Valós darab-profit: ${formatHuf(d.unitProfit)} (${Math.round(d.unitMarginPct)}% árrés)`);
    lines.push(`  Havi profit: ${formatHuf(d.monthlyProfit)}  |  Fedezeti darabszám: ${d.breakevenQty} db`);
  }
  if (narrative.trim()) {
    lines.push("");
    lines.push("AI-ELEMZÉS ÉS JAVASLATOK");
    lines.push("");
    lines.push(narrative.trim());
  }
  return lines.join("\n");
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

  const method: AllocationMethod = body.method === "unit" ? "unit" : "revenue";
  // A bevitt ételek: {dish_id, monthly_qty}. A forgalmat innen vesszük, az árakat a DB-ből.
  const qtyById = new Map<string, number>();
  if (Array.isArray(body.dishes)) {
    for (const e of body.dishes as unknown[]) {
      const o = (e ?? {}) as Record<string, unknown>;
      const id = String(o.dish_id ?? "").trim();
      const qty = Math.max(0, Math.floor(Number(o.monthly_qty) || 0));
      if (id) qtyById.set(id, qty);
    }
  }
  const ids = [...qtyById.keys()].slice(0, MAX_DISHES);
  if (ids.length < COSTING_MIN_DISHES) {
    return NextResponse.json({ error: "Válassz legalább egy ételt a kalkulációhoz." }, { status: 422 });
  }

  const admin = createAdminClient();

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
    // 1) Fix költség-profil -> havi összes rezsi.
    const { data: profileRow } = await admin
      .from("restaurant_cost_profile")
      .select("rent, wages, utilities, insurance, accounting, marketing, depreciation, bank_fees, delivery_fees, other, extra_items")
      .eq("user_id", user.id)
      .maybeSingle();
    const overhead = costProfileTotal(normalizeCostProfile((profileRow ?? null) as Record<string, unknown> | null));

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

    // 3) Determinisztikus számítás.
    const result = computeCosting(inputs, overhead, method);

    // 4) AI-javaslat (a számokat készen kapja).
    const prompt = await buildCostingPromptActive(costingSummaryText(result));
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
      const bytes = await generateValuationPdf({
        title: "Önköltség & profit riport",
        meta: [
          `Készült: ${new Date().toLocaleDateString("hu-HU")}`,
          `Rezsi-allokáció: ${method === "revenue" ? "árbevétel-arányos" : "darab-arányos"}`,
          `Havi fix költség: ${formatHuf(overhead)}`,
        ],
        body: buildPdfBody(result, narrative),
      });
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
      input_data: { method, overhead, dish_count: inputs.length },
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
