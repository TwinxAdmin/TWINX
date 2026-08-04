// Google Ads (PPC) generátor — PROMPT rész. SZERVEROLDALI fájl.
// Egy azonnal Google Ads Editorba importálható, pontosvesszős CSV-t kér Search
// kampányhoz. CSAK szerveroldali kód importálhatja (lib/prompts.ts, API route).

/** Az admin felületen SZERKESZTHETŐ szegmensek alapértéke. */
export const GOOGLE_ADS_DEFAULT_SEGMENTS = {
  intro:
    "Profi Google Ads szakértő és PPC copywriter vagy. A feladatod, hogy elemezd a megadott " +
    "ingatlan tartalmát, és generálj egy azonnal Google Ads Editorba importálható CSV fájlt " +
    "keresési (Search) kampányhoz, a lakossági (B2C) vásárlók megcélzására. Ne találj ki adatot: " +
    "a település, kerület, utca és a jellemzők a weboldal tartalmából pontosan legyenek kitöltve.",
  task:
    "Kötelező struktúra és szabályok:\n" +
    "- KIZÁRÓLAG egy pontosvesszővel (;) elválasztott CSV-t adj vissza, nyers kódblokkban (```), " +
    "MINDEN más szöveg, magyarázat vagy megjegyzés nélkül.\n" +
    "- A legelső sor PONTOSAN ez a fejléc legyen:\n" +
    "Campaign;Campaign Type;Ad Group;Keyword;Criterion Type;Headline 1;Headline 2;Headline 3;Description 1;Description 2;Final URL;Campaign Status\n" +
    "- Generálj PONTOSAN 10 adatsort, mindegyikben egy MAGAS VÁSÁRLÁSI SZÁNDÉKÚ kulcsszóval.\n\n" +
    "Az oszlopok tartalma soronként:\n" +
    "- Campaign: Konkrét Ingatlanok\n" +
    "- Campaign Type: Search\n" +
    "- Ad Group: „[Település vagy Kerület] - [Utca] - [MAI DÁTUM]” formában, a weboldal adataiból " +
    "pontosan kitöltve; minden sorban UGYANAZ. A dátumot a lenti adatblokk „Mai dátum” sorából vedd.\n" +
    "- Keyword: a magas vásárlási szándékú kulcsszó (soronként más).\n" +
    "- Criterion Type: Phrase vagy Exact.\n" +
    "- Headline 1, Headline 2, Headline 3: reszponzív keresési hirdetés címsorai, MINDEGYIK " +
    "LEGFELJEBB 30 karakter, lokációval és fő előnnyel, B2C fókusszal.\n" +
    "- Description 1, Description 2: leírások, MINDEGYIK LEGFELJEBB 90 karakter, egyértelmű CTA-val.\n" +
    "- Final URL: a lenti adatblokk „Final URL” sorában megadott cím (minden sorban ugyanaz).\n" +
    "- Campaign Status: Paused\n\n" +
    "FONTOS: tartsd be SZIGORÚAN a karakterkorlátokat (Headline ≤30, Description ≤90). A cellák NE " +
    "tartalmazzanak pontosvesszőt (;), mert az az elválasztó. A hirdetésszövegek magyarul legyenek.",
};

/** Az admin felületen mutatott (zárolt) adat-blokk előnézete. */
export const GOOGLE_ADS_DATA_BLOCK_PREVIEW =
  "--- A HIRDETETT INGATLAN ---\n" +
  "Forrás: {link vagy „a partner által bemásolt szöveg\"}\n" +
  "Mai dátum: {ÉÉÉÉ.HH.NN}\n" +
  "Final URL: {a hirdetés végső URL-je}\n" +
  "A landing page / hirdetés szövege:\n{a hirdetés teljes szövege}\n" +
  "----------------------------";

export type GoogleAdsInput = {
  url?: string | null;
  text?: string | null;
};

/** A mai dátum ÉÉÉÉ.HH.NN formában (az Ad Group nevéhez). */
function todayHu(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

/** A végleges prompt összeállítása (a változók itt zároltak). */
export function composeGoogleAdsPrompt(
  input: GoogleAdsInput,
  segments: { intro: string; task: string }
): string {
  const source = input.text?.trim()
    ? "a partner által megadott hirdetés-szöveg"
    : (input.url ?? "").trim() || "ismeretlen";
  const finalUrl = (input.url ?? "").trim() || "[A HIRDETÉS VÉGSŐ URL-JE]";

  const body = input.text?.trim()
    ? `A landing page / hirdetés szövege:\n${input.text.trim()}`
    : `Nyisd meg ezt a landing page-et, és olvasd ki belőle a hirdetés teljes tartalmát ` +
      `(település, kerület, utca, jellemzők, előnyök): ${input.url}\n` +
      `Ha az oldal nem érhető el vagy nem tartalmaz hirdetést, a válaszod KIZÁRÓLAG ez legyen: ` +
      `{"error":"unreachable"}`;

  return [
    segments.intro,
    "",
    "--- A HIRDETETT INGATLAN ---",
    `Forrás: ${source}`,
    `Mai dátum: ${todayHu()}`,
    `Final URL: ${finalUrl}`,
    body,
    "----------------------------",
    "",
    segments.task,
  ].join("\n");
}
