// Google Ads (PPC) szöveg- és kulcsszó-generátor — PROMPT rész. SZERVEROLDALI fájl.
// CSAK szerveroldali kód importálhatja (lib/prompts.ts, API route).

/** Az admin felületen SZERKESZTHETŐ szegmensek alapértéke. */
export const GOOGLE_ADS_DEFAULT_SEGMENTS = {
  intro:
    "Profi Google Ads (PPC) szakértő vagy. A feladatod, hogy a megadott landing page (hirdetés) " +
    "tartalma alapján keresési kampányhoz hirdetésszövegeket és kulcsszólistát készíts az ott " +
    "bemutatott lakossági (B2C) ingatlan eladására. Magyarul dolgozz. Ne találj ki adatot: amit a " +
    "hirdetés nem állít, azt te se állítsd.",
  task:
    "Szigorúan az alábbi struktúrában és karakterkorlátokkal válaszolj.\n\n" +
    "1. Hirdetésszövegek (reszponzív keresési hirdetéshez):\n" +
    "- headlines: 5 db figyelemfelkeltő, VÁLTOZATOS címsor, mindegyik LEGFELJEBB 30 karakter " +
    "(a szóközök is számítanak). Tartalmazzon lokációt és fő előnyt.\n" +
    "- descriptions: 3 db lényegre törő leírás, mindegyik LEGFELJEBB 90 karakter, egyértelmű " +
    "cselekvésre ösztönzéssel (CTA).\n\n" +
    "2. Kulcsszólista:\n" +
    "- keywords: 10 db magas vásárlási szándékú keresési kifejezés (célzott kulcsszavak).\n" +
    "- negatives: 5-10 db kizáró kulcsszó, ami alapján KERÜLNI kell a megjelenést " +
    "(pl. „kiadó”, „albérlet”, „ingyen”).\n\n" +
    "FONTOS: tartsd be a karakterkorlátokat (címsor ≤30, leírás ≤90). Ezen felül adj egy rövid, " +
    "felismerhető FŐCÍMET az ingatlanról (title).\n\n" +
    "A válasz KIZÁRÓLAG egyetlen JSON objektum legyen, más szöveg nélkül, ebben a szerkezetben:\n" +
    '{"title":"…","headlines":["…","…","…","…","…"],"descriptions":["…","…","…"],' +
    '"keywords":["…"],"negatives":["…"]}',
};

/** Az admin felületen mutatott (zárolt) adat-blokk előnézete. */
export const GOOGLE_ADS_DATA_BLOCK_PREVIEW =
  "--- A HIRDETETT INGATLAN ---\n" +
  "Forrás: {link vagy „a partner által bemásolt szöveg\"}\n" +
  "A landing page / hirdetés szövege:\n{a hirdetés teljes szövege}\n" +
  "----------------------------";

export type GoogleAdsInput = {
  url?: string | null;
  text?: string | null;
};

/** A végleges prompt összeállítása (a változók itt zároltak). */
export function composeGoogleAdsPrompt(
  input: GoogleAdsInput,
  segments: { intro: string; task: string }
): string {
  const source = input.text?.trim()
    ? "a partner által megadott hirdetés-szöveg"
    : (input.url ?? "").trim() || "ismeretlen";

  const body = input.text?.trim()
    ? `A landing page / hirdetés szövege:\n${input.text.trim()}`
    : `Nyisd meg ezt a landing page-et, és olvasd ki belőle a hirdetés teljes tartalmát ` +
      `(cím, leírás, felsorolt adatok, előnyök): ${input.url}\n` +
      `Ha az oldal nem érhető el vagy nem tartalmaz hirdetést, a válaszod KIZÁRÓLAG ez legyen: ` +
      `{"error":"unreachable"}`;

  return [
    segments.intro,
    "",
    "--- A HIRDETETT INGATLAN ---",
    `Forrás: ${source}`,
    body,
    "----------------------------",
    "",
    segments.task,
  ].join("\n");
}
