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
    placeholder: "pl. 2 szoba + 1 félszoba",
    required: true,
  },
  {
    key: "furdok",
    label: "Fürdőszobák/mellékhelyiségek",
    placeholder: "pl. 1 fürdő, 1 külön WC",
    required: true,
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
${locationBlock(input)}`;
}

/** A lokációs korrekció sorai. Ha nincs felár, ezt egyértelműen kimondjuk,
 *  hogy a modell ne találjon ki magától szorzót. */
function locationBlock(input: ValuationInput): string {
  const category = String(input.lokacioKategoria ?? "").trim();
  const pct = parseLocationPremium(input.lokacioSzazalek, category);
  if (!pct) {
    return `- Lokációs kategória: ${category || "Átlagos"}
- Lokációs prémium: NINCS (0%) — ne alkalmazz semmilyen lokációs szorzót

KÖTELEZŐ LOKÁCIÓS SZABÁLY: a lokáció átlagos, ezért a piaci átlagárat NEM
módosítod felfelé. A levezetésben ettől függetlenül szerepeljen egy
"Lokációs prémium korrekció" nevű önálló sor, ezzel a tartalommal:
0% — 0 Ft — a korrigált ár megegyezik a piaci átlagárral.`;
  }
  return `- Lokációs kategória: ${category}
- Lokációs prémium: ${pct}% (a partner által megadott, KÖTELEZŐEN ezzel számolj)

KÖTELEZŐ LOKÁCIÓS SZABÁLY: az árellenőrzés után kapott tiszta piaci átlagárat
KÖTELEZŐEN súlyozd pontosan ${pct}%-os értéknövelő szorzóval (bázisár × ${(1 + pct / 100).toFixed(2)}).
Saját szorzót NE találj ki, és a ${pct}%-tól semmilyen irányban ne térj el.
A végső strukturált levezetésben hozz létre egy önálló, "Lokációs prémium korrekció"
nevű sort, amely KIZÁRÓLAG ezt a három adatot tartalmazza:
1) a módosítás pontos százalékos mértéke (${pct}%),
2) az összegszerű különbség forintban,
3) a korrigált végső ár.
Minden ezt követő ár (ársáv, ajánlott hirdetési ár, összegzés) már a korrigált
árra épüljön.`;
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
  intro: `Bújj egy tapasztalt, adatalapú ingatlanpiaci szakértő szerepébe. Száraz, tényszerű, strukturált elemzést várok tőled. A válaszodban NE utalj a szemléletedre, a stílusodra, és ne használj olyan kifejezéseket a saját elemzésedre, mint "reális", "óvatos" vagy "pesszimista" – csak a tiszta adatokat és a végeredményt add meg a kért formátumban. Ne írj felesleges körítést vagy bevezetőt.

Feladat: Készíts ingatlan-értékbecslést az alábbi paraméterekkel rendelkező ingatlanról.

Keresési és elemzési instrukciók (ezt a háttérben végezd el):
1. LOKÁCIÓ ÉS KERESÉS: Az összehasonlító ingatlanok felkutatásakor szigorúan tartsd be az alábbi földrajzi szabályokat:
   - Ha Budapest: Csak és kizárólag az adott kerületen belül keress.
   - Ha Pest megye (vagy egyéb agglomeráció/vidék): Csak az adott települést és a közvetlenül szomszédos településeket veheted figyelembe.
   - Mikrolokáció ellenőrzés: Ha meg van adva városrész és utca, a háttérben többszörösen ellenőrizd le, hogy a megadott utca valóban abba a városrészbe esik-e. Az összehasonlításhoz csak azonos megítélésű és árfekvésű városrészből hozz példákat.
2. ELEMZÉS: A háttérben vizsgálj meg pontosan tizenöt darab (15 db) releváns összehasonlító ingatlant (semmiképp se téveszd össze a darabszámot Budapest 15. kerületével!).
3. ÁRELLENŐRZÉS: Első lépésként vizsgáld meg a kapott árakat. Zárd ki az irreálisan magas vagy alacsony (outlier) hirdetéseket. Ha a megmaradt adatokból számolt átlagár jelentősen eltér a normál piaci trendektől, futtasd le újra a keresést és finomítsd a számítást a legtisztább adatok alapján.
4. LOKÁCIÓS PRÉMIUM KORREKCIÓ: Az árellenőrzés után kapott tiszta piaci átlagárat (bázisár) KÖTELEZŐEN súlyozd a megadott "Lokációs prémium" értékkel. A százalékot NE te határozd meg: pontosan a megadott értékkel számolj. Ha a prémium 0% vagy "NINCS", semmilyen lokációs szorzót ne alkalmazz, és a korrekciós sorban ezt jelezd. A korrekció a bázisárra vonatkozik, és a további levezetett értékeket (négyzetméterár, gyors eladási ár) is ehhez a korrigált árhoz igazítsd.`,
  task: `Kimeneti struktúra (kérlek, SZIGORÚAN ezt a formát kövesd, rövid, vázlatpontos formában):

1. RÖVID ÖSSZEFOGLALÓ: (2-3 mondat a lokáció aktuális piaci helyzetéről).
2. 5 DB HASONLÓ INGATLAN: (Az elemzett 15 darabból a legrelevánsabb 5 darab listája. Tartalmazza: méret, állapot, irányár, becsült eladási idő).
3. LOKÁCIÓS PRÉMIUM KORREKCIÓ: (Önálló sor. KIZÁRÓLAG ezt a hármat tartalmazza, más szöveget ne: a módosítás pontos százalékos mértéke; az összegszerű különbség HUF-ban; a korrigált végső ár HUF-ban. Ha nincs prémium, csak ennyit írj: "0% — nincs lokációs korrekció".)
4. PIACI ÁR: (HUF — a lokációs korrekcióval együtt)
5. ÁTLAGOS NÉGYZETMÉTERÁR: (HUF/nm)
6. GYORS ELADÁSI ÁR: (Az az ár, amin 2-3 hónapon belül biztosan likvidálható, HUF).
7. VÁRHATÓ ELADÁSI IDŐ: (Hónapban megadva, normál piaci áron).
8. SWOT-ANALÍZIS: (Csak tömör kulcsszavas felsorolás a 4 ponthoz).
9. ÖSSZEGZÉS: (1-2 mondatos tényszerű konklúzió az eladhatóságról).`,
};

export function composeValuationPrompt(
  input: ValuationInput,
  segments: { intro?: string; task?: string }
): string {
  const intro = (segments.intro ?? VALUATION_DEFAULT_SEGMENTS.intro).trim();
  const task = (segments.task ?? VALUATION_DEFAULT_SEGMENTS.task).trim();
  return `${intro}\n\n${valuationDataBlock(input)}\n\n${task}`;
}
