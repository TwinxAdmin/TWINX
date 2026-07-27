// Hirdetés-sablonrendszer: 5 STÍLUS × 4 ARÁNY × 1–4 KÉP.
// Nem 80 külön sablont írunk, hanem paraméteres rendszert: a stílus adja a
// színhasználatot és a tipográfiát, az arány a vászon méretét, a képszám pedig a
// képek elrendezését. Új stílus felvételekor csak ide kell egy blokk.
//
// KÉT SZABÁLY, amit a rendszer garantál:
//  1) Kontraszt: színes/sötét felületre mindig világos betű kerül és fordítva
//     (contrastOn()), tehát sosem lesz olvashatatlan felirat.
//  2) Nincs túlcsordulás: minden szövegdoboznak sorkorlátja van (clamp) és a
//     hosszú szöveg automatikusan kisebb betűvel jelenik meg (fitSize()).

export type FlyerStyleId = "klasszikus" | "modern" | "minimal" | "magazin" | "bold";
export type FlyerRatioId = "9:16" | "1:1" | "4:3" | "3:2";

export type FlyerStyle = {
  id: FlyerStyleId;
  label: string;
  desc: string;
  /** A fő felület: a kép fölé úszó szöveg, vagy külön szöveg-sáv. */
  surface: "overlay" | "panel";
  /** Sarkok lekerekítése (px, 900 px széles vászonra méretezve). */
  radius: number;
  /** Az adat-chipek stílusa. */
  chip: "solid" | "outline" | "underline";
  /** A cím betűvastagsága és nagybetűsítése. */
  titleWeight: 700 | 800 | 900;
  titleUpper: boolean;
  /** Az arculati akcentszín mennyire domináljon (0–1). */
  accentStrength: number;
};

export const FLYER_STYLES: FlyerStyle[] = [
  {
    id: "klasszikus",
    label: "Klasszikus",
    desc: "Nagy főkép, alatta letisztult adatsáv — a bevált ingatlanos elrendezés.",
    surface: "panel",
    radius: 14,
    chip: "solid",
    titleWeight: 800,
    titleUpper: true,
    accentStrength: 0.6,
  },
  {
    id: "modern",
    label: "Modern",
    desc: "A szöveg a képre úszik, finom sötétítéssel — látványos, mai hatás.",
    surface: "overlay",
    radius: 18,
    chip: "outline",
    titleWeight: 800,
    titleUpper: false,
    accentStrength: 0.8,
  },
  {
    id: "minimal",
    label: "Minimál",
    desc: "Sok fehér tér, vékony vonalak, csendes tipográfia — prémium érzet.",
    surface: "panel",
    radius: 8,
    chip: "underline",
    titleWeight: 700,
    titleUpper: false,
    accentStrength: 0.35,
  },
  {
    id: "magazin",
    label: "Magazin",
    desc: "Két hasáb, szerkesztőségi ritmus — részletes adatokhoz a legjobb.",
    surface: "panel",
    radius: 10,
    chip: "underline",
    titleWeight: 700,
    titleUpper: true,
    accentStrength: 0.45,
  },
  {
    id: "bold",
    label: "Erőteljes",
    desc: "Nagy színmezők, vastag betűk — kiugrik a hirdetési felületek közül.",
    surface: "overlay",
    radius: 0,
    chip: "solid",
    titleWeight: 900,
    titleUpper: true,
    accentStrength: 1,
  },
];

export function getFlyerStyle(id: string): FlyerStyle {
  return FLYER_STYLES.find((s) => s.id === id) ?? FLYER_STYLES[0];
}

// --- Arányok ---------------------------------------------------------------
export type FlyerRatio = {
  id: FlyerRatioId;
  label: string;
  hint: string;
  width: number;
  height: number;
};

export const FLYER_RATIOS: FlyerRatio[] = [
  { id: "9:16", label: "9:16 — álló", hint: "Story, Reels, TikTok", width: 1080, height: 1920 },
  { id: "1:1", label: "1:1 — négyzet", hint: "Instagram, Facebook poszt", width: 1080, height: 1080 },
  { id: "4:3", label: "4:3 — fekvő", hint: "Hirdetési portálok, e-mail", width: 1440, height: 1080 },
  { id: "3:2", label: "3:2 — fekvő", hint: "Nyomtatás, prezentáció", width: 1620, height: 1080 },
];

export function getFlyerRatio(id: string): FlyerRatio {
  return FLYER_RATIOS.find((r) => r.id === id) ?? FLYER_RATIOS[1];
}

// --- Képszám-variánsok -----------------------------------------------------
// 1 kép: a kép uralja a felületet, az adatok nagyobbak és hangsúlyosabbak.
// 2–4 kép: egy fő kép + kisebb galéria; a fő kép aránya csökken, ahogy nő a darabszám.
export type ImagePlan = {
  count: 1 | 2 | 3 | 4;
  /** A fő kép a vászon hány százalékát foglalja el (a szövegblokk kapja a többit). */
  heroShare: number;
  /** A galéria-képek egy sorban. */
  galleryCols: number;
  /** Az adatblokk mérete: minél kevesebb kép, annál nagyobb. */
  textScale: number;
};

export function imagePlan(count: number, ratio: FlyerRatioId): ImagePlan {
  const n = Math.max(1, Math.min(4, count)) as 1 | 2 | 3 | 4;
  const tall = ratio === "9:16";
  const base: Record<1 | 2 | 3 | 4, ImagePlan> = {
    1: { count: 1, heroShare: tall ? 0.58 : 0.62, galleryCols: 0, textScale: 1.15 },
    2: { count: 2, heroShare: tall ? 0.5 : 0.55, galleryCols: 1, textScale: 1.05 },
    3: { count: 3, heroShare: tall ? 0.46 : 0.5, galleryCols: 2, textScale: 1 },
    4: { count: 4, heroShare: tall ? 0.42 : 0.46, galleryCols: 3, textScale: 0.95 },
  };
  return base[n];
}

// --- Kontraszt -------------------------------------------------------------
/** Egy háttérszínre olvasható szövegszín (WCAG-közeli, egyszerű luminancia). */
export function contrastOn(hex: string): string {
  const h = (hex || "#000000").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#16120e" : "#ffffff";
}

/** Sötét-e a megadott szín (döntésekhez: pl. sávot vagy keretet használjunk). */
export function isDark(hex: string): boolean {
  return contrastOn(hex) === "#ffffff";
}

/** Az akcentszín halvány változata háttérnek (a szöveg mindig az ink marad). */
export function accentSoft(hex: string, alpha = 0.12): string {
  const h = (hex || "#000000").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// --- Szöveg: túlcsordulás elleni védelem -----------------------------------
/** Karakterlimitek — a beviteli mezőkön is ezt használjuk, élő számlálóval. */
export const TEXT_LIMITS = {
  title: 46,
  subtitle: 60,
  price: 18,
  highlight: 26,
  characteristic: 34,
  block: 220,
} as const;

/**
 * Hosszú szöveghez kisebb betűméret — így a felirat sosem lóg le a sávról.
 * @param len a szöveg hossza
 * @param comfortable eddig a hosszig marad a teljes méret
 * @param base alap betűméret px-ben
 */
export function fitSize(len: number, comfortable: number, base: number, min = 0.62): number {
  if (len <= comfortable) return base;
  const factor = Math.max(min, comfortable / len);
  return Math.round(base * factor);
}

/** Biztonságos szövegdoboz CSS-e: tördel, és legfeljebb N sorban jelenik meg. */
export function clampCss(lines: number): string {
  return `display:-webkit-box;-webkit-line-clamp:${lines};-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;word-break:break-word;`;
}
