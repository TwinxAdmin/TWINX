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
  width: number;
  height: number;
};

export const FLYER_FORMATS: FlyerFormat[] = [
  { value: "a4", label: "A4 álló — PDF", kind: "pdf", width: 794, height: 1123 },
  { value: "1:1", label: "Négyzet 1:1 — poszt", kind: "image", width: 1080, height: 1080 },
  { value: "4:3", label: "4:3 — fekvő", kind: "image", width: 1200, height: 900 },
  { value: "16:9", label: "16:9 — fekvő széles", kind: "image", width: 1280, height: 720 },
  { value: "9:16", label: "9:16 — story", kind: "image", width: 1080, height: 1920 },
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
  condition: string;
  extra: string; // egyéb, amit az AI tudjon (pl. felújított fürdő, metró közel)
};

export const EMPTY_FACTS: FlyerFacts = {
  location: "",
  price: "",
  propertyType: "",
  size: "",
  rooms: "",
  condition: "",
  extra: "",
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
