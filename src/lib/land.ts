// Telek értékbecslés — mezők, validáció, prompt és a két kutatási szint.
// A prompt a partner bevált eszközéből származik (szó szerint). Üres mező -> "[Nincs megadva]".

export type LandInput = {
  telepules: string; // Város / kerület
  utca: string; // Utca, házszám
  hrsz: string; // Helyrajzi szám
  ovezet: string; // Építési övezet
  besorolas: string; // Telek besorolása
};

export const EMPTY_LAND: LandInput = {
  telepules: "",
  utca: "",
  hrsz: "",
  ovezet: "",
  besorolas: "",
};

export type LandField = {
  key: keyof LandInput;
  label: string;
  placeholder: string;
  required: boolean;
  fullWidth?: boolean;
};

// Egyelőre MIND kötelező (később lazítható).
export const LAND_FIELDS: LandField[] = [
  { key: "telepules", label: "Város / kerület", placeholder: "pl. Budapest 16. kerület / Gödöllő", required: true },
  { key: "utca", label: "Utca, házszám", placeholder: "pl. Diófa utca 12", required: true },
  { key: "hrsz", label: "Helyrajzi szám", placeholder: "pl. 12345/6", required: true },
  { key: "ovezet", label: "Építési övezet", placeholder: "pl. Lke-1 (kertvárosias lakóterület)", required: true },
  { key: "besorolas", label: "Telek besorolása", placeholder: "pl. beépítetlen terület / lakóház udvar", required: true, fullWidth: true },
];

// --- Kutatási szintek --------------------------------------------------
export type LandLevel = "normal" | "high";

export const LAND_LEVELS: Record<
  LandLevel,
  { label: string; model: string; credits: number; async: boolean; desc: string }
> = {
  normal: {
    label: "Normál",
    model: "sonar-pro",
    credits: 1,
    async: false,
    desc: "Középszintű kutatás — gyors, pár tíz másodperc.",
  },
  high: {
    label: "Magas",
    model: "sonar-deep-research",
    credits: 2,
    async: true,
    desc: "Legmélyebb kutatás — alaposabb, akár néhány perc.",
  },
};

export function isLandLevel(v: unknown): v is LandLevel {
  return v === "normal" || v === "high";
}

// --- Validáció ---------------------------------------------------------
export function validateLandInput(
  raw: Record<string, unknown>
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  for (const field of LAND_FIELDS) {
    const value = String(raw?.[field.key] ?? "").trim();
    if (field.required && value.length === 0) {
      errors[field.key] = "Kötelező mező.";
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

// --- Prompt (partner eszköze alapján, szó szerint) ---------------------
function v(value: string): string {
  const t = String(value ?? "").trim();
  return t.length > 0 ? t : "[Nincs megadva]";
}

// --- Prompt: zárolt adat-blokk + finomítható szegmensek --------------------
// A ZÁROLT adat-blokk (a felhasználói mezők behelyettesítése) kizárólag itt,
// kódból módosítható — az admin felületen NEM szerkeszthető. Az admin csak az
// alábbi alapértelmezett szövegtömböket ("intro", "task") finomíthatja.

// Zárolt adat-blokk: a változók helye garantáltan sértetlen marad.
export function landDataBlock(input: LandInput): string {
  return `### A vizsgálandó telek adatai:

* **Város / kerület:** ${v(input.telepules)}
* **Utca, házszám:** ${v(input.utca)}
* **Helyrajzi szám:** ${v(input.hrsz)}
* **Építési övezet:** ${v(input.ovezet)}
* **Telek besorolása:** ${v(input.besorolas)}`;
}

// Előnézet az admin felülethez (mit és hova helyettesít be a rendszer).
export const LAND_DATA_BLOCK_PREVIEW = `### A vizsgálandó telek adatai:

* **Város / kerület:** {település}
* **Utca, házszám:** {utca}
* **Helyrajzi szám:** {hrsz}
* **Építési övezet:** {övezet}
* **Telek besorolása:** {besorolás}`;

// Finomítható szegmensek alapértelmezett (v0 — kódban rögzített) szövege.
export const LAND_DEFAULT_SEGMENTS = {
  intro: `Kérlek, viselkedj úgy, mint egy 30 éves, segítőkész építészmérnök! A feladatod az, hogy egy laikus telektulajdonos számára érthetően, a felesleges szakszavakat kerülve egy rövid, tömör, lényegre törő, maximum 1 oldalas jelentést készíts a telek beépíthetőségéről.`,
  task: `### A feladatod:

Keress rá a weben a hatályos HÉSZ-re (Helyi Építési Szabályzat) és a TAK-ra (Településképi Arculati Kézikönyv). Az alábbi pontokból készíts egy szigorúan strukturált, azonnal átlátható, 1 oldalas összefoglalót:

1.  **Beépítési mód:** (pl. oldalhatáron álló, szabadonálló - röviden magyarázva)
2.  **Beépítési százalék:** (%)
3.  **Magassági korlátok:** (maximum megengedett magasság)
4.  **Megjelenés és design:** (tetőforma, dőlésszög, anyagok - csak a lényeges korlátozások)
5.  **Védőtávolságok:** (előkert, oldalkert, hátsókert kötelező mérete)
6.  **Lakásszám:** (maximum építhető lakóegység)
7.  **Közművek:** (minimum elvárások a beépítéshez)
8.  **Buktatók és korlátozások:** (építési tilalmak, szabályozási vonalak, védett zónák)

---

A válaszod legyen egy szigorúan strukturált, vázlatpontos jelentés. Ne írj hosszú bevezetőt vagy lezárást. Ha egy adat nem elérhető az interneten, jelezd röviden, hogy a főépítésznél érdeklődjön.`,
};

// Végső prompt összeállítása: [bevezető] + [zárolt adat-blokk] + [feladat].
export function composeLandPrompt(
  input: LandInput,
  segments: { intro?: string; task?: string }
): string {
  const intro = (segments.intro ?? LAND_DEFAULT_SEGMENTS.intro).trim();
  const task = (segments.task ?? LAND_DEFAULT_SEGMENTS.task).trim();
  return `${intro}\n\n${landDataBlock(input)}\n\n---\n\n${task}`;
}
