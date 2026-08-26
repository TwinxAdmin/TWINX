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

// ADATFORRÁS: elsődlegesen a GDN Ingatlan iroda kínálata (gdn-ingatlan.hu) és a
// jelenleg aktív ingatlan.com hirdetések (comps-lista), kiegészítésként pedig a
// nyilvános piaci statisztikák és szakmai elemzések (ellenőrzés, árszint-beágyazás,
// outlier-szűrés). A Perplexity max 20 domaint fogad el; a GDN áll elöl, hogy az
// aktív GDN-prompt a saját kínálatból induljon (a régi prompt is használhatja).
export const LISTING_DOMAINS = ["gdn-ingatlan.hu", "ingatlan.com"];

export const MARKET_ANALYSIS_DOMAINS = [
  "ksh.hu", // KSH lakáspiaci jelentések
  "mnb.hu", // MNB lakásárindex
  "dunahouse.hu", // Duna House Barométer
  "otthoncentrum.hu", // OC piaci körkép
  "otthonterkep.hu", // nyilvános kerületi átlagár-térkép
  "ingatlannet.hu", // ár-statisztikák
  "portfolio.hu",
  "bankmonitor.hu",
  "penzcentrum.hu",
  "ingatlanhirek.hu",
];

// Az értékbecslés keresési köre. Env-ből felülírható vesszős listával.
export const HU_PROPERTY_DOMAINS: string[] = (
  process.env.VALUATION_SEARCH_DOMAINS ||
  [...LISTING_DOMAINS, ...MARKET_ANALYSIS_DOMAINS].join(",")
)
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean);

// A források frissessége: alapból az ELMÚLT 1 ÉV ("year") — így nem jöhet vissza régi
// (pl. 2014-es) forrás. Env-ből felülírható (pl. "month" szigorúbbra, vagy "" a szűrő ki).
export const VALUATION_RECENCY = ((process.env.VALUATION_SEARCH_RECENCY ?? "year") || "") as
  | SonarRecency
  | "";

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
  opts?: { temperature?: number; domains?: string[]; recency?: SonarRecency; timeoutMs?: number }
): Promise<{ content: string; sources: SonarSource[] }> {
  const apiKey = apiKeyOrThrow();
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: opts?.temperature ?? 0.2,
  };
  if (opts?.domains?.length) body.search_domain_filter = opts.domains.slice(0, 20);
  if (opts?.recency) body.search_recency_filter = opts.recency;

  // Belső időkorlát: a hívás előbb dobjon tiszta hibát, mint hogy a szerverless
  // futásidő-limit megölje a folyamatot (így a hívó catch-ága lefut — pl. kredit-visszatérítés).
  const ctrl = new AbortController();
  const timeoutMs = opts?.timeoutMs ?? 0;
  const timer = timeoutMs > 0 ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  let res: Response;
  try {
    res = await fetch(`${PPLX_BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") {
      throw new Error(`Az adatlekérés túllépte az időkorlátot (${Math.round(timeoutMs / 1000)} mp).`);
    }
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
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
export async function submitSonarAsync(
  prompt: string,
  model: string,
  opts?: { temperature?: number; domains?: string[]; recency?: SonarRecency }
): Promise<string> {
  const apiKey = apiKeyOrThrow();
  const req: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: opts?.temperature ?? 0.2,
  };
  // Ugyanazok a szűkítések, mint a szinkron ágon (magyar ingatlanportálok, frissesség).
  if (opts?.domains?.length) req.search_domain_filter = opts.domains;
  if (opts?.recency) req.search_recency_filter = opts.recency;

  const res = await fetch(`${PPLX_BASE}/v1/async/sonar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ request: req }),
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
  | { status: "completed"; content: string; sources: SonarSource[] }
  | { status: "failed"; error: string };

/** Forrás-lista kinyerése az async válaszból (ugyanaz a formátum, mint szinkronban). */
function extractSonarSources(data: unknown): SonarSource[] {
  const d = (data ?? {}) as Record<string, unknown>;
  const resp = (d.response ?? {}) as Record<string, unknown>;
  const out: SonarSource[] = [];
  const raw = (resp.search_results ?? d.search_results) as unknown;
  if (Array.isArray(raw)) {
    for (const r of raw as Array<Record<string, unknown>>) {
      const url = typeof r?.url === "string" ? r.url : "";
      if (!url) continue;
      out.push({ title: typeof r?.title === "string" ? r.title : url, url, date: r?.date as string | undefined });
    }
    return out;
  }
  const cites = (resp.citations ?? d.citations) as unknown;
  if (Array.isArray(cites)) {
    for (const c of cites) if (typeof c === "string" && c) out.push({ title: c, url: c });
  }
  return out;
}

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
    return { status: "completed", content, sources: extractSonarSources(data) };
  }
  if (status === "FAILED" || status === "ERROR" || status === "CANCELLED") {
    return { status: "failed", error: (data?.error_message as string) ?? "A kutatás sikertelen." };
  }
  // CREATED | IN_PROGRESS | PROCESSING | QUEUED | egyéb → még fut
  return { status: "processing", raw: status || "PROCESSING" };
}
