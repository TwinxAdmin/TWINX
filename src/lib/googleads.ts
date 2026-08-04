// Google Ads (keresési/PPC) szöveg- és kulcsszó-generátor — egy landing page link
// alapján reszponzív keresési hirdetés szövegei + kulcsszólista B2C ingatlanra.
// A kredit a Facebook-generátorral közös konstansból jön (lib/fbads.ts).

/** Google Ads karakterkorlátok (reszponzív keresési hirdetés). */
export const GADS_HEADLINE_MAX = 30;
export const GADS_DESC_MAX = 90;

export type GoogleAdsResult = {
  title: string;         // felismerhető főcím az ingatlanról
  headlines: string[];   // max 5, egyenként ≤30 karakter
  descriptions: string[]; // max 3, egyenként ≤90 karakter
  keywords: string[];    // ~10 magas vásárlási szándékú kifejezés
  negatives: string[];   // 5-10 kizáró kulcsszó
};

export const EMPTY_GOOGLE_ADS: GoogleAdsResult = {
  title: "", headlines: [], descriptions: [], keywords: [], negatives: [],
};

/** A modell válaszának beolvasása — a JSON köré írt szöveget is elviseli, és a
 *  karakterkorlátokat biztonságból betartatja (a túl hosszút levágja). */
export function parseGoogleAds(raw: string): GoogleAdsResult | null {
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
  const listCapped = (v: unknown, maxItems: number, maxChars?: number) =>
    (Array.isArray(v) ? v : [])
      .map((x) => {
        const s = str(x);
        return maxChars ? s.slice(0, maxChars) : s;
      })
      .filter(Boolean)
      .slice(0, maxItems);

  const res: GoogleAdsResult = {
    title: str(o.title).slice(0, 120),
    headlines: listCapped(o.headlines, 5, GADS_HEADLINE_MAX),
    descriptions: listCapped(o.descriptions, 3, GADS_DESC_MAX),
    keywords: listCapped(o.keywords, 12),
    negatives: listCapped(o.negatives, 12),
  };
  if (!res.headlines.length && !res.descriptions.length && !res.keywords.length) return null;
  return res;
}
