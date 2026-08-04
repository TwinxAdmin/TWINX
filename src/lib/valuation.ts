// Ingatlan Értékbecslő — 14 mezős konfiguráció + validáció (kliens + szerver).
// A partner bevált Perplexity-eszköze alapján. A mezők datalist-javaslatokkal:
// "válassz a listából vagy írj sajátot" (native <datalist>).

export type ValuationInput = {
  telepules: string;
  utca: string;
  tipus: string;
  meret: string;
  telek: string;
  szint: string;
  szobak: string;
  furdok: string;
  epitesEve: string;
  szerkezet: string;
  allapot: string;
  futes: string;
  jogi: string;
  egyeb: string;
  // Lokációs prémium: a környék megítélése és a partner által megadott felár.
  lokacioKategoria: string;
  lokacioSzazalek: string;
};

export const EMPTY_VALUATION: ValuationInput = {
  telepules: "",
  utca: "",
  tipus: "",
  meret: "",
  telek: "",
  szint: "",
  szobak: "",
  furdok: "",
  epitesEve: "",
  szerkezet: "",
  allapot: "",
  futes: "",
  jogi: "",
  egyeb: "",
  lokacioKategoria: "Átlagos",
  lokacioSzazalek: "",
};

export type ValuationField = {
  key: keyof ValuationInput;
  label: string; // a promptban is ez a címke szerepel
  placeholder: string;
  required: boolean;
  fullWidth?: boolean;
  options?: string[]; // datalist javaslatok
};

// --- Választható opciók (a Hirdetéskészítő is ezekből dolgozik — ne duplázzuk!) ---
export const PROPERTY_TYPE_OPTIONS = [
  "Új építésű lakás",
  "Új építésű családi ház",
  "Használt családi ház",
  "Ikerház fél",
  "Sorház",
  "Tégla építésű társasházi lakás",
  "Panellakás",
  "Csúsztatott zsalus lakás",
  "Építési telek",
  "Nyaraló / Hétvégi ház",
];

export const FLOOR_OPTIONS = [
  "Földszintes",
  "Földszint + emelet",
  "Földszint + tetőtér",
  "Földszint (kertkapcsolatos)",
  "Magasföldszint",
  "1. emelet",
  "2. emelet",
  "3. emelet",
  "4. emelet",
  "5. emelet",
  "6. emelet",
  "7. emelet",
  "8. emelet",
  "9. emelet",
  "10. emelet",
  "Zárószint / Tetőtér",
];

export const STRUCTURE_OPTIONS = [
  "Tégla (pl. Porotherm)",
  "Panel / Házgyári",
  "Csúsztatott zsalus",
  "Könnyűszerkezetes (fa/fém vázas)",
  "Ytong",
  "Vasbeton",
  "Vályog / Vegyes falazat",
];

// Szobaszám — a leggyakoribb kombinációk; saját érték is beírható (ComboField).
export const ROOM_OPTIONS = [
  "1 szoba",
  "1 + 1 fél szoba",
  "2 szoba",
  "2 + 1 fél szoba",
  "3 szoba",
  "3 + 1 fél szoba",
  "4 szoba",
  "4 + 1 fél szoba",
  "5 szoba",
  "5 vagy több szoba",
];

// Fürdőszobák / mellékhelyiségek.
export const BATHROOM_OPTIONS = [
  "1 fürdőszoba (WC-vel egyben)",
  "1 fürdőszoba + külön WC",
  "2 fürdőszoba",
  "2 fürdőszoba + külön WC",
  "3 vagy több fürdőszoba",
];

export const CONDITION_OPTIONS = [
  "Új építésű (kulcsrakész)",
  "Új építésű (szerkezetkész/félkész)",
  "Újszerű (pár éve épült/felújított)",
  "Kiváló / Prémium állapotú",
  "Jó állapotú (azonnal költözhető)",
  "Közepes állapotú (korszerűsítést igényel)",
  "Felújítandó",
  "Bontandó / Teljesen átépítendő",
];

// --- Lokációs prémium korrekció -------------------------------------------
// A környék megítélése felfelé módosíthatja a piaci átlagárat. A kategóriát ÉS a
// százalékot is a partner adja meg — ő ismeri a mikrolokációt, nem a modell.
export const LOCATION_PREMIUM_MIN = 5;
export const LOCATION_PREMIUM_MAX = 25;

// range = a legördülőben látszó sáv, suggested = a csúszka kezdőértéke.
export const LOCATION_CATEGORIES = [
  {
    value: "Átlagos",
    premium: false,
    range: "0%",
    suggested: 0,
    hint: "Nincs felár (0%) — a piaci átlagár változatlan marad.",
  },
  {
    value: "Népszerű",
    premium: true,
    range: "5-12%",
    suggested: 8,
    hint: "Keresett környék — jellemzően 5-12% felár. A pontos értéket te állítod be.",
  },
  {
    value: "Kiemelten prémium",
    premium: true,
    range: "12-25%",
    suggested: 15,
    hint: "Kiemelt fekvés (panoráma, belváros, exkluzív utca) — jellemzően 12-25% felár. A pontos értéket te állítod be.",
  },
] as const;

/** A kategóriához ajánlott kiinduló százalék (a csúszka kezdőértéke). */
export function suggestedLocationPremium(value: string): number {
  return LOCATION_CATEGORIES.find((c) => c.value === value)?.suggested ?? 0;
}

export function isPremiumCategory(value: string): boolean {
  return LOCATION_CATEGORIES.some((c) => c.value === value && c.premium);
}

/** A megadott százalék beolvasása és határok közé szorítása. 0 = nincs korrekció. */
export function parseLocationPremium(raw: string | undefined, category: string): number {
  if (!isPremiumCategory(category)) return 0;
  const n = Number(String(raw ?? "").replace("%", "").replace(",", ".").trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(LOCATION_PREMIUM_MAX, Math.max(LOCATION_PREMIUM_MIN, Math.round(n)));
}

export const VALUATION_FIELDS: ValuationField[] = [
  {
    key: "telepules",
    label: "Település, kerület/környék",
    placeholder: "pl. Budapest 11. kerület / Mogyoród",
    required: true,
  },
  {
    key: "utca",
    label: "Pontosabb helyszín/utca",
    placeholder: "pl. Gazdagrét / Árpád vezér út",
    required: false,
  },
  {
    key: "tipus",
    label: "Ingatlan típusa",
    placeholder: "Válassz a listából vagy írj sajátot",
    required: true,
    options: PROPERTY_TYPE_OPTIONS,
  },
  {
    key: "meret",
    label: "Méret (lakóterület nm-ben)",
    placeholder: "pl. 65 nm",
    required: true,
  },
  {
    key: "telek",
    label: "Telek területe (nm-ben)",
    placeholder: "Válassz vagy írd be (pl. 400 nm)",
    required: true,
    options: ["Nincs (társasházi lakás)", "Osztatlan közös kert", "Belső udvar / Gang"],
  },
  {
    key: "szint",
    label: "Épület szintje / Szintek száma",
    placeholder: "Válassz a listából",
    required: true,
    options: FLOOR_OPTIONS,
  },
  {
    key: "szobak",
    label: "Szobák száma",
    placeholder: "Válassz a listából vagy írj sajátot",
    required: true,
    options: ROOM_OPTIONS,
  },
  {
    key: "furdok",
    label: "Fürdőszobák/mellékhelyiségek",
    placeholder: "Válassz a listából vagy írj sajátot",
    required: true,
    options: BATHROOM_OPTIONS,
  },
  {
    key: "epitesEve",
    label: "Építés éve",
    placeholder: "Válassz a listából vagy írd be",
    required: true,
    options: [
      "2020 után (Új vagy újszerű)",
      "2010-2020 között",
      "2000-es évek",
      "1990-es évek",
      "1980-as évek",
      "1970-es évek",
      "1960-as évek",
      "1950 előtt (Klasszikus/Polgári)",
    ],
  },
  {
    key: "szerkezet",
    label: "Szerkezet",
    placeholder: "Válassz a listából",
    required: true,
    options: STRUCTURE_OPTIONS,
  },
  {
    key: "allapot",
    label: "Műszaki és esztétikai állapot",
    placeholder: "Válassz a listából",
    required: true,
    options: [
      "Új építésű (kulcsrakész)",
      "Új építésű (szerkezetkész/félkész)",
      "Újszerű (pár éve épült/felújított)",
      "Kiváló / Prémium állapotú",
      "Jó állapotú (azonnal költözhető)",
      "Közepes állapotú (korszerűsítést igényel)",
      "Felújítandó",
      "Bontandó / Teljesen átépítendő",
    ],
  },
  {
    key: "futes",
    label: "Fűtésrendszer és energetika",
    placeholder: "Válassz a listából",
    required: true,
    options: [
      "Hőszivattyú (padló- és mennyezethűtés/fűtés)",
      "Gázcirkó (padlófűtés + radiátorok)",
      "Gázcirkó (csak radiátorok)",
      "Távfűtés (egyedi mérős)",
      "Távfűtés (átalánydíjas)",
      "Gázkonvektor",
      "Elektromos (fűtőpanel / infra)",
      "Hűtő-fűtő klímák (H-tarifa)",
      "Vegyes tüzelésű kazán / Cserépkályha",
    ],
  },
  {
    key: "jogi",
    label: "Jogi háttér / Tulajdoni viszonyok",
    placeholder: "Válassz a listából",
    required: true,
    options: [
      "1/1 tulajdon, tehermentes",
      "1/1 tulajdon, banki hitellel terhelt",
      "Osztatlan közös tulajdon (használati megosztással)",
      "Haszonélvezeti joggal terhelt",
      "Céges tulajdon / ÁFÁ-s",
      "Folyamatban lévő hagyatéki eljárás",
    ],
  },
  {
    key: "egyeb",
    label: "Egyéb főbb jellemzők / Extrák / Előnyök",
    placeholder: "pl. Klíma, napelem, panoráma, amerikai konyha, garázs, erkély (5 nm)",
    required: false,
    fullWidth: true,
  },
  // --- Lokációs prémium: a partner ítéli meg a környék megítélését. ---
  {
    key: "lokacioKategoria",
    label: "Lokációs kategória",
    placeholder: "Válassz a listából",
    required: false,
    options: LOCATION_CATEGORIES.map((c) => c.value),
  },
  {
    key: "lokacioSzazalek",
    label: "Lokációs prémium (%)",
    placeholder: `${LOCATION_PREMIUM_MIN}-${LOCATION_PREMIUM_MAX} között`,
    required: false,
  },
];

export function validateValuationInput(input: Partial<ValuationInput>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  for (const field of VALUATION_FIELDS) {
    if (field.required) {
      const value = String(input[field.key] ?? "").trim();
      if (value.length === 0) {
        errors[field.key] = `Kötelező mező: ${field.label}.`;
      }
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

// --- Prompt: zárolt adat-blokk + finomítható szegmensek --------------------
function vv(value: string): string {
  const t = String(value ?? "").trim();
  return t.length > 0 ? t : "[Nincs megadva]";
}

// Zárolt adat-blokk: az értékelt ingatlan 14 mezője (a változók helye zárolt).
export function valuationDataBlock(input: ValuationInput): string {
  return `Az értékelt ingatlan adatai:
- Település, kerület/környék: ${vv(input.telepules)}
- Pontosabb helyszín/utca: ${vv(input.utca)}
- Típus: ${vv(input.tipus)}
- Méret (lakóterület): ${vv(input.meret)}
- Telek terület: ${vv(input.telek)}
- Szintek száma / Épület szintje: ${vv(input.szint)}
- Szobák száma: ${vv(input.szobak)}
- Fürdőszobák/mellékhelyiségek száma: ${vv(input.furdok)}
- Építés éve: ${vv(input.epitesEve)}
- Szerkezet: ${vv(input.szerkezet)}
- Műszaki és esztétikai állapot: ${vv(input.allapot)}
- Fűtésrendszer és energetika: ${vv(input.futes)}
- Jogi háttér / Tulajdoni viszonyok: ${vv(input.jogi)}
- Egyéb főbb jellemzők/extrák: ${vv(input.egyeb)}
${locationBlock(input)}

${freshnessBlock(input)}`;
}

/**
 * Frissesség: a modell a KONKRÉT dátumtartományt lássa, ne csak azt, hogy
 * "az elmúlt 3 hónap". A kódból generáljuk, mert az ai_prompts aktív szegmensei
 * felülírhatják az intro/task szövegét.
 */
function freshnessBlock(_input: ValuationInput): string {
  const now = new Date();
  const from = new Date(now);
  from.setMonth(from.getMonth() - 6);
  const d = (x: Date) => x.toISOString().slice(0, 10);

  return `ADATFRISSESSÉG:
- Mai dátum: ${d(now)}. Elsődlegesen a JELENLEG AKTÍV ingatlan.com hirdetéseket használd
  (comps-lista). Ha egy hirdetés láthatóan régi vagy már nem elérhető, csak ellenőrző
  háttérként vedd figyelembe, csökkentett súllyal.
- Kiegészítő, ellenőrző források: friss (${d(from)} utáni) nyilvános piaci statisztikák és
  szakmai elemzések — KSH, MNB lakásárindex, ingatlan.com és Duna House piaci elemzések,
  Otthon Centrum, otthonterkep.hu, szakmai sajtó. Ezekből NE indulj ki, csak az aktív
  kínálatot velük ellenőrizd és ágyazd be.
- Kitalált konkrét hirdetést (cím, link, hirdető) tilos közölni.`;
}

/** A lokációs korrekció sorai. Ha nincs felár, ezt egyértelműen kimondjuk,
 *  hogy a modell ne találjon ki magától szorzót. */
function locationBlock(input: ValuationInput): string {
  const category = String(input.lokacioKategoria ?? "").trim();
  const pct = parseLocationPremium(input.lokacioSzazalek, category);
  if (!pct) {
    return `- Lokációs kategória: ${category || "Átlagos"}
- Lokációs prémium: NINCS (0%) — ne alkalmazz semmilyen lokációs szorzót

KÖTELEZŐ LOKÁCIÓS SZABÁLY: a lokáció átlagos, ezért a bázisárat NEM módosítod felfelé.
A "Korrekciós táblázat" szakaszban ettől függetlenül szerepeljen egy "Lokációs prémium"
sor, ezzel a tartalommal: 0% — 0 Ft — a korrigált ár megegyezik a bázisárral.`;
  }
  return `- Lokációs kategória: ${category}
- Lokációs prémium: ${pct}% (a partner által megadott, KÖTELEZŐEN ezzel számolj)

KÖTELEZŐ LOKÁCIÓS SZABÁLY: a bázisárat KÖTELEZŐEN súlyozd pontosan ${pct}%-os értéknövelő
szorzóval (bázisár × ${(1 + pct / 100).toFixed(2)}). Saját szorzót NE találj ki, és a ${pct}%-tól
semmilyen irányban ne térj el. A "Korrekciós táblázat" szakaszban szerepeljen egy "Lokációs
prémium" sor, amely tartalmazza: a százalékos mértéket (${pct}%), a forintos különbséget és a
korrigált árat. Minden ezt követő érték (végső nm-ár, becsült piaci érték, értéksáv) már a
lokációs prémiummal korrigált árra épüljön.`;
}

export const VALUATION_DATA_BLOCK_PREVIEW = `Az értékelt ingatlan adatai:
- Település, kerület/környék: {település}
- Pontosabb helyszín/utca: {utca}
- Típus: {típus}
- Méret (lakóterület): {méret}
- Telek terület: {telek}
- Szintek száma / Épület szintje: {szint}
- Szobák száma: {szobák}
- Fürdőszobák/mellékhelyiségek száma: {fürdők}
- Építés éve: {építés éve}
- Szerkezet: {szerkezet}
- Műszaki és esztétikai állapot: {állapot}
- Fűtésrendszer és energetika: {fűtés}
- Jogi háttér / Tulajdoni viszonyok: {jogi}
- Egyéb főbb jellemzők/extrák: {egyéb}
- Lokációs kategória: {lokációs kategória}
- Lokációs prémium: {lokációs prémium %}`;

export const VALUATION_DEFAULT_SEGMENTS = {
  intro: `Bújj egy tapasztalt, adatalapú ingatlanpiaci szakértő szerepébe. Száraz, tényszerű, strukturált elemzést adj. Ne írj felesleges bevezetőt, ne kommentáld a saját módszeredet, és ne használj önértékelő vagy bizonytalanító kifejezéseket. A feladat kizárólag az, hogy a megadott ingatlanra a lehető legpontosabb piaci értékbecslést készítsd a **jelenleg aktív, valós ingatlan.com hirdetések** és a legrelevánsabb kiegészítő nyilvános piaci adatok alapján.

## Feladat
Készíts ingatlan-értékbecslést az alábbi paraméterekkel rendelkező lakásról.

## Kötelező elemzési logika
1. **Elsődleges adatforrás: aktív ingatlan.com hirdetések**
   - Az összehasonlítás alapja mindig a jelenleg aktív, nyilvános ingatlan.com hirdetések legyenek.
   - Elsősorban ezeket használd a comps-lista felépítéséhez.
   - A piaci átlagokat, statisztikákat és szakmai elemzéseket csak kiegészítő, ellenőrző forrásként használd.
   - Ha az aktív hirdetések és az átlagadatok eltérnek, az aktív kínálatot súlyozd feljebb.

2. **Lokációs szűrés**
   - Budapest esetén csak az adott kerületben keress.
   - Pest megye és más települések esetén az adott település és közvetlenül szomszédos települések vehetők figyelembe.
   - Ha városrész és utca is meg van adva, ellenőrizd, hogy az utca valóban a megadott városrészhez tartozik-e.
   - Csak azonos vagy nagyon közeli mikrolokációból válassz összehasonlító adatokat.

3. **Compok kiválasztása**
   - Legalább 5, legfeljebb 8 aktív hirdetést válassz.
   - Elsődlegesen a következőket vizsgáld: alapterület, állapot, emelet, lift, erkély/loggia/terasz, közös költség, jogi helyzet, mikrolokáció.
   - Szűrd ki az outliereket, a szélsőségesen magas vagy alacsony hirdetéseket, és a félrevezető vagy torzító példákat.
   - Osztatlan közös, használati megosztásos vagy rendezetlen jogi helyzetű hirdetéseket csak külön megjegyzéssel, csökkentett súllyal vedd figyelembe.

4. **Kiegészítő piaci források**
   - A jelenlegi aktív hirdetéseket egészítsd ki friss piaci statisztikákkal, ha szükséges.
   - Ezek szerepe az ellenőrzés, az árszint beágyazása és az outlierek kiszűrése.
   - Ne ezekből indulj ki, hanem az aktív kínálatból.

5. **Állapot szerinti illesztés**
   - A bázisárat lehetőleg azonos műszaki állapotú lakásokból állítsd össze.
   - Ha ez nem lehetséges, akkor a különbséget külön százalékos korrekcióval kezeld.
   - Az állapotkorrekció legyen tételes és átlátható.

6. **Lakásspecifikus korrekciók**
   - Külön kezeld az emeletet.
   - Külön kezeld a lift meglétét vagy hiányát.
   - Külön kezeld az erkélyt, loggiát, teraszt.
   - Külön kezeld az utcai vagy belső fekvést.
   - Külön kezeld a tájolást, benapozottságot, panorámát.
   - Külön kezeld a közös költséget.
   - Külön kezeld a társasház állapotát és műszaki színvonalát.
   - Külön kezeld az energetikai jellemzőket, ha elérhetők.

7. **Számítási menet**
   - Határozz meg egy bázis négyzetméterárat az aktív hirdetések súlyozott átlagából.
   - Alkalmazz mikrolokációs korrekciót.
   - Alkalmazz lakás-specifikus korrekciókat tételesen.
   - Számíts végső korrigált négyzetméterárat.
   - Számíts becsült forgalmi értéket a korrigált négyzetméterár és a lakás hasznos alapterülete alapján.
   - Ha releváns, adj külön értéksávot is.

8. **Lokációs prémium**
   - A megadott lokációs prémiumot pontosan alkalmazd (a pontos értéket az adatblokk tartalmazza).
   - Ha a prémium 0% vagy nincs megadva, ne alkalmazz külön lokációs szorzót.
   - A lokációs prémiumot az aktív hirdetésekből képzett bázisárra kell alkalmazni, és minden további levezetést ehhez kell igazítani.

9. **Súlyozás**
   - A compsokat pontozd a relevancia alapján.
   - A súlyozás alapja legyen:
     - lokáció,
     - időbeliség,
     - alapterület,
     - állapot,
     - emelet és lift,
     - közös költség,
     - erkély/loggia/terasz,
     - jogi tisztaság,
     - különleges jellemzők.
   - A leginkább hasonló, **jelenleg aktív** compok kapjanak nagyobb súlyt.
   - A régi vagy lezárt hirdetéseket csak ellenőrző háttérelemként használd, ha egyáltalán szükséges.
   - A súlyozott átlag számítása legyen átlátható.

10. **Bizonytalanság kezelése**
   - Ne tagadd meg a becslést.
   - Ha kevés az aktív adat, akkor is készíts becslést a legjobb rendelkezésre álló aktív hirdetésekből.
   - Az adatkorlátokat az **Adatminőség** sorban jelezd.
   - Az esetleges bizonytalanságot ne szöveges kitérőkkel, hanem külön mezőben jelenítsd meg.

## Számítási elv
- Bázisár = a kiválasztott aktív ingatlan.com hirdetések súlyozott átlagos fajlagos ára.
- Korrigált nm-ár = bázisár + mikrolokációs korrekció + lakás-specifikus korrekciók.
- Becsült érték = korrigált nm-ár × hasznos alapterület.
- A piaci átlagok és statisztikák csak kiegészítő ellenőrző szerepűek.
- Ha szükséges, külön jelezd az emelet-, lift-, erkély- és közös költség-hatást.

## Stílus
- Tényszerű, tömör, strukturált.
- Csak a lényeges információk szerepeljenek.
- Számokat, százalékokat és levezetést mindig tételesen mutass.
- A végső válasz legyen ellenőrizhető és visszakövethető.`,
  task: `## Kimeneti forma
A választ KIZÁRÓLAG az alábbi 12 szakaszban add meg. Minden szakaszt önálló, "## " kezdetű markdown címsorként írj ki (pontosan a megadott címmel), a szakaszon belül pedig sima felsorolással vagy rövid bekezdésekkel. Ne tegyél fel kérdést, ne kérj vissza adatot, és ne írj a szerkezeten kívüli szöveget.

## Javasolt ár
## 1. Vizsgált ingatlan adatai
## 2. Aktív összehasonlító ingatlanok listája
## 3. Kiegészítő piaci források
## 4. Korlátozások és szűrési elvek
## 5. Korrekciós táblázat
## 6. Súlyozás és számítás
## 7. Becsült piaci érték
## 8. Értéksáv
## 9. Adatminőség
## 10. Rövid szakmai indoklás
## 11. Végső összegzés

Kötelező tartalmi elvárások:
- A LEGELSŐ szakasz a "Javasolt ár": ide PONTOSAN EGY darab konkrét vételárat írj forintban (a lokációs prémiummal együtt), semmi mást. NE írj ársávot, tartományt, kötőjelet, zárójelet vagy magyarázatot — csak egyetlen számot mértékegységgel. Pl.: "80 000 000 Ft". Az ársáv külön, a "8. Értéksáv" szakaszba kerül.
- Az "Aktív összehasonlító ingatlanok listája" szakaszban 5-8 jelenleg aktív ingatlan.com hirdetést sorolj fel: alapterület, állapot, emelet/lift, irányár, fajlagos ár, és ahol lehet, a hirdetés linkje vagy azonosítója. Kitalált hirdetést tilos közölni.
- A "Korrekciós táblázat" tartalmazza a lokációs prémium sort is (a megadott százalék, a forintos különbség és a korrigált ár), valamint a lakás-specifikus korrekciókat tételesen, százalékosan.
- A "Súlyozás és számítás" mutassa a bázis nm-árat (az aktív hirdetések súlyozott átlaga), a compok súlyait, majd a korrigált nm-árat és a végső értéket (nm-ár × alapterület).
- A "Becsült piaci érték" a fő szám forintban, az "Értéksáv" alsó–felső HUF sáv.
- Mind a 12 szakasz kötelező, konkrét számokkal kitöltve.`,
};

export function composeValuationPrompt(
  input: ValuationInput,
  segments: { intro?: string; task?: string }
): string {
  const intro = (segments.intro ?? VALUATION_DEFAULT_SEGMENTS.intro).trim();
  const task = (segments.task ?? VALUATION_DEFAULT_SEGMENTS.task).trim();
  return `${intro}\n\n${valuationDataBlock(input)}\n\n${task}`;
}
