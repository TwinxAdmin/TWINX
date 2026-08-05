// Facebook hirdetésszöveg-generátor — PROMPT rész. SZERVEROLDALI fájl (mint az
// adcheck-prompt): a teljes prompt nem való a böngészőbe letöltött kódba.
// CSAK szerveroldali kód importálhatja (lib/prompts.ts, API route).

/** Az admin felületen SZERKESZTHETŐ szegmensek alapértéke. */
export const FBADS_DEFAULT_SEGMENTS = {
  intro:
    "Profi ingatlanmarketinges és Facebook hirdetésszöveg-író vagy. A feladatod, hogy a megadott " +
    "landing page (hirdetés) tartalma alapján 3 különböző stílusú, azonnal felhasználható, B2C " +
    "(lakossági) Facebook hirdetési szöveget írj az ott szereplő ingatlan eladására. Magyarul írj, " +
    "meggyőző, de ízléses hangon. Ne találj ki adatot: amit a hirdetés nem állít, azt te se állítsd — " +
    "ahol egy konkrét adat hiányzik, hagyd ki vagy tegyél [szögletes zárójeles] kitöltendő helyet.",
  task:
    "FONTOS: TÖMÖR, feszes szövegeket írj — a Facebook-felhasználó gyorsan görget, a rövid szöveg " +
    "teljesít jobban. Kerüld a tölteléket, az ismétlést és a hosszú körülírásokat; minden mondat " +
    "vigye előre a hirdetést.\n\n" +
    "Követelmények MINDHÁROM szöveghez:\n" +
    "- Erős, figyelemfelkeltő első mondat (Hook).\n" +
    "- Visszafogott vizuális tagolás és kevés, célzott emoji.\n" +
    "- Záruljon egyértelmű, azonnali cselekvésre ösztönzéssel (CTA) és egy link-helyőrzővel, " +
    "pl. „➡️ Részletek és galéria: [IDE ILLESZD A HIRDETÉS LINKJÉT]”.\n\n" +
    "A 3 kért verzió (tartsd be a hosszkorlátokat):\n" +
    "1) short — Rövid és pörgős: MAX 2-3 rövid mondat (kb. 250-350 karakter), csak a legfőbb egyedi " +
    "előny (USP). Semmi felesleg.\n" +
    "2) story — Érzelmi és sztori-alapú: MAX 4-5 rövid mondat (kb. 400-550 karakter), egyetlen " +
    "erős képpel az ott lakásról — ne fusson szét, ne legyen bekezdésekbe szedett esszé.\n" +
    "3) bullets — Adatvezérelt (felsorolásos): egy rövid Hook, MAX 4-5 tömör bullet (soronként " +
    "1 rövid tőmondat) az ingatlan legfontosabb paramétereiről és környék-előnyeiről, majd CTA.\n\n" +
    "Ezen felül adj egy rövid, felismerhető FŐCÍMET az ingatlanról (title), pl. „Budapest XIII. kerület, " +
    "Visegrádi utca — 2 szobás tégla lakás”. Csak azt írd bele, ami a hirdetésből KIDERÜL.\n\n" +
    "A válasz KIZÁRÓLAG egyetlen JSON objektum legyen, más szöveg nélkül, ebben a szerkezetben " +
    "(a szövegekben a sortöréseket \\n-nel add meg):\n" +
    '{"title":"…","short":"…","story":"…","bullets":"…"}',
};

/** Az admin felületen mutatott (zárolt) adat-blokk előnézete. */
export const FBADS_DATA_BLOCK_PREVIEW =
  "--- A HIRDETETT INGATLAN ---\n" +
  "Forrás: {link vagy „a partner által bemásolt szöveg\"}\n" +
  "A landing page / hirdetés szövege:\n{a hirdetés teljes szövege}\n" +
  "----------------------------";

export type FbAdsInput = {
  url?: string | null;
  text?: string | null; // ha a szerver letöltötte / a partner bemásolta
};

/** A végleges prompt összeállítása (a változók itt zároltak). */
export function composeFbAdsPrompt(
  input: FbAdsInput,
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
