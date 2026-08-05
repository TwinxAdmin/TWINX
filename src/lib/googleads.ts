// Google Ads (keresési/PPC) generátor — egy landing page link alapján egy azonnal
// Google Ads Editorba importálható, pontosvesszővel (;) elválasztott CSV-t ad
// Search kampányhoz (10 kulcsszavas sor + RSA-oszlopok). A kredit a Facebook-
// generátorral közös konstansból jön (lib/fbads.ts).

/** A várt CSV kötelező fejléce (a Google Ads Editor oszlopai). */
export const GADS_CSV_HEADER =
  "Campaign;Campaign Type;Ad Group;Keyword;Criterion Type;Headline 1;Headline 2;Headline 3;Description 1;Description 2;Final URL;Campaign Status";

export type GoogleAdsResult = { csv: string };
export const EMPTY_GOOGLE_ADS: GoogleAdsResult = { csv: "" };

/** A CSV szerkeszthető, olvasható formája (a felületen ebből dolgozunk). */
export type GoogleAdsAd = {
  campaignName: string;
  campaignType: string;
  adGroupName: string;
  finalUrl: string;
  campaignStatus: string;
  headlines: string[];        // RSA címsorok (≤30 karakter)
  descriptions: string[];     // RSA leírások (≤90 karakter)
  keywords: Array<{ text: string; criterionType: string }>; // Phrase / Exact / Broad
};

export const EMPTY_GOOGLE_ADS_AD: GoogleAdsAd = {
  campaignName: "Konkrét Ingatlanok", campaignType: "Search", adGroupName: "",
  finalUrl: "", campaignStatus: "Paused", headlines: [], descriptions: [], keywords: [],
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ";" && !inQ) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** CSV → szerkeszthető struktúra (kliens-oldali, böngészőben is fut). */
export function parseGoogleAdsCsvClient(csv: string): GoogleAdsAd | null {
  const lines = String(csv ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const c = (name: string) => header.indexOf(name.toLowerCase());
  const iC = c("campaign"), iCT = c("campaign type"), iAG = c("ad group"),
    iKw = c("keyword"), iCr = c("criterion type"), iH1 = c("headline 1"),
    iH2 = c("headline 2"), iH3 = c("headline 3"), iD1 = c("description 1"),
    iD2 = c("description 2"), iUrl = c("final url"), iCS = c("campaign status");
  if (iKw < 0 || iH1 < 0 || iUrl < 0) return null;

  const rows = lines.slice(1).map(splitCsvLine).filter((r) => r.some((x) => x));
  if (!rows.length) return null;
  const first = rows[0];
  const at = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").replace(/^"|"$/g, "").trim() : "");

  return {
    campaignName: at(first, iC) || "Konkrét Ingatlanok",
    campaignType: at(first, iCT) || "Search",
    adGroupName: at(first, iAG) || "Ad Group",
    finalUrl: at(first, iUrl),
    campaignStatus: at(first, iCS) || "Paused",
    headlines: [at(first, iH1), at(first, iH2), at(first, iH3)].filter(Boolean),
    descriptions: [at(first, iD1), at(first, iD2)].filter(Boolean),
    keywords: rows
      .map((r) => ({ text: at(r, iKw), criterionType: at(r, iCr) || "Phrase" }))
      .filter((k) => k.text),
  };
}

/** Szerkesztett struktúra → Google Ads Editor CSV (soronként egy kulcsszó). */
export function serializeGoogleAdsCsv(ad: GoogleAdsAd): string {
  const q = (v: string) => (v.includes(";") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
  const h = ad.headlines;
  const d = ad.descriptions;
  const rows = (ad.keywords.length ? ad.keywords : [{ text: "", criterionType: "Phrase" }]).map((k) =>
    [
      ad.campaignName, ad.campaignType, ad.adGroupName, k.text, k.criterionType,
      h[0] ?? "", h[1] ?? "", h[2] ?? "", d[0] ?? "", d[1] ?? "", ad.finalUrl, ad.campaignStatus,
    ].map(q).join(";")
  );
  return [GADS_CSV_HEADER, ...rows].join("\n");
}

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
