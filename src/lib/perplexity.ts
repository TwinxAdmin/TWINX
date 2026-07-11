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
