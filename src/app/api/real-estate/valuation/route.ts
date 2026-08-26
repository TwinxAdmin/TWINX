// POST /api/real-estate/valuation — Ingatlan Értékbecslő teljes lánc.
// Sorrend: validáció -> kredit levonás (admin/sales megkerül) -> Perplexity (Sonar)
// -> usage_history. Hiba esetén kredit-visszatérítés.
// A PDF-et NEM itt készítjük: a partner előbb szerkeszti a riportot, és a
// böngésző rendereli a végleges dokumentumot (lásd ./save).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateValuationInput, type ValuationInput } from "@/lib/valuation";
import { chargeCredit, checkCreditAvailable } from "@/lib/credits";
import {
  runSonarWithSources,
  PERPLEXITY_MODEL,
  HU_PROPERTY_DOMAINS,
  VALUATION_RECENCY,
  type SonarSource,
} from "@/lib/perplexity";
import { buildValuationPromptActive } from "@/lib/prompts";
import {
  analyzePropertyPhotos,
  renderConditionBlock,
  type VisionImage,
} from "@/lib/property-vision";
import { logCost, perplexityCostUsd } from "@/lib/costs";
import { computeValuation, type EngineResult } from "@/lib/valuation-engine";
import {
  loadActiveEngineConfig, buildCompsPrompt, buildSubject, parseCompsJson, composeEngineReport,
  compsCacheKey, getCachedComps, setCachedComps, stripHiddenReportSections,
} from "@/lib/valuation-engine-server";
import { type RawComp } from "@/lib/valuation-engine";

export const runtime = "nodejs";
// A Perplexity-hívás hosszú lehet, és a motoros ág KÉT hívást tehet egymás után
// (comp-lekérés → AI-tartalék). Vercel PRO alatt a plafon 300 mp; 180-at használunk,
// hogy legyen bőven keret, de a partner se várjon értelmetlenül sokat.
// A belső `deadline`/`sonarTimeout` ezzel arányosan van beállítva (route törzsében).
export const maxDuration = 180;

const SERVICE_SLUG = "real-estate";
const FEATURE = "valuation";

/** Egy publikus kép-URL letöltése bájttá (méret- és típus-korláttal). Hibatűrő: null. */
async function fetchImageBytes(url: string): Promise<VisionImage | null> {
  try {
    if (!/^https?:\/\//i.test(url)) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type") || "image/jpeg";
    if (!mimeType.startsWith("image/")) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > 8_000_000) return null;
    return { bytes: buf, mimeType };
  } catch {
    return null;
  }
}

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

  // A kérés kétféle lehet: sima JSON (fotó nélkül, visszafelé kompatibilis) vagy
  // multipart FormData (ha fotók is jönnek): "data" mező a JSON, "images" a feltöltött
  // fájlok, "systemUrls" a rendszerből behúzott képek URL-listája.
  let body: unknown;
  const photoImages: VisionImage[] = [];
  const contentType = request.headers.get("content-type") || "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      body = JSON.parse(String(form.get("data") ?? "{}"));
      // Feltöltött fájlok → bájtok (max 5 kép).
      for (const f of form.getAll("images")) {
        if (photoImages.length >= 5) break;
        if (f instanceof File && f.size > 0 && f.size <= 8_000_000) {
          const buf = new Uint8Array(await f.arrayBuffer());
          photoImages.push({ bytes: buf, mimeType: f.type || "image/jpeg" });
        }
      }
      // Rendszerből behúzott URL-ek → szerveroldali letöltés bájttá.
      const urlsRaw = form.get("systemUrls");
      const urls: string[] = urlsRaw ? (JSON.parse(String(urlsRaw)) as string[]) : [];
      for (const u of urls) {
        if (photoImages.length >= 5) break;
        const img = await fetchImageBytes(u);
        if (img) photoImages.push(img);
      }
    } else {
      body = await request.json();
    }
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

  // 1) Kredit-ELLENŐRZÉS levonás nélkül (admin megkerüli). A tényleges levonás
  //    csak a SIKERES generálás után történik (lentebb) — így egy időtúllépés
  //    vagy hiba SOHA nem visz el kreditet, még akkor sem, ha a hosting platform
  //    (Vercel) a függvényt menet közben leállítaná.
  let avail: Awaited<ReturnType<typeof checkCreditAvailable>>;
  try {
    avail = await checkCreditAvailable({ userId: user.id, amount: 1 });
  } catch {
    return NextResponse.json(
      { error: "A kredit ellenőrzése most nem sikerült. Próbáld újra." },
      { status: 503 }
    );
  }
  if (!avail.ok) {
    return NextResponse.json(
      { error: "Nincs elég kredit ehhez a modulhoz." },
      { status: 402 }
    );
  }
  const bypassed = avail.bypassed;
  // Levontuk-e ténylegesen a kreditet? (A generálás UTÁN állítjuk true-ra.)
  let didCharge = false;

  try {
    // 2) Perplexity (Sonar) hívás a validált adatokból (az aktív prompttal).
    //    A keresést a magyar ingatlanportálokra és piaci forrásokra szűkítjük —
    //    így nagyobb eséllyel dolgozik KONKRÉT hirdetésekből, nem általános cikkekből.
    // Fotó-alapú állapotértékelés (opcionális): ha jött fotó, gépi képelemzés →
    // strukturált állapot-blokk, amit a modell a lakás-korrekcióknál használ (±5% plafon).
    let conditionText: string | undefined;
    if (photoImages.length > 0) {
      const rep = await analyzePropertyPhotos(photoImages);
      if (rep) conditionText = renderConditionBlock(rep);
    }

    // KÖZÖS IDŐKERET. A motoros ág legrosszabb esetben KÉT Perplexity-hívást tesz
    // egymás után (comp-lekérés, majd AI-tartalék), és ezek együtt kicsúszhatnak a
    // Vercel 60 mp-es futásidejéből → a platform megöli a függvényt, a `catch`
    // NEM fut le, a partner „Hálózati hibát" lát. Ezért a két hívás EGY közös,
    // ~55 mp-es keretből gazdálkodik: minden hívás annyit kaphat, amennyi a keretből
    // MARADT. Így a belső időkorlát mindig HAMARABB elsül, mint a platform kése →
    // lefut a `catch`, tiszta hibaüzenet, és (mivel még nem vontunk le) nincs kredit-veszés.
    // VERCEL PRO: a maxDuration 180 mp. A belső keret 170 mp — marad ~10 mp a válasz
    // összeállítására + az előzmény mentésére, MIELŐTT a platform megölné a függvényt.
    // Egy hívás legfeljebb 100 mp-et kaphat: így ha a comp-lekérés kifut, az AI-tartalék
    // ágnak is marad bőven ideje (100 + 70), és nem a platform kése vág közbe.
    const deadline = Date.now() + 170_000;
    const sonarTimeout = () =>
      Math.max(8_000, Math.min(100_000, deadline - Date.now())); // legalább 8 mp, legfeljebb 100

    const sonarBase = {
      // Alacsony hőmérséklet: az értékbecslésnél a kiszámíthatóság a fontos.
      temperature: 0.1,
      domains: HU_PROPERTY_DOMAINS,
      recency: VALUATION_RECENCY || undefined,
    } as const;

    // Az AI-becslő ág (régi mód / fallback): a válasz + források.
    const runAiValuation = async (prefix = "") => {
      const prompt = await buildValuationPromptActive(input, conditionText);
      const r = await runSonarWithSources(prompt, PERPLEXITY_MODEL, {
        ...sonarBase,
        timeoutMs: sonarTimeout(),
      });
      return prefix + r.content + sourcesSection(r.sources);
    };

    // Comp-alapú MOTOR, ha az adminban be van kapcsolva; különben a régi AI-becslő.
    const engineCfg = await loadActiveEngineConfig();
    let report: string;
    let engineAudit: EngineResult | null = null;

    if (engineCfg.engine.mode === "on") {
      // Comp-halmaz: előbb a gyorsítótárból (→ konzisztens ismételt becslés, kevesebb hívás),
      // különben friss Perplexity-lekérés + eltárolás.
      const cacheKey = compsCacheKey(input);
      let comps: RawComp[] | null = await getCachedComps(cacheKey, engineCfg.cache.comps_days);
      let sources: SonarSource[] = [];
      if (!comps) {
        const { content: compsRaw, sources: s } = await runSonarWithSources(
          buildCompsPrompt(input, engineCfg), PERPLEXITY_MODEL,
          { ...sonarBase, timeoutMs: sonarTimeout() }
        );
        comps = parseCompsJson(compsRaw);
        sources = s;
        if (comps.length) await setCachedComps(cacheKey, comps);
      }
      const res = computeValuation(comps, buildSubject(input), engineCfg);
      if (res.ok) {
        engineAudit = res;
        report = composeEngineReport(res, input, engineCfg) + sourcesSection(sources);
      } else {
        report = await runAiValuation(
          "> Kevés összehasonlító állt rendelkezésre, ezért tájékoztató jellegű, AI-alapú becslés készült.\n\n"
        );
      }
    } else {
      report = await runAiValuation();
    }

    // A partnernek szánt kimenetből kivesszük a belső, módszertani szakaszokat
    // (korlátozások, szűrési/lazítási elvek, kizárt comp-ok) — a PDF-ben ne látszódjanak.
    report = stripHiddenReportSections(report);

    // 2) A generálás SIKERES → MOST vonjuk le a kreditet (admin megkerüli).
    //    Ha közben (a ritka verseny miatt) elfogyott az egyenleg, a riport akkor is
    //    kész — nem dobjuk el, csak nem számlázunk érte.
    if (!bypassed) {
      try {
        const c = await chargeCredit({ userId: user.id, amount: 1 });
        didCharge = c.ok && !c.bypassed;
      } catch {
        // A levonás technikai hibája ne buktassa el a kész riportot.
        didCharge = false;
      }
    }

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
        credits_charged: didCharge ? 1 : 0,
      })
      .select("id")
      .single();
    if (histError) throw new Error(`Előzmény mentés hiba: ${histError.message}`);

    // A motor levezetése (audit) az előzményhez — best-effort (ha a column létezik).
    if (engineAudit && hist?.id) {
      try {
        await admin.from("usage_history").update({ valuation_audit: engineAudit }).eq("id", hist.id);
      } catch { /* a valuation-engine.sql még nem futott — nem gond */ }
    }

    // Nyers API-önköltség logolása (admin-only, best-effort).
    await logCost({
      userId: user.id,
      serviceId: service.id,
      feature: FEATURE,
      serviceName: "perplexity",
      units: 1,
      estimatedCostUsd: perplexityCostUsd(PERPLEXITY_MODEL),
    });

    // A fotó-elemzés (Gemini) nyers költsége — best-effort, admin-only.
    if (photoImages.length > 0 && conditionText) {
      await logCost({
        userId: user.id,
        serviceId: service.id,
        feature: FEATURE,
        serviceName: "gemini-vision",
        units: photoImages.length,
        estimatedCostUsd: 0.03,
      });
    }

    return NextResponse.json({
      ok: true,
      id: hist?.id ?? null,
      report,
      charged: didCharge,
    });
  } catch (err) {
    // Csak akkor térítünk vissza, ha TÉNYLEGESEN levontunk (pl. a levonás után a
    // history-mentés bukott el). Az esetek zömében a hiba a generálás közben jön,
    // amikor még nem vontunk le — ilyenkor nincs mit visszaadni. Így soha nem
    // vész el és nem is duplázódik a kredit.
    if (didCharge) {
      await admin.rpc("wallet_add", { p_user_id: user.id, p_amount: 1 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
