// Comp-alapú, DETERMINISZTIKUS értékbecslő motor.
// A Perplexity CSAK comp-adatot ad; a végső számot ez a tiszta logika adja, az
// adminból hangolható config szerint. Ugyanaz a bemenet → ugyanaz a kimenet
// (ezért konzisztens az 5 futás). Se DB, se hálózat itt — tesztelhető, dry-run-olható.

// --- Config (a valuation_engine_configs.params ezt tükrözi) ------------------
export type EngineConfig = {
  engine: { mode: "off" | "on" }; // "off": a régi AI-becslő fut; "on": comp-alapú motor
  comp: { size_tolerance_pct: number; max_age_months: number; same_district_only: boolean; min_count: number };
  outlier: { method: "median_band" | "iqr" | "mad"; band_pct: number; min_kept: number };
  central: { method: "median" | "weighted" };
  adjust: {
    condition: { felujitando: number; kozepes: number; jo: number; ujszeru: number };
    location_premium_pct: number;
  };
  realism: { bp_min_huf_per_m2: number; asking_to_tx_pct: number; correction_cap_pct: number };
  rounding: { step_huf: number };
  cache: { comps_days: number };
  fallback: { enabled: boolean; min_comps_for_engine: number };
};

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  engine: { mode: "off" },
  comp: { size_tolerance_pct: 20, max_age_months: 6, same_district_only: true, min_count: 5 },
  outlier: { method: "median_band", band_pct: 25, min_kept: 4 },
  central: { method: "median" },
  adjust: { condition: { felujitando: -12, kozepes: 0, jo: 4, ujszeru: 10 }, location_premium_pct: 0 },
  realism: { bp_min_huf_per_m2: 1_000_000, asking_to_tx_pct: -7, correction_cap_pct: 5 },
  rounding: { step_huf: 100_000 },
  cache: { comps_days: 3 },
  fallback: { enabled: true, min_comps_for_engine: 3 },
};

// Beérkező (Perplexity) comp — laza típus, mert a modell néha stringet ad.
export type RawComp = {
  address?: string; district?: string; size_m2?: number | string; price_huf?: number | string;
  price_per_m2?: number | string; rooms?: string; condition?: string; floor?: string;
  listing_date?: string; url?: string; distance_note?: string;
};

export type Comp = {
  address: string; district: string; sizeM2: number; priceHuf: number; pricePerM2: number;
  rooms: string; condition: string; url: string; distanceNote: string; ageMonths: number | null;
};

export type ConditionKey = "felujitando" | "kozepes" | "jo" | "ujszeru";

export type Subject = {
  sizeM2: number;
  conditionKey: ConditionKey;
  locationPremiumPct: number; // a partner által megadott lokációs felár
  photoCorrectionPct: number; // fotó-elemzésből (±), 0 ha nincs
  isBudapest: boolean;
  district: string;
};

export type CompRow = Comp & { kept: boolean; reason: string; weight: number };
export type AdjustStep = { label: string; deltaPct: number; deltaHuf: number };

export type EngineResult = {
  ok: boolean;
  estimateHuf: number;
  lowHuf: number;
  highHuf: number;
  centralPricePerM2: number;
  usedCount: number;
  comps: CompRow[];
  steps: AdjustStep[];
  fellBack: boolean;
  note: string;
};

// --- Segédek ----------------------------------------------------------------
const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v ?? "").replace(/[^\d.,-]/g, "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const median = (xs: number[]): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const roundTo = (v: number, step: number): number => (step > 0 ? Math.round(v / step) * step : Math.round(v));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** allapot / condition szöveg → config-kulcs. */
export function conditionKey(text: string | undefined): ConditionKey {
  const t = (text ?? "").toLowerCase();
  if (/felúj|feluj|rossz|bont/.test(t)) return "felujitando";
  if (/újszer|ujszer|új épít|uj epit|kiváló|kivalo|kitűn|kitun|prémium|premium/.test(t)) return "ujszeru";
  if (/\bjó\b|\bjo\b|szép|szep|rendezett/.test(t)) return "jo";
  return "kozepes";
}

/** Hónapok a "YYYY-MM" / "YYYY.MM" listing_date és a mai dátum között. */
function ageMonths(listing: string | undefined, now = new Date()): number | null {
  const m = String(listing ?? "").match(/(\d{4})[.\-/](\d{1,2})/);
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]);
  if (!y || !mo) return null;
  return (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - mo);
}

/** Nyers comps → tiszta Comp[] (méret, ár, Ft/m² kiszámítva; hiányos kiesik). */
export function normalizeComps(raw: RawComp[]): Comp[] {
  const out: Comp[] = [];
  for (const r of raw ?? []) {
    const size = num(r.size_m2);
    const price = num(r.price_huf);
    let ppm2 = num(r.price_per_m2);
    if (!ppm2 && size && price) ppm2 = price / size;
    if (!ppm2 || !size) continue;
    out.push({
      address: String(r.address ?? "").trim(),
      district: String(r.district ?? "").trim(),
      sizeM2: size,
      priceHuf: price ?? Math.round(ppm2 * size),
      pricePerM2: ppm2,
      rooms: String(r.rooms ?? "").trim(),
      condition: String(r.condition ?? "").trim(),
      url: String(r.url ?? "").trim(),
      distanceNote: String(r.distance_note ?? "").trim(),
      ageMonths: ageMonths(r.listing_date),
    });
  }
  return out;
}

// --- A fő számolás ----------------------------------------------------------
export function computeValuation(rawComps: RawComp[], subject: Subject, cfg: EngineConfig): EngineResult {
  const steps: AdjustStep[] = [];
  const all = normalizeComps(rawComps);

  // 1) Kemény szűrés: méret-tűrés, frissesség, kerület.
  const tol = cfg.comp.size_tolerance_pct / 100;
  const rows: CompRow[] = all.map((c) => {
    let kept = true; let reason = "beszámít";
    if (subject.sizeM2 > 0 && Math.abs(c.sizeM2 - subject.sizeM2) / subject.sizeM2 > tol) {
      kept = false; reason = `méret eltér (>${cfg.comp.size_tolerance_pct}%)`;
    } else if (c.ageMonths !== null && c.ageMonths > cfg.comp.max_age_months) {
      kept = false; reason = `régi hirdetés (>${cfg.comp.max_age_months} hó)`;
    } else if (cfg.comp.same_district_only && subject.district && c.district &&
      c.district.toLowerCase() !== subject.district.toLowerCase()) {
      kept = false; reason = "más kerület";
    }
    return { ...c, kept, reason, weight: 0 };
  });

  // 2) Outlier-trimmelés a megmaradtakon (medián-sáv).
  let pool = rows.filter((r) => r.kept);
  if (pool.length >= 3) {
    const med = median(pool.map((r) => r.pricePerM2));
    const band = cfg.outlier.band_pct / 100;
    const trimmed = pool.filter((r) => Math.abs(r.pricePerM2 - med) / med <= band);
    if (trimmed.length >= cfg.outlier.min_kept) {
      for (const r of pool) {
        if (!trimmed.includes(r)) { r.kept = false; r.reason = `kiugró (medián ${r.pricePerM2 > med ? "+" : "−"}${Math.round(Math.abs(r.pricePerM2 - med) / med * 100)}%)`; }
      }
      pool = trimmed;
    }
  }

  // Fallback jelzés: túl kevés comp → a hívó a régi AI-módra vált.
  if (pool.length < cfg.fallback.min_comps_for_engine) {
    return {
      ok: false, estimateHuf: 0, lowHuf: 0, highHuf: 0, centralPricePerM2: 0,
      usedCount: pool.length, comps: rows, steps, fellBack: true,
      note: `Kevés használható összehasonlító (${pool.length} db) — a motor nem tud stabil árat adni.`,
    };
  }

  // 3) Központi Ft/m² (medián vagy méret-súlyozott).
  let central: number;
  if (cfg.central.method === "weighted") {
    const weights = pool.map((r) => 1 / (1 + Math.abs(r.sizeM2 - subject.sizeM2) / Math.max(1, subject.sizeM2)));
    const wsum = weights.reduce((a, b) => a + b, 0) || 1;
    pool.forEach((r, i) => (r.weight = weights[i] / wsum));
    central = pool.reduce((a, r, i) => a + r.pricePerM2 * weights[i], 0) / wsum;
  } else {
    central = median(pool.map((r) => r.pricePerM2));
    pool.forEach((r) => (r.weight = 1 / pool.length));
  }

  // 4) Nyers érték.
  let value = central * subject.sizeM2;
  steps.push({ label: `Központi ${Math.round(central).toLocaleString("hu-HU")} Ft/m² × ${subject.sizeM2} m²`, deltaPct: 0, deltaHuf: Math.round(value) });

  // 5) Állapot-korrekció (hard).
  const condPct = cfg.adjust.condition[subject.conditionKey] ?? 0;
  if (condPct) { const before = value; value *= 1 + condPct / 100; steps.push({ label: `Állapot (${subject.conditionKey})`, deltaPct: condPct, deltaHuf: Math.round(value - before) }); }

  // 6) Soft korrekció: lokációs prémium (partner + globális) + fotó, ±plafonnal.
  const cap = cfg.realism.correction_cap_pct;
  const softRaw = subject.locationPremiumPct + cfg.adjust.location_premium_pct + subject.photoCorrectionPct;
  const soft = clamp(softRaw, -cap, cap);
  if (soft) { const before = value; value *= 1 + soft / 100; steps.push({ label: `Lokáció + fotó korrekció (±${cap}% plafon)`, deltaPct: soft, deltaHuf: Math.round(value - before) }); }

  // 7) Hirdetési → tranzakciós diszkont (hard).
  if (cfg.realism.asking_to_tx_pct) { const before = value; value *= 1 + cfg.realism.asking_to_tx_pct / 100; steps.push({ label: "Hirdetési → tranzakciós", deltaPct: cfg.realism.asking_to_tx_pct, deltaHuf: Math.round(value - before) }); }

  // 8) Budapesti realitás-küszöb (Ft/m² minimum).
  if (subject.isBudapest && subject.sizeM2 > 0) {
    const floor = cfg.realism.bp_min_huf_per_m2 * subject.sizeM2;
    if (value < floor) { const before = value; value = floor; steps.push({ label: `BP realitás-küszöb (${cfg.realism.bp_min_huf_per_m2.toLocaleString("hu-HU")} Ft/m²)`, deltaPct: Math.round((value / before - 1) * 100), deltaHuf: Math.round(value - before) }); }
  }

  // 9) Kerekítés + prezentációs sáv (±3%).
  const estimate = roundTo(value, cfg.rounding.step_huf);
  const low = roundTo(estimate * 0.97, cfg.rounding.step_huf);
  const high = roundTo(estimate * 1.03, cfg.rounding.step_huf);

  return {
    ok: true, estimateHuf: estimate, lowHuf: low, highHuf: high,
    centralPricePerM2: Math.round(central), usedCount: pool.length,
    comps: rows, steps, fellBack: false,
    note: `${pool.length} összehasonlító alapján, determinisztikus számítással.`,
  };
}
