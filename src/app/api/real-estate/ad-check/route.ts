// POST /api/real-estate/ad-check — meglévő hirdetés SZÖVEGÉNEK elemzése link (vagy
// bemásolt szöveg) alapján: pontszám, javítási javaslatok, kiemelendők és újraírt
// szöveg. GET — a korábbi elemzések + saját mappák a könyvtárhoz.
//
// Fotókat NEM elemzünk; a kiemelendőknél csak felhívjuk a figyelmet, mihez érdemes kép.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeCredit, refundCredit, payFromRequest } from "@/lib/credits";
import { insufficientResponse } from "@/lib/credit-response";
import { runSonar, PERPLEXITY_MODEL } from "@/lib/perplexity";
import { buildAdCheckPromptActive } from "@/lib/prompts";
import { ADCHECK_CREDITS, isValidTone, parseAdCheck } from "@/lib/adcheck";
import { fetchPageText } from "@/lib/fetch-page-text";
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

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  // Csak a saját, NEM elrejtett elemzések; max 50 elem. Ha a hidden_at még nincs, szűrés nélkül.
  const listQ = (hide: boolean) => {
    const q = supabase.from("ad_checks")
      .select("id, source_url, title, tone, score, result, pdf_url, folder_id, created_at")
      .eq("user_id", user.id);
    return (hide ? q.is("hidden_at", null) : q).order("created_at", { ascending: false }).limit(50);
  };
  const [first, { data: folders }] = await Promise.all([
    listQ(true),
    supabase.from("ad_check_folders").select("id, name").order("name"),
  ]);
  let { data: items, error } = first;
  if (error && /hidden_at/.test(error.message)) ({ data: items, error } = await listQ(false));
  // A hibát NE nyeljük el: ha a migráció hiányzik, derüljön ki.
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // a PDF-hez tartozó usage_history sor (a Korábbi munkák mappáihoz / közös mappákhoz)
  const pdfs = (items ?? []).map((i) => i.pdf_url as string | null).filter(Boolean) as string[];
  const histByUrl = new Map<string, string>();
  if (pdfs.length) {
    const { data: hs } = await supabase.from("usage_history").select("id, output_file_url")
      .eq("user_id", user.id).in("output_file_url", pdfs);
    for (const h of hs ?? []) histByUrl.set(h.output_file_url as string, h.id as string);
  }
  const withHist = (items ?? []).map((i) => ({ ...i, history_id: (i.pdf_url && histByUrl.get(i.pdf_url as string)) || null }));
  return NextResponse.json({ items: withHist, folders: folders ?? [] });
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
  const charge = credits > 0 ? await chargeCredit({ userId: user.id, payFrom: payFromRequest(request), amount: credits, service: "ad-check" }) : null;
  if (charge && !charge.ok) {
    return insufficientResponse(user.id, credits, charge);
  }
  const refund = async () => {
    if (charge && !charge.bypassed) await refundCredit(user.id, credits, charge?.source);
  };

  try {
    // 2) Ha csak LINK jött, előbb szerveroldalról letöltjük az oldal szövegét —
    //    ez megbízhatóbb, mint a keresőt kérni, hogy nyissa meg. Ha nem sikerül
    //    (üres / túl rövid), visszaesünk a kereső-alapú megnyitásra.
    let fetchedText = "";
    if (url && !text) {
      fetchedText = await fetchPageText(url);
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
