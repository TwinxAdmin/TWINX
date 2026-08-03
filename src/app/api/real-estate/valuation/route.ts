// POST /api/real-estate/valuation — Ingatlan Értékbecslő teljes lánc.
// Sorrend: validáció -> kredit levonás (admin/sales megkerül) -> Perplexity (Sonar)
// -> usage_history. Hiba esetén kredit-visszatérítés.
// A PDF-et NEM itt készítjük: a partner előbb szerkeszti a riportot, és a
// böngésző rendereli a végleges dokumentumot (lásd ./save).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateValuationInput, type ValuationInput } from "@/lib/valuation";
import { chargeCredit } from "@/lib/credits";
import {
  runSonarWithSources,
  PERPLEXITY_MODEL,
  HU_PROPERTY_DOMAINS,
  VALUATION_RECENCY,
  type SonarSource,
} from "@/lib/perplexity";
import { buildValuationPromptActive } from "@/lib/prompts";
import { logCost, perplexityCostUsd } from "@/lib/costs";

export const runtime = "nodejs";
export const maxDuration = 60; // a Perplexity-hívás hosszabb lehet

const SERVICE_SLUG = "real-estate";
const FEATURE = "valuation";

/** A felhasznált források külön szakaszként a riport végén (ellenőrizhetőség). */
function sourcesSection(sources: SonarSource[]): string {
  if (!sources.length) return "";
  const lines = sources
    .slice(0, 12)
    .map((s) => `- ${s.title}${s.date ? ` (${s.date})` : ""} — ${s.url}`);
  return `\n\n## Felhasznált források\n${lines.join("\n")}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const { valid, errors } = validateValuationInput(body as Record<string, unknown>);
  if (!valid) {
    return NextResponse.json({ errors }, { status: 422 });
  }
  const input = body as ValuationInput;

  const admin = createAdminClient();

  const { data: service } = await admin
    .from("services")
    .select("id")
    .eq("slug", SERVICE_SLUG)
    .single();
  if (!service) {
    return NextResponse.json({ error: "A modul nem található." }, { status: 400 });
  }

  // 1) Kredit levonás (admin/sales megkerüli). Sikertelen generálásnál visszatérítjük.
  let charge: Awaited<ReturnType<typeof chargeCredit>>;
  try {
    charge = await chargeCredit({ userId: user.id, amount: 1 });
  } catch {
    // A levonás technikai hibája ne nyers 500-as hibaként érje a partnert.
    return NextResponse.json(
      { error: "A kredit levonása most nem sikerült. Próbáld újra." },
      { status: 503 }
    );
  }
  if (!charge.ok) {
    return NextResponse.json(
      { error: "Nincs elég kredit ehhez a modulhoz." },
      { status: 402 }
    );
  }

  try {
    // 2) Perplexity (Sonar) hívás a validált adatokból (az aktív prompttal).
    //    A keresést a magyar ingatlanportálokra és piaci forrásokra szűkítjük —
    //    így nagyobb eséllyel dolgozik KONKRÉT hirdetésekből, nem általános cikkekből.
    const prompt = await buildValuationPromptActive(input);
    const { content, sources } = await runSonarWithSources(prompt, PERPLEXITY_MODEL, {
      // Alacsony hőmérséklet: az értékbecslésnél a kiszámíthatóság fontosabb,
      // mint a fogalmazás változatossága (két futás ne adjon eltérő árat).
      temperature: 0.1,
      domains: HU_PROPERTY_DOMAINS,
      recency: VALUATION_RECENCY || undefined,
    });
    const report = content + sourcesSection(sources);

    // 3) Mentés a usage_history táblába — a PDF-et már a BÖNGÉSZŐ készíti a
    //    szerkesztett riportból (/api/real-estate/valuation/save), így pontosan
    //    az kerül a dokumentumba, amit a partner az előnézetben jóváhagyott.
    const { data: hist, error: histError } = await admin
      .from("usage_history")
      .insert({
        user_id: user.id,
        service_id: service.id,
        feature_used: FEATURE,
        input_data: input,
        output_text: report,
        credits_charged: charge.bypassed ? 0 : 1,
      })
      .select("id")
      .single();
    if (histError) throw new Error(`Előzmény mentés hiba: ${histError.message}`);

    // Nyers API-önköltség logolása (admin-only, best-effort).
    await logCost({
      userId: user.id,
      serviceId: service.id,
      feature: FEATURE,
      serviceName: "perplexity",
      units: 1,
      estimatedCostUsd: perplexityCostUsd(PERPLEXITY_MODEL),
    });

    return NextResponse.json({
      ok: true,
      id: hist?.id ?? null,
      report,
      charged: !charge.bypassed,
    });
  } catch (err) {
    if (!charge.bypassed) {
      await admin.rpc("wallet_add", {
        p_user_id: user.id,
        p_amount: 1,
      });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
