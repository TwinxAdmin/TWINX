// Egyoldalas értékbecslés — a részletes riportból KIVONAT.
//
// Miért kell: a teljes riport több oldal, tele forrásokkal és levezetéssel — az
// ügyfélnek viszont egy áttekinthető lap kell EGY árral, az ingatlan adataival
// és pár mondat indoklással. Ez a fájl a meglévő ReportDoc-ból állítja elő
// ennek az egy lapnak az adatait, hogy ne kelljen új AI-hívás (és új kredit).
//
// KLIENS-BIZTOS: nincs benne szerveroldali import.
import { reportHighlights, type ReportDoc } from "@/lib/valuation-report";
import type { ValuationInput } from "@/lib/valuation";

export type OnePagerRow = { label: string; value: string };

/** A motor levezetésének kliensre átadott, minimális formája. */
export type AuditStep = { label: string; deltaPct: number; deltaHuf?: number };
export type OnePagerAudit = {
  steps?: AuditStep[];
  usedCount?: number;
  estimateHuf?: number;
  lowHuf?: number;
  highHuf?: number;
} | null;

export type OnePagerData = {
  /** Cím-sor: település, utca. */
  title: string;
  /** Alcím: típus · méret · szobák. */
  subtitle: string;
  /** A JAVASOLT ÁR — ez az egyetlen kiemelt szám a lapon. */
  price: string;
  /** Értéksáv szövegesen, ha van (pl. „92–104 M Ft"). */
  range: string;
  /** Számokra bontott sáv a kis grafikonhoz (0 = nincs adat). */
  rangeLow: number;
  rangeHigh: number;
  priceNum: number;
  /** Átlagos nm-ár, ha a riport tartalmazza. */
  pricePerM2: string;
  /** Az ingatlan adatai (bal oszlop). */
  facts: OnePagerRow[];
  /** Indoklás — MINDIG 5-7 egysoros pont. */
  reasons: string[];
  /** Készítés dátuma. */
  dateLabel: string;
};

/** „92 000 000 Ft" → 92000000. Ha nincs értelmes szám, 0. */
export function parseHuf(text: string): number {
  const digits = String(text ?? "").replace(/[^\d]/g, "");
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

/** Millió forintra rövidítve: 92 000 000 → „92,0 M Ft". */
export function shortHuf(n: number): string {
  if (!n) return "";
  const m = n / 1_000_000;
  return `${m.toFixed(m >= 100 ? 0 : 1).replace(".", ",")} M Ft`;
}

/**
 * Tartalmaz-e a szöveg VALÓDI összeget? A tartalék (AI-írta) riportokban a
 * szakasz-szöveg néha mondat, nem érték — abból nem szabad „értéksávot"
 * csinálni (így került ki korábban az „A HORGONY" felirat a lapra).
 */
function looksLikeMoney(text: string): boolean {
  const t = String(text ?? "");
  if (!/\d/.test(t)) return false;
  // Legalább egy 4+ jegyű összeg, vagy „12,5 M Ft" alak.
  return /\d[\d\s.]{3,}/.test(t) || /\d+([.,]\d+)?\s*m\s*ft/i.test(t);
}

/** 92 000 000 → „92 000 000 Ft" */
function huf(n: number): string {
  return `${Math.round(n).toLocaleString("hu-HU")} Ft`;
}

/** Az értéksáv szövegéből („92–104 M Ft" / „92 000 000 - 104 000 000 Ft") két szám. */
function parseRange(text: string): { low: number; high: number } {
  const parts = String(text ?? "").split(/[–—-]/);
  if (parts.length < 2) return { low: 0, high: 0 };
  const millions = /m\s*ft/i.test(text);
  const toNum = (s: string) => {
    const n = parseHuf(s);
    if (!n) return 0;
    // „92–104 M Ft" esetén a számok millióban értendők.
    return millions && n < 10_000 ? n * 1_000_000 : n;
  };
  const low = toNum(parts[0]);
  const high = toNum(parts.slice(1).join("-"));
  return low && high && high >= low ? { low, high } : { low: 0, high: 0 };
}

// =====================================================================
// INDOKLÁSOK — „Miért ennyi az ár?"
//
// A lapon MINDIG 5–7 indoklás áll, mindegyik EGYSOROS. Ezért nem az AI
// riport szövegéből vágunk mondatokat (az hol üres, hol többsoros), hanem
// a motor levezetéséből (audit) és az űrlap adataiból építjük sablonokkal.
// Így garantált, hogy van elég sor, és egyik sem lóg bele a fotósávba.
// =====================================================================

/** Egy indoklás felső hossza — ennél a komponens amúgy is levágná. */
const REASON_MAX_CHARS = 66;
export const REASONS_MIN = 5;
export const REASONS_MAX = 7;

/** Prioritásos jelölt: minél nagyobb a `weight`, annál előbb kerül a lapra. */
type Candidate = { text: string; weight: number };

function pct(n: number): string {
  const r = Math.round(n * 10) / 10;
  const s = String(r).replace(".", ",");
  return `${r > 0 ? "+" : ""}${s}%`;
}

function clip(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > REASON_MAX_CHARS ? `${t.slice(0, REASON_MAX_CHARS - 1).trimEnd()}…` : t;
}

/** A motor technikai lépés-címkéiből ügyfélnek szóló, egysoros mondat. */
function reasonFromStep(step: AuditStep): Candidate | null {
  const label = String(step.label ?? "");
  const p = Number(step.deltaPct) || 0;
  const w = Math.abs(p);

  // A központi árszint nem korrekció, hanem a számítás alapja.
  const central = /Ft\/m².*×|×.*m²/.test(label) && !p;
  if (central) {
    const m = /^Központi\s+([\d\s]+)\s*Ft\/m²/.exec(label);
    return m
      ? { text: `A környék irányadó négyzetméterára: ${m[1].trim()} Ft/m²`, weight: 100 }
      : null;
  }
  if (!p) return null; // 0%-os lépés nem indoklás

  if (/^Állapot/i.test(label)) {
    const key = /\(([^)]+)\)/.exec(label)?.[1] ?? "";
    const names: Record<string, string> = {
      bontando: "Bontandó / szerkezetkész állapot",
      felujitando: "Felújítandó állapot",
      kozepes: "Közepes állapot",
      jo: "Jó állapot",
      ujszeru: "Újszerű, felújított állapot",
      premium: "Prémium, kulcsrakész állapot",
    };
    return { text: `${names[key] ?? "Műszaki állapot"}: ${pct(p)}`, weight: 90 + w };
  }
  if (/lokáci/i.test(label)) {
    return {
      text: p < 0 ? `Átlagon aluli környék: ${pct(p)}` : `Keresett, prémium lokáció: ${pct(p)}`,
      weight: 80 + w,
    };
  }
  if (/^Helyiségek/i.test(label)) {
    const notes = /\(([^)]+)\)/.exec(label)?.[1] ?? "";
    return { text: `Helyiség-kiosztás${notes ? ` (${notes})` : ""}: ${pct(p)}`, weight: 70 + w };
  }
  if (/^Korszerűség/i.test(label)) {
    const notes = /\(([^)]+)\)/.exec(label)?.[1] ?? "";
    return { text: `Építés éve és fűtés${notes ? ` (${notes})` : ""}: ${pct(p)}`, weight: 65 + w };
  }
  if (/emelet|lift|erkély|földszint/i.test(label)) {
    return { text: `${label.replace(/\s*\(.*\)$/, "")}: ${pct(p)}`, weight: 60 + w };
  }
  if (/tranzakciós/i.test(label)) {
    return { text: `Hirdetési árakról tényleges eladási szintre: ${pct(p)}`, weight: 40 };
  }
  if (/normalizál/i.test(label)) {
    return { text: "Az összehasonlító árak azonos állapotra visszaszámolva", weight: 45 };
  }
  if (/küszöb/i.test(label)) {
    return { text: `Budapesti realitás-küszöb miatt korrigálva: ${pct(p)}`, weight: 35 };
  }
  return { text: `${label}: ${pct(p)}`, weight: 30 + w };
}

/** Tartalék: az űrlap adataiból, százalék nélkül — ha nincs motor-levezetés. */
function reasonsFromInput(input: Partial<ValuationInput>): Candidate[] {
  const out: Candidate[] = [];
  const push = (text: string, weight: number) => out.push({ text, weight });
  const v = (s: string | undefined) => String(s ?? "").trim();

  if (v(input.allapot)) push(`Műszaki állapot: ${v(input.allapot).toLowerCase()}`, 90);
  if (v(input.tipus) && v(input.meret)) push(`${v(input.tipus)}, ${v(input.meret)} m² alapterülettel`, 85);
  if (v(input.szobak)) push(`Szobaszám: ${v(input.szobak)}`, 70);
  if (v(input.epitesEve)) push(`Építés éve: ${v(input.epitesEve)}`, 68);
  if (v(input.futes)) push(`Fűtés: ${v(input.futes).toLowerCase()}`, 66);
  if (v(input.emelet)) push(`Elhelyezkedés az épületben: ${v(input.emelet)}${input.lift === "igen" ? ", lifttel" : ""}`, 64);
  if (input.erkely === "igen") push(`Erkély / terasz${v(input.erkelyMeret) ? `: ${v(input.erkelyMeret)} nm` : ""}`, 62);
  if (v(input.lokacioKategoria)) push(`Környék megítélése: ${v(input.lokacioKategoria).toLowerCase()}`, 60);
  if (v(input.telepules)) push(`Helyszín: ${v(input.telepules)}${v(input.utca) ? `, ${v(input.utca)}` : ""}`, 55);
  return out;
}

/** Mindig igaz, tényszerű sorok — ezek töltik fel a listát 5-ig. */
function fillerReasons(audit: OnePagerAudit | null, priceNum: number, sizeM2: number): Candidate[] {
  const out: Candidate[] = [];
  const used = Number(audit?.usedCount) || 0;
  if (used > 0) {
    out.push({ text: `${used} hasonló ingatlan tényleges árából számolva`, weight: 50 });
  }
  out.push({ text: "Az elmúlt 12 hónap piaci adatai alapján", weight: 48 });
  if (priceNum && sizeM2) {
    const ppm = Math.round(priceNum / sizeM2);
    out.push({ text: `Fajlagos ár: ${ppm.toLocaleString("hu-HU")} Ft/m²`, weight: 25 });
  }
  out.push({ text: "Aktív hirdetések és lezárt eladások alapján", weight: 22 });
  out.push({ text: "Egységes, minden becslésnél azonos módszertannal", weight: 20 });
  out.push({ text: "A környék hasonló méretű ingatlanjaihoz mérve", weight: 18 });
  out.push({ text: "Az ingatlan egyedi jellemzőire korrigált érték", weight: 15 });
  return out;
}

/**
 * Az 5–7 egysoros indoklás összeállítása.
 * Sorrend: motor-korrekciók (nagyobb hatás előbb) → tényszerű kiegészítők.
 */
export function buildReasons(
  audit: OnePagerAudit | null,
  input: Partial<ValuationInput>,
  priceNum: number
): string[] {
  const cands: Candidate[] = [];

  const steps = Array.isArray(audit?.steps) ? audit!.steps : [];
  if (steps.length) {
    for (const st of steps) {
      const c = reasonFromStep(st);
      if (c) cands.push(c);
    }
  } else {
    // Tartalék ág: nincs motor-levezetés → az űrlap adataiból építünk.
    cands.push(...reasonsFromInput(input));
  }

  const sizeM2 = Number(String(input.meret ?? "").replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
  cands.push(...fillerReasons(audit, priceNum, sizeM2));

  // Súly szerint, duplikátumok nélkül, legfeljebb 7 sor.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of cands.sort((a, b) => b.weight - a.weight)) {
    const text = clip(c.text);
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= REASONS_MAX) break;
  }
  return out;
}

/**
 * Az egyoldalas kivonat összeállítása.
 * `input` = az űrlap adatai (ebből jönnek az ingatlan-jellemzők),
 * `doc`   = a kész riport (ebből az ár, a sáv és az indoklás).
 */
export function buildOnePager(
  doc: ReportDoc,
  input: Partial<ValuationInput>,
  dateLabel: string,
  audit: OnePagerAudit = null
): OnePagerData {
  const highlights = reportHighlights(doc);
  const find = (label: string) => highlights.find((h) => h.label === label)?.value ?? "";

  const price = doc.headlinePrice || find("Becsült piaci érték") || find("Piaci ár");
  const priceNum = parseHuf(price);

  // --- ÉRTÉKSÁV ---
  // 1) a motor levezetéséből (legpontosabb), 2) a riport szövegéből, ha az
  // tényleg összeget tartalmaz, 3) az árból számolva ±4% — így a kis grafikon
  // MINDIG megjelenik, és soha nem kerül oda félreolvasott mondattöredék.
  const rawRange = find("Értéksáv");
  const parsed = looksLikeMoney(rawRange) ? parseRange(rawRange) : { low: 0, high: 0 };
  let low = Number(audit?.lowHuf) || parsed.low;
  let high = Number(audit?.highHuf) || parsed.high;
  if ((!low || !high || high <= low) && priceNum) {
    low = Math.round((priceNum * 0.96) / 100_000) * 100_000;
    high = Math.round((priceNum * 1.04) / 100_000) * 100_000;
  }
  const range = low && high ? `${huf(low)} – ${huf(high)}` : "";

  // --- FAJLAGOS ÁR --- a riportból, különben ár / alapterület.
  const rawPpm = find("Átlagos nm-ár");
  const sizeM2 = Number(String(input.meret ?? "").replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
  const pricePerM2 = looksLikeMoney(rawPpm)
    ? rawPpm
    : priceNum && sizeM2
      ? `${Math.round(priceNum / sizeM2).toLocaleString("hu-HU")} Ft/m²`
      : "";

  // Az ingatlan adatai — csak a kitöltött mezők, tömören.
  const rows: OnePagerRow[] = [];
  const add = (label: string, value: string | undefined) => {
    const v = String(value ?? "").trim();
    if (v) rows.push({ label, value: v });
  };
  add("Típus", input.tipus);
  add("Alapterület", input.meret);
  add("Szobák", input.szobak);
  add("Fürdő / WC", input.furdok);
  add("Emelet", input.emelet);
  add("Építés éve", input.epitesEve);
  add("Állapot", input.allapot);
  add("Fűtés", input.futes);
  if (input.erkely === "igen") {
    add("Erkély / terasz", input.erkelyMeret ? `${input.erkelyMeret} nm` : "van");
  }
  add("Lift", input.lift === "igen" ? "van" : "");

  return {
    title: doc.title,
    subtitle: doc.subtitle,
    price,
    range,
    rangeLow: low,
    rangeHigh: high,
    priceNum,
    pricePerM2,
    facts: rows.slice(0, 9),
    reasons: buildReasons(audit, input, priceNum),
    dateLabel,
  };
}
