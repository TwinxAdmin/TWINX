// Szakember-kereső — közös logika mindkét iparágnak (vendéglátás + ingatlan).
// A Perplexity élő webes kutatással keres szakembereket a partner szűrői szerint.
// FONTOS: minden SZAKMÁHOZ saját prompt-specializáció (hint) tartozik — így később
// szakmánként külön-külön bővíthető és finomítható a keresés. Kitalált jelölt tilos,
// minden találathoz forrás kell.

import { COUNTIES, RADIUS_OPTIONS } from "@/lib/suppliers";
export { COUNTIES, RADIUS_OPTIONS };

export type Industry = "hospitality" | "realestate";
export const INDUSTRIES: { value: Industry; label: string }[] = [
  { value: "hospitality", label: "Vendéglátás" },
  { value: "realestate", label: "Ingatlan" },
];
export function isIndustry(v: unknown): v is Industry {
  return v === "hospitality" || v === "realestate";
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

export const EXPERIENCE_LEVELS = [
  { value: "", label: "Mindegy" },
  { value: "palyakezdo", label: "Pályakezdő" },
  { value: "1-3", label: "1–3 év" },
  { value: "3-5", label: "3–5 év" },
  { value: "5-10", label: "5–10 év" },
  { value: "10+", label: "10+ év" },
  { value: "vezeto", label: "Vezetői tapasztalat" },
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

// --- Szakmák iparáganként (mindegyikhez saját prompt-specializáció) ---------
export type Profession = { value: string; label: string; hint: string };

const HOSPITALITY_PROFESSIONS: Profession[] = [
  { value: "sef", label: "Séf / konyhafőnök", hint: "Tapasztalt séfet/konyhafőnököt keress, aki menütervezésben, konyhavezetésben és csapatirányításban is jártas; nézd a szakmai profilokat, korábbi éttermeket, esetleges díjakat." },
  { value: "szakacs", label: "Szakács", hint: "Gyakorlott szakácsot keress adott konyhastílusra; fontos a megbízhatóság, műszakbírás és a HACCP-ismeret." },
  { value: "cukrasz", label: "Cukrász / pék", hint: "Cukrászt vagy péket keress; nézd a portfóliót/desszertkínálatot, kézműves tapasztalatot, esetleges saját manufaktúrát." },
  { value: "hidegkonyhas", label: "Hidegkonyhás", hint: "Hidegkonyhás szakembert keress (saláták, előételek, tálalás); fontos a gyorsaság és az esztétikus tálalás." },
  { value: "felszolgalo", label: "Felszolgáló / pincér", hint: "Vendégtéri felszolgálót keress; fontos a vendégkezelés, nyelvtudás és a felszolgálási tapasztalat típusa (à la carte, fine dining, rendezvény)." },
  { value: "pultos", label: "Pultos / bartender", hint: "Pultost vagy bartendert keress; nézd a koktél-ismeretet, kávégép-kezelést, kasszakezelést." },
  { value: "barista", label: "Barista", hint: "Baristát keress; fontos a specialty kávé ismerete, latte art, gépkezelés és karbantartás." },
  { value: "kisegito", label: "Konyhai kisegítő / mosogató", hint: "Konyhai kisegítőt/mosogatót keress; a megbízhatóság és a terhelhetőség a legfontosabb." },
  { value: "uzletvezeto", label: "Üzletvezető", hint: "Vendéglátós üzletvezetőt keress; fontos a személyzet-irányítás, készletgazdálkodás, adminisztráció és értékesítési szemlélet." },
  { value: "sommelier", label: "Sommelier", hint: "Sommelier-t keress; nézd a borismeretet, esetleges WSET/sommelier képesítést, borlapkészítési tapasztalatot." },
  { value: "haccp", label: "HACCP / élelmiszerbiztonsági tanácsadó", hint: "HACCP/élelmiszerbiztonsági tanácsadót vagy céget keress; fontos a hatósági megfelelés, dokumentáció és auditálási tapasztalat." },
  { value: "konyvelo", label: "Vendéglátós könyvelő", hint: "Vendéglátásra szakosodott könyvelőt/könyvelőirodát keress; fontos a NAV-online, felszolgálási díj, TEÁOR-specifikus tapasztalat." },
  { value: "marketing", label: "Vendéglátó-marketinges", hint: "Vendéglátós marketingest/ügynökséget keress; nézd a közösségimédia-kezelést, ételfotózást, kampány-referenciákat." },
  { value: "gepszerelo", label: "Konyhagép-szerelő", hint: "Nagykonyhai gép szerelőt/szervizt keress; fontos a gyors kiszállás, gyártói szakértelem, karbantartási szerződés lehetősége." },
  { value: "takarito", label: "Takarító / mosodai szolgáltató", hint: "Vendéglátós takarítót vagy mosodai szolgáltatót keress; fontos a higiéniai előírások ismerete és a rugalmas időbeosztás." },
  { value: "futar", label: "Futár", hint: "Kiszállító futárt keress; fontos a saját jármű, lefedett terület és a megbízhatóság." },
];

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
  hospitality: HOSPITALITY_PROFESSIONS,
  realestate: REALESTATE_PROFESSIONS,
};

export function professionsFor(industry: Industry): Profession[] {
  return PROFESSIONS[industry] ?? [];
}
export function professionLabel(industry: Industry, value: string): string {
  return professionsFor(industry).find((p) => p.value === value)?.label ?? value;
}

// --- Iparág-specifikus extra szűrők ----------------------------------------
export const HOSPITALITY_STYLES = [
  "magyaros", "olasz", "ázsiai", "fine dining", "bisztró", "street food",
  "cukrászat", "kávézó", "gyorsétterem", "rendezvény / catering",
] as const;
export const HOSPITALITY_SHIFTS = [
  { value: "", label: "Mindegy" },
  { value: "nappali", label: "Nappali" },
  { value: "esti", label: "Esti" },
  { value: "hetvegi", label: "Hétvégi" },
  { value: "ketmuszak", label: "Kétműszakos" },
] as const;

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
  styles?: string[];           // vendéglátás
  shift?: string;              // vendéglátás
  propertyTypes?: string[];    // ingatlan
  services?: string[];         // ingatlan
  needCredential?: boolean;    // engedély / kamarai tagság elvárt
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
export const PROFESSIONAL_PLANS = [
  { count: 3, credits: 1, label: "3 találat" },
  { count: 6, credits: 2, label: "6 találat" },
  { count: 9, credits: 3, label: "9 találat" },
] as const;
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
  hospitality: {
    intro: `Te egy magyar vendéglátóipari HR- és beszerzési szakértő vagy, aki éttermeknek, kávézóknak keres szakembereket és szolgáltatókat. Valós, ellenőrizhető forrásokból dolgozz: LÉTEZŐ személyeket, csapatokat, cégeket ajánlj. SOHA ne találj ki nevet, telefonszámot vagy e-mailt — ha egy adatot nem találsz, hagyd üresen. Minden találathoz adj meg forrás-URL-t.`,
    task: `Válaszolj KIZÁRÓLAG érvényes JSON-nal, magyarázó szöveg nélkül, ebben a szerkezetben:
{"professionals":[{"name":"","role":"","location":"","distance":"","experience":"","availability":"","rate":"","phone":"","email":"","website":"","why":"","source":""}],"extras":{"market":"","tips":["",""],"outreach":""}}
A "role" a pontos szakma/pozíció. A "why" egy mondatban indokolja, miért illik a megadott igényhez. A "market" adjon rövid tájékoztatót a szakma aktuális bér-/díjszintjéről és arról, hol érdemes még keresni (pl. szakmai csoportok, álláshirdető felületek). A "tips" 2-3 gyakorlatias kiválasztási/tárgyalási tanács. Az "outreach" egy kész, udvarias magyar megkereső üzenet, amit a partner kimásolhat és elküldhet.`,
  },
  realestate: {
    intro: `Te egy magyar ingatlanpiaci szakértő vagy, aki ingatlantulajdonosoknak és -kezelőknek keres szakembereket és szolgáltatókat (közvetítő, ügyvéd, energetikus, kivitelező stb.). Valós, ellenőrizhető forrásokból dolgozz: LÉTEZŐ szakembereket, cégeket ajánlj, ahol releváns, ellenőrizd a jogosultságot/kamarai tagságot. SOHA ne találj ki nevet, telefonszámot vagy e-mailt — ha nem találod, hagyd üresen. Minden találathoz adj meg forrás-URL-t.`,
    task: `Válaszolj KIZÁRÓLAG érvényes JSON-nal, magyarázó szöveg nélkül, ebben a szerkezetben:
{"professionals":[{"name":"","role":"","location":"","distance":"","experience":"","availability":"","rate":"","phone":"","email":"","website":"","why":"","source":""}],"extras":{"market":"","tips":["",""],"outreach":""}}
A "role" a pontos szakma/pozíció. A "why" egy mondatban indokolja, miért illik a megadott igényhez, és ha releváns, említse a jogosultságot/kamarai tagságot. A "market" adjon rövid tájékoztatót az aktuális díjszintekről és arról, hol érdemes még keresni. A "tips" 2-3 gyakorlatias kiválasztási/tárgyalási tanács (pl. mit kérj be: referencia, árajánlat, jogosultság). Az "outreach" egy kész, udvarias magyar megkereső üzenet a partner számára.`,
  },
};

export const PROFESSIONAL_DATA_BLOCK_PREVIEW = `Keresési feltételek:
{szakma + szakma-specifikus instrukció + terület + körzet + munkaviszony + tapasztalat + elérhetőség + nyelv + iparág-specifikus szűrők + díjazás + egyedi igény + találatszám}`;

// A zárolt adat-blokk összeállítása a tényleges szűrőkből + a SZAKMA saját hintjéből.
export function composeProfessionalPrompt(
  q: ProfessionalQuery,
  segments: { intro?: string; task?: string }
): string {
  const def = PROFESSIONAL_DEFAULT_SEGMENTS[q.industry] ?? PROFESSIONAL_DEFAULT_SEGMENTS.hospitality;
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
    // Szakma-specifikus, kódból jövő specializáció (később szakmánként bővíthető):
    profHint ? `Szakma-specifikus szempontok: ${profHint}` : "",
    `Terület: ${q.county}${q.city ? `, ${q.city}` : ""}`,
    area,
    q.employment && q.employment !== "barmelyik"
      ? `Munkaviszony: ${label(EMPLOYMENT_TYPES, q.employment)}.`
      : "",
    q.arrangement.length ? `Foglalkoztatás: ${q.arrangement.map((a) => label(WORK_ARRANGEMENTS, a)).join(", ")}.` : "",
    q.experience ? `Elvárt tapasztalat: ${label(EXPERIENCE_LEVELS, q.experience)}.` : "",
    q.availability ? `Elérhetőség: ${label(AVAILABILITY_OPTIONS, q.availability)}.` : "",
    q.languages.length ? `Nyelvtudás: ${q.languages.join(", ")}.` : "",
    q.rate ? `Tervezett díjazás / bér keret: ${q.rate}.` : "",
  ];

  if (q.industry === "hospitality") {
    if (q.styles?.length) lines.push(`Konyha / profil: ${q.styles.join(", ")}.`);
    if (q.shift) lines.push(`Műszak: ${label(HOSPITALITY_SHIFTS, q.shift)}.`);
  } else {
    if (q.propertyTypes?.length) lines.push(`Ingatlantípus: ${q.propertyTypes.join(", ")}.`);
    if (q.services?.length) lines.push(`Kért szolgáltatás: ${q.services.join(", ")}.`);
    if (q.needCredential) lines.push(`FONTOS: csak megfelelő jogosultsággal / kamarai tagsággal rendelkező szakembert ajánlj, és jelezd ezt.`);
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
