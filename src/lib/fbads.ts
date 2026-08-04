// Facebook hirdetésszöveg-generátor — egy landing page link (vagy bemásolt szöveg)
// alapján 3 különböző stílusú, azonnal felhasználható B2C Facebook hirdetésszöveget ad.
// A kliens is olvassa (gombfelirat), ezért NEXT_PUBLIC_ előtag kell a kredithez.
const rawCredits = Number(process.env.NEXT_PUBLIC_FBADS_CREDITS ?? process.env.FBADS_CREDITS ?? 1);
export const FBADS_CREDITS = Number.isFinite(rawCredits) && rawCredits >= 0 ? rawCredits : 1;

/** A három kért verzió. */
export type FbAdsResult = {
  title: string;   // felismerhető főcím az ingatlanról (a könyvtár-névhez)
  short: string;   // rövid és pörgős — max 3-4 mondat, USP-fókusz
  story: string;   // érzelmi és sztori-alapú — hosszabb, életérzés
  bullets: string; // adatvezérelt — felsorolásos, technikai paraméterek + infrastruktúra
};

export const EMPTY_FBADS: FbAdsResult = { title: "", short: "", story: "", bullets: "" };

/** A modell válaszának beolvasása — a JSON köré írt szöveget is elviseli. */
export function parseFbAds(raw: string): FbAdsResult | null {
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

  const res: FbAdsResult = {
    title: str(o.title).slice(0, 120),
    short: str(o.short),
    story: str(o.story),
    bullets: str(o.bullets),
  };
  // Legalább egy szövegnek lennie kell.
  if (!res.short && !res.story && !res.bullets) return null;
  return res;
}
