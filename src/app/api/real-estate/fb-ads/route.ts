// POST /api/real-estate/fb-ads — Facebook hirdetésszöveg-generátor.
// Egy landing page link (vagy bemásolt szöveg) alapján 3 stílusú B2C FB-hirdetésszöveg.
// Ugyanaz a módszer, mint a Szöveg-ellenőrzőnél: szerveroldali oldal-letöltés,
// ha nem megy, kereső-alapú megnyitás.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeCredit } from "@/lib/credits";
import { runSonar, PERPLEXITY_MODEL } from "@/lib/perplexity";
import { buildFbAdsPromptActive } from "@/lib/prompts";
import { fetchPageText } from "@/lib/fetch-page-text";
import { FBADS_CREDITS, parseFbAds } from "@/lib/fbads";
import { logCost, perplexityCostUsd } from "@/lib/costs";

export const runtime = "nodejs";
export const maxDuration = 120;

const FEATURE = "fb-ads";
const MAX_TEXT = 20000;

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch { return false; }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { url?: string; text?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const url = String(body.url ?? "").trim();
  const text = String(body.text ?? "").trim().slice(0, MAX_TEXT);

  if (!url && !text) {
    return NextResponse.json({ error: "Adj meg egy landing page linket, vagy másold be a szövegét." }, { status: 422 });
  }
  if (url && !text && !isHttpUrl(url)) {
    return NextResponse.json({ error: "A link nem érvényes (http:// vagy https:// kell)." }, { status: 422 });
  }
  if (text && text.length < 80) {
    return NextResponse.json({ error: "A bemásolt szöveg túl rövid a generáláshoz." }, { status: 422 });
  }

  const admin = createAdminClient();

  const credits = FBADS_CREDITS;
  const charge = credits > 0 ? await chargeCredit({ userId: user.id, amount: credits }) : null;
  if (charge && !charge.ok) {
    return NextResponse.json({ error: `Nincs elég egyenleg (${credits} szükséges).` }, { status: 402 });
  }
  const refund = async () => {
    if (charge && !charge.bypassed) await admin.rpc("wallet_add", { p_user_id: user.id, p_amount: credits });
  };

  try {
    // Ha csak LINK jött, előbb szerveroldalról letöltjük az oldal szövegét.
    let fetchedText = "";
    if (url && !text) {
      fetchedText = await fetchPageText(url);
      if (fetchedText.length < 200) fetchedText = "";
    }
    const sourceText = text || fetchedText;

    const prompt = await buildFbAdsPromptActive({
      url: sourceText ? null : (url || null),
      text: sourceText || null,
    });
    const raw = await runSonar(prompt, PERPLEXITY_MODEL, {
      disableSearch: Boolean(sourceText),
      temperature: 0.6, // hirdetésszövegnél kicsit több kreativitás
    });

    await logCost({
      userId: user.id, serviceId: null, feature: FEATURE,
      serviceName: "perplexity", units: 1, estimatedCostUsd: perplexityCostUsd(PERPLEXITY_MODEL),
    });

    if (raw.trim().length < 200 && /"error"\s*:\s*"unreachable"/i.test(raw)) {
      await refund();
      return NextResponse.json({
        error: "Ezt az oldalt nem sikerült megnyitni (bejelentkezés vagy védelem miatt). Másold be a hirdetés szövegét, és úgy dolgozunk.",
        needsText: true,
      }, { status: 422 });
    }

    const result = parseFbAds(raw);
    if (!result) {
      await refund();
      return NextResponse.json({ error: "A szöveggenerálás nem sikerült, próbáld újra." }, { status: 502 });
    }

    // Mentés az előzményekbe (a modul saját könyvtára nélkül — a szövegek másolhatók).
    await admin.from("usage_history").insert({
      user_id: user.id,
      service_id: null,
      feature_used: FEATURE,
      input_data: { url: text ? null : (url || null), title: result.title },
      output_text: JSON.stringify(result),
      credits_charged: charge && !charge.bypassed ? credits : 0,
    });

    return NextResponse.json({ ok: true, result, charged: !!charge && !charge.bypassed });
  } catch (err) {
    await refund();
    return NextResponse.json({ error: (err as Error).message || "A generálás nem sikerült." }, { status: 500 });
  }
}
