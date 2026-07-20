// POST /api/hospitality/simulation — PROFIT-TERV (előretekintő szimuláció, kredit alapú).
// A partner megadja a tervezett mixet (étel-darabszámok + napi menük) egy jövőbeli
// időszakra, és opcionálisan egy cél-profitot. Kétféle mód:
//   - "dish": csak az ételeken elért profit (egyéb költség nélkül)
//   - "full": + az étterem egyéb költségei az időszakra arányosítva (rezsi, egyszeri tételek)
// A kredit a letölthető PDF-riportért (és az AI-értékelésért) jár.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeCredit } from "@/lib/credits";
import { runSonar, PERPLEXITY_MODEL } from "@/lib/perplexity";
import { buildSimulationPromptActive } from "@/lib/prompts";
import { generateSimulationPdf } from "@/lib/pdf";
import {
  normalizeCostProfile, costProfileTotal, periodDays, proratedOverhead, oneTimeInRange,
  type OneTimeCost,
} from "@/lib/costing";
import {
  computeSimulation, simulationSummaryText, SIMULATION_CREDITS,
  type SimDishInput, type SimMode,
} from "@/lib/simulation";

export const runtime = "nodejs";
export const maxDuration = 60;
const FEATURE = "profit_plan";
const BUCKET = "reports";
const MAX_DISHES = 60;

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

  const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
  const start = String(body.start ?? "").trim();
  const end = String(body.end ?? "").trim();
  if (!isDate(start) || !isDate(end)) {
    return NextResponse.json({ error: "Hiányzó vagy hibás időszak." }, { status: 422 });
  }
  const days = periodDays(start, end);
  if (days <= 0) {
    return NextResponse.json({ error: "A záró dátum nem lehet korábbi az induló dátumnál." }, { status: 422 });
  }

  const mode: SimMode = body.mode === "full" ? "full" : "dish";
  const num = (v: unknown) => Math.max(0, Number(String(v ?? "").replace(",", ".")) || 0);
  const target = num(body.target);

  // Tervezett étel-darabszámok.
  const qtyById = new Map<string, number>();
  if (Array.isArray(body.dishes)) {
    for (const e of body.dishes as unknown[]) {
      const o = (e ?? {}) as Record<string, unknown>;
      const id = String(o.dish_id ?? "").trim();
      const qty = Math.max(0, Math.floor(num(o.qty)));
      if (id && qty > 0) qtyById.set(id, qty);
    }
  }
  const ids = [...qtyById.keys()].slice(0, MAX_DISHES);

  const m = (body.menu ?? {}) as Record<string, unknown>;
  const menuQty2 = Math.max(0, Math.floor(num(m.qty2)));
  const menuQty3 = Math.max(0, Math.floor(num(m.qty3)));

  if (!ids.length && menuQty2 + menuQty3 === 0) {
    return NextResponse.json({ error: "Adj meg legalább egy ételt vagy menüt darabszámmal." }, { status: 422 });
  }

  const admin = createAdminClient();

  // Kredit levonás (admin/sales megkerüli). Hibánál visszatérítjük.
  const credits = SIMULATION_CREDITS;
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
    // 1) Ételek árai a DB-ből (csak étlaposan árazottak vehetnek részt).
    const { data: dishRows, error: dishErr } = await admin
      .from("restaurant_dishes")
      .select("id, name, category, cost_price, sale_price")
      .eq("user_id", user.id)
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    if (dishErr) throw new Error(dishErr.message);

    const dishes: SimDishInput[] = (dishRows ?? [])
      .filter((d) => d.cost_price != null && d.sale_price != null)
      .map((d) => ({
        dish_id: d.id as string,
        name: d.name as string,
        category: (d.category as string) ?? null,
        cost_price: Number(d.cost_price),
        sale_price: Number(d.sale_price),
        qty: qtyById.get(d.id as string) ?? 0,
      }));

    // 2) Költségprofil: menü-árak + (full módban) az időszakra arányosított rezsi.
    const { data: profileRow } = await admin
      .from("restaurant_cost_profile")
      .select("rent, wages, utilities, insurance, accounting, marketing, depreciation, bank_fees, delivery_fees, other, extra_items, menu_price_2, menu_price_3")
      .eq("user_id", user.id)
      .maybeSingle();
    const profile = normalizeCostProfile((profileRow ?? null) as Record<string, unknown> | null);

    let otherCosts = 0;
    let oneTimeIncome = 0;
    if (mode === "full") {
      const { data: otRows } = await admin
        .from("restaurant_one_time_costs")
        .select("id, label, amount, period_start, period_end, kind")
        .eq("user_id", user.id)
        .lte("period_start", end)
        .gte("period_end", start);
      const otAll = (otRows ?? []) as OneTimeCost[];
      otherCosts = proratedOverhead(costProfileTotal(profile), days) + oneTimeInRange(otAll, start, end, "expense");
      oneTimeIncome = oneTimeInRange(otAll, start, end, "income");
    }

    // A menünkénti előállítási költséget a kliens küldi (az ételek menü-költségéből becsülve,
    // de felülírható) — tervezésnél nem tudjuk, pontosan mely ételek kerülnek a menükbe.
    const result = computeSimulation({
      mode, dishes, target, otherCosts, oneTimeIncome,
      menu: {
        qty2: menuQty2, qty3: menuQty3,
        price2: num(m.price2) || profile.menu_price_2,
        price3: num(m.price3) || profile.menu_price_3,
        cost2: num(m.cost2),
        cost3: num(m.cost3),
      },
    });

    const periodLabel = `${start} – ${end} (${days} nap)`;

    // 3) AI-értékelés (a számokat készen kapja).
    let narrative = "";
    try {
      const prompt = await buildSimulationPromptActive(simulationSummaryText(result, periodLabel));
      narrative = await runSonar(prompt, PERPLEXITY_MODEL);
    } catch {
      narrative = "";
    }

    // 4) Letölthető PDF -> Storage.
    let pdfUrl: string | null = null;
    try {
      const bytes = await generateSimulationPdf({ result, narrative, period: periodLabel });
      const path = `profit-plan/${user.id}/${randomUUID()}.pdf`;
      const { error: upErr } = await admin.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: "application/pdf", upsert: false });
      if (!upErr) pdfUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    } catch {
      pdfUrl = null;
    }

    // 5) Előzmény.
    await admin.from("usage_history").insert({
      user_id: user.id,
      service_id: null,
      feature_used: FEATURE,
      input_data: { start, end, days, mode, target, dish_count: result.dishes.length, menu_count: result.menu.count },
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
