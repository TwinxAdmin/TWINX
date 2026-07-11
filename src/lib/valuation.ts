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
};

export type ValuationField = {
  key: keyof ValuationInput;
  label: string; // a promptban is ez a címke szerepel
  placeholder: string;
  required: boolean;
  fullWidth?: boolean;
  options?: string[]; // datalist javaslatok
};

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
    options: [
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
    ],
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
    options: [
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
    ],
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
    options: [
      "Tégla (pl. Porotherm)",
      "Panel / Házgyári",
      "Csúsztatott zsalus",
      "Könnyűszerkezetes (fa/fém vázas)",
      "Ytong",
      "Vasbeton",
      "Vályog / Vegyes falazat",
    ],
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
- Egyéb főbb jellemzők/extrák: ${vv(input.egyeb)}`;
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
- Egyéb főbb jellemzők/extrák: {egyéb}`;

export const VALUATION_DEFAULT_SEGMENTS = {
  intro: `Bújj egy tapasztalt, adatalapú ingatlanpiaci szakértő szerepébe. Száraz, tényszerű, strukturált elemzést várok tőled. A válaszodban NE utalj a szemléletedre, a stílusodra, és ne használj olyan kifejezéseket a saját elemzésedre, mint "reális", "óvatos" vagy "pesszimista" – csak a tiszta adatokat és a végeredményt add meg a kért formátumban. Ne írj felesleges körítést vagy bevezetőt.

Feladat: Készíts ingatlan-értékbecslést az alábbi paraméterekkel rendelkező ingatlanról.

Keresési és elemzési instrukciók (ezt a háttérben végezd el):
1. LOKÁCIÓ ÉS KERESÉS: Az összehasonlító ingatlanok felkutatásakor szigorúan tartsd be az alábbi földrajzi szabályokat:
   - Ha Budapest: Csak és kizárólag az adott kerületen belül keress.
   - Ha Pest megye (vagy egyéb agglomeráció/vidék): Csak az adott települést és a közvetlenül szomszédos településeket veheted figyelembe.
   - Mikrolokáció ellenőrzés: Ha meg van adva városrész és utca, a háttérben többszörösen ellenőrizd le, hogy a megadott utca valóban abba a városrészbe esik-e. Az összehasonlításhoz csak azonos megítélésű és árfekvésű városrészből hozz példákat.
2. ELEMZÉS: A háttérben vizsgálj meg pontosan tizenöt darab (15 db) releváns összehasonlító ingatlant (semmiképp se téveszd össze a darabszámot Budapest 15. kerületével!).
3. ÁRELLENŐRZÉS: Első lépésként vizsgáld meg a kapott árakat. Zárd ki az irreálisan magas vagy alacsony (outlier) hirdetéseket. Ha a megmaradt adatokból számolt átlagár jelentősen eltér a normál piaci trendektől, futtasd le újra a keresést és finomítsd a számítást a legtisztább adatok alapján.`,
  task: `Kimeneti struktúra (kérlek, SZIGORÚAN ezt a formát kövesd, rövid, vázlatpontos formában):

1. RÖVID ÖSSZEFOGLALÓ: (2-3 mondat a lokáció aktuális piaci helyzetéről).
2. 5 DB HASONLÓ INGATLAN: (Az elemzett 15 darabból a legrelevánsabb 5 darab listája. Tartalmazza: méret, állapot, irányár, becsült eladási idő).
3. PIACI ÁR: (HUF)
4. ÁTLAGOS NÉGYZETMÉTERÁR: (HUF/nm)
5. GYORS ELADÁSI ÁR: (Az az ár, amin 2-3 hónapon belül biztosan likvidálható, HUF).
6. VÁRHATÓ ELADÁSI IDŐ: (Hónapban megadva, normál piaci áron).
7. SWOT-ANALÍZIS: (Csak tömör kulcsszavas felsorolás a 4 ponthoz).
8. ÖSSZEGZÉS: (1-2 mondatos tényszerű konklúzió az eladhatóságról).`,
};

export function composeValuationPrompt(
  input: ValuationInput,
  segments: { intro?: string; task?: string }
): string {
  const intro = (segments.intro ?? VALUATION_DEFAULT_SEGMENTS.intro).trim();
  const task = (segments.task ?? VALUATION_DEFAULT_SEGMENTS.task).trim();
  return `${intro}\n\n${valuationDataBlock(input)}\n\n${task}`;
}
