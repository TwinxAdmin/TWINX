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
    "Követelmények MINDHÁROM szöveghez:\n" +
    "- Erős, figyelemfelkeltő első mondat (Hook).\n" +
    "- Ízléses vizuális tagolás és emojik (nem túlzásba vive).\n" +
    "- Záruljon egyértelmű, azonnali cselekvésre ösztönzéssel (CTA) és egy link-helyőrzővel, " +
    "pl. „➡️ Részletek és galéria: [IDE ILLESZD A HIRDETÉS LINKJÉT]”.\n\n" +
    "A 3 kért verzió:\n" +
    "1) short — Rövid és pörgős: maximum 3-4 mondat, a legfőbb egyedi előny (USP) a fókuszban.\n" +
    "2) story — Érzelmi és sztori-alapú: a lakossági (B2C) célcsoport életérzésére ható, hosszabb " +
    "szöveg, amely segít elképzelni az ott lakást.\n" +
    "3) bullets — Adatvezérelt (felsorolásos): logikus, könnyen átfutható bullet-point lista az " +
    "ingatlan technikai paramétereiről és infrastrukturális előnyeiről (közlekedés, boltok, iskola, " +
    "zöldterület), a Hookkal az elején és a CTA-val a végén.\n\n" +
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
