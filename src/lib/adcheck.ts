// Hirdetés-ellenőrző — a partner bemásolja egy meglévő hirdetés linkjét (vagy a
// szövegét), és kap egy TÖMÖR szakmai értékelést: Megfelelőség %, Miben jó,
// Miben rossz, Mit kell javítani. CSAK a SZÖVEGET vizsgáljuk (a fotókat nem).

// A kliens is olvassa (a gombfelirathoz), ezért NEXT_PUBLIC_ előtag kell, különben
// a böngészőben undefined lenne. Hibás env esetén az alapérték marad.
const rawCredits = Number(process.env.NEXT_PUBLIC_ADCHECK_CREDITS ?? process.env.ADCHECK_CREDITS ?? 1);
export const ADCHECK_CREDITS = Number.isFinite(rawCredits) && rawCredits >= 0 ? rawCredits : 1;

/** Hangnem — megtartva a kompatibilitásért (a tömör értékelés nem ír újra szöveget). */
export type AdTone = { slug: string; label: string; hint: string };

export const AD_TONES: AdTone[] = [
  { slug: "elegans", label: "Elegáns", hint: "visszafogott, prémium, választékos" },
  { slug: "tenyszeru", label: "Tényszerű", hint: "tömör, adatközpontú, túlzások nélkül" },
  { slug: "csaladias", label: "Családias", hint: "meleg, otthonos, hétköznapi hangon" },
  { slug: "premium", label: "Prémium", hint: "exkluzív, életérzést hangsúlyozó" },
];

export function isValidTone(slug: string): boolean {
  return AD_TONES.some((t) => t.slug === slug);
}
export function toneLabel(slug: string): string {
  return AD_TONES.find((t) => t.slug === slug)?.label ?? slug;
}

/** A modell által visszaadott TÖMÖR értékelés szerkezete. */
export type AdCheckResult = {
  /** Felismerhető főcím az ingatlanról (a könyvtárban ez a név, nem a nyers link). */
  title: string;
  score: number;    // Megfelelőség 0-100%
  good: string[];   // Miben jó — tőmondatok
  bad: string[];    // Miben rossz — tőmondatok
  fixes: string[];  // Mit kell javítani — konkrét lépések
};

export const EMPTY_AD_CHECK: AdCheckResult = { title: "", score: 0, good: [], bad: [], fixes: [] };

/** A modell válaszának beolvasása — a JSON köré írt szöveget is elviseli. */
export function parseAdCheck(raw: string): AdCheckResult | null {
  const text = String(raw ?? "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const o = parsed as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
  };
  const list = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean).slice(0, 6) : []);

  return {
    title: str(o.title).slice(0, 120),
    score: num(o.score),
    good: list(o.good),
    bad: list(o.bad),
    fixes: list(o.fixes),
  };
}
