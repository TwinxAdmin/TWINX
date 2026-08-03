// Perplexity (Sonar) hívás az Ingatlan Értékbecslőhöz.
// A prompt a partner bevált eszközéből származik. A finomítható szegmenseket és a
// zárolt adat-blokkot lásd: lib/valuation.ts (composeValuationPrompt).
import {
  composeValuationPrompt,
  VALUATION_DEFAULT_SEGMENTS,
  type ValuationInput,
} from "@/lib/valuation";

// Alapértelmezett (kód) prompt — más hívók kompatibilitásához.
export function buildValuationPrompt(input: ValuationInput): string {
  return composeValuationPrompt(input, VALUATION_DEFAULT_SEGMENTS);
}

// A valós piackutatáshoz erősebb keresőmodell kell (2x találat, több forrás).
// Env-ből felülírható: pl. sonar-reasoning-pro (analitikus) vagy sonar-deep-research (legmélyebb).
export const PERPLEXITY_MODEL = process.env.PERPLEXITY_MODEL || "sonar-pro";

// Magyar ingatlanpiaci források — ezekre szűkítjük az értékbecslés keresését.
// A Perplexity max 20 domaint fogad el; a sorrend a fontosság szerinti.
// Env-ből felülírható vesszős listával (VALUATION_SEARCH_DOMAINS).
export const HU_PROPERTY_DOMAINS: string[] = (
  process.env.VALUATION_SEARCH_DOMAINS ||
  [
    // Hirdetési portálok — innen jönnek a KONKRÉT ingatlanok
    "ingatlan.com",
    "oc.hu",
    "dh.hu",
    "ingatlannet.hu",
    "ingatlanbazar.hu",
    "jofogas.hu",
    "otthonterkep.hu",
    "startlak.hu",
    "alapkolcson.hu",
    "ingatlantajolo.hu",
    // Piaci elemzések, hivatalos statisztika — a kontroll-adatokhoz
    "ksh.hu",
    "mnb.hu",
    "dunahouse.hu",
    "otthoncentrum.hu",
    "ingatlan.com/elemzes",
    "portfolio.hu",
    "bankmonitor.hu",
  ].join(",")
)
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean);

// A források frissessége. Alapból "year": a hirdetésoldalak publikálási dátuma
// gyakran bizonytalan, egy "month" szűrő könnyen kinullázná a találatokat —
// a 3 hónapos preferenciát a prompt kéri. Env-ből szigorítható.
export const VALUATION_RECENCY = (process.env.VALUATION_SEARCH_RECENCY ||
  "year") as SonarRecency;

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
    throw new Error(`Keresési hiba (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Üres válasz a keresőtől.");
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

export type SonarRecency = "hour" | "day" | "week" | "month" | "year";

// Szinkron hívás egy tetszőleges modellel (pl. sonar-pro a "normál" szinthez).
// opts.disableSearch: webkeresés kikapcsolása (pl. copywritinghez, csak a megadott tények).
// opts.domains: a keresés ezekre a domainekre szűkül (allowlist, max 20 elem).
// opts.recency: a források publikálási ideje ennél frissebb legyen.
export async function runSonar(
  prompt: string,
  model: string,
  opts?: {
    disableSearch?: boolean;
    temperature?: number;
    domains?: string[];
    recency?: SonarRecency;
  }
): Promise<string> {
  const apiKey = apiKeyOrThrow();
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: opts?.temperature ?? 0.2,
  };
  if (opts?.disableSearch) body.disable_search = true;
  // A Perplexity legfeljebb 20 domaint fogad el az allowlistában.
  if (opts?.domains?.length) body.search_domain_filter = opts.domains.slice(0, 20);
  if (opts?.recency) body.search_recency_filter = opts.recency;

  const res = await fetch(`${PPLX_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Keresési hiba (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Üres válasz a keresőtől.");
  return content as string;
}

export type SonarSource = { title: string; url: string; date?: string };

/**
 * Ugyanaz, mint a runSonar, de a felhasznált FORRÁSOKAT is visszaadja.
 * Így a riportban valódi hivatkozások szerepelhetnek (ellenőrizhető adat).
 * A Perplexity a `search_results` (újabb) vagy a `citations` (régebbi) mezőt adja.
 */
export async function runSonarWithSources(
  prompt: string,
  model: string,
  opts?: { temperature?: number; domains?: string[]; recency?: SonarRecency }
): Promise<{ content: string; sources: SonarSource[] }> {
  const apiKey = apiKeyOrThrow();
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: opts?.temperature ?? 0.2,
  };
  if (opts?.domains?.length) body.search_domain_filter = opts.domains.slice(0, 20);
  if (opts?.recency) body.search_recency_filter = opts.recency;

  const res = await fetch(`${PPLX_BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Keresési hiba (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Üres válasz a keresőtől.");

  const sources: SonarSource[] = [];
  const raw = data?.search_results;
  if (Array.isArray(raw)) {
    for (const r of raw) {
      const url = typeof r?.url === "string" ? r.url : "";
      if (!url) continue;
      sources.push({ title: typeof r?.title === "string" ? r.title : url, url, date: r?.date });
    }
  } else if (Array.isArray(data?.citations)) {
    for (const c of data.citations) {
      if (typeof c === "string" && c) sources.push({ title: c, url: c });
    }
  }
  return { content: content as string, sources };
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
    throw new Error(`Keresési hiba (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const id = data?.id;
  if (!id) throw new Error("A kutatás indítása nem adott vissza azonosítót.");
  return id as string;
}

export type SonarAsyncResult =
  | { status: "processing"; raw?: string }
  | { status: "completed"; content: string }
  | { status: "failed"; error: string };

// A válaszból kinyerhető szöveges tartalom többféle helyről (robusztus a formátumra).
function extractSonarContent(data: unknown): string {
  const d = (data ?? {}) as Record<string, unknown>;
  const resp = (d.response ?? {}) as Record<string, unknown>;
  const fromChoices = (o: Record<string, unknown>) => {
    const ch = o.choices as Array<Record<string, unknown>> | undefined;
    const msg = ch?.[0]?.message as Record<string, unknown> | undefined;
    return typeof msg?.content === "string" ? (msg.content as string) : "";
  };
  return (
    fromChoices(resp) ||
    fromChoices(d) ||
    (typeof resp.output_text === "string" ? (resp.output_text as string) : "") ||
    (typeof d.output_text === "string" ? (d.output_text as string) : "")
  );
}

// Async állapot lekérdezése request id alapján. A státuszt kis/nagybetűtől függetlenül
// értékeljük (a Perplexity hol nagy-, hol kisbetűs státuszt ad vissza).
export async function getSonarAsync(requestId: string): Promise<SonarAsyncResult> {
  const apiKey = apiKeyOrThrow();
  const res = await fetch(`${PPLX_BASE}/v1/async/sonar/${encodeURIComponent(requestId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kutatás-lekérdezés hiba (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const status = String(data?.status ?? "").toUpperCase();

  if (status === "COMPLETED" || status === "COMPLETE" || status === "SUCCEEDED") {
    const content = extractSonarContent(data);
    if (!content) return { status: "failed", error: "Üres válasz a kutatástól." };
    return { status: "completed", content };
  }
  if (status === "FAILED" || status === "ERROR" || status === "CANCELLED") {
    return { status: "failed", error: (data?.error_message as string) ?? "A kutatás sikertelen." };
  }
  // CREATED | IN_PROGRESS | PROCESSING | QUEUED | egyéb → még fut
  return { status: "processing", raw: status || "PROCESSING" };
}
