// Közös Satori-építőelemek a hirdetés-sablonokhoz.
// Minden sablon (prémium, nyitott ház, adatlap) ezekből dolgozik, így a tipográfia,
// az ikonok és a szöveg-rövidítés egységes marad.
//
// Satori-korlátok, amikre MINDIG figyelni kell:
//  - csak flexbox, csak pixel értékek, egyszerű CSS + egyszerű SVG,
//  - `undefined` stílusértéktől elhasal → csak a meglévő kulcsokat adjuk át,
//  - a szöveg-gyerek mindig string legyen.
import React from "react";
import { truncate, type RenderDetails } from "@/lib/flyer-poster";

export type Style = React.CSSProperties;

export function box(style: Style, children?: React.ReactNode): React.ReactElement {
  return React.createElement("div", { style: { display: "flex", ...style } }, children);
}

export function img(src: string, style: Style): React.ReactElement {
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return React.createElement("img", { src, style });
}

/** hex szín adott átlátszósággal (rgba) — a színátmenetekhez. */
export function hexA(hex: string, a: number): string {
  const h = (hex || "#000000").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0, g = parseInt(h.slice(2, 4), 16) || 0, b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Olvasható szövegszín az adott háttéren (világos háttér → sötét betű). */
export function onColor(hex: string): string {
  const h = (hex || "#000000").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0, g = parseInt(h.slice(2, 4), 16) || 0, b = parseInt(h.slice(4, 6), 16) || 0;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#171310" : "#ffffff";
}

/** Az első szám a szövegből (pl. "1 fürdőszoba + külön WC" → "1"). */
export function numOf(s?: string): string {
  const m = String(s ?? "").match(/\d+([.,]\d+)?/);
  return m ? m[0] : "";
}

/** Rövid címke: a zárójeles rész és a felesleges farok nélkül. */
export function shortLabel(s: string, max = 16): string {
  const base = String(s ?? "").split("(")[0].split("/")[0].trim();
  return truncate(base, max);
}

// Flyer-only tömörítés: a szabvány (és hosszú) opciónevek rövid, csinos formája —
// CSAK a hirdetésen; a teljes név máshol (értékbecslés, AI) érintetlen marad.
// STEM alapú (részleges) egyezés — a farok (pl. „…es lakás") ne rontsa el a találatot.
const COMPACT_STEMS: Array<[string, string]> = [
  ["könnyűszerkezet", "Könnyűszerkezetes"],
  ["csúsztatott zsalu", "Csúszt. zsalu"],
  ["tégla építésű társasházi", "Téglalakás"],
  ["panel építésű társasházi", "Panellakás"],
  ["vegyes falazat", "Vegyes fal."],
  ["felújítandó", "Felújítandó"],
  ["kitűnő", "Kitűnő áll."],
  ["újszerű", "Újszerű"],
  ["közepes", "Közepes állapotú"],
  ["átlagos", "Közepes állapotú"],
];

/** Csinos, rövid megjelenítés levágás („…") nélkül. */
export function compact(s: string, max: number): string {
  let raw = String(s ?? "").trim();
  if (!raw) return "";
  raw = raw.replace(/(\d+)\s*vagy\s*t[öo]bb\s*szoba/i, "$1+ szoba");
  const low = raw.toLowerCase();
  for (const [stem, short] of COMPACT_STEMS) if (low.includes(stem)) return short;
  const base = raw.split("(")[0].split("/")[0].trim();
  if (base.length <= max) return base;
  const cut = base.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).trim();
}

// --- Vonalas ikonok (24×24 rács, stroke) ------------------------------------
export const ICON_PATHS: Record<string, string[]> = {
  area: ["M3 3h18v18H3z", "M8 3v18", "M3 8h18"],                                  // alaprajz / m²
  bed: ["M3 18v-7a2 2 0 012-2h14a2 2 0 012 2v7", "M3 14h18", "M3 18h18", "M7 9V6h5v3"], // szoba
  bath: ["M4 12h16v3a4 4 0 01-4 4H8a4 4 0 01-4-4z", "M7 12V6a2 2 0 114 0", "M6 19l-1 2", "M18 19l1 2"], // fürdő
  stairs: ["M3 20h4v-4h4v-4h4V8h4V4"],                                            // szint
  brick: ["M3 6h18v5H3z", "M3 13h18v5H3z", "M9 6v5", "M15 6v5", "M6 13v5", "M12 13v5", "M18 13v5"], // szerkezet
  check: ["M20 6L9 17l-5-5"],                                                     // állapot
  phone: ["M4 5a2 2 0 012-2h2l2 5-2 1a12 12 0 006 6l1-2 5 2v2a2 2 0 01-2 2A16 16 0 014 5z"], // telefon
  mail: ["M3 6h18v12H3z", "M3 7l9 6 9-6"],                                        // e-mail
  globe: ["M12 3a9 9 0 100 18 9 9 0 000-18z", "M3 12h18", "M12 3c2.5 2.7 2.5 15.3 0 18", "M12 3c-2.5 2.7-2.5 15.3 0 18"], // honlap
  pin: ["M12 21s7-6.1 7-11a7 7 0 10-14 0c0 4.9 7 11 7 11z", "M12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"], // cím
};

export function icon(kind: string, size: number, color: string, strokeW = 1.8): React.ReactElement {
  const paths = ICON_PATHS[kind] ?? ICON_PATHS.check;
  return React.createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", style: { display: "flex" } },
    paths.map((d, i) =>
      React.createElement("path", {
        key: i, d, stroke: color, strokeWidth: strokeW, strokeLinecap: "round", strokeLinejoin: "round",
      })
    )
  );
}

/** Pipa jel körvonalas dobozban (a „nyitott ház" sablon előny-listájához). */
export function checkBox(size: number, color: string, stroke = 2): React.ReactElement {
  return box(
    {
      width: size, height: size, flexShrink: 0, alignItems: "center", justifyContent: "center",
      border: `${stroke}px solid ${color}`, borderRadius: Math.round(size * 0.16),
    },
    icon("check", Math.round(size * 0.68), color, 2.6)
  );
}

/**
 * A főkép „cover" kitöltése egy TETSZŐLEGES méretű régióban, igazítható kivágással.
 * A visszaadott elem abszolút pozíciójú — `overflow: hidden` dobozba kell tenni.
 * Ha ismerjük a fotó valódi méretét (iw/ih), a teljes rejtett területen mozgatunk
 * (+6% ránagyítás); e nélkül tartalék 16%-os ránagyításon belül tolunk.
 */
export function heroFill(
  src: string, rw: number, rh: number,
  hx = 50, hy = 50, iw = 0, ih = 0
): React.ReactElement | null {
  if (!src) return null;
  const x = Math.max(0, Math.min(100, hx));
  const y = Math.max(0, Math.min(100, hy));
  if (iw > 0 && ih > 0) {
    const s = Math.max(rw / iw, rh / ih) * 1.06;
    const dw = Math.round(iw * s);
    const dh = Math.round(ih * s);
    return img(src, {
      position: "absolute",
      width: dw, height: dh,
      left: -Math.round(((dw - rw) * x) / 100),
      top: -Math.round(((dh - rh) * y) / 100),
    });
  }
  const ZOOM = 1.16;
  const overW = Math.round(rw * (ZOOM - 1));
  const overH = Math.round(rh * (ZOOM - 1));
  return img(src, {
    position: "absolute",
    width: rw + overW, height: rh + overH,
    left: -Math.round((x / 100) * overW),
    top: -Math.round((y / 100) * overH),
    objectFit: "cover",
  });
}

export type FactItem = { k: string; v: string };

/**
 * Az ingatlan ikonos adat-tételei a megadott mezőkből (csak ami ki van töltve).
 * Mindhárom sablon ugyanezt a listát használja — így az adatok sorrendje egységes.
 */
export function factItems(d: RenderDetails, sizeTxt: string): FactItem[] {
  const items: FactItem[] = [];
  if (sizeTxt) items.push({ k: "area", v: truncate(sizeTxt, 14) });
  const roomsNum = numOf(d.rooms);
  if (roomsNum) items.push({ k: "bed", v: `${roomsNum} szoba` });
  else if (d.rooms) items.push({ k: "bed", v: compact(d.rooms, 14) });
  const bathNum = numOf(d.bathrooms);
  if (bathNum) items.push({ k: "bath", v: `${bathNum} fürdő` });
  if (d.floor) items.push({ k: "stairs", v: compact(d.floor, 16) });
  if (d.structure) items.push({ k: "brick", v: compact(d.structure, 16) });
  if (d.condition) items.push({ k: "check", v: compact(d.condition, 16) });
  return items;
}

/**
 * Bekezdés illesztése egy ADOTT magasságú dobozba.
 *
 * A Satori NEM vág sor-korláttal (`lineClamp` hatástalan), ezért a sorszámot a
 * szöveghosszból becsüljük (sorhossz ≈ dobozszélesség / (betűméret × 0,52)).
 * Először a betűméretet csökkentjük, hogy a TELJES szöveg kiférjen — és csak
 * akkor vágunk, ha a legkisebb méreten sem fér el. Így a leírás vége nem vész el.
 */
export function fitParagraph(
  text: string, boxW: number, availH: number, baseFs: number, minFs: number
): { fs: number; lineH: number; text: string; lines: number } {
  const t = String(text ?? "").trim();
  const step = Math.max(1, Math.round(baseFs * 0.07));
  const cplAt = (fs: number) => Math.max(8, Math.floor(boxW / (fs * 0.52)));
  for (let fs = baseFs; fs >= minFs; fs -= step) {
    const lineH = Math.round(fs * 1.45);
    const lines = Math.max(1, Math.ceil(t.length / cplAt(fs)));
    if (lines * lineH <= availH) return { fs, lineH, text: t, lines };
  }
  // Legkisebb méreten sem fér el → annyi sort tartunk meg, amennyi belefér.
  const fs = minFs;
  const lineH = Math.round(fs * 1.45);
  const lines = Math.max(1, Math.floor(availH / lineH));
  return { fs, lineH, text: truncate(t, lines * cplAt(fs)), lines };
}

/**
 * Betűméret hosszhoz igazítva: a `base` méret arányosan csökken, ha a szöveg
 * hosszabb a referenciánál — így a fix dobozokból sosem lóg ki.
 */
export function fitFs(text: string, base: number, refLen: number, min = 0.6): number {
  const len = String(text ?? "").length;
  if (len <= refLen) return Math.round(base);
  const k = Math.max(min, refLen / len);
  return Math.round(base * k);
}
