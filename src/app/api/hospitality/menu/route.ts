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
import { logCost, perplexityCostUsd } from "@/lib/costs";
import {
  isTimeframe,
  isMenuTheme,
  isProfitGoal,
  PREFERRED_MARGINS,
  MENU_CREDITS,
  MENU_MIN_DISHES,
  timeframeDays,
  categoryLabel,
  marginLabel,
  courseStructure,
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
            dishes: Array.isArray(o.dishes)
              ? (o.dishes as unknown[]).map((x) => String(x ?? "").trim().slice(0, 120)).filter(Boolean).slice(0, 4)
              : [],
          };
        })
        .filter((e) => e.day && (e.cuisine || e.dishes.length))
        .slice(0, 7)
    : [];
  const courses = typeof body.courses === "string" ? body.courses.slice(0, 40) : "";
  const variety = body.variety === "high" ? "high" : "normal";
  const targetCount = body.targetCount != null && String(body.targetCount).trim() ? String(body.targetCount).trim() : "";
  const targetProfit = body.targetProfit != null && String(body.targetProfit).trim() ? String(body.targetProfit).trim() : "";

  const admin = createAdminClient();

  // Ár: naponta MENU_CREDITS kredit (1 nap = 1 kredit, N nap = N kredit).
  const credits = MENU_CREDITS * timeframeDays(String(timeframe));

  // 1) Kredit levonás (admin/sales megkerüli). Hibánál visszatérítjük.
  const charge = await chargeCredit({ userId: user.id, amount: credits });
  if (!charge.ok) {
    return NextResponse.json(
      { error: `Nincs elég egyenleg (${credits} szükséges).` },
      { status: 402 }
    );
  }
  const refund = async () => {
    if (!charge.bypassed && credits > 0) {
      await admin.rpc("wallet_add", { p_user_id: user.id, p_amount: credits });
    }
  };

  try {
    // 2) ELŐSZŰRÉS: a partner saját ételei, a profit-cél szerint preferált marzsokra szűrve.
    //    A napi menübe CSAK olyan étel kerülhet, amelynek van menü-előállítási költsége.
    const preferred = PREFERRED_MARGINS[goal];
    const { data: dishes, error: dishErr } = await admin
      .from("restaurant_dishes")
      .select("name, description, category, cuisine_style, profit_margin, menu_cost_price, main_ingredients")
      .eq("user_id", user.id)
      .eq("is_menu", true)
      .not("menu_cost_price", "is", null)
      .or(`profit_margin.in.(${preferred.join(",")}),profit_margin.is.null`);
    if (dishErr) throw new Error(dishErr.message);

    // A napi menü fix ára a költségprofilból (a fogásszám szerint).
    const { data: profileRow } = await admin
      .from("restaurant_cost_profile")
      .select("menu_price_2, menu_price_3")
      .eq("user_id", user.id)
      .maybeSingle();
    const courseCount = courseStructure(courses).slots.length;
    const menuPrice = String(
      courseCount >= 3 ? Number(profileRow?.menu_price_3 ?? 0) : Number(profileRow?.menu_price_2 ?? 0)
    );

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
          error: `Túl kevés menübe tehető étel (min. ${MENU_MIN_DISHES}). A napi menühöz az ételeknél meg kell adni a „menüben az előállítási költséget" a Kínálat kezelőben.`,
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
        if (d.menu_cost_price != null) parts.push(`menü-előállítási költség: ${Math.round(d.menu_cost_price)} Ft`);
        if (d.main_ingredients) parts.push(`alapanyagok: ${d.main_ingredients}`);
        return `- ${d.name} (${parts.join(", ")})${d.description ? ` — ${d.description}` : ""}`;
      })
      .join("\n");

    const prompt = await buildMenuPromptActive({
      timeframe, theme, goal, dishListText, instruction, dayPlan, courses, menuPrice, variety, targetCount, targetProfit,
    });

    // 4) Perplexity (szinkron) -> menü-szöveg
    const menuText = await runSonar(prompt, PERPLEXITY_MODEL);
    // API-önköltség logolása (admin költség-kimutatáshoz) — best-effort, sosem bukhat.
    await logCost({
      userId: user.id,
      serviceId: null,
      feature: FEATURE,
      serviceName: "perplexity",
      units: 1,
      estimatedCostUsd: perplexityCostUsd(PERPLEXITY_MODEL),
    });

    // 5) Előzmény
    await admin.from("usage_history").insert({
      user_id: user.id,
      service_id: null,
      feature_used: FEATURE,
      input_data: { timeframe, theme, goal, courses, menuPrice, variety, targetCount, targetProfit, dish_count: selected.length, day_plan: dayPlan, instruction },
      output_file_url: null,
      credits_charged: charge.bypassed ? 0 : credits,
    });

    return NextResponse.json({
      ok: true,
      menu: menuText,
      dishCount: selected.length,
      charged: !charge.bypassed,
      credits: charge.bypassed ? 0 : credits,
    });
  } catch (err) {
    await refund();
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
