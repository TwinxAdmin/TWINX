// Google Ads (keresési/PPC) generátor — egy landing page link alapján egy azonnal
// Google Ads Editorba importálható, pontosvesszővel (;) elválasztott CSV-t ad
// Search kampányhoz (10 kulcsszavas sor + RSA-oszlopok). A kredit a Facebook-
// generátorral közös konstansból jön (lib/fbads.ts).

/** A várt CSV kötelező fejléce (a Google Ads Editor oszlopai). */
export const GADS_CSV_HEADER =
  "Campaign;Campaign Type;Ad Group;Keyword;Criterion Type;Headline 1;Headline 2;Headline 3;Description 1;Description 2;Final URL;Campaign Status";

export type GoogleAdsResult = { csv: string };
export const EMPTY_GOOGLE_ADS: GoogleAdsResult = { csv: "" };

/**
 * A modell válaszából kinyeri a CSV-t: levágja az esetleges kódblokk-jelölőt, és
 * ellenőrzi, hogy tartalmazza-e a fejlécet + legalább egy adatsort. Hibánál null.
 */
export function extractGoogleAdsCsv(raw: string): string | null {
  let t = String(raw ?? "").trim();
  const fence = t.match(/```(?:csv)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  if (/"error"\s*:\s*"unreachable"/i.test(t)) return null;
  // Legyen "Campaign;" kezdetű fejléc valahol, és legalább 2 nem üres sor.
  if (!/(^|\n)\s*Campaign\s*;/.test(t)) return null;
  const lines = t.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim().length);
  if (lines.length < 2) return null;
  return lines.join("\n");
}
