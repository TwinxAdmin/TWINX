// Szerver-oldali kötőréteg a comp-alapú értékbecslő motorhoz:
// - aktív config betöltése a DB-ből (fallback a beépített alapértékre),
// - a Perplexitytől kért JSON-only comps prompt,
// - a válasz JSON-comps kinyerése,
// - a ValuationInput → Subject leképezés,
// - a motor eredményéből szerkeszthető (a riport-parserrel kompatibilis) markdown.
import { createAdminClient } from "@/lib/supabase/admin";
import { type ValuationInput } from "@/lib/valuation";
import {
  DEFAULT_ENGINE_CONFIG, conditionKey, computeValuation, normalizeComps,
  type EngineConfig, type RawComp, type Subject, type EngineResult,
} from "@/lib/valuation-engine";

/** Aktív config a DB-ből; hiányzó csoportokat a beépített alapértékkel pótol. */
export async function loadActiveEngineConfig(): Promise<EngineConfig> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("valuation_engine_configs")
      .select("params")
      .eq("is_active", true)
      .maybeSingle();
    const p = (data?.params ?? {}) as Partial<EngineConfig>;
    const d = DEFAULT_ENGINE_CONFIG;
    return {
      engine: { ...d.engine, ...p.engine },
      comp: { ...d.comp, ...p.comp },
      outlier: { ...d.outlier, ...p.outlier },
      central: { ...d.central, ...p.central },
      adjust: { condition: { ...d.adjust.condition, ...p.adjust?.condition }, location_premium_pct: p.adjust?.location_premium_pct ?? d.adjust.location_premium_pct },
      realism: { ...d.realism, ...p.realism },
      rounding: { ...d.rounding, ...p.rounding },
      cache: { ...d.cache, ...p.cache },
      fallback: { ...d.fallback, ...p.fallback },
    };
  } catch {
    return DEFAULT_ENGINE_CONFIG;
  }
}

function parseSize(meret: string): number {
  const m = String(meret ?? "").match(/\d+([.,]\d+)?/);
  return m ? Number(m[0].replace(",", ".")) : 0;
}

/** "Budapest XIII. kerület" / "13. kerület" → kerület-jelölés a comp-szűréshez. */
function districtOf(telepules: string): string {
  const t = String(telepules ?? "");
  const roman = t.match(/\b([IVXLC]{1,6})\.?\s*ker/i);
  if (roman) return roman[1].toUpperCase();
  const arab = t.match(/\b(\d{1,2})\.?\s*ker/i);
  if (arab) return arab[1];
  return "";
}

export function buildSubject(input: ValuationInput, photoCorrectionPct = 0): Subject {
  return {
    sizeM2: parseSize(input.meret),
    conditionKey: conditionKey(input.allapot),
    locationPremiumPct: Number(String(input.lokacioSzazalek ?? "").replace(/[^\d.-]/g, "")) || 0,
    photoCorrectionPct,
    isBudapest: /budapest/i.test(input.telepules),
    district: districtOf(input.telepules),
  };
}

/** A Perplexitynek adott prompt: KIZÁRÓLAG comp-adatokat kérünk, JSON-ban. */
export function buildCompsPrompt(input: ValuationInput, cfg: EngineConfig): string {
  const size = parseSize(input.meret);
  const tol = cfg.comp.size_tolerance_pct;
  const hely = [input.telepules, input.utca].filter(Boolean).join(", ");
  return [
    "Te egy magyar ingatlanpiaci adatgyűjtő vagy. NE becsülj árat, NE írj elemzést.",
    `Keress ${Math.max(cfg.comp.min_count + 5, 12)} db, a megadotthoz HASONLÓ eladó vagy nemrég eladott ingatlant a következő helyszín KÖRNYÉKÉN: ${hely}.`,
    `Az ingatlan: ${input.tipus || "lakás"}, kb. ${size} m², ${input.szobak || "?"} szoba.`,
    `Hasonlóság: azonos településrész/kerület, azonos típus, méret kb. ±${tol}%. Csak KONKRÉT hirdetéseket/eladásokat használj, ne általános cikkeket.`,
    "A válaszod KIZÁRÓLAG egyetlen JSON objektum legyen, más szöveg nélkül:",
    `{"comps":[{"address":"","district":"","size_m2":0,"price_huf":0,"price_per_m2":0,"rooms":"","condition":"","floor":"","listing_date":"YYYY-MM","url":"","distance_note":""}],"notes":""}`,
    "Fontos: minden comphoz adj forrás-URL-t; ha egy mezőt nem tudsz, hagyd üresen/0. Ne találj ki adatot.",
  ].join("\n");
}

/** A Perplexity szövegéből kinyeri a comps tömböt (kódblokk / körítő szöveg tűrve). */
export function parseCompsJson(raw: string): RawComp[] {
  let t = String(raw ?? "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start >= 0 && end > start) t = t.slice(start, end + 1);
  try {
    const o = JSON.parse(t) as { comps?: RawComp[] };
    return Array.isArray(o.comps) ? o.comps : [];
  } catch {
    return [];
  }
}

const ft = (n: number) => `${Math.round(n).toLocaleString("hu-HU")} Ft`;

/** A motor eredményéből a riport-parserrel kompatibilis, szerkeszthető markdown. */
export function composeEngineReport(res: EngineResult, input: ValuationInput): string {
  const used = res.comps.filter((c) => c.kept);
  const size = parseSize(input.meret);
  const lines: string[] = [];
  lines.push(`## Becsült piaci érték`, ft(res.estimateHuf), "");
  lines.push(`## Értéksáv`, `${ft(res.lowHuf)} – ${ft(res.highHuf)}`, "");
  lines.push(`## Átlagos nm-ár`, `${res.centralPricePerM2.toLocaleString("hu-HU")} Ft/m²`, "");
  lines.push(
    `## Rövid összefoglaló`,
    `A becslés ${used.length} hasonló, a környéken talált ingatlan négyzetméterárának mediánjából indul (${res.centralPricePerM2.toLocaleString("hu-HU")} Ft/m²), amelyet a lakás mérete (${size} m²), állapota és a piaci korrekciók módosítanak. A számítás determinisztikus és átlátható — a levezetés lentebb látható.`,
    "",
  );
  lines.push(`## Összehasonlító ingatlanok`);
  for (const c of used) {
    lines.push(`- ${c.address || "ismeretlen cím"} · ${c.sizeM2} m² · ${Math.round(c.pricePerM2).toLocaleString("hu-HU")} Ft/m²${c.condition ? ` · ${c.condition}` : ""}`);
  }
  lines.push("");
  lines.push(`## Számítás levezetése`);
  for (const s of res.steps) {
    const pctTxt = s.deltaPct ? ` (${s.deltaPct > 0 ? "+" : ""}${s.deltaPct}%)` : "";
    const hufTxt = s.deltaHuf === 0 ? "" : `: ${s.deltaHuf > 0 ? "+" : ""}${ft(s.deltaHuf)}`;
    lines.push(`- ${s.label}${pctTxt}${hufTxt}`);
  }
  const excluded = res.comps.filter((c) => !c.kept);
  if (excluded.length) {
    lines.push("", `## Kizárt összehasonlítók`);
    for (const c of excluded) lines.push(`- ${c.address || "ismeretlen"} — ${c.reason}`);
  }
  return lines.join("\n");
}
