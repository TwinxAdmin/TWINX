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
  oneTimeInRange,
  COSTING_CREDITS,
  COSTING_MIN_DISHES,
  type CostingDishInput,
  type MenuSalesInput,
  type OneTimeCost,
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
  // ételenként ÉS csatornánként összegezve. Így 2 napra és 2 hónapra is ugyanabból megy a riport.
  const { data: saleRows, error: saleErr } = await admin
    .from("dish_sales")
    .select("dish_id, qty, channel")
    .eq("user_id", user.id)
    .gte("period_start", start)
    .lte("period_end", end);
  if (saleErr) return NextResponse.json({ error: saleErr.message }, { status: 500 });

  const qtyEtlap = new Map<string, number>();
  const qtyMenu = new Map<string, number>();
  for (const r of saleRows ?? []) {
    const id = String(r.dish_id);
    const target = String(r.channel) === "menu" ? qtyMenu : qtyEtlap;
    target.set(id, (target.get(id) ?? 0) + (Number(r.qty) || 0));
  }

  // Eladott napi menük az időszakban (+ esetleges ár-felülírás).
  const { data: menuRows } = await admin
    .from("menu_sales")
    .select("qty_2, qty_3, price_2, price_3")
    .eq("user_id", user.id)
    .gte("period_start", start)
    .lte("period_end", end);

  const ids = [...new Set([...qtyEtlap.keys(), ...qtyMenu.keys()])].slice(0, MAX_DISHES);
  const anyMenus = (menuRows ?? []).some((m) => (Number(m.qty_2) || 0) + (Number(m.qty_3) || 0) > 0);
  if (ids.length < COSTING_MIN_DISHES && !anyMenus) {
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

    // Egyszeri kiadások: azok, amelyek időszaka (period_start..period_end) átfed a riporttal;
    // az átfedő napok arányában (arányos elosztás) számítjuk be.
    const { data: otRows } = await admin
      .from("restaurant_one_time_costs")
      .select("id, label, amount, period_start, period_end")
      .eq("user_id", user.id)
      .lte("period_start", end)
      .gte("period_end", start);
    const oneTimeTotal = oneTimeInRange((otRows ?? []) as OneTimeCost[], start, end);

    const overhead = proratedFix + oneTimeTotal;

    // 2) Az érintett ételek árai a DB-ből (étlapos pár + menü-költség).
    const { data: dishRows, error: dishErr } = await admin
      .from("restaurant_dishes")
      .select("id, name, category, cost_price, sale_price, menu_cost_price")
      .eq("user_id", user.id)
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    if (dishErr) throw new Error(dishErr.message);

    const inputs: CostingDishInput[] = (dishRows ?? []).map((d) => ({
      dish_id: d.id as string,
      name: d.name as string,
      category: (d.category as string) ?? null,
      cost_price: d.cost_price != null ? Number(d.cost_price) : null,
      sale_price: d.sale_price != null ? Number(d.sale_price) : null,
      menu_cost_price: d.menu_cost_price != null ? Number(d.menu_cost_price) : null,
      qty_etlap: qtyEtlap.get(d.id as string) ?? 0,
      qty_menu: qtyMenu.get(d.id as string) ?? 0,
    }));

    // 3) Eladott menük + ár (a felülírás elsőbbséget élvez a beállított árral szemben).
    const profile = normalizeCostProfile((profileRow ?? null) as Record<string, unknown> | null);
    let qty2 = 0, qty3 = 0, rev2 = 0, rev3 = 0;
    for (const m of menuRows ?? []) {
      const q2 = Math.max(0, Math.floor(Number(m.qty_2) || 0));
      const q3 = Math.max(0, Math.floor(Number(m.qty_3) || 0));
      const p2 = m.price_2 != null ? Number(m.price_2) : profile.menu_price_2;
      const p3 = m.price_3 != null ? Number(m.price_3) : profile.menu_price_3;
      qty2 += q2; qty3 += q3; rev2 += q2 * p2; rev3 += q3 * p3;
    }
    const menuSales: MenuSalesInput = {
      qty2, qty3,
      price2: qty2 > 0 ? rev2 / qty2 : profile.menu_price_2,
      price3: qty3 > 0 ? rev3 / qty3 : profile.menu_price_3,
    };

    // 4) Determinisztikus számítás (időszakra arányosított rezsivel).
    const result = computeCosting(inputs, menuSales, overhead);
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
