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
    placeholder: "Válassz a listából (opcionális)",
    required: false,
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
    placeholder: "Válassz a listából (opcionális)",
    required: false,
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
${locationBlock(input)}`;
}

/**
 * Kód-generált dátumsor: a modell a KONKRÉT mai dátumot és a "friss" statisztikák
 * időhatárát lássa. Forrás-független (mindkét prompt-verzió elé bekerül), mert az
 * adott adatbázis (ingatlan.com vagy GDN) stratégiáját a szerkeszthető
 * "source" szegmens írja le.
 */
export function valuationDateNote(): string {
  const now = new Date();
  const from = new Date(now);
  from.setMonth(from.getMonth() - 6);
  const d = (x: Date) => x.toISOString().slice(0, 10);
  return `ADATFRISSESSÉG:
- Mai dátum: ${d(now)}. A kiegészítő, ellenőrző nyilvános piaci statisztikák lehetőleg ${d(from)} utániak legyenek.
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

// Az alap (régi) verzió ADATFORRÁS-stratégiája: elsődlegesen az aktív ingatlan.com
// hirdetések. Ez a "source" szegmens szerkeszthető és verziózható — a GDN-verzió ezt
// írja felül (lásd VALUATION_GDN_SEGMENTS).
const SOURCE_INGATLANCOM = `ADATFORRÁS ÉS ELEMZÉSI BÁZIS:
- Elsődleges adatforrás: a JELENLEG AKTÍV, nyilvános ingatlan.com hirdetések. Ezekből építsd fel a comps-listát.
- Ha egy hirdetés láthatóan régi vagy már nem elérhető, csak ellenőrző háttérként vedd figyelembe, csökkentett súllyal.
- Kiegészítő, ellenőrző források: nyilvános piaci statisztikák és szakmai elemzések — KSH, MNB lakásárindex, ingatlan.com és Duna House piaci elemzések, Otthon Centrum, otthonterkep.hu, szakmai sajtó. Ezekből NE indulj ki, csak az aktív kínálatot velük ellenőrizd és ágyazd be.
- Ha az aktív hirdetések és az átlagadatok eltérnek, az aktív kínálatot súlyozd feljebb.`;

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
  source: SOURCE_INGATLANCOM,
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
- A LEGELSŐ szakasz a "Javasolt ár": ide PONTOSAN EGY darab konkrét TELJES VÉTELÁRAT írj forintban (a lakás teljes forgalmi értéke = korrigált nm-ár × alapterület, a lokációs prémiummal együtt), semmi mást. Ez NEM a négyzetméterár, hanem a teljes ingatlan ára — így jellemzően tíz- vagy százmilliós nagyságrend. NE írj ársávot, tartományt, kötőjelet, zárójelet, nm-árat vagy magyarázatot — csak egyetlen számot mértékegységgel. Pl.: "80 000 000 Ft". Az ársáv külön, a "8. Értéksáv" szakaszba kerül.
- Az "Aktív összehasonlító ingatlanok listája" szakaszban 5-8 jelenleg aktív ingatlan.com hirdetést sorolj fel: alapterület, állapot, emelet/lift, irányár, fajlagos ár, és ahol lehet, a hirdetés linkje vagy azonosítója. Kitalált hirdetést tilos közölni.
- A "Korrekciós táblázat" tartalmazza a lokációs prémium sort is (a megadott százalék, a forintos különbség és a korrigált ár), valamint a lakás-specifikus korrekciókat tételesen, százalékosan.
- A "Súlyozás és számítás" mutassa a bázis nm-árat (az aktív hirdetések súlyozott átlaga), a compok súlyait, majd a korrigált nm-árat és a végső értéket (nm-ár × alapterület).
- A "Becsült piaci érték" a fő szám forintban, az "Értéksáv" alsó–felső HUF sáv.
- Mind a 12 szakasz kötelező, konkrét számokkal kitöltve.`,
};

// --- ÚJ VERZIÓ: GDN Ingatlan iroda bázisa + lazító létra ---------------------
// A partner bevált (fenti) modellre támaszkodik, de a piaci árat elsődlegesen a GDN
// Ingatlan iroda kínálatából (gdn-ingatlan.hu) próbálja levezetni. Mivel a GDN
// ~6000 ingatlant kezel az ingatlan.com ~40000-es kínálatához képest, sokkal
// nagyobb "lazító létrát" kap: nem kell pont a megadott paraméterű ingatlant
// megtalálni — a leginkább hasonló, legközelebb álló GDN-ingatlan is jó alapot ad.
export const VALUATION_GDN_SEGMENTS = {
  intro: `Bújj egy tapasztalt, adatalapú ingatlanpiaci szakértő szerepébe. Száraz, tényszerű, strukturált elemzést adj. Ne írj felesleges bevezetőt, ne kommentáld a saját módszeredet, és ne használj önértékelő vagy bizonytalanító kifejezéseket. A feladat kizárólag az, hogy a megadott ingatlanra a lehető legpontosabb piaci értékbecslést készítsd, elsődlegesen a **GDN Ingatlan iroda kínálatából és adataiból** (gdn-ingatlan.hu), a legrelevánsabb kiegészítő nyilvános piaci adatokkal ellenőrizve.

## Feladat
Készíts ingatlan-értékbecslést az alábbi paraméterekkel rendelkező ingatlanról.

## Kötelező elemzési logika
1. **Elsődleges adatforrás: a GDN Ingatlan iroda kínálata (gdn-ingatlan.hu)**
   - A comps-listát elsődlegesen a GDN iroda által hirdetett / kezelt ingatlanokból építsd fel.
   - A piaci átlagokat, statisztikákat és szakmai elemzéseket csak kiegészítő, ellenőrző forrásként használd (árszint-beágyazás, outlier-szűrés).

2. **Lazító létra (relaxációs keresés) — EZ A LEGFONTOSABB SZABÁLY**
   - A GDN kínálata jóval kisebb (kb. 6000 ingatlan), mint az országos portáloké (kb. 40000), ezért NEM kell pontosan a megadott paraméterű ingatlant megtalálni.
   - Ha nincs pontos egyezés, fokozatosan lazíts, és MINDIG a keresett ingatlanhoz LEGKÖZELEBB álló, leginkább hasonló GDN-ingatlant válaszd. A hasonló árfekvésű, közeli paraméterű ingatlan is elfogadható alap.
   - A lazítás javasolt fokozatai (csak annyit lazíts, amennyi az elégséges mintához kell):
     1. fok — pontos: azonos település + azonos típus + hasonló méret (±10-15%) + hasonló szoba/fürdő/emelet.
     2. fok — méret- és paraméter-sáv tágítása: méret ±20-30%, ±1 szoba, ±1 fürdő, szomszédos emeletek.
     3. fok — azonos településen belül más városrész, azonos vagy közeli ingatlantípus.
     4. fok — hasonló árfekvésű, közeli település vagy régió, azonos típus.
   - Mindig jegyezd fel, hányadik lazítási fokot használtad, és a kiválasztott comp mennyiben tér el a keresett ingatlantól. Ezt az "Adatminőség" szakaszban jelezd.
   - Példa: ha a keresett ingatlan "Szeged, 50 nm, 2 szoba, 1 fürdő, 2. emelet", és pont ilyen nincs a GDN-en, akkor a legközelebbi hasonlót vedd (pl. 45-58 nm, 1-2 fürdő, 1-3. emelet, Szeged), majd ha ott sincs elég, tovább lazíts a fenti létra szerint.

3. **Lokációs szűrés a lazító létrán belül**
   - Budapest esetén elsődlegesen az adott kerület, majd szükség szerint a szomszédos, hasonló árfekvésű kerületek.
   - Vidéki település esetén az adott település, majd a közeli, hasonló piacú települések.
   - Ha városrész és utca is meg van adva, vedd figyelembe a mikrolokációt, de a lazító létra engedi a tágítást, ha kevés a GDN-adat.

4. **Compok kiválasztása**
   - Lehetőleg 5-8 GDN-comp; ha a GDN-en kevesebb releváns adat van, annyit válassz, amennyi valósan elérhető, és ezt jelezd.
   - Elsődlegesen vizsgáld: alapterület, állapot, emelet, lift, erkély/loggia/terasz, jogi helyzet, mikrolokáció.
   - Szűrd ki az outliereket és a félrevezető példákat.

5. **Kiegészítő piaci ellenőrzés**
   - A GDN-ből képzett árszintet vesd össze a nyilvános piaci statisztikákkal (KSH, MNB lakásárindex, ingatlan.com / Duna House piaci elemzések, otthonterkep.hu).
   - Ezek szerepe az ellenőrzés és a beágyazás; ne ezekből indulj ki. Ha a GDN-minta nagyon szűk, a piaci statisztikák nagyobb ellenőrző súlyt kapnak — ezt jelezd.

6. **Állapot és lakásspecifikus korrekciók**
   - A bázisárat lehetőleg azonos műszaki állapotú ingatlanokból állítsd össze; ha nem lehet, a különbséget tételes százalékos korrekcióval kezeld.
   - Külön kezeld: emelet, lift megléte/hiánya, erkély/loggia/terasz, utcai vagy belső fekvés, tájolás/panoráma, közös költség, társasház állapota, energetika.

7. **Számítási menet**
   - Határozz meg egy bázis négyzetméterárat a kiválasztott GDN-compok súlyozott átlagából.
   - Alkalmazz mikrolokációs és lakás-specifikus korrekciókat tételesen.
   - Számíts végső korrigált négyzetméterárat, majd becsült forgalmi értéket (korrigált nm-ár × hasznos alapterület).
   - Ha releváns, adj külön értéksávot.

8. **Lokációs prémium**
   - A megadott lokációs prémiumot pontosan alkalmazd (a pontos értéket az adatblokk tartalmazza).
   - Ha a prémium 0% vagy nincs megadva, ne alkalmazz külön lokációs szorzót.
   - A lokációs prémiumot a GDN-bázisból képzett bázisárra kell alkalmazni.

9. **Súlyozás**
   - A compokat pontozd relevancia szerint: lokáció, hasonlóság (méret/szoba/fürdő/emelet), állapot, lift, erkély, jogi tisztaság, különleges jellemzők.
   - A keresett ingatlanhoz LEGKÖZELEBB álló GDN-compok kapják a legnagyobb súlyt. A távolabbi (több lazítási fokkal elért) compok kisebb súlyt kapnak.
   - A súlyozott átlag számítása legyen átlátható.

10. **Bizonytalanság kezelése**
   - Ne tagadd meg a becslést. Ha a GDN-en kevés az adat, a lazító létra és a kiegészítő piaci statisztikák alapján akkor is készíts becslést.
   - Az adatkorlátokat és a felhasznált lazítási fokot az "Adatminőség" sorban jelezd.

## Stabilizálás és konzisztencia (KÖTELEZŐ)
A cél, hogy két azonos adatokkal indított futás KÖZEL AZONOS árat adjon. Ezért ebben a sorrendben dolgozz:
- MIKROLOKÁCIÓ-AZONOSÍTÁS ELŐSZÖR: mielőtt bármilyen árat rögzítenél, azonosítsd a megadott utca/városrész pontos piaci zónáját és sorold be (prémium / népszerű / átlagos / kedvezőbb), majd a riportban NEVEZD IS MEG. Ugyanaz a kerület több, eltérő árszintű zónát tartalmazhat (pl. Budapest XIII.: az Újlipótváros prémium/népszerű ~1,6-2,2 M Ft/m², az Angyalföld-belső olcsóbb) — MINDIG a megadott utcához tartozó zónát használd, ne a kerület legolcsóbb részét.
- HORGONY: ezután rögzíts egy referencia (átlag) négyzetméterárat a mikrolokációra és az ingatlan típusára/állapotára, nyilvános piaci adatokból (otthonterkep.hu kerületi/utcaszintű átlag, KSH, MNB lakásárindex, ingatlannet.hu, ingatlan.com piaci elemzések). Ez a HORGONY-nm-ár, ez a stabil referencia.
- HORGONY MEGERŐSÍTÉSE: a HORGONY-t legalább 2-3 független nyilvános forrásból erősítsd meg és egyeztesd. Ha az egyik forrás a többihez képest kiugróan alacsony vagy magas (>25% eltérés), azt VESD EL, ne súlyozd be.
- REALITÁS-KORLÁT (Budapest): jó állapotú budapesti téglalakás fajlagos ára reálisan RITKÁN esik 1 000 000 Ft/m² alá; belső és belső-környéki, népszerű zónákban (pl. V., VI., VII., IX., XIII. Újlipótváros) jellemzően 1,3-2,2 M Ft/m². Ha a HORGONY-d egy ilyen népszerű budapesti mikrolokációnál ez alá esik, az szinte biztosan ADATHIBA (rossz zóna vagy elavult adat) — ne számolj vele, keress újra, és igazítsd a reális szintre.
- KÖZÖS ALULLÖVÉS SZŰRÉSE: ha a GDN-compok fajlagos ára EGYÜTTESEN a mikrolokáció reális szintje alatt van, ne fogadd el automatikusan — ellenőrizd, nem kevertél-e össze olcsóbb zónát vagy távoli/nem hasonló ingatlanokat. A mikrolokáció realitás-korlátja felülírja a téves, olcsó compokat.
- SÁV: a GDN-compokból számított bázis nm-ár a HORGONY ±12%-os sávjában maradjon. Csak akkor lépj ki a sávból, ha tételes, számszerű indokod van (pl. kiemelt mikrolokáció vagy állapot), és akkor is legfeljebb ±20%-ig.
- MEDIÁN + KEREKÍTÉS: a bázis nm-árat a kiválasztott GDN-compok MEDIÁNJÁBÓL számítsd (nem a szélsőségekre érzékeny egyszerű átlagból), majd kerekítsd a legközelebbi 5 000 Ft/nm értékre. Így a kis eltérések nem ugráltatják az eredményt.
- TIPIKUS SZEGMENS A HORGONYHOZ: a HORGONY és a bázis a zóna TIPIKUS, a megadotthoz hasonló méretű és állapotú lakását tükrözze. A nagypolgári, kiemelt prémium, panorámás vagy kiugróan eltérő méretű ingatlanokat NE építsd sem a HORGONY-ba, sem a bázis-mediánba — ezek csak külön, tételes korrekcióként jelenhetnek meg (és outlierként kis súllyal). Így a HORGONY futásonként stabil marad.
- HIRDETÉSI → TRANZAKCIÓS ÁR (KÖTELEZŐ): a GDN- és portál-compok IRÁNYÁRAK (hirdetési árak), amelyek jellemzően magasabbak a tényleges eladási árnál. A becslés célja a reálisan ELÉRHETŐ eladási ár, ezért a bázis nm-árra alkalmazz egy tételes alku/tranzakciós korrekciót: a jelenlegi magyar piacon jellemzően -5...-10% (belső budapesti, népszerű zónákban 2025-2026-ban kb. -6...-8%). Ha van valós, zárt tranzakciós adat (KSH/MNB tranzakciós index, GDN eladott ingatlanok), azzal kalibráld. A végső korrigált nm-ár már a TRANZAKCIÓS szintet tükrözze, ne a hirdetési szintet.
- LAKÁS-KORREKCIÓK PLAFONJA: a lakás-specifikus korrekciók EGYÜTTES nettó hatása szokásos (nem kiemelt) ingatlannál maradjon ±5%-on belül; efölé csak tételes, erős indokkal lépj (pl. teljes felújítás, panoráma, kiemelt extra). Így egy átlagos lakás korrekciói nem tolják el jelentősen a bázisárat.
- FOTÓ-ALAPÚ ÁLLAPOT: ha a bemenetben szerepel "FOTÓ-ALAPÚ ÁLLAPOTÉRTÉKELÉS" blokk (a partner feltöltött fotóiból), azt a lakás-specifikus korrekcióknál vedd figyelembe — de a fotók hirdetési célúak, lehetnek beállítottak, ezért KONZERVATÍVAN: a fotó-alapú korrekció önmagában ne lépje túl a ±5%-ot, alacsony megbízhatóságnál kisebb súllyal számolj, és a "Korrekciós táblázat"-ban külön, tételes sorként tüntesd fel.
- MECHANIKUS VÉGSŐ ÁR: a "Javasolt ár" KÖTELEZŐEN a korrigált (tranzakciós szintű) nm-ár × hasznos alapterület (a lokációs prémiummal együtt), a legközelebbi 500 000 Ft-ra kerekítve. Ez PONTOSAN egyezzen meg a "Becsült piaci érték" szakasz fő számával, és essen bele az "Értéksáv"-ba. A hirdetési→tranzakciós korrekció a korrigált nm-ár RÉSZE (nem külön, utólagos csökkentés); ezen felül TILOS a számított érték alá csökkenteni vagy fölé emelni — a végső ár mechanikusan a levezetésből jöjjön.
- A riportban KÖTELEZŐEN tüntesd fel a HORGONY-nm-árat, a GDN-alapú bázis nm-árat és a kettő eltérését százalékban.
- A lokációs prémiumot és a lakás-specifikus korrekciókat a sávon belül maradó bázisárra alkalmazd.

## Számítási elv
- HORGONY-nm-ár = a mikrolokáció + típus/állapot nyilvános piaci átlag négyzetméterára (referencia).
- Bázisár = a kiválasztott GDN-compok MEDIÁN fajlagos ára, a HORGONY ±12%-os sávjába illesztve (a lazító létra szerint a legközelebbi hasonló ingatlanokból), 5 000 Ft/nm-re kerekítve.
- Korrigált nm-ár = bázisár + mikrolokációs korrekció + lakás-specifikus korrekciók.
- Becsült érték = korrigált nm-ár × hasznos alapterület.

## Stílus
- Tényszerű, tömör, strukturált. Csak a lényeges információk. Számokat, százalékokat és levezetést tételesen mutass. A végső válasz legyen ellenőrizhető és visszakövethető.`,
  source: `ADATFORRÁS ÉS ELEMZÉSI BÁZIS:
- Elsődleges adatforrás: a GDN Ingatlan iroda kínálata és adatai (gdn-ingatlan.hu) — a GDN által hirdetett / kezelt ingatlanok.
- A GDN kínálata kisebb (kb. 6000 ingatlan), mint az országos portáloké (kb. 40000), ezért ALKALMAZD A LAZÍTÓ LÉTRÁT: ne ragaszkodj a pontos paraméterekhez, hanem mindig a keresett ingatlanhoz LEGKÖZELEBB álló, leginkább hasonló GDN-ingatlant vedd alapul. A hasonló árfekvésű, közeli paraméterű ingatlan is jó alap.
- Kiegészítő, ellenőrző források: nyilvános piaci statisztikák és szakmai elemzések — KSH, MNB lakásárindex, ingatlan.com és Duna House piaci elemzések, Otthon Centrum, otthonterkep.hu, ingatlannet.hu. Ezekből számítsd a HORGONY-nm-árat (a mikrolokáció + típus/állapot piaci átlag négyzetmétere), és a GDN-ből képzett bázis nm-ár ennek a ±12%-os sávjában maradjon.
- STABILIZÁLÁS: a bázis nm-árat a GDN-compok MEDIÁNJÁBÓL számítsd, 5 000 Ft/nm-re kerekítve, és a HORGONY ±12%-os sávjában tartsd (kilépés csak tételes indokkal, max. ±20%). Így két azonos futás közel azonos árat ad.
- Jelezd, hányadik lazítási fokot használtad, a HORGONY-nm-árat, a GDN-bázis nm-árat és a kettő eltérését %-ban.`,
  task: `## Kimeneti forma
A választ KIZÁRÓLAG az alábbi 12 szakaszban add meg. Minden szakaszt önálló, "## " kezdetű markdown címsorként írj ki (pontosan a megadott címmel), a szakaszon belül pedig sima felsorolással vagy rövid bekezdésekkel. Ne tegyél fel kérdést, ne kérj vissza adatot, és ne írj a szerkezeten kívüli szöveget.

## Javasolt ár
## 1. Vizsgált ingatlan adatai
## 2. GDN összehasonlító ingatlanok listája
## 3. Kiegészítő piaci források
## 4. Korlátozások és lazítási elvek
## 5. Korrekciós táblázat
## 6. Súlyozás és számítás
## 7. Becsült piaci érték
## 8. Értéksáv
## 9. Adatminőség
## 10. Rövid szakmai indoklás
## 11. Végső összegzés

Kötelező tartalmi elvárások:
- A LEGELSŐ szakasz a "Javasolt ár": ide PONTOSAN EGY darab konkrét TELJES VÉTELÁRAT írj forintban (a lakás teljes forgalmi értéke = korrigált nm-ár × alapterület, a lokációs prémiummal együtt), 500 000 Ft-ra kerekítve, semmi mást. Ez az érték KÖTELEZŐEN egyezzen meg a "7. Becsült piaci érték" fő számával, és essen bele a "8. Értéksáv" tartományba — TILOS a sáv alá csökkenteni "alku/értékesítési" indokkal vagy a számított érték fölé emelni. Ez NEM a négyzetméterár, hanem a teljes ingatlan ára — így jellemzően tíz- vagy százmilliós nagyságrend. NE írj ársávot, tartományt, kötőjelet, zárójelet, nm-árat vagy magyarázatot — csak egyetlen számot mértékegységgel. Pl.: "80 000 000 Ft". Az ársáv külön, a "8. Értéksáv" szakaszba kerül.
- A "GDN összehasonlító ingatlanok listája" szakaszban a GDN kínálatából (gdn-ingatlan.hu) sorolj fel 5-8 (vagy ha kevesebb elérhető, annyi) leginkább hasonló ingatlant: alapterület, állapot, emelet/lift, irányár, fajlagos ár, mikrolokáció, és ahol lehet, a hirdetés linkje vagy azonosítója. Minden compnál jelöld, melyik lazítási fokkal került be és mennyire tér el a keresett ingatlantól. Kitalált hirdetést tilos közölni.
- A "Korlátozások és lazítási elvek" szakasz mondja ki, meddig kellett lazítani a mintáért, és mennyire hasonlóak a compok a keresett ingatlanhoz.
- A "Kiegészítő piaci források" szakaszban KÖTELEZŐEN nevezd meg az azonosított mikrolokáció-zónát és piaci besorolását (prémium / népszerű / átlagos / kedvezőbb), valamint a HORGONY-nm-árat megerősítő 2-3 forrást. Ha egy forrást kiugróként elvetettél, azt is jelezd.
- A "Korrekciós táblázat" tartalmazza a lokációs prémium sort is (a megadott százalék, a forintos különbség és a korrigált ár), valamint a lakás-specifikus korrekciókat tételesen, százalékosan.
- A "Súlyozás és számítás" KÖTELEZŐEN mutassa: a HORGONY-nm-árat (nyilvános piaci átlag), a GDN-compok MEDIÁNJÁBÓL számított bázis nm-árat (5 000 Ft/nm-re kerekítve, a HORGONY ±12%-os sávjában), a kettő eltérését %-ban, a compok súlyait, a hirdetési→tranzakciós korrekciót (%-ban, tételesen), a lakás-specifikus korrekciók nettó hatását (±5% plafonnal), majd a végső korrigált (tranzakciós szintű) nm-árat és a végső értéket (nm-ár × alapterület).
- A "Becsült piaci érték" a fő szám forintban, az "Értéksáv" alsó–felső HUF sáv (a bázis nm-ár sávjából, tehát szűk, nem tág tartomány).
- Az "Adatminőség" sorban jelezd a GDN-minta méretét, a felhasznált lazítási fokot, a HORGONY és a GDN-bázis eltérését, és a kiegészítő piaci ellenőrzés súlyát.
- Mind a 12 szakasz kötelező, konkrét számokkal kitöltve.`,
};

export function composeValuationPrompt(
  input: ValuationInput,
  segments: { intro?: string; source?: string; task?: string },
  // Opcionális, fotó-alapú állapot-blokk (lásd lib/property-vision.ts). Ha van,
  // az adatblokk után kerül be — a modell a lakás-korrekcióknál használja fel.
  conditionText?: string
): string {
  const intro = (segments.intro ?? VALUATION_DEFAULT_SEGMENTS.intro).trim();
  const source = (segments.source ?? VALUATION_DEFAULT_SEGMENTS.source).trim();
  const task = (segments.task ?? VALUATION_DEFAULT_SEGMENTS.task).trim();
  const condition = conditionText && conditionText.trim() ? `\n\n${conditionText.trim()}` : "";
  return `${intro}\n\n${valuationDataBlock(input)}${condition}\n\n${valuationDateNote()}\n\n${source}\n\n${task}`;
}
