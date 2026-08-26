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
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateValuationInput, type ValuationInput } from "@/lib/valuation";
import { checkCreditAvailable } from "@/lib/credits";
import {
  submitSonarAsync,
  PERPLEXITY_MODEL,
  HU_PROPERTY_DOMAINS,
  VALUATION_RECENCY,
} from "@/lib/perplexity";
import { finalizeValuation } from "@/lib/valuation-finalize";
import { buildValuationPromptActive } from "@/lib/prompts";
import {
  analyzePropertyPhotos,
  renderConditionBlock,
  type VisionImage,
} from "@/lib/property-vision";
import { computeValuation } from "@/lib/valuation-engine";
import {
  loadActiveEngineConfig, buildCompsPrompt, buildSubject, composeEngineReport,
  compsCacheKey, getCachedComps,
} from "@/lib/valuation-engine-server";
import { type RawComp } from "@/lib/valuation-engine";

export const runtime = "nodejs";
// A Perplexity-hívás hosszú lehet, és a motoros ág KÉT hívást tehet egymás után
// (comp-lekérés → AI-tartalék). Vercel PRO alatt a plafon 300 mp; 180-at használunk,
// hogy legyen bőven keret, de a partner se várjon értelmetlenül sokat.
// A belső `deadline`/`sonarTimeout` ezzel arányosan van beállítva (route törzsében).
export const maxDuration = 180;

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

    // ---- ASZINKRON ÚT: beküldjük a kérést a Perplexity async végpontjára, és
    //      csak egy JOB-ot hozunk létre. A partner NEM vár a HTTP-kérésben →
    //      soha nincs platform-időkorlát. A kliens a /status végponton pollingoz.
    const stage: "comps" | "ai" = engineOn ? "comps" : "ai";
    const prompt = engineOn
      ? buildCompsPrompt(input, engineCfg)
      : await buildValuationPromptActive(input, conditionText);
    const requestId = await submitSonarAsync(prompt, PERPLEXITY_MODEL, sonarOpts);

    const { data: job, error: jobError } = await admin
      .from("valuation_jobs")
      .insert({
        user_id: user.id,
        service_id: service.id,
        status: "processing",
        input_data: { input, conditionText: conditionText ?? null, stage, photoCount: photoImages.length },
        request_id: requestId,
        credits_charged: 0, // a levonás CSAK a kész riportnál (status végpont)
      })
      .select("id")
      .single();
    if (jobError || !job) throw new Error(jobError?.message ?? "A job létrehozása nem sikerült.");

    return NextResponse.json({ ok: true, jobId: job.id, async: true });
  } catch (err) {
    // Itt még SOHA nem vontunk le kreditet (a levonás a kész riportnál történik),
    // ezért nincs mit visszatéríteni.
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
