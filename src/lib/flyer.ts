// Hirdetéskészítő — közös modell: formátumok, hangnemek, kredit, adat-típusok.
// A layoutok és a render az F4-ben jönnek; ez a közös alap.

// Kredit: induláskor 0 (ingyenes). Később egyetlen szám átírásával ára lehet
// (a 100% haszon szabály szerint). 0 = nincs levonás.
// Egy elfogadott (végleges) hirdetés ára. Az előnézet mindig ingyenes (vízjeles).
export const FLYER_CREDITS = Number(process.env.FLYER_CREDITS ?? 1);

// Egyoldalas hirdetés: legfeljebb ennyi kép fér el értelmesen (1 fő + pár galéria).
// Később, többoldalas hirdetésnél ez emelhető.
export const MAX_FLYER_IMAGES = 4;

// Kimeneti formátumok. Az A4 PDF; a social arányok PNG kép (a megadott px méretben).
export type FlyerFormat = {
  value: string;
  label: string;
  kind: "pdf" | "image";
  // poster = a magasság a tartalomhoz igazodik (álló poszter);
  // frame = fix méret, a kép kitölti a keretet (social formátumok).
  mode: "poster" | "frame";
  width: number;
  height: number;
};

export const FLYER_FORMATS: FlyerFormat[] = [
  { value: "poster", label: "Álló poszter — normál", kind: "image", mode: "poster", width: 900, height: 1280 },
  { value: "poster-hd", label: "Álló poszter — HD (nagy)", kind: "image", mode: "poster", width: 1200, height: 1700 },
  { value: "square", label: "Négyzet 1:1 — Insta/FB poszt", kind: "image", mode: "frame", width: 1080, height: 1080 },
  { value: "story", label: "Story 9:16 — Insta/FB story", kind: "image", mode: "frame", width: 1080, height: 1920 },
];

// Választható TWINX elrendezések (a szín/betű/téma az arculatból jön).
export type FlyerLayout = { value: string; label: string };
// Egyetlen, véglegesített TWINX elrendezés (a "The Keys" sablon szerint).
export const FLYER_LAYOUTS: FlyerLayout[] = [
  { value: "keys", label: "TWINX ügynök-sablon" },
];

export type FlyerTone = { value: string; label: string };
export const FLYER_TONES: FlyerTone[] = [
  { value: "tenyszeru", label: "Tényszerű, lényegre törő" },
  { value: "marketinges", label: "Lelkes, marketinges" },
  { value: "premium", label: "Elegáns, prémium" },
];

// A hirdetés alapadatai (ezekből dolgozik az AI; kézzel is szerkeszthető).
export type FlyerFacts = {
  location: string; // település, kerület / utca
  price: string;
  propertyType: string;
  size: string;
  rooms: string;
  bathrooms: string; // fürdőszobák száma
  condition: string;
  extra: string; // egyéb, amit az AI tudjon (pl. felújított fürdő, metró közel)
  custom1: string; // szabad sor — rákerül a hirdetésre (pl. "Hatalmas kert")
  custom2: string; // szabad sor — rákerül a hirdetésre
};

export const EMPTY_FACTS: FlyerFacts = {
  location: "",
  price: "",
  propertyType: "",
  size: "",
  rooms: "",
  bathrooms: "",
  condition: "",
  extra: "",
  custom1: "",
  custom2: "",
};

// Az AI által generált (és kézzel felülírható) hirdetés-szöveg.
export type FlyerText = {
  title: string;
  subtitle: string;
  price: string;
  highlights: string[]; // rövid kiemelések (ikonsor), max 4
  characteristics: string[]; // jellemzők pontokban
  infra: string; // infrastruktúra leírás
  transport: string; // közlekedés leírás
};

export const EMPTY_TEXT: FlyerText = {
  title: "",
  subtitle: "",
  price: "",
  highlights: [],
  characteristics: [],
  infra: "",
  transport: "",
};

// --- AI szöveg-prompt: zárolt adat-blokk (hangnem + tények) + finomítható rész
function ffv(s: unknown): string {
  return typeof s === "string" && s.trim() ? s.trim() : "";
}

// Zárolt adat-blokk: a hangnem és a megadott tények (a változók helye zárolt).
export function flyerDataBlock(facts: Partial<FlyerFacts>, toneDesc: string): string {
  const factLines = [
    `Elhelyezkedés: ${ffv(facts.location) || "[nincs megadva]"}`,
    `Ár: ${ffv(facts.price) || "[nincs megadva]"}`,
    `Típus: ${ffv(facts.propertyType) || "[nincs megadva]"}`,
    `Méret: ${ffv(facts.size) || "[nincs megadva]"}`,
    `Szobák: ${ffv(facts.rooms) || "[nincs megadva]"}`,
    `Fürdőszobák: ${ffv(facts.bathrooms) || "[nincs megadva]"}`,
    `Állapot: ${ffv(facts.condition) || "[nincs megadva]"}`,
    `Egyéb: ${ffv(facts.extra) || "[nincs megadva]"}`,
    `További kiemelt jellemzők: ${[ffv(facts.custom1), ffv(facts.custom2)].filter(Boolean).join("; ") || "[nincs megadva]"}`,
  ].join("\n");
  return `Hangnem: ${toneDesc}\n\nTények:\n${factLines}`;
}

export const FLYER_DATA_BLOCK_PREVIEW = `Hangnem: {hangnem}

Tények:
Elhelyezkedés: {elhelyezkedés}
Ár: {ár}
Típus: {típus}
Méret: {méret}
Szobák: {szobák}
Fürdőszobák: {fürdőszobák}
Állapot: {állapot}
Egyéb: {egyéb}
További kiemelt jellemzők: {custom1; custom2}`;

export const FLYER_DEFAULT_SEGMENTS = {
  intro: `Ingatlanhirdetés szövegírója vagy. Írj magyar nyelvű hirdetésszöveget KIZÁRÓLAG az alábbi tények alapján. NE találj ki új adatot (címet, árat, méretet), amit nem adtak meg. Ügyelj a helyes magyar helyesírásra és az egybeírandó szavakra (pl. "újépítésű", "belvárosi", "kétszintes").`,
  task: `Válaszolj KIZÁRÓLAG egyetlen érvényes JSON objektummal, pontosan ezekkel a kulcsokkal (magyarul, ékezetekkel):
{
  "title": "rövid, ütős főcím (pl. 'Eladó 1 szobás lakás')",
  "subtitle": "a PONTOS lokáció egy sorban: település, kerület ÉS utca is, ha meg van adva (ne csak a várost)",
  "price": "CSAK a szám millióban, mértékegység nélkül (pl. '46,5' vagy '50'); ha nincs ár, üres string",
  "highlights": ["3-4 nagyon rövid kiemelés, egyenként max 3 szó"],
  "characteristics": ["5-7 pontban a főbb jellemzők, rövid mondatokban"],
  "infra": "1-2 mondat az infrastruktúráról/környékről (csak ha van rá alap)",
  "transport": "1-2 mondat a közlekedésről (csak ha van rá alap)"
}
Ne írj semmit a JSON elé vagy mögé.`,
};

export function composeFlyerCopyPrompt(
  facts: Partial<FlyerFacts>,
  toneDesc: string,
  segments: { intro?: string; task?: string }
): string {
  const intro = (segments.intro ?? FLYER_DEFAULT_SEGMENTS.intro).trim();
  const task = (segments.task ?? FLYER_DEFAULT_SEGMENTS.task).trim();
  return `${intro}\n\n${flyerDataBlock(facts, toneDesc)}\n\n${task}`;
}

// Egy munkakönyvtár-elem (a korábbi munkákból).
export type LibraryItem = {
  id: string;
  type: string; // feature_used vagy 'video'
  typeLabel: string;
  title: string;
  createdAt: string;
  images: string[]; // felhasználható képek (látványterv kimenetek stb.)
  pdfUrl: string | null; // ha PDF a kimenet (értékbecslés)
  data: {
    telepules?: string;
    utca?: string;
    tipus?: string;
    meret?: string;
    szobak?: string;
  } | null;
  details: { label: string; value: string }[]; // összefoglaló a felugró ablakhoz
};
