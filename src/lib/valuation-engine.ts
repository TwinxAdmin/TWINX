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
    condition: {
      bontando: number;    // bontandó / szerkezetkész — a legnagyobb diszkont
      felujitando: number; // felújítandó
      kozepes: number;     // közepes (viszonyítási alap: 0%)
      jo: number;          // jó, azonnal költözhető
      ujszeru: number;     // újszerű / felújított
      premium: number;     // kiváló, prémium, új építésű kulcsrakész
    };
    /** A comp-ok nm-árát visszaszámoljuk „közepes" állapotra, mielőtt mediánt veszünk. */
    normalize_comps_by_condition: boolean;
    /** Extra fürdőszoba (az elsőn felül) felára. */
    extra_bathroom_pct: number;
    /** Külön WC (mellékhelyiség) felára, darabonként. */
    separate_wc_pct: number;
    /** Szoba-sűrűség: ha az adott m²-hez sok/kevés a szoba, ennyivel korrigálunk (±). */
    room_density_pct: number;
    /** Nagy terasz (a küszöb feletti nm) felára — az erkély alapfelárán FELÜL. */
    large_terrace_pct: number;
    /** Ekkora nm felett számít nagy terasznak. */
    large_terrace_threshold_m2: number;
    /** Építési év szerinti korrekció. */
    year_new_pct: number;      // 2010 után
    year_mid_pct: number;      // 1980-2010
    year_old_pct: number;      // 1980 előtt
    /** Fűtés / energetika szerinti korrekció. */
    heating_modern_pct: number;      // hőszivattyú, padlófűtés
    heating_convector_pct: number;   // gázkonvektor, elektromos fűtőpanel
    heating_district_flat_pct: number; // távfűtés átalánydíjas (nem mérhető)
    location_premium_pct: number;
    floor_ground_pct: number;      // földszint (jellemzően diszkont)
    floor_basement_pct: number;    // SZUTERÉN / alagsor (erős diszkont, a földszint HELYETT)
    floor_high_nolift_pct: number; // magas emelet lift NÉLKÜL (diszkont)
    lift_pct: number;              // van lift (felár)
    balcony_pct: number;           // van erkély/terasz (felár)
  };
  realism: { bp_min_huf_per_m2: number; asking_to_tx_pct: number; correction_cap_pct: number };
  rounding: { step_huf: number };
  cache: { comps_days: number };
  fallback: { enabled: boolean; min_comps_for_engine: number };
};

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  engine: { mode: "on" },
  comp: { size_tolerance_pct: 20, max_age_months: 12, same_district_only: true, min_count: 5 },
  outlier: { method: "median_band", band_pct: 25, min_kept: 4 },
  central: { method: "median" },
  adjust: {
    // Állapot-szorzók. A magyar piacon a felújítandó és a prémium ingatlan
    // között jellemzően 35-50% a különbség — a korábbi −12…+10 sáv ehhez képest
    // túl szűk volt, ezért a prémium alig kapott többet a közepesnél.
    condition: { bontando: -30, felujitando: -18, kozepes: 0, jo: 6, ujszeru: 14, premium: 24 },
    normalize_comps_by_condition: true,
    extra_bathroom_pct: 3,
    separate_wc_pct: 1.5,
    room_density_pct: 4,
    large_terrace_pct: 3,
    large_terrace_threshold_m2: 15,
    year_new_pct: 5, year_mid_pct: 0, year_old_pct: -4,
    heating_modern_pct: 4, heating_convector_pct: -4, heating_district_flat_pct: -3,
    location_premium_pct: 0,
    floor_ground_pct: -3, floor_basement_pct: -20, floor_high_nolift_pct: -5, lift_pct: 2, balcony_pct: 3,
  },
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

export type ConditionKey = "bontando" | "felujitando" | "kozepes" | "jo" | "ujszeru" | "premium";

export type Subject = {
  sizeM2: number;
  conditionKey: ConditionKey;
  locationPremiumPct: number; // a partner által megadott lokációs felár
  photoCorrectionPct: number; // fotó-elemzésből (±), 0 ha nincs
  isBudapest: boolean;
  district: string;
  floorNum: number | null;    // a lakás emelete (0 = földszint), null = ismeretlen
  isBasement: boolean;        // szuterén / alagsor — a földszintnél lényegesen rosszabb
  hasLift: boolean;
  hasBalcony: boolean;
  // --- Az űrlapon pontosan megadott helyiség- és műszaki adatok ---
  rooms: number;              // egész szobák
  halfRooms: number;          // fél szobák
  bathrooms: number;          // fürdőszobák
  separateWcs: number;        // külön WC-k
  balconyM2: number;          // erkély / terasz mérete (0 = nincs megadva)
  buildYear: number | null;   // építés éve (közelítés a szövegből)
  heatingKey: HeatingKey;     // fűtés / energetika besorolás
};

/** Fűtés-besorolás a korrekcióhoz. */
export type HeatingKey = "modern" | "atlagos" | "konvektor" | "tavfutes_atalany";

export type CompRow = Comp & {
  kept: boolean;
  reason: string;
  weight: number;
  /** „Közepes" állapotra visszaszámolt nm-ár (ebből képezzük a mediánt). */
  normalizedPricePerM2?: number;
  /** A comp saját állapot-besorolása, ha felismerhető volt. */
  conditionKey?: ConditionKey;
};
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
  /** true: kevés comp volt, ezért TÁGABB értéksávval, jelzetten készült a becslés.
   *  A szám ettől még DETERMINISZTIKUS (nem AI) — így nem ugrál futásról futásra. */
  lowConfidence?: boolean;
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

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 };
function romanToInt(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN[s[i]] ?? 0; const nx = ROMAN[s[i + 1]] ?? 0;
    n += v < nx ? -v : v;
  }
  return n;
}
/** Kerület-szám kinyerése bármilyen formából ("XIII" / "13" / "Budapest XIII. kerület" → 13). 0 = ismeretlen. */
export function districtNum(s: string): number {
  const t = String(s ?? "").toUpperCase();
  const ar = t.match(/\b(\d{1,2})\b/);
  if (ar) return Number(ar[1]);
  const r = t.match(/\b([IVXLC]{1,6})\b/);
  if (r) return romanToInt(r[1]);
  return 0;
}

/**
 * allapot / condition szöveg → config-kulcs.
 *
 * A SORREND kritikus. Korábban a „felúj" minta előbb futott, ezért az
 * „Újszerű (pár éve épült/FELÚJÍTOTT)" tévesen felújítandónak számított, és
 * levonást kapott felár helyett. Ezért előbb a rossz állapotot azonosítjuk
 * PONTOS szóalakkal (felújítandó, nem felújított), és csak utána a jókat.
 */
export function conditionKey(text: string | undefined): ConditionKey {
  const t = (text ?? "").toLowerCase();

  // 1) Legrosszabb: bontandó, illetve a befejezetlen szerkezetkész/félkész.
  if (/bontand|átépítend|atepitend|szerkezetkész|szerkezetkesz|félkész|felkesz/.test(t)) return "bontando";

  // 2) Felújítandó / rossz állapotú — a „felújított" NEM ide tartozik.
  if (/felúj[íi]tand|feluj[íi]tand|rossz állapot|rossz allapot|lelakott|korszerűsítend|korszerusitend/.test(t)) {
    return "felujitando";
  }

  // 3) Csúcskategória: prémium, kiváló, kulcsrakész új építés.
  if (/prémium|premium|kiváló|kivalo|kitűn|kitun|luxus|kulcsrakész|kulcsrakesz|új épít|uj epit/.test(t)) {
    return "premium";
  }

  // 4) Újszerű / felújított.
  if (/újszer|ujszer|felúj[íi]tott|feluj[íi]tott|megújult|megujult/.test(t)) return "ujszeru";

  // 5) Jó, azonnal költözhető.
  if (/\bjó\b|\bjo\b|szép|szep|rendezett|azonnal költözhet|azonnal koltozhet/.test(t)) return "jo";

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
  const subjDist = districtNum(subject.district);

  // 1) Szűrés LAZÍTÓ LÉTRÁVAL: ha kevés marad, fokozatosan enyhítünk (méret → kerület →
  //    kor), hogy a determinisztikus motor akkor is fusson, ne essen a szórós AI-becslőre.
  //    A kerület-egyezés FUZZY (XIII/13/Budapest XIII egyezik; ismeretlennél nem dobunk).
  const levels = [
    { tolMult: 1, district: cfg.comp.same_district_only, age: true, note: "" },
    { tolMult: 1.5, district: cfg.comp.same_district_only, age: true, note: "tágabb méret-tűrés" },
    { tolMult: 1.5, district: false, age: true, note: "kerület nélkül, tágabb méret" },
    { tolMult: 2, district: false, age: false, note: "teljesen tágított kör" },
  ];
  const target = Math.max(cfg.comp.min_count, cfg.outlier.min_kept);
  const filterAt = (lvl: (typeof levels)[number]): CompRow[] => {
    const tol = (cfg.comp.size_tolerance_pct / 100) * lvl.tolMult;
    return all.map((c) => {
      const cd = districtNum(c.district);
      let kept = true; let reason = "beszámít";
      if (subject.sizeM2 > 0 && Math.abs(c.sizeM2 - subject.sizeM2) / subject.sizeM2 > tol) {
        kept = false; reason = "méret eltér";
      } else if (lvl.age && c.ageMonths !== null && c.ageMonths > cfg.comp.max_age_months) {
        kept = false; reason = `régi hirdetés (>${cfg.comp.max_age_months} hó)`;
      } else if (lvl.district && subjDist > 0 && cd > 0 && cd !== subjDist) {
        kept = false; reason = "más kerület";
      }
      return { ...c, kept, reason, weight: 0 };
    });
  };
  let rows: CompRow[] = filterAt(levels[0]);
  let loosened = "";
  for (const lvl of levels) {
    rows = filterAt(lvl);
    loosened = lvl.note;
    if (rows.filter((r) => r.kept).length >= target) break;
  }

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

  // NULLA comp: nincs mihez viszonyítani → a hívó dönt (AI-tartalék).
  // FONTOS: 1-2 compnál NEM esünk vissza szabadfutású AI-becslésre, mert az
  // futásonként MÁS árat adna (ez okozta a 61 M / 78 M / 85 M típusú ingadozást).
  // Helyette determinisztikusan számolunk, csak TÁGABB sávval és jelzéssel.
  if (pool.length === 0) {
    return {
      ok: false, estimateHuf: 0, lowHuf: 0, highHuf: 0, centralPricePerM2: 0,
      usedCount: 0, comps: rows, steps, fellBack: true,
      note: "Nem találtunk használható összehasonlító ingatlant.",
    };
  }
  const lowConfidence = pool.length < cfg.fallback.min_comps_for_engine;

  // 2b) ÁLLAPOT-NORMALIZÁLÁS. A comp-ok saját állapota eddig figyelmen kívül
  //     maradt: ha a találatok többsége felújítandó volt, az alacsony bázisra
  //     jött rá a mi ingatlanunk felára, és a prémium lakás is alulárazott lett.
  //     Ezért minden comp nm-árát visszaszámoljuk „közepes" állapotra, és a
  //     mediánt már ebből képezzük — így a bázis állapot-semleges.
  if (cfg.adjust.normalize_comps_by_condition) {
    for (const r of pool) {
      const key = conditionKey(r.condition);
      const pct = cfg.adjust.condition[key] ?? 0;
      if (!r.condition || !pct) { r.normalizedPricePerM2 = r.pricePerM2; continue; }
      // Ha a comp pl. felújítandó (−18%), akkor a közepes szintje magasabb:
      // normalizált = ár / (1 + pct/100).
      r.normalizedPricePerM2 = r.pricePerM2 / (1 + pct / 100);
      r.conditionKey = key;
    }
  } else {
    for (const r of pool) r.normalizedPricePerM2 = r.pricePerM2;
  }
  const priceOf = (r: CompRow) => r.normalizedPricePerM2 ?? r.pricePerM2;

  // 3) Központi Ft/m² (medián vagy méret-súlyozott) — a NORMALIZÁLT árakból.
  let central: number;
  if (cfg.central.method === "weighted") {
    const weights = pool.map((r) => 1 / (1 + Math.abs(r.sizeM2 - subject.sizeM2) / Math.max(1, subject.sizeM2)));
    const wsum = weights.reduce((a, b) => a + b, 0) || 1;
    pool.forEach((r, i) => (r.weight = weights[i] / wsum));
    central = pool.reduce((a, r, i) => a + priceOf(r) * weights[i], 0) / wsum;
  } else {
    central = median(pool.map((r) => priceOf(r)));
    pool.forEach((r) => (r.weight = 1 / pool.length));
  }
  if (cfg.adjust.normalize_comps_by_condition && pool.some((r) => r.conditionKey)) {
    steps.push({
      label: "Comp-ok állapot-normalizálása (közepes szintre)",
      deltaPct: 0,
      deltaHuf: 0,
    });
  }

  // 4) Nyers érték.
  let value = central * subject.sizeM2;
  steps.push({ label: `Központi ${Math.round(central).toLocaleString("hu-HU")} Ft/m² × ${subject.sizeM2} m²`, deltaPct: 0, deltaHuf: Math.round(value) });

  // 5) Állapot-korrekció (hard).
  const condPct = cfg.adjust.condition[subject.conditionKey] ?? 0;
  if (condPct) { const before = value; value *= 1 + condPct / 100; steps.push({ label: `Állapot (${subject.conditionKey})`, deltaPct: condPct, deltaHuf: Math.round(value - before) }); }

  // 5b) Emelet / lift / erkély (hard) — fontos, forgalomképességet befolyásoló tényezők.
  let flPct = 0;
  // A szuterén/alagsor a földszint HELYETT kap korrekciót (nem összeadódik vele).
  if (subject.isBasement) flPct += cfg.adjust.floor_basement_pct;
  else if (subject.floorNum === 0) flPct += cfg.adjust.floor_ground_pct;
  else if (subject.floorNum !== null && subject.floorNum >= 3 && !subject.hasLift) flPct += cfg.adjust.floor_high_nolift_pct;
  if (subject.hasLift) flPct += cfg.adjust.lift_pct;
  if (subject.hasBalcony) flPct += cfg.adjust.balcony_pct;
  if (flPct) {
    const before = value; value *= 1 + flPct / 100;
    // A levezetésben külön nevesítjük a szuterént, hogy a partner is lássa, miért alacsonyabb.
    const label = subject.isBasement ? "Szuterén / alagsor + lift / erkély" : "Emelet / lift / erkély";
    steps.push({ label, deltaPct: flPct, deltaHuf: Math.round(value - before) });
  }

  // 5c) HELYISÉGEK (hard) — az űrlapon pontosan megadott szoba/fürdő/WC/terasz.
  //     Eddig ezek az adatok csak a riport szövegébe kerültek, az árba nem.
  let roomPct = 0;
  const roomNotes: string[] = [];
  // Extra fürdőszoba (az elsőn felül) és külön WC.
  if (subject.bathrooms > 1) {
    const p = (subject.bathrooms - 1) * cfg.adjust.extra_bathroom_pct;
    roomPct += p; roomNotes.push(`+${subject.bathrooms - 1} fürdő`);
  }
  if (subject.separateWcs > 0) {
    roomPct += subject.separateWcs * cfg.adjust.separate_wc_pct;
    roomNotes.push(`${subject.separateWcs} külön WC`);
  }
  // Szoba-sűrűség: a fél szoba fél súllyal. Az elvárt szobaszám kb. 25 m²/szoba.
  const effRooms = subject.rooms + subject.halfRooms * 0.5;
  if (effRooms > 0 && subject.sizeM2 > 0) {
    const expected = subject.sizeM2 / 25;
    const diff = effRooms - expected;
    // Csak érdemi eltérésnél korrigálunk (±0,7 szoba felett), max ±1 lépés.
    if (Math.abs(diff) >= 0.7) {
      const dir = diff > 0 ? 1 : -1;
      roomPct += dir * cfg.adjust.room_density_pct;
      roomNotes.push(diff > 0 ? "jó szobaszám" : "kevés szoba a méretéhez");
    }
  }
  // Nagy terasz: az erkély alapfelárán FELÜL, ha a megadott méret nagy.
  if (subject.balconyM2 >= cfg.adjust.large_terrace_threshold_m2) {
    roomPct += cfg.adjust.large_terrace_pct;
    roomNotes.push(`nagy terasz (${subject.balconyM2} nm)`);
  }
  if (roomPct) {
    const before = value; value *= 1 + roomPct / 100;
    steps.push({ label: `Helyiségek (${roomNotes.join(", ")})`, deltaPct: roomPct, deltaHuf: Math.round(value - before) });
  }

  // 5d) ÉPÍTÉS ÉVE + FŰTÉS (hard) — korszerűség és rezsi.
  let techPct = 0;
  const techNotes: string[] = [];
  if (subject.buildYear) {
    const y = subject.buildYear;
    const p = y >= 2010 ? cfg.adjust.year_new_pct : y >= 1980 ? cfg.adjust.year_mid_pct : cfg.adjust.year_old_pct;
    if (p) { techPct += p; techNotes.push(`építés ${y}`); }
  }
  const heatPct =
    subject.heatingKey === "modern" ? cfg.adjust.heating_modern_pct
      : subject.heatingKey === "konvektor" ? cfg.adjust.heating_convector_pct
        : subject.heatingKey === "tavfutes_atalany" ? cfg.adjust.heating_district_flat_pct
          : 0;
  if (heatPct) { techPct += heatPct; techNotes.push("fűtés"); }
  if (techPct) {
    const before = value; value *= 1 + techPct / 100;
    steps.push({ label: `Korszerűség (${techNotes.join(", ")})`, deltaPct: techPct, deltaHuf: Math.round(value - before) });
  }

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

  // 9) Kerekítés + prezentációs sáv. Kevés compnál TÁGABB (±8%) a sáv, mert
  //    kisebb mintából nagyobb a bizonytalanság — de a szám így is stabil marad.
  const bandPct = lowConfidence ? 0.08 : 0.03;
  const estimate = roundTo(value, cfg.rounding.step_huf);
  const low = roundTo(estimate * (1 - bandPct), cfg.rounding.step_huf);
  const high = roundTo(estimate * (1 + bandPct), cfg.rounding.step_huf);

  return {
    ok: true, estimateHuf: estimate, lowHuf: low, highHuf: high,
    centralPricePerM2: Math.round(central), usedCount: pool.length,
    comps: rows, steps, fellBack: false, lowConfidence,
    note: lowConfidence
      ? `Kevés (${pool.length} db) összehasonlító állt rendelkezésre, ezért az érték tájékoztató jellegű és tágabb sávval szerepel — a számítás determinisztikus.${loosened ? ` (Tágított kör: ${loosened}.)` : ""}`
      : `${pool.length} összehasonlító alapján, determinisztikus számítással.${loosened ? ` (Tágított kör: ${loosened}.)` : ""}`,
  };
}
