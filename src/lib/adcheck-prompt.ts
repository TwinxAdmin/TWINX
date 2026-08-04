// Hirdetés-ellenőrző — a PROMPT rész. SZERVEROLDALI fájl: szándékosan külön van a
// lib/adcheck.ts-től, mert azt a kliens is importálja, és a prompt nem való a
// böngészőbe letöltött kódba.
// FONTOS: ezt a fájlt CSAK szerveroldali kód importálhatja (lib/prompts.ts,
// API route-ok). Kliens komponensbe behúzva a teljes prompt a böngészőbe kerülne.

/** Az admin felületen SZERKESZTHETŐ szegmensek alapértéke. */
export const ADCHECK_DEFAULT_SEGMENTS = {
  intro:
    "Tapasztalt magyar ingatlanmarketing-szakértő vagy, aki hirdetésszövegeket auditál. " +
    "Értékeld a megadott ingatlanhirdetést a legfontosabb szakmai szempontok alapján: " +
    "címsor, technikai adatok, struktúra, célcsoport és CTA (felhívás a kapcsolatfelvételre). " +
    "Kizárólag a SZÖVEGGEL foglalkozz — a fotókat NE értékeld, mert nem látod őket. " +
    "Magyarul, közvetlen, szakmai hangon válaszolj. Ne találj ki adatot: amit a hirdetés nem " +
    "állít, azt ne állítsd te sem.",
  task:
    "Add meg SZIGORÚAN az alábbi tömör értékelést, tőmondatokban, konkrétan:\n" +
    "- Megfelelőség: egyetlen szám 0-100 között (az egész hirdetés összesített szakmai minősége).\n" +
    "- Miben jó: pontosan 2 tőmondat a hirdetés erősségeiről.\n" +
    "- Miben rossz: pontosan 2 tőmondat a hirdetés gyengeségeiről.\n" +
    "- Mit kell javítani: pontosan 2 KONKRÉT, azonnal elvégezhető lépés.\n" +
    "Ezen felül adj egy rövid, felismerhető FŐCÍMET az ingatlanról (title), formátum: " +
    "„Település (kerület), utca — típus, méret\", pl. „Budapest V. kerület, Sas utca — 3 szobás " +
    "lakás, 78 m²\". Csak azt írd bele, ami a hirdetésből KIDERÜL; ne írj bele árat, és ne találj ki adatot.\n" +
    "Írd meg a TELJES, javított, közlésre kész hirdetésszöveget is (rewritten): erős, figyelemfelkeltő " +
    "címsor; jól tagolt, olvasható leírás (rövid bekezdések, szükség szerint felsorolás); a technikai " +
    "adatok rendezetten; a célcsoportnak szóló előnyök kiemelve; a végén világos felhívás a " +
    "kapcsolatfelvételre (CTA). A javított szöveg a lehető legjobb legyen. Ahol a hirdetésből egy konkrét " +
    "adat HIÁNYZIK, tegyél oda szögletes zárójeles kitöltendő helyet, pl. [REZSI: …] — SOHA ne találj ki " +
    "számot vagy tényt.\n\n" +
    "A válasz KIZÁRÓLAG egyetlen JSON objektum legyen, más szöveg nélkül, ebben a szerkezetben:\n" +
    '{"title":"…","score":0-100,"good":["tőmondat 1","tőmondat 2"],' +
    '"bad":["tőmondat 1","tőmondat 2"],"fixes":["konkrét lépés 1","konkrét lépés 2"],"rewritten":"a teljes javított hirdetésszöveg"}',
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
    body,
    "---------------------------",
    "",
    segments.task,
  ].join("\n");
}
