// Perplexity (Sonar) hívás az Ingatlan Értékbecslőhöz.
// A prompt a partner bevált eszközéből származik (szó szerint). Üres mező -> "[Nincs megadva]".
import type { ValuationInput } from "@/lib/valuation";

function v(value: string): string {
  const t = String(value ?? "").trim();
  return t.length > 0 ? t : "[Nincs megadva]";
}

export function buildValuationPrompt(input: ValuationInput): string {
  return `Bújj egy tapasztalt, adatalapú ingatlanpiaci szakértő szerepébe. Száraz, tényszerű, strukturált elemzést várok tőled. A válaszodban NE utalj a szemléletedre, a stílusodra, és ne használj olyan kifejezéseket a saját elemzésedre, mint "reális", "óvatos" vagy "pesszimista" – csak a tiszta adatokat és a végeredményt add meg a kért formátumban. Ne írj felesleges körítést vagy bevezetőt.

Feladat: Készíts ingatlan-értékbecslést az alábbi paraméterekkel rendelkező ingatlanról.

Keresési és elemzési instrukciók (ezt a háttérben végezd el):
1. LOKÁCIÓ ÉS KERESÉS: Az összehasonlító ingatlanok felkutatásakor szigorúan tartsd be az alábbi földrajzi szabályokat:
   - Ha Budapest: Csak és kizárólag az adott kerületen belül keress.
   - Ha Pest megye (vagy egyéb agglomeráció/vidék): Csak az adott települést és a közvetlenül szomszédos településeket veheted figyelembe.
   - Mikrolokáció ellenőrzés: Ha meg van adva városrész és utca, a háttérben többszörösen ellenőrizd le, hogy a megadott utca valóban abba a városrészbe esik-e. Az összehasonlításhoz csak azonos megítélésű és árfekvésű városrészből hozz példákat.
2. ELEMZÉS: A háttérben vizsgálj meg pontosan tizenöt darab (15 db) releváns összehasonlító ingatlant (semmiképp se téveszd össze a darabszámot Budapest 15. kerületével!).
3. ÁRELLENŐRZÉS: Első lépésként vizsgáld meg a kapott árakat. Zárd ki az irreálisan magas vagy alacsony (outlier) hirdetéseket. Ha a megmaradt adatokból számolt átlagár jelentősen eltér a normál piaci trendektől, futtasd le újra a keresést és finomítsd a számítást a legtisztább adatok alapján.

Az értékelt ingatlan adatai:
- Település, kerület/környék: ${v(input.telepules)}
- Pontosabb helyszín/utca: ${v(input.utca)}
- Típus: ${v(input.tipus)}
- Méret (lakóterület): ${v(input.meret)}
- Telek terület: ${v(input.telek)}
- Szintek száma / Épület szintje: ${v(input.szint)}
- Szobák száma: ${v(input.szobak)}
- Fürdőszobák/mellékhelyiségek száma: ${v(input.furdok)}
- Építés éve: ${v(input.epitesEve)}
- Szerkezet: ${v(input.szerkezet)}
- Műszaki és esztétikai állapot: ${v(input.allapot)}
- Fűtésrendszer és energetika: ${v(input.futes)}
- Jogi háttér / Tulajdoni viszonyok: ${v(input.jogi)}
- Egyéb főbb jellemzők/extrák: ${v(input.egyeb)}

Kimeneti struktúra (kérlek, SZIGORÚAN ezt a formát kövesd, rövid, vázlatpontos formában):

1. RÖVID ÖSSZEFOGLALÓ: (2-3 mondat a lokáció aktuális piaci helyzetéről).
2. 5 DB HASONLÓ INGATLAN: (Az elemzett 15 darabból a legrelevánsabb 5 darab listája. Tartalmazza: méret, állapot, irányár, becsült eladási idő).
3. PIACI ÁR: (HUF)
4. ÁTLAGOS NÉGYZETMÉTERÁR: (HUF/nm)
5. GYORS ELADÁSI ÁR: (Az az ár, amin 2-3 hónapon belül biztosan likvidálható, HUF).
6. VÁRHATÓ ELADÁSI IDŐ: (Hónapban megadva, normál piaci áron).
7. SWOT-ANALÍZIS: (Csak tömör kulcsszavas felsorolás a 4 ponthoz).
8. ÖSSZEGZÉS: (1-2 mondatos tényszerű konklúzió az eladhatóságról).`;
}

// A valós piackutatáshoz erősebb keresőmodell kell (2x találat, több forrás).
// Env-ből felülírható: pl. sonar-reasoning-pro (analitikus) vagy sonar-deep-research (legmélyebb).
export const PERPLEXITY_MODEL = process.env.PERPLEXITY_MODEL || "sonar-pro";

export async function runValuation(input: ValuationInput): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("Hiányzó PERPLEXITY_API_KEY.");

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: PERPLEXITY_MODEL,
      messages: [{ role: "user", content: buildValuationPrompt(input) }],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Perplexity hiba (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Üres válasz a Perplexity API-tól.");
  return content as string;
}

// =====================================================================
// Generikus Sonar hívások (Telek értékbecslés + újrahasználható más modulokhoz)
// =====================================================================
const PPLX_BASE = "https://api.perplexity.ai";

function apiKeyOrThrow(): string {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("Hiányzó PERPLEXITY_API_KEY.");
  return apiKey;
}

// Szinkron hívás egy tetszőleges modellel (pl. sonar-pro a "normál" szinthez).
// opts.disableSearch: webkeresés kikapcsolása (pl. copywritinghez, csak a megadott tények).
export async function runSonar(
  prompt: string,
  model: string,
  opts?: { disableSearch?: boolean; temperature?: number }
): Promise<string> {
  const apiKey = apiKeyOrThrow();
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: opts?.temperature ?? 0.2,
  };
  if (opts?.disableSearch) body.disable_search = true;

  const res = await fetch(`${PPLX_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Perplexity hiba (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Üres válasz a Perplexity API-tól.");
  return content as string;
}

// Aszinkron beküldés (pl. sonar-deep-research a "magas" szinthez).
// Visszaadja a Perplexity request id-t, amivel később lekérdezhető az állapot.
export async function submitSonarAsync(prompt: string, model: string): Promise<string> {
  const apiKey = apiKeyOrThrow();
  const res = await fetch(`${PPLX_BASE}/v1/async/sonar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      request: {
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Perplexity async hiba (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const id = data?.id;
  if (!id) throw new Error("A Perplexity async válasz nem tartalmaz request id-t.");
  return id as string;
}

export type SonarAsyncResult =
  | { status: "processing" }
  | { status: "completed"; content: string }
  | { status: "failed"; error: string };

// Async állapot lekérdezése request id alapján.
export async function getSonarAsync(requestId: string): Promise<SonarAsyncResult> {
  const apiKey = apiKeyOrThrow();
  const res = await fetch(`${PPLX_BASE}/v1/async/sonar/${encodeURIComponent(requestId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Perplexity async lekérdezés hiba (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const status = data?.status as string | undefined;

  if (status === "COMPLETED") {
    const content = data?.response?.choices?.[0]?.message?.content;
    if (!content) return { status: "failed", error: "Üres válasz a Perplexity async API-tól." };
    return { status: "completed", content: content as string };
  }
  if (status === "FAILED") {
    return { status: "failed", error: data?.error_message ?? "A kutatás sikertelen." };
  }
  // CREATED | IN_PROGRESS | egyéb
  return { status: "processing" };
}
