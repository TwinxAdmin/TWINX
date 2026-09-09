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
  /** Rövid indoklás — 3-5 tömör mondat/pont. */
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

/** Egy szakasz szövegéből a legfeljebb `max` legérdemibb mondat/pont. */
function bulletsFrom(body: string, max: number): string[] {
  return String(body ?? "")
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").replace(/\*\*/g, "").trim())
    .filter((l) => l.length > 25 && !/^https?:/i.test(l))
    .slice(0, max);
}

/**
 * Az egyoldalas kivonat összeállítása.
 * `input` = az űrlap adatai (ebből jönnek az ingatlan-jellemzők),
 * `doc`   = a kész riport (ebből az ár, a sáv és az indoklás).
 */
export function buildOnePager(
  doc: ReportDoc,
  input: Partial<ValuationInput>,
  dateLabel: string
): OnePagerData {
  const highlights = reportHighlights(doc);
  const find = (label: string) => highlights.find((h) => h.label === label)?.value ?? "";

  const price = doc.headlinePrice || find("Becsült piaci érték") || find("Piaci ár");
  const range = find("Értéksáv");
  const { low, high } = parseRange(range);

  // Indoklás: az összefoglaló, kiegészítve az értékelési/korrekciós szakaszokkal.
  const reasons: string[] = [];
  for (const line of bulletsFrom(doc.intro, 3)) reasons.push(line);
  if (reasons.length < 4) {
    const sec = doc.sections.find(
      (s) => !s.hidden && /(indokl|értékel|korrekci|összegz|piaci helyzet)/i.test(s.heading)
    );
    if (sec) for (const line of bulletsFrom(sec.body, 4 - reasons.length)) reasons.push(line);
  }

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
    priceNum: parseHuf(price),
    pricePerM2: find("Átlagos nm-ár"),
    facts: rows.slice(0, 9),
    reasons: reasons.slice(0, 4),
    dateLabel,
  };
}
