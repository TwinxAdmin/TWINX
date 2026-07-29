// Hirdetés-ellenőrző — a PROMPT rész. SZERVEROLDALI fájl: szándékosan külön van a
// lib/adcheck.ts-től, mert azt a kliens is importálja, és a prompt nem való a
// böngészőbe letöltött kódba.
// FONTOS: ezt a fájlt CSAK szerveroldali kód importálhatja (lib/prompts.ts,
// API route-ok). Kliens komponensbe behúzva a teljes prompt a böngészőbe kerülne.
import { AD_TONES } from "@/lib/adcheck";

/** Az admin felületen SZERKESZTHETŐ szegmensek alapértéke. */
export const ADCHECK_DEFAULT_SEGMENTS = {
  intro:
    "Tapasztalt magyar ingatlanmarketing-szakértő vagy, aki hirdetésszövegeket auditál. " +
    "A feladatod, hogy egy meglévő ingatlanhirdetés SZÖVEGÉT értékeld, és konkrét, azonnal " +
    "használható javításokat adj. Kizárólag a szöveggel foglalkozz — a fotókat NE értékeld, " +
    "mert nem látod őket. Magyarul válaszolj, közvetlen, szakmai hangon. " +
    "Ne találj ki adatot: amit a hirdetés nem állít, azt ne állítsd te sem.",
  task:
    "Vizsgáld meg a hirdetést négy szempont szerint, és adj mindegyikre 0-100 pontot:\n" +
    "1) info — Hiányzó információk: mit keresne a vevő, ami nincs benne (rezsi, tájolás, emelet, " +
    "lift, parkolás, közlekedés, fűtés, állapot, költözhetőség).\n" +
    "2) opening — Cím és első mondat: felkelti-e a figyelmet, kiderül-e azonnal a lényeg.\n" +
    "3) structure — Szerkezet és olvashatóság: túl hosszú tömbök, felsorolások hiánya, csupa " +
    "nagybetű, túl sok emoji, helyesírás, ismétlés.\n" +
    "4) persuasion — Meggyőző erő és lezárás: életkép, előnyök kiemelése, van-e világos " +
    "felhívás a kapcsolatfelvételre.\n\n" +
    "Ezen felül:\n" +
    "- rewrites: 4-8 KONKRÉT mondat az eredeti szövegből, mindegyikhez egy jobb megfogalmazás " +
    "és rövid indoklás. Az „original\" mező szó szerint az eredeti szövegből származzon.\n" +
    "- highlights: 3-6 dolog, amit érdemes lenne HANGSÚLYOSAN kiemelni, mert megfogja az " +
    "érdeklődőt; mindegyikhez egy kérdés a hirdetőnek, hogy van-e erről fotó a hirdetésben.\n" +
    "- missing: a pótlandó adatok listája.\n" +
    "- rewritten: a TELJES újraírt hirdetésszöveg a kért hangnemben, tagolva, felsorolásokkal. " +
    "Ahol adat hiányzik, tegyél oda szögletes zárójeles kitöltendő helyet, például [REZSI: …] — " +
    "SOHA ne találj ki konkrét számot vagy tényt.\n\n" +
    "Csak a hirdetés tartalmát értékeld, ne a portált. A válasz KIZÁRÓLAG egy JSON objektum " +
    "legyen, magyarázó szöveg nélkül, ebben a szerkezetben:\n" +
    '{"score":0-100,"summary":"…","aspects":[{"key":"info|opening|structure|persuasion",' +
    '"score":0-100,"findings":["…"]}],"rewrites":[{"original":"…","improved":"…","why":"…"}],' +
    '"highlights":[{"what":"…","why":"…","hasPhotoQuestion":"…"}],"missing":["…"],"rewritten":"…"}',
};

/** Az admin felületen mutatott (zárolt) adat-blokk előnézete. */
export const ADCHECK_DATA_BLOCK_PREVIEW =
  "--- A VIZSGÁLT HIRDETÉS ---\n" +
  "Forrás: {link vagy „a partner által bemásolt szöveg\"}\n" +
  "Kért hangnem: {hangnem}\n" +
  "Hirdetés szövege:\n{a hirdetés teljes szövege}\n" +
  "---------------------------";

export type AdCheckInput = {
  url?: string | null;
  text?: string | null;   // ha a partner kézzel másolta be
  tone: string;
};

/** A végleges prompt összeállítása (a változók itt zároltak). */
export function composeAdCheckPrompt(
  input: AdCheckInput,
  segments: { intro: string; task: string }
): string {
  const tone = AD_TONES.find((t) => t.slug === input.tone) ?? AD_TONES[0];
  const source = input.text?.trim()
    ? "a partner által bemásolt szöveg"
    : (input.url ?? "").trim() || "ismeretlen";

  const body = input.text?.trim()
    ? `Hirdetés szövege:\n${input.text.trim()}`
    : `Nyisd meg ezt az oldalt, és olvasd ki belőle a hirdetés teljes szövegét ` +
      `(cím, leírás, felsorolt adatok): ${input.url}\n` +
      `Ha az oldal nem érhető el vagy nem tartalmaz hirdetést, a válaszod KIZÁRÓLAG ez legyen: ` +
      `{"error":"unreachable"}`;

  return [
    segments.intro,
    "",
    "--- A VIZSGÁLT HIRDETÉS ---",
    `Forrás: ${source}`,
    `Kért hangnem az újraírt szöveghez: ${tone.label} (${tone.hint})`,
    body,
    "---------------------------",
    "",
    segments.task,
  ].join("\n");
}
