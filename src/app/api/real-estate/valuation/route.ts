// POST /api/real-estate/valuation — Ingatlan Értékbecslő BEKÜLDÉS (aszinkron).
//
// MIÉRT ASZINKRON: a Perplexity válasza néha percekig tart, és egy HTTP-kérésben
// kivárva a hosting platform (Vercel) időkorlátjába futottunk. Mostantól:
//   1) validáció + fotó-elemzés + kredit-FEDEZET ellenőrzés (levonás NÉLKÜL),
//   2) ha a comp-halmaz gyorsítótárban van → a riport AZONNAL elkészül (gyors út),
//   3) különben a kérés a Perplexity async végpontjára megy, és csak egy JOB jön
//      létre → a kliens a /status végponton pollingoz. Így a partner SOHA nem
//      ütközik időkorlátba, és el is navigálhat: a kész riport az előzményekbe kerül.
//
// KREDIT: a levonás CSAK kész riport esetén (lásd lib/valuation-finalize.ts).
// A PDF-et NEM itt készítjük: a partner előbb szerkeszti a riportot, és a
// böngésző rendereli a végleges dokumentumot (lásd ./save).
import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateValuationInput, type ValuationInput } from "@/lib/valuation";
import { checkCreditAvailable } from "@/lib/credits";
import {
  runSonarWithSources,
  PERPLEXITY_MODEL,
  HU_PROPERTY_DOMAINS,
  VALUATION_RECENCY,
} from "@/lib/perplexity";
import { finalizeValuation, sourcesSection } from "@/lib/valuation-finalize";
import { buildValuationPromptActive } from "@/lib/prompts";
import {
  analyzePropertyPhotos,
  renderConditionBlock,
  type VisionImage,
} from "@/lib/property-vision";
import { computeValuation, type EngineResult } from "@/lib/valuation-engine";
import {
  loadActiveEngineConfig, buildCompsPrompt, buildSubject, parseCompsJson, composeEngineReport,
  compsCacheKey, getCachedComps, setCachedComps,
} from "@/lib/valuation-engine-server";
import { type RawComp } from "@/lib/valuation-engine";

export const runtime = "nodejs";
// A Perplexity-hívás hosszú lehet, és a motoros ág KÉT hívást tehet egymás után
// (comp-lekérés → AI-tartalék). Vercel PRO alatt a plafon 300 mp; 180-at használunk,
// hogy legyen bőven keret, de a partner se várjon értelmetlenül sokat.
// A belső `deadline`/`sonarTimeout` ezzel arányosan van beállítva (route törzsében).
export const maxDuration = 300; // a háttérlánc (after) eddig futhat — Vercel Pro plafon

const SERVICE_SLUG = "real-estate";

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

  try {
    // Fotó-alapú állapotértékelés (opcionális): ha jött fotó, gépi képelemzés →
    // strukturált állapot-blokk, amit a modell a lakás-korrekcióknál használ (±5% plafon).
    let conditionText: string | undefined;
    if (photoImages.length > 0) {
      const rep = await analyzePropertyPhotos(photoImages);
      if (rep) conditionText = renderConditionBlock(rep);
    }

    const engineCfg = await loadActiveEngineConfig();
    const engineOn = engineCfg.engine.mode === "on";

    const sonarOpts = {
      temperature: 0.1,
      domains: HU_PROPERTY_DOMAINS,
      recency: VALUATION_RECENCY || undefined,
    } as const;

    // ---- GYORS ÚT: ha a comp-halmaz már a gyorsítótárban van, nincs szükség
    //      Perplexity-hívásra → a riport AZONNAL elkészül, nincs várakozás.
    if (engineOn) {
      const cacheKey = compsCacheKey(input);
      const cached: RawComp[] | null = await getCachedComps(cacheKey, engineCfg.cache.comps_days);
      if (cached && cached.length) {
        const res = computeValuation(cached, buildSubject(input), engineCfg);
        if (res.ok) {
          const fin = await finalizeValuation({
            userId: user.id, serviceId: service.id, input,
            report: composeEngineReport(res, input, engineCfg),
            engineAudit: res, bypassed, photoCount: photoImages.length,
          });
          return NextResponse.json({ ok: true, id: fin.id, report: fin.report, charged: fin.charged });
        }
      }
    }

    // ---- HÁTTÉR-FELDOLGOZÁS: azonnal létrehozunk egy JOB-ot és VISSZATÉRÜNK.
    //      A tényleges (hosszú) Perplexity-lánc az `after()`-ben fut tovább, MIUTÁN
    //      a partner már megkapta a választ → a böngésző semmire nem vár, tehát
    //      SOHA nincs időkorlát-élmény. A kliens a /status végponton pollingoz.
    //      (A Perplexity async API-ja csak sonar-deep-research-t támogat, ezért
    //      a sima `sonar` modellt itt szinkron hívjuk — csak épp a háttérben.)
    const { data: job, error: jobError } = await admin
      .from("valuation_jobs")
      .insert({
        user_id: user.id,
        service_id: service.id,
        status: "processing",
        input_data: { input, conditionText: conditionText ?? null, photoCount: photoImages.length },
        credits_charged: 0, // a levonás CSAK a kész riportnál
      })
      .select("id")
      .single();
    if (jobError || !job) throw new Error(jobError?.message ?? "A job létrehozása nem sikerült.");

    const jobId = job.id as string;
    const userId = user.id;
    const serviceId = service.id as string;

    after(async () => {
      const bg = createAdminClient();
      try {
        let report: string;
        let engineAudit: EngineResult | null = null;

        if (engineOn) {
          // 1) Comp-lekérés. HA nem jön értelmezhető comp, EGYSZER újrapróbáljuk —
          //    a legtöbb üres találat átmeneti (formátum-hiba, elakadt keresés).
          //    Ez azért fontos, mert comp nélkül szabadfutású AI-becslés jönne,
          //    ami futásonként MÁS árat ad (61 M / 78 M / 85 M ugrálás).
          let comps: RawComp[] = [];
          let sources: Awaited<ReturnType<typeof runSonarWithSources>>["sources"] = [];
          for (let attempt = 0; attempt < 2; attempt++) {
            const r = await runSonarWithSources(
              buildCompsPrompt(input, engineCfg), PERPLEXITY_MODEL, sonarOpts
            );
            comps = parseCompsJson(r.content);
            sources = r.sources;
            if (comps.length) break;
          }
          if (comps.length) {
            try { await setCachedComps(compsCacheKey(input), comps); } catch { /* cache best-effort */ }
          }

          const calc = computeValuation(comps, buildSubject(input), engineCfg);
          if (calc.ok) {
            // A motor akkor is determinisztikusan számol, ha kevés a comp — ilyenkor
            // csak tágabb sávot és jelzést kapunk (calc.lowConfidence), de a szám STABIL.
            engineAudit = calc;
            const prefix = calc.lowConfidence
              ? "> Kevesebb összehasonlító állt rendelkezésre, ezért az érték tájékoztató jellegű, tágabb értéksávval. A számítás így is determinisztikus.\n\n"
              : "";
            report = prefix + composeEngineReport(calc, input, engineCfg) + sourcesSection(sources);
          } else {
            // Ide már CSAK akkor jutunk, ha EGYETLEN használható comp sincs.
            const r = await runSonarWithSources(
              await buildValuationPromptActive(input, conditionText), PERPLEXITY_MODEL, sonarOpts
            );
            report =
              "> Nem találtunk használható összehasonlító ingatlant, ezért tájékoztató jellegű, AI-alapú becslés készült. Az érték nagyobb bizonytalanságot hordoz.\n\n" +
              r.content + sourcesSection(r.sources);
          }
        } else {
          const r = await runSonarWithSources(
            await buildValuationPromptActive(input, conditionText), PERPLEXITY_MODEL, sonarOpts
          );
          report = r.content + sourcesSection(r.sources);
        }

        // KÉSZ riport → kredit levonása (CSAK itt!) + mentés az előzményekbe.
        const fin = await finalizeValuation({
          userId, serviceId, input, report, engineAudit, bypassed, photoCount: photoImages.length,
        });
        await bg.from("valuation_jobs").update({
          status: "done", report: fin.report, credits_charged: fin.charged ? 1 : 0,
        }).eq("id", jobId);
      } catch (err) {
        // Hiba: a job "failed" lesz — kreditet SOHA nem vontunk le idáig.
        await bg.from("valuation_jobs")
          .update({ status: "failed", error: (err as Error).message })
          .eq("id", jobId);
      }
    });

    return NextResponse.json({ ok: true, jobId, async: true });
  } catch (err) {
    // Itt még SOHA nem vontunk le kreditet (a levonás a kész riportnál történik),
    // ezért nincs mit visszatéríteni.
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
