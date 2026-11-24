// Szakember-kereső (ingatlan). A vendéglátós ág 2026-11-24-én kikerült (Márk döntése).
// A Perplexity élő webes kutatással keres szakembereket a partner szűrői szerint.
// FONTOS: minden SZAKMÁHOZ saját prompt-specializáció (hint) tartozik — így később
// szakmánként külön-külön bővíthető és finomítható a keresés. Kitalált jelölt tilos,
// minden találathoz forrás kell.

// --- Terület ---------------------------------------------------------------
export const COUNTIES = [
  "Budapest", "Pest", "Bács-Kiskun", "Baranya", "Békés", "Borsod-Abaúj-Zemplén",
  "Csongrád-Csanád", "Fejér", "Győr-Moson-Sopron", "Hajdú-Bihar", "Heves",
  "Jász-Nagykun-Szolnok", "Komárom-Esztergom", "Nógrád", "Somogy",
  "Szabolcs-Szatmár-Bereg", "Tolna", "Vas", "Veszprém", "Zala",
] as const;

// --- Körzet (a megadott településtől) --------------------------------------
export const RADIUS_OPTIONS = [
  { value: "5", label: "5 km-en belül" },
  { value: "10", label: "10 km-en belül" },
  { value: "25", label: "25 km-en belül" },
  { value: "50", label: "50 km-en belül" },
  { value: "100", label: "100 km-en belül" },
  { value: "150", label: "150 km-en belül" },
  { value: "orszagos", label: "Országosan" },
] as const;


export type Industry = "realestate";
export const INDUSTRIES: { value: Industry; label: string }[] = [
  { value: "realestate", label: "Ingatlan" },
];
export function isIndustry(v: unknown): v is Industry {
  return v === "realestate";
}

// --- Közös szűrők ----------------------------------------------------------
export const EMPLOYMENT_TYPES = [
  { value: "alkalmazott", label: "Állandó alkalmazott" },
  { value: "alkalmi", label: "Alkalmi munka" },
  { value: "alvallalkozo", label: "Alvállalkozó / szolgáltató" },
  { value: "barmelyik", label: "Mindegy" },
] as const;

export const WORK_ARRANGEMENTS = [
  { value: "teljes", label: "Teljes munkaidő" },
  { value: "resz", label: "Részmunkaidő" },
  { value: "hetvegi", label: "Hétvégi" },
  { value: "alkalmi", label: "Alkalmi / beugró" },
  { value: "projekt", label: "Projekt / megbízás" },
] as const;

// Tapasztalati szint — SZÖVEGESEN, nem konkrét évszámmal (a keresés így nem támaszkodik
// egy adott számra, csak a szint jellegére).
export const EXPERIENCE_LEVELS = [
  { value: "", label: "Mindegy" },
  { value: "palyakezdo", label: "Pályakezdő" },
  { value: "tapasztalt", label: "Tapasztalt" },
  { value: "rutinos", label: "Rutinos, nagy gyakorlatú" },
  { value: "szakerto", label: "Kiemelkedő / szakértő" },
] as const;

export const AVAILABILITY_OPTIONS = [
  { value: "", label: "Mindegy" },
  { value: "azonnal", label: "Azonnal" },
  { value: "2het", label: "2 héten belül" },
  { value: "1honap", label: "1 hónapon belül" },
  { value: "rugalmas", label: "Rugalmas" },
] as const;

export const LANGUAGE_OPTIONS = [
  "angol", "német", "francia", "olasz", "spanyol", "orosz", "ukrán", "román", "kínai",
] as const;

// A díjazás időszaka (a szám mellé).
export const RATE_PERIODS = [
  { value: "ora", label: "Ft / óra" },
  { value: "nap", label: "Ft / nap" },
  { value: "het", label: "Ft / hét" },
  { value: "ho", label: "Ft / hó" },
] as const;
export function ratePeriodLabel(v: string): string {
  return RATE_PERIODS.find((p) => p.value === v)?.label ?? "Ft / hó";
}

// --- Szakmák iparáganként (mindegyikhez saját prompt-specializáció) ---------
// track: "finder"  → az interneten nyilvános elérhetőséggel megtalálható szolgáltató/cég
//                    (ezek jelennek meg a Szakember-kereső fülön).
//        "recruit" → jellemzően egyéni alkalmazott (pl. alkalmazott munkatárs), akit online
//                    nem lehet kész kontaktként megtalálni → a Toborzás fülre tartozik.
// Alapértelmezés (ha nincs megadva): "finder". SEMMIT nem törlünk — a recruit szakmák
// bent maradnak a kódban, a későbbi Toborzás modulhoz.
export type ProfessionTrack = "finder" | "recruit";
export type Profession = { value: string; label: string; hint: string; track?: ProfessionTrack };
export function professionTrack(p: Profession): ProfessionTrack {
  return p.track ?? "finder";
}

const REALESTATE_PROFESSIONS: Profession[] = [
  { value: "kozvetito", label: "Ingatlanközvetítő", hint: "Ingatlanközvetítőt/irodát keress; nézd a helyi piacismeretet, referenciákat, értékesítési statisztikát, esetleges MLM-tagságot." },
  { value: "ugyved", label: "Ingatlanjogász / ügyvéd", hint: "Ingatlanjogra szakosodott ügyvédet keress; fontos az adásvételi/bérleti szerződések, ügyvédi kamarai tagság, tulajdoni ügyintézés." },
  { value: "energetikus", label: "Energetikai tanúsító", hint: "Energetikai tanúsítót keress; fontos a jogosultsági regisztráció (kamarai névjegyzék), gyors kiszállás, e-tanúsítvány." },
  { value: "ertekbecslo", label: "Ingatlan-értékbecslő", hint: "Független ingatlan-értékbecslőt keress; fontos a banki/hitelképes értékbecslés, kamarai jogosultság, tapasztalat az adott ingatlantípusban." },
  { value: "fotos", label: "Ingatlanfotós", hint: "Ingatlanfotóst keress; nézd a portfóliót, drónfotó/videó lehetőséget, gyors leadási időt." },
  { value: "homestager", label: "Home stager", hint: "Home stagert/belsőépítészt keress értékesítésre felkészítéshez; nézd az előtte-utána portfóliót és a bútor-bérlési lehetőséget." },
  { value: "kivitelezo", label: "Generálkivitelező / felújító", hint: "Megbízható generálkivitelezőt/felújító céget keress; fontos a referenciák, garancia, írásos árajánlat és határidő-tartás." },
  { value: "festo", label: "Festő-mázoló", hint: "Festő-mázolót keress; fontos a tiszta munka, referenciák, rövid határidő." },
  { value: "burkolo", label: "Burkoló", hint: "Burkolót keress (csempe, járólap, kőburkolat); nézd a referenciákat és a precizitást." },
  { value: "villanyszerelo", label: "Villanyszerelő", hint: "Villanyszerelőt keress; fontos az érintésvédelmi mérés, jogosultság, MEE-tagság, gyors kiszállás." },
  { value: "gepesz", label: "Víz-/fűtésszerelő (gépész)", hint: "Víz-, gáz- vagy fűtésszerelőt keress; fontos a gázszerelői jogosultság, MKEH-regisztráció, kazán-karbantartás." },
  { value: "statikus", label: "Statikus", hint: "Statikus mérnököt keress; fontos a kamarai jogosultság (MMK), teherhordó szerkezet, bővítés/tetőtér szakvélemény." },
  { value: "epitesz", label: "Építész", hint: "Építész tervezőt keress; fontos a kamarai jogosultság, engedélyes tervek, korábbi projektek." },
  { value: "foldmero", label: "Földmérő", hint: "Földmérőt keress; fontos a hatósági záradékolt munkarész, telekhatár-rendezés, megosztás." },
  { value: "kozmu", label: "Közműügyintéző", hint: "Közmű-ügyintézőt keress (víz, gáz, áram bekötés/átírás); fontos a hatósági eljárásban való jártasság." },
  { value: "takarito_ingatlan", label: "Takarítás / kiürítés", hint: "Ingatlan-takarító vagy lomtalanító/kiürítő szolgáltatót keress; fontos a gyors, rugalmas kiszállás." },
  { value: "koltozteto", label: "Költöztető", hint: "Költöztető céget keress; fontos a biztosítás, csomagolás, bútorszerelés, referenciák." },
  { value: "kezelo", label: "Ingatlan-/társasházkezelő", hint: "Ingatlan- vagy társasházkezelőt keress; fontos a közös képviseleti tapasztalat, elszámolás átláthatósága, referenciák." },
];

export const PROFESSIONS: Record<Industry, Profession[]> = {
  realestate: REALESTATE_PROFESSIONS,
};

// --- Szakmánkénti RÉSZLETES szempontok (a lenyíló "Részletes keresés" mezői) --------
// Minden szakmához saját mező-készlet; a szakma kiválasztásakor ez változik. A prompt
// ezekből épül tovább (formatDetails). Egyelőre szakmánként töltjük fel — amelyikhez még
// nincs, ott a részletes sáv üres, a közös mezőkkel akkor is lehet keresni.
export type DetailField = {
  id: string;
  label: string;
  type: "select" | "chips"; // select = egy érték, chips = több érték
  options: { value: string; label: string }[];
};

export const PROFESSION_DETAILS: Record<string, DetailField[]> = {};

export function detailFieldsFor(profession: string): DetailField[] {
  return PROFESSION_DETAILS[profession] ?? [];
}

// A részletes mezők értékeinek biztonságos szűrése (csak a szakmához tartozó mezők/értékek).
export function sanitizeDetails(profession: string, raw: unknown): Record<string, string | string[]> {
  const fields = detailFieldsFor(profession);
  const out: Record<string, string | string[]> = {};
  const src = (raw ?? {}) as Record<string, unknown>;
  for (const f of fields) {
    const v = src[f.id];
    const valid = new Set(f.options.map((o) => o.value));
    if (f.type === "chips") {
      const arr = Array.isArray(v) ? (v as unknown[]).map(String).filter((x) => valid.has(x)).slice(0, 8) : [];
      if (arr.length) out[f.id] = arr;
    } else {
      const s = String(v ?? "");
      if (valid.has(s)) out[f.id] = s;
    }
  }
  return out;
}

// A részletes mezők ember által olvasható sorai (a prompthoz).
export function formatDetails(profession: string, details: Record<string, string | string[]> | undefined): string[] {
  if (!details) return [];
  const fields = detailFieldsFor(profession);
  const lines: string[] = [];
  for (const f of fields) {
    const v = details[f.id];
    if (!v || (Array.isArray(v) && !v.length)) continue;
    const vals = (Array.isArray(v) ? v : [v]).map((x) => f.options.find((o) => o.value === x)?.label ?? x);
    lines.push(`${f.label}: ${vals.join(", ")}`);
  }
  return lines;
}

export function professionsFor(industry: Industry): Profession[] {
  return PROFESSIONS[industry] ?? [];
}
// Csak a megadott "track" szakmái. A Szakember-kereső fül a "finder" (online elérhető
// szolgáltatók), a Toborzás fül a "recruit" (egyéni alkalmazottak) szakmákat használja.
export function professionsForTrack(industry: Industry, track: ProfessionTrack): Profession[] {
  return professionsFor(industry).filter((p) => professionTrack(p) === track);
}
export function professionLabel(industry: Industry, value: string): string {
  return professionsFor(industry).find((p) => p.value === value)?.label ?? value;
}

// --- Iparág-specifikus extra szűrők ----------------------------------------
export const REALESTATE_PROPERTY_TYPES = [
  "lakás", "családi ház", "telek", "ipari / kereskedelmi", "új építésű", "luxus", "mezőgazdasági",
] as const;
export const REALESTATE_SERVICES = [
  "eladás / vétel közvetítés", "bérbeadás", "felújítás / kivitelezés", "tanúsítás / mérés", "jogi ügyintézés",
] as const;

// --- Típusok ---------------------------------------------------------------
export type ProfessionalQuery = {
  industry: Industry;
  profession: string;          // szakma value; "egyeb" = szabad megadás
  professionCustom: string;    // ha egyéb
  county: string;
  city: string;
  radius: string;
  employment: string;          // munkaviszony
  arrangement: string[];       // foglalkoztatás (több)
  experience: string;
  availability: string;
  languages: string[];
  rate: string;                // tervezett bér / óradíj / díjazás (szabad)
  propertyTypes?: string[];    // ingatlan
  services?: string[];         // ingatlan
  needCredential?: boolean;    // engedély / kamarai tagság elvárt
  details?: Record<string, string | string[]>; // szakma-specifikus részletes szempontok
  customCriteria?: string[];   // a partner saját szempontjai (bármely szakmánál)
  notes: string;
  count: number;
  exclude?: string[];
};

export type Professional = {
  name: string;
  role: string;        // szakma / pozíció
  location: string;
  distance?: string;
  experience?: string;
  availability?: string;
  rate?: string;       // díjazás megjegyzés
  phone?: string;
  email?: string;
  website?: string;
  why: string;
  source?: string;
};

export type ProfessionalExtras = {
  market?: string;     // piaci helyzet / bérszint tájékoztató
  tips?: string[];     // tárgyalási / kiválasztási tippek
  outreach?: string;   // kész megkereső üzenet
};

export type ProfessionalResult = {
  professionals: Professional[];
  extras: ProfessionalExtras;
};

// --- Találatszám = kredit ---------------------------------------------------
// BÉTA: amíg a modul fejlesztés alatt van, EGYETLEN verzió: 5 találat = 1 kredit.
export const PROFESSIONAL_PLANS = [
  { count: 5, credits: 1, label: "5 találat" },
] as const;
export const PROFESSIONAL_DEFAULT_COUNT = 5;
export function creditsForCount(count: number): number {
  return PROFESSIONAL_PLANS.find((p) => p.count === count)?.credits ?? 1;
}
export function isValidCount(count: unknown): boolean {
  return PROFESSIONAL_PLANS.some((p) => p.count === Number(count));
}

function label<T extends { value: string; label: string }>(list: readonly T[], v: string): string {
  return list.find((x) => x.value === v)?.label ?? v;
}

// --- AI prompt (admin által szerkeszthető szegmensek, iparáganként) --------
export const PROFESSIONAL_DEFAULT_SEGMENTS: Record<Industry, { intro: string; task: string }> = {
  realestate: {
    intro: `Te egy magyar ingatlanpiaci szakértő vagy, aki ingatlantulajdonosoknak és -kezelőknek keres szakembereket és szolgáltatókat (közvetítő, ügyvéd, energetikus, kivitelező stb.). Valós, ellenőrizhető forrásokból dolgozz: LÉTEZŐ szakembereket, cégeket ajánlj, ahol releváns, ellenőrizd a jogosultságot/kamarai tagságot. SOHA ne találj ki nevet, telefonszámot vagy e-mailt — ha nem találod, hagyd üresen. Minden találathoz adj meg forrás-URL-t.`,
    task: `Válaszolj KIZÁRÓLAG érvényes JSON-nal, magyarázó szöveg nélkül, ebben a szerkezetben:
{"professionals":[{"name":"","role":"","location":"","distance":"","experience":"","availability":"","rate":"","phone":"","email":"","website":"","why":"","source":""}],"extras":{"market":"","tips":["",""],"outreach":""}}
A "role" a pontos szakma/pozíció. A "why" egy mondatban indokolja, miért illik a megadott igényhez, és ha releváns, említse a jogosultságot/kamarai tagságot. A "market" adjon rövid tájékoztatót az aktuális díjszintekről és arról, hol érdemes még keresni. A "tips" 2-3 gyakorlatias kiválasztási/tárgyalási tanács (pl. mit kérj be: referencia, árajánlat, jogosultság). Az "outreach" egy kész, udvarias magyar megkereső üzenet a partner számára.`,
  },
};

export const PROFESSIONAL_DATA_BLOCK_PREVIEW = `Keresési feltételek:
{szakma + szakma-specifikus instrukció + terület + körzet + munkaviszony + tapasztalati szint + elérhetőség + nyelv + iparág-specifikus szűrők + egyedi igény + találatszám}`;

// A zárolt adat-blokk összeállítása a tényleges szűrőkből + a SZAKMA saját hintjéből.
export function composeProfessionalPrompt(
  q: ProfessionalQuery,
  segments: { intro?: string; task?: string }
): string {
  const def = PROFESSIONAL_DEFAULT_SEGMENTS.realestate;
  const intro = (segments.intro ?? def.intro).trim();
  const task = (segments.task ?? def.task).trim();

  const prof = professionsFor(q.industry).find((p) => p.value === q.profession);
  const profName = prof?.label ?? (q.professionCustom || "szakember");
  const profHint = prof?.hint ?? "";

  const area =
    q.radius === "orszagos"
      ? "Országosan keress, de a földrajzilag közelebbieket sorold előre."
      : `Elsősorban ${q.city ? `${q.city} (${q.county})` : q.county} környékén, kb. ${q.radius} km-es körzetben keress.`;

  const lines = [
    `Keresett szakember: ${profName}.`,
    // A LEGFONTOSABB szűrő: csak a keresett szakma, semmi rokon/helyettesítő.
    `RELEVANCIA — a legfontosabb szabály: KIZÁRÓLAG "${profName}" szakmának megfelelő találatokat adj. Ne ajánlj más, rokon vagy helyettesítő szakmát (pl. ha takarítót keresnek, ne adj kertészt, karbantartót vagy más szolgáltatót). Ha ebből a szakmából nincs elég valódi találat, inkább adj kevesebbet — de a mennyiség kedvéért SOHA ne tölts fel más szakmával.`,
    // Szakma-specifikus, kódból jövő specializáció (később szakmánként bővíthető):
    profHint ? `Szakma-specifikus szempontok: ${profHint}` : "",
    `Terület: ${q.county}${q.city ? `, ${q.city}` : ""}`,
    area,
    q.employment && q.employment !== "barmelyik"
      ? `Munkaviszony: ${label(EMPLOYMENT_TYPES, q.employment)}.`
      : "",
    q.arrangement.length ? `Foglalkoztatás: ${q.arrangement.map((a) => label(WORK_ARRANGEMENTS, a)).join(", ")}.` : "",
    q.experience ? `Elvárt tapasztalati szint (jellegében, nem konkrét évszámra szűrve): ${label(EXPERIENCE_LEVELS, q.experience)}.` : "",
    q.availability ? `Elérhetőség: ${label(AVAILABILITY_OPTIONS, q.availability)}.` : "",
    q.languages.length ? `Nyelvtudás: ${q.languages.join(", ")}.` : "",
  ];

  if (q.propertyTypes?.length) lines.push(`Ingatlantípus: ${q.propertyTypes.join(", ")}.`);
  if (q.services?.length) lines.push(`Kért szolgáltatás: ${q.services.join(", ")}.`);
  if (q.needCredential) lines.push(`FONTOS: csak megfelelő jogosultsággal / kamarai tagsággal rendelkező szakembert ajánlj, és jelezd ezt.`);

  // Szakma-specifikus RÉSZLETES szempontok (a lenyíló keresőből) — ezekre külön figyelj.
  const detailLines = formatDetails(q.profession, q.details);
  const custom = (q.customCriteria ?? []).map((c) => c.trim()).filter(Boolean);
  if (detailLines.length || custom.length) {
    lines.push(`Részletes elvárások (ezeknek KIEMELTEN feleljen meg a jelölt):`);
    for (const d of detailLines) lines.push(`- ${d}`);
    for (const c of custom) lines.push(`- ${c}`);
  }

  if (q.notes) lines.push(`Egyedi igény: ${q.notes}`);
  lines.push(`Ennyi találatot adj: PONTOSAN ${q.count} darab (ha kevesebb valódi találat van, inkább adj kevesebbet, mint kitaláltat).`);
  if (q.exclude?.length) {
    lines.push(`FONTOS: az alábbi szakembereket a partner MÁR ISMERI egy korábbi keresésből, ezeket NE sorold fel újra — keress helyettük MÁSOKAT: ${q.exclude.join("; ")}.`);
  }
  lines.push(`Merítsd a találatokat többféle forrásból: szakmai közösségek, álláshirdető és szolgáltató-kereső felületek, cégjegyzék, kamarai névjegyzékek, helyi ajánló csoportok. Kerüld, hogy csak a legnagyobb, legismertebb szereplők jöjjenek vissza.`);

  return `${intro}\n\nKeresési feltételek:\n${lines.filter(Boolean).join("\n")}\n\n${task}`;
}

// Az AI JSON-válaszának biztonságos feldolgozása (körbeírt szöveg esetén is).
export function parseProfessionalResponse(raw: string, max: number): ProfessionalResult {
  const empty: ProfessionalResult = { professionals: [], extras: {} };
  if (!raw) return empty;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return empty;
  try {
    const o = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    const list = Array.isArray(o.professionals) ? (o.professionals as Record<string, unknown>[]) : [];
    const str = (v: unknown) => String(v ?? "").trim();
    const professionals: Professional[] = list
      .map((s) => ({
        name: str(s.name),
        role: str(s.role),
        location: str(s.location),
        distance: str(s.distance) || undefined,
        experience: str(s.experience) || undefined,
        availability: str(s.availability) || undefined,
        rate: str(s.rate) || undefined,
        phone: str(s.phone) || undefined,
        email: str(s.email) || undefined,
        website: str(s.website) || undefined,
        why: str(s.why),
        source: str(s.source) || undefined,
      }))
      .filter((s) => s.name)
      .slice(0, max);

    const e = (o.extras ?? {}) as Record<string, unknown>;
    const extras: ProfessionalExtras = {
      market: str(e.market) || undefined,
      tips: Array.isArray(e.tips) ? (e.tips as unknown[]).map(str).filter(Boolean).slice(0, 5) : undefined,
      outreach: str(e.outreach) || undefined,
    };
    return { professionals, extras };
  } catch {
    return empty;
  }
}
