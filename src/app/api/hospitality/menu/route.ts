// POST /api/hospitality/menu — Napi/Heti menü generálása a partner saját ételeiből (RAG).
// Folyamat: kredit levonás -> profit-cél szerinti ELŐSZŰRÉS a restaurant_dishes-ből ->
// admin-szerkeszthető prompt összeállítása a szűrt listával -> Perplexity (szinkron) ->
// usage_history + a kész szöveg. Hibánál / túl kevés ételnél a kredit visszajár.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeCredit } from "@/lib/credits";
import { runSonar, PERPLEXITY_MODEL } from "@/lib/perplexity";
import { buildMenuPromptActive } from "@/lib/prompts";
import {
  isTimeframe,
  isMenuTheme,
  isProfitGoal,
  PREFERRED_MARGINS,
  MENU_CREDITS,
  MENU_MIN_DISHES,
  categoryLabel,
  marginLabel,
} from "@/lib/hospitality";

export const runtime = "nodejs";
export const maxDuration = 60; // Perplexity hívás
const FEATURE = "menu_generator";
const MAX_DISHES = 40; // a promptba befűzött ételek felső határa

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

  const { timeframe, theme, goal } = body;
  if (!isTimeframe(timeframe) || !isMenuTheme(theme) || !isProfitGoal(goal)) {
    return NextResponse.json({ error: "Hiányzó vagy érvénytelen paraméter." }, { status: 422 });
  }

  // Opcionális: szabad instrukció + napokra bontott konyha-beosztás.
  const instruction = typeof body.instruction === "string" ? body.instruction.slice(0, 600) : "";
  const dayPlan = Array.isArray(body.dayPlan)
    ? (body.dayPlan as unknown[])
        .map((e) => {
          const o = (e ?? {}) as Record<string, unknown>;
          return {
            day: String(o.day ?? "").trim(),
            cuisine: String(o.cuisine ?? "").trim().slice(0, 60),
            ingredient: String(o.ingredient ?? "").trim().slice(0, 60),
          };
        })
        .filter((e) => e.day && (e.cuisine || e.ingredient))
        .slice(0, 7)
    : [];
  const courses = ["2", "3"].includes(String(body.courses ?? "")) ? String(body.courses) : "";
  const targetPrice = body.targetPrice != null && String(body.targetPrice).trim() ? String(body.targetPrice).trim() : "";
  const variety = body.variety === "high" ? "high" : "normal";
  const targetCount = body.targetCount != null && String(body.targetCount).trim() ? String(body.targetCount).trim() : "";
  const targetProfit = body.targetProfit != null && String(body.targetProfit).trim() ? String(body.targetProfit).trim() : "";

  const admin = createAdminClient();

  // 1) Kredit levonás (admin/sales megkerüli). Hibánál visszatérítjük.
  const charge = await chargeCredit({ userId: user.id, amount: MENU_CREDITS });
  if (!charge.ok) {
    return NextResponse.json(
      { error: `Nincs elég egyenleg (${MENU_CREDITS} szükséges).` },
      { status: 402 }
    );
  }
  const refund = async () => {
    if (!charge.bypassed && MENU_CREDITS > 0) {
      await admin.rpc("wallet_add", { p_user_id: user.id, p_amount: MENU_CREDITS });
    }
  };

  try {
    // 2) ELŐSZŰRÉS: a partner saját ételei, a profit-cél szerint preferált marzsokra szűrve.
    const preferred = PREFERRED_MARGINS[goal];
    const { data: dishes, error: dishErr } = await admin
      .from("restaurant_dishes")
      .select("name, description, category, cuisine_style, profit_margin, cost_price, sale_price, main_ingredients")
      .eq("user_id", user.id)
      .or(`profit_margin.in.(${preferred.join(",")}),profit_margin.is.null`);
    if (dishErr) throw new Error(dishErr.message);

    // Rangsor: a cél szerint preferált marzs kerül előre, majd max MAX_DISHES étel.
    const rank = new Map(preferred.map((m, i) => [m, i]));
    const selected = (dishes ?? [])
      .slice()
      .sort((a, b) => (rank.get(a.profit_margin) ?? 9) - (rank.get(b.profit_margin) ?? 9))
      .slice(0, MAX_DISHES);

    if (selected.length < MENU_MIN_DISHES) {
      await refund();
      return NextResponse.json(
        {
          error: `Túl kevés étel a kiválasztott profit-célhoz (min. ${MENU_MIN_DISHES}). Vigyél fel többet a Kínálat kezelőben, vagy válassz más profit-célt.`,
        },
        { status: 422 }
      );
    }

    // 3) Prompt: admin-szerkeszthető sablon + a szűrt étel-lista befűzése.
    const dishListText = selected
      .map((d) => {
        const parts = [categoryLabel(d.category)];
        if (d.cuisine_style) parts.push(d.cuisine_style);
        if (d.profit_margin) parts.push(`${marginLabel(d.profit_margin)} haszon`);
        if (d.sale_price != null) parts.push(`ár: ${Math.round(d.sale_price)} Ft`);
        if (d.cost_price != null && d.sale_price != null) parts.push(`darab-profit: ${Math.round(d.sale_price - d.cost_price)} Ft`);
        if (d.main_ingredients) parts.push(`alapanyagok: ${d.main_ingredients}`);
        return `- ${d.name} (${parts.join(", ")})${d.description ? ` — ${d.description}` : ""}`;
      })
      .join("\n");

    const prompt = await buildMenuPromptActive({
      timeframe, theme, goal, dishListText, instruction, dayPlan, courses, targetPrice, variety, targetCount, targetProfit,
    });

    // 4) Perplexity (szinkron) -> menü-szöveg
    const menuText = await runSonar(prompt, PERPLEXITY_MODEL);

    // 5) Előzmény
    await admin.from("usage_history").insert({
      user_id: user.id,
      service_id: null,
      feature_used: FEATURE,
      input_data: { timeframe, theme, goal, courses, targetPrice, variety, targetCount, targetProfit, dish_count: selected.length, day_plan: dayPlan, instruction },
      output_file_url: null,
      credits_charged: charge.bypassed ? 0 : MENU_CREDITS,
    });

    return NextResponse.json({
      ok: true,
      menu: menuText,
      dishCount: selected.length,
      charged: !charge.bypassed,
    });
  } catch (err) {
    await refund();
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
