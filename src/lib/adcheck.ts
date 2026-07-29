// Hirdetés-ellenőrző — a partner bemásolja egy meglévő hirdetés linkjét (vagy a
// szövegét), és kap egy elemzést + javított szöveget. CSAK a SZÖVEGET vizsgáljuk:
// a fotókat nem elemezzük, csak felhívjuk a figyelmet, mihez érdemes képet tenni.

// A kliens is olvassa (a gombfelirathoz), ezért NEXT_PUBLIC_ előtag kell, különben
// a böngészőben undefined lenne. Hibás env esetén az alapérték marad.
const rawCredits = Number(process.env.NEXT_PUBLIC_ADCHECK_CREDITS ?? process.env.ADCHECK_CREDITS ?? 1);
export const ADCHECK_CREDITS = Number.isFinite(rawCredits) && rawCredits >= 0 ? rawCredits : 1;

/** Az újraírt szöveg hangneme — a Hirdetéskészítőhöz igazodva. */
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

/** A négy vizsgált szempont — a pontszámok is ezek szerint bomlanak. */
export const AD_ASPECTS = [
  { key: "info", label: "Hiányzó információk" },
  { key: "opening", label: "Cím és első mondat" },
  { key: "structure", label: "Szerkezet és olvashatóság" },
  { key: "persuasion", label: "Meggyőző erő és lezárás" },
] as const;

export type AdAspectKey = (typeof AD_ASPECTS)[number]["key"];

/** A modell által visszaadott elemzés szerkezete. */
export type AdCheckResult = {
  score: number;                       // 0-100 összpontszám
  summary: string;                     // 2-3 mondatos összegzés
  aspects: Array<{
    key: AdAspectKey;
    score: number;                     // 0-100
    findings: string[];                // mi a helyzet ezen a téren
  }>;
  rewrites: Array<{
    original: string;                  // az eredeti megfogalmazás
    improved: string;                  // a javasolt változat
    why: string;                       // miért jobb
  }>;
  highlights: Array<{
    what: string;                      // mit érdemes kiemelni
    why: string;                       // miért fogja meg az érdeklődőt
    hasPhotoQuestion: string;          // a partnernek szóló fotó-ellenőrző kérdés
  }>;
  missing: string[];                   // hiányzó, pótlandó adatok
  rewritten: string;                   // a teljes újraírt hirdetésszöveg
};

export const EMPTY_AD_CHECK: AdCheckResult = {
  score: 0, summary: "", aspects: [], rewrites: [], highlights: [], missing: [], rewritten: "",
};

/** A modell válaszának beolvasása — a JSON köré írt szöveget is elviseli. */
export function parseAdCheck(raw: string): AdCheckResult | null {
  const text = String(raw ?? "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(text.slice(start, end + 1)); } catch { return null; }
  if (!parsed || typeof parsed !== "object") return null;

  const o = parsed as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
  };
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);

  const aspects = arr(o.aspects)
    .map((a) => {
      const x = (a ?? {}) as Record<string, unknown>;
      const key = str(x.key) as AdAspectKey;
      if (!AD_ASPECTS.some((s) => s.key === key)) return null;
      return {
        key,
        score: num(x.score),
        findings: arr(x.findings).map(str).filter(Boolean),
      };
    })
    .filter((a): a is AdCheckResult["aspects"][number] => a !== null);

  return {
    score: num(o.score),
    summary: str(o.summary),
    aspects,
    rewrites: arr(o.rewrites)
      .map((r) => {
        const x = (r ?? {}) as Record<string, unknown>;
        return { original: str(x.original), improved: str(x.improved), why: str(x.why) };
      })
      .filter((r) => r.improved),
    highlights: arr(o.highlights)
      .map((h) => {
        const x = (h ?? {}) as Record<string, unknown>;
        return {
          what: str(x.what), why: str(x.why),
          hasPhotoQuestion: str(x.hasPhotoQuestion) || (str(x.what) ? `Van erről fotó a hirdetésben: ${str(x.what)}?` : ""),
        };
      })
      .filter((h) => h.what),
    missing: arr(o.missing).map(str).filter(Boolean),
    rewritten: str(o.rewritten),
  };
}
