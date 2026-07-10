// Hirdetéskészítő — közös modell: formátumok, hangnemek, kredit, adat-típusok.
// A layoutok és a render az F4-ben jönnek; ez a közös alap.

// Kredit: induláskor 0 (ingyenes). Később egyetlen szám átírásával ára lehet
// (a 100% haszon szabály szerint). 0 = nincs levonás.
export const FLYER_CREDITS = Number(process.env.FLYER_CREDITS ?? 0);

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
};
