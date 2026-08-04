// POST /api/real-estate/ad-check — meglévő hirdetés SZÖVEGÉNEK elemzése link (vagy
// bemásolt szöveg) alapján: pontszám, javítási javaslatok, kiemelendők és újraírt
// szöveg. GET — a korábbi elemzések + saját mappák a könyvtárhoz.
//
// Fotókat NEM elemzünk; a kiemelendőknél csak felhívjuk a figyelmet, mihez érdemes kép.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeCredit } from "@/lib/credits";
import { runSonar, PERPLEXITY_MODEL } from "@/lib/perplexity";
import { buildAdCheckPromptActive } from "@/lib/prompts";
import { ADCHECK_CREDITS, isValidTone, parseAdCheck } from "@/lib/adcheck";
import { logCost, perplexityCostUsd } from "@/lib/costs";

export const runtime = "nodejs";
export const maxDuration = 120;

const FEATURE = "ad-check";
const MAX_TEXT = 20000;

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch { return false; }
}

/**
 * Szerveroldali oldal-letöltés: a hirdetés-oldal HTML-jéből kinyeri az olvasható
 * szöveget. Ez megbízhatóbb, mint a keresőt kérni, hogy "nyissa meg" az URL-t —
 * sok portál (pl. gdn-ingatlan.hu) így elérhető. Hibánál üres stringet ad, és a
 * hívó visszaesik a kereső-alapú megnyitásra.
 */
async function fetchAdTextOnce(url: string, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "hu-HU,hu;q=0.9,en-US;q=0.8,en;q=0.7",
        "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"macOS"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Upgrade-Insecure-Requests": "1",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return "";
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html") && !ct.includes("text/plain")) return "";

    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<\/(p|div|li|br|h[1-6]|tr|section|article)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/[ \t ]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^[ \t]+|[ \t]+$/gm, "")
      .trim();
    return text.slice(0, MAX_TEXT);
  } catch {
    return "";
  }
}

/** Több próbálkozás, növekvő időkerettel — a lassabb oldalaknak több idő. */
async function fetchAdText(url: string): Promise<string> {
  for (const ms of [20000, 30000]) {
    const t = await fetchAdTextOnce(url, ms);
    if (t.length >= 200) return t;
  }
  return "";
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const [{ data: items, error }, { data: folders }] = await Promise.all([
    supabase
      .from("ad_checks")
      .select("id, source_url, title, tone, score, result, pdf_url, folder_id, created_at")
      .order("created_at", { ascending: false })
      .limit(50), // az előzményekben max 50 elemet listázunk
    supabase.from("ad_check_folders").select("id, name").order("name"),
  ]);
  // A hibát NE nyeljük el: ha a migráció hiányzik, derüljön ki.
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: items ?? [], folders: folders ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { url?: string; text?: string; tone?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const url = String(body.url ?? "").trim();
  const text = String(body.text ?? "").trim().slice(0, MAX_TEXT);
  const tone = String(body.tone ?? "");

  if (!isValidTone(tone)) return NextResponse.json({ error: "Válassz hangnemet." }, { status: 422 });
  if (!url && !text) {
    return NextResponse.json({ error: "Adj meg egy hirdetés-linket, vagy másold be a szövegét." }, { status: 422 });
  }
  if (url && !text && !isHttpUrl(url)) {
    return NextResponse.json({ error: "A link nem érvényes (http:// vagy https:// kell)." }, { status: 422 });
  }
  if (text && text.length < 80) {
    return NextResponse.json({ error: "A bemásolt szöveg túl rövid az elemzéshez." }, { status: 422 });
  }

  const admin = createAdminClient();

  // 1) Kredit (admin/sales bypass). Hibánál visszatérítjük.
  const credits = ADCHECK_CREDITS;
  const charge = credits > 0 ? await chargeCredit({ userId: user.id, amount: credits }) : null;
  if (charge && !charge.ok) {
    return NextResponse.json({ error: `Nincs elég egyenleg (${credits} szükséges).` }, { status: 402 });
  }
  const refund = async () => {
    if (charge && !charge.bypassed) await admin.rpc("wallet_add", { p_user_id: user.id, p_amount: credits });
  };

  try {
    // 2) Ha csak LINK jött, előbb szerveroldalról letöltjük az oldal szövegét —
    //    ez megbízhatóbb, mint a keresőt kérni, hogy nyissa meg. Ha nem sikerül
    //    (üres / túl rövid), visszaesünk a kereső-alapú megnyitásra.
    let fetchedText = "";
    if (url && !text) {
      fetchedText = await fetchAdText(url);
      if (fetchedText.length < 200) fetchedText = "";
    }
    const analysisText = text || fetchedText;

    // Ha van szövegünk (bemásolt vagy letöltött), nem kell webes keresés.
    const prompt = await buildAdCheckPromptActive({
      url: analysisText ? null : (url || null),
      text: analysisText || null,
      tone,
    });
    const raw = await runSonar(prompt, PERPLEXITY_MODEL, {
      disableSearch: Boolean(analysisText),
      temperature: 0.3,
    });

    // Az API-hívás akkor is pénzbe került, ha az eredmény használhatatlan —
    // ezért a költséget MINDEN ágon logoljuk (a kredit visszatérítése külön kérdés).
    await logCost({
      userId: user.id, serviceId: null, feature: FEATURE,
      serviceName: "perplexity", units: 1, estimatedCostUsd: perplexityCostUsd(PERPLEXITY_MODEL),
    });

    // A modell jelezheti, hogy nem érte el az oldalt — ilyenkor NEM vonunk kreditet.
    // Csak RÖVID választ fogadunk el ilyennek: egy vizsgált oldal szövege is
    // tartalmazhatja ezt a mintát, és akkor ingyen futtathatna elemzéseket.
    if (raw.trim().length < 200 && /"error"\s*:\s*"unreachable"/i.test(raw)) {
      await refund();
      return NextResponse.json({
        error: "Ezt az oldalt nem sikerült megnyitni (bejelentkezés vagy védelem miatt). Másold be a hirdetés szövegét, és úgy elemezzük.",
        needsText: true,
      }, { status: 422 });
    }

    const result = parseAdCheck(raw);
    if (!result || (!result.good.length && !result.bad.length && !result.fixes.length)) {
      await refund();
      return NextResponse.json({ error: "Az elemzés nem sikerült, próbáld újra." }, { status: 502 });
    }

    // 3) A PDF-et NEM itt készítjük: a partner előbb átnézi/szerkeszti a javított
    //    hirdetésszöveget, és az ELFOGADÁSKOR (külön végpont) készül a PDF.
    const pdfUrl: string | null = null;

    // 4) Mentés + előzmény.
    const { data: saved, error: saveErr } = await admin
      .from("ad_checks")
      .insert({
        user_id: user.id,
        // Ha bemásolt szövegből dolgoztunk, a linket NE mentsük — félrevezető lenne.
        source_url: text ? null : (url || null),
        title: result.title || null,
        source_text: analysisText || null,
        tone,
        score: result.score,
        result,
        pdf_url: pdfUrl,
        credits_charged: charge && !charge.bypassed ? credits : 0,
      })
      .select("id, source_url, title, tone, score, result, pdf_url, folder_id, created_at")
      .single();

    // Ha a mentés nem sikerült (pl. az ad-check.sql még nem futott le), az elemzés
    // elveszne — inkább jelezzük, és NE vonjunk kreditet érte.
    if (saveErr || !saved) {
      await refund();
      return NextResponse.json({
        error: "Az elemzés elkészült, de nem sikerült elmenteni. Futtasd le az ad-check.sql migrációt.",
      }, { status: 500 });
    }

    await admin.from("usage_history").insert({
      user_id: user.id,
      service_id: null,
      feature_used: FEATURE,
      input_data: { url: text ? null : (url || null), title: result.title, tone, score: result.score },
      output_file_url: pdfUrl,
      credits_charged: charge && !charge.bypassed ? credits : 0,
    });

    return NextResponse.json({ ok: true, item: saved, result, pdfUrl });
  } catch (err) {
    await refund();
    return NextResponse.json({ error: (err as Error).message || "Az elemzés nem sikerült." }, { status: 500 });
  }
}
