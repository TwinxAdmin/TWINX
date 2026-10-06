// TWINX MOZAIK — világos, „márvány" hangulatú sablon rombusz-fotómozaikkal.
// ÉLESÍTVE 2026-10-06.
//
// NYITÓKÉP (a referencia alapján): fehér keretes rombuszok („gyémántok") — a
// LEGNAGYOBBAN a főkép (1. fotó), a kisebbekben a lakás többi fotója; mellette
// (1:1) / alatta (9:16) az információk. ANIMÁCIÓ: először a főkép ugrik fel, utána
// gyorsan a kisebbek, végül az információk is előugranak (pop).
//
// GALÉRIA (2. fotótól): nagy kép + kis képek oszlopa, „csere" áttűnés, papírcsík-felirat.
//
// IDŐVONAL (5 fotó, 34,4 mp): 0–6 nyitó · 6–28,4 galéria (4 × 5,6 mp) · 28,4–34,4 zárókép
import type { TwinxTemplate, Layer, StackItem, AspectId, Box } from "@/lib/video-engine/template-schema";

const HEAD = "Outfit";
const NOTE = "Shantell Sans";

// --- Rombusz-geometria: középpont + fél-átló, a vászon SZÉLESSÉGÉNEK egységében ---
type D = { cx: number; cy: number; r: number };
/** A rombusz dobozának megadása a vászon arányaiban (y a magasságra átszámolva). */
function dbox(d: D, aspect: AspectId) {
  const k = aspect === "9:16" ? 1080 / 1920 : 1; // szélesség-egység → magasság-arány
  return { x: d.cx - d.r, y: (d.cy - d.r) * k, w: 2 * d.r, h: 2 * d.r * k };
}

// A rombuszok egymáshoz képest ~0,035 W fehér réssel (a referencia sűrű mozaikja).
const LAYOUT: Record<AspectId, { main: D; small: D[] }> = {
  "1:1": {
    main: { cx: 0.33, cy: 0.42, r: 0.3 },
    small: [
      { cx: 0.08, cy: 0.15, r: 0.17 }, // bal felső (kilóg a szélen)
      { cx: 0.08, cy: 0.73, r: 0.21 }, // bal alsó
      { cx: 0.47, cy: 0.8, r: 0.17 },  // lent középen
    ],
  },
  "9:16": {
    main: { cx: 0.56, cy: 0.48, r: 0.38 },
    small: [
      { cx: 0.14, cy: 0.25, r: 0.22 }, // bal felső
      { cx: 0.12, cy: 0.73, r: 0.26 }, // bal alsó
      { cx: 0.8, cy: 0.87, r: 0.2 },   // jobb alsó
    ],
  },
};

/**
 * Rombusz-mozaik: főkép + 3 kisebb, mind előugró animációval, egymás után.
 * `photos` = [nagy, kicsi1, kicsi2, kicsi3] fotószámok (nyitó: 1,2,3,4; zárókép: más sorrend).
 */
function mosaic(photos: number[] = [1, 2, 3, 4], prefix = ""): Layer[] {
  const border = { width: 0.012, color: "#ffffff" as const };
  const main: Layer = {
    id: `${prefix}fokep`, kind: "image", bind: `photo.${photos[0]}`, mask: "diamond", fit: "cover",
    box: dbox(LAYOUT["9:16"].main, "9:16"),
    byAspect: { "1:1": { box: dbox(LAYOUT["1:1"].main, "1:1") } },
    border,
    appear: { type: "pop", delay: 0.2, duration: 0.6 },
  };
  const small: Layer[] = [0, 1, 2].map((i) => ({
    id: `${prefix}kiskep-${i}`, kind: "image" as const, bind: `photo.${photos[i + 1]}` as const, mask: "diamond" as const, fit: "cover" as const,
    box: dbox(LAYOUT["9:16"].small[i], "9:16"),
    byAspect: { "1:1": { box: dbox(LAYOUT["1:1"].small[i], "1:1") } },
    border,
    appear: { type: "pop" as const, delay: 0.6 + i * 0.14, duration: 0.45 },
  }));
  return [main, ...small];
}

/** Az információk három előugró csoportban: cím-blokk → ár → kapcsolat. */
function infoGroups(): Layer[] {
  const sq = (k: number) => k * 0.92; // 1:1-ben a keskenyebb oszlop miatt picit kisebb
  const titleItems = (k: number): StackItem[] => [
    { type: "text", bind: "property.type", font: { family: HEAD, weight: 600, size: 0.026 * k }, color: "@muted", uppercase: true, letterSpacing: 0.004, maxLines: 1, align: "right" },
    { type: "text", bind: "property.title", font: { family: HEAD, weight: 800, size: 0.082 * k }, color: "@accent", lineHeight: 1.02, maxLines: 3, gapBefore: 0.01, align: "right" },
    { type: "text", bind: "property.city", font: { family: HEAD, weight: 800, size: 0.05 * k }, color: "@text", lineHeight: 1.05, maxLines: 2, gapBefore: 0.008, align: "right" },
  ];
  const priceItems = (k: number): StackItem[] => [
    { type: "text", bind: "property.price", font: { family: HEAD, weight: 800, size: 0.066 * k }, color: "@accent", maxLines: 1, align: "right" },
    { type: "rule", width: 0.3, height: 0.006, color: "@text", gapBefore: 0.012 },
  ];
  const contactItems = (k: number): StackItem[] => [
    { type: "text", text: "Kapcsolat", font: { family: HEAD, weight: 800, size: 0.04 * k }, color: "@text", maxLines: 1, align: "right" },
    { type: "text", bind: "agent.name", font: { family: HEAD, weight: 400, size: 0.032 * k }, color: "@text", maxLines: 1, gapBefore: 0.012, align: "right" },
    { type: "text", bind: "agent.phone", font: { family: HEAD, weight: 400, size: 0.032 * k }, color: "@text", maxLines: 1, gapBefore: 0.006, align: "right" },
    { type: "text", bind: "agent.email", font: { family: HEAD, weight: 400, size: 0.026 * k }, color: "@muted", maxLines: 1, gapBefore: 0.006, align: "right" },
  ];
  // 9:16: a rombuszok ALATT, teljes szélességben jobbra zárva · 1:1: jobb oldali oszlop.
  const y = (wUnits: number) => wUnits * (1080 / 1920);
  return [
    {
      id: "info-cim", kind: "stack", align: "right", valign: "bottom",
      box: { x: 0.06, y: y(1.08), w: 0.88, h: y(0.32) },
      items: titleItems(1.22),
      byAspect: { "1:1": { box: { x: 0.64, y: 0.08, w: 0.32, h: 0.42 }, items: titleItems(sq(0.95)) } },
      appear: { type: "pop", delay: 1.05, duration: 0.45 },
    },
    {
      id: "info-ar", kind: "stack", align: "right", valign: "top",
      box: { x: 0.06, y: y(1.415), w: 0.88, h: y(0.12) },
      items: priceItems(1.22),
      byAspect: { "1:1": { box: { x: 0.64, y: 0.52, w: 0.32, h: 0.12 }, items: priceItems(sq(0.95)) } },
      appear: { type: "pop", delay: 1.25, duration: 0.4 },
    },
    {
      id: "info-kapcsolat", kind: "stack", align: "right", valign: "top",
      box: { x: 0.06, y: y(1.535), w: 0.88, h: y(0.2) },
      items: contactItems(1.2),
      byAspect: { "1:1": { box: { x: 0.64, y: 0.68, w: 0.32, h: 0.26 }, items: contactItems(sq(1)) } },
      appear: { type: "pop", delay: 1.45, duration: 0.4 },
    },
  ];
}

const marble: Layer = {
  id: "marvany", kind: "component", component: "marble",
  box: { x: 0, y: 0, w: 1, h: 1 }, props: { seed: 11 },
};

// ---------------------------------------------------------------------------
// GALÉRIA (a 2. fotótól): nagyban a soron következő fotó, mellette balra egymás alatt
// a többi kicsiben (fehér keret). Váltáskor a következő fotó a saját kis helyéről nagyra
// nő, az addigi nagy kép a megüresedett kis helyre zsugorodik („swap" áttűnés).
// Csak a NAGY kép mozog: lassú, kis nagyítás (pásztázás nincs).
// Rétegsorrend: márvány → nagy kép → papírcsík-felirat → kis képek.
// ---------------------------------------------------------------------------
const SWAP = 0.92;      // a csere hossza (mp) — 23 képkocka
const GLEN = 5.6;       // egy galériajelenet hossza (mp) — EGÉSZ képkockaszám (140), különben a határon 1 kocka „villan"
const ZOOM = 0.05;      // a nagy kép nagyítása jelenetenként (+5%)
const THUMB_BORDER = 0.008;

type Geom = { main: Box; slots: Box[]; note: Box; insetLeft: number };
/** A galéria elrendezése méretenként és a kis képek számától függően (3 vagy 4). */
function galleryGeom(aspect: AspectId, slots: number): Geom {
  const portrait = aspect === "9:16";
  const ar = portrait ? 1080 / 1920 : 1; // szélesség → magasság arány
  // A kis képek oszlopa és a nagy kép NEM fedik egymást (rés van köztük) — így a csere
  // elején és végén sincs takarás-váltás: a kis képek rétege végig felül marad.
  const tw = portrait ? (slots === 4 ? 0.33 : 0.35) : (slots === 4 ? 0.27 : 0.29);
  const th = (tw / 1.5) * ar;            // 3:2-es fekvő kis képek
  const gap = portrait ? (slots === 4 ? 0.025 : 0.03) : (slots === 4 ? 0.025 : 0.035);
  const total = slots * th + (slots - 1) * gap;
  const top = (1 - total) / 2;
  const x = portrait ? 0.04 : 0.035;
  const boxes = Array.from({ length: slots }, (_, i) => ({ x, y: top + i * (th + gap), w: tw, h: th }));
  const right = x + tw;
  return portrait
    // 9:16: a csík a kép alján, szinte teljes szélességben (a teteje a legalsó kis kép alá bújik)
    // → széles szövegsor, nagy betű, legfeljebb 3 sor.
    ? { main: { x: right + 0.03, y: 0.07, w: 1 - right - 0.03, h: 0.86 }, slots: boxes, note: { x: 0.035, y: 0.785, w: 0.93, h: 0.17 }, insetLeft: 0.05 }
    : { main: { x: right + 0.025, y: 0.05, w: 1 - right - 0.025, h: 0.9 }, slots: boxes, note: { x: 0.24, y: 0.63, w: 0.73, h: 0.27 }, insetLeft: right + 0.035 - 0.24 };
}

/**
 * A galéria jelenetei `count` fotóhoz (4 vagy 5). A kis képek kezdetben: 1, 3, 4, (5).
 * Minden cserénél a következő fotó a helyéről nagyra nő, a helyére az előző nagy kép kerül.
 */
function galleryScenes(count: number): TwinxTemplate["scenes"] {
  const nSlots = count - 1;
  const g9 = galleryGeom("9:16", nSlots), g1 = galleryGeom("1:1", nSlots);
  let slots = [1, ...Array.from({ length: count - 2 }, (_, i) => i + 3)]; // pl. [1,3,4,5]
  const scenes: TwinxTemplate["scenes"] = [];
  for (let m = 2; m <= count; m++) {
    const first = m === 2;
    const outgoing = m - 1; // az előző nagy kép (a cserénél ez megy a kis helyre)
    if (!first) slots = slots.map((p) => (p === m ? outgoing : p));
    const thumbs: Layer[] = slots.map((p, k) => ({
      id: `kiskep-${k}`, kind: "image" as const, bind: `photo.${p}` as const, fit: "cover" as const,
      box: g9.slots[k], byAspect: { "1:1": { box: g1.slots[k] } },
      border: { width: THUMB_BORDER, color: "#ffffff" as const },
      // A cserében érkező kis kép (az előző nagy) csak a csere végén „áll be" — addig az
      // áttűnés rajzolja mozgás közben.
      ...(!first && p === outgoing ? { appear: { type: "fade" as const, delay: SWAP, duration: 0.04 } } : {}),
    }));
    scenes.push({
      id: `foto-${m}`,
      role: "photo",
      length: GLEN,
      background: { type: "color", color: "@base" },
      transitionIn: first
        ? { type: "softDip", duration: 1.0, colors: { fill: "#ffffff" } }
        : { type: "swap", duration: SWAP },
      layers: [
        marble,
        {
          id: "nagykep", kind: "image", bind: `photo.${m}`, fit: "cover",
          box: g9.main, byAspect: { "1:1": { box: g1.main } },
          motion: { type: "zoomIn", amount: ZOOM },
          // Cserénél a nagy kép a csere végén veszi át a helyét (addig az áttűnés mozgatja).
          ...(first ? {} : { appear: { type: "none" as const, delay: SWAP } }),
        },
        {
          id: "felirat", kind: "component", component: "paperNote", bind: `caption.${m}`,
          box: g9.note,
          props: { family: NOTE, weight: 500, size: 0.05, lines: 3, insetLeft: Number(g9.insetLeft.toFixed(3)), tilt: -1 },
          // 1:1-ben más a betűméret, a sorok száma és a bal margó.
          byAspect: { "1:1": { box: g1.note, props: { family: NOTE, weight: 500, size: 0.04, lines: 4, insetLeft: Number(g1.insetLeft.toFixed(3)), tilt: -1 } } },
          appear: { type: "slideUp", delay: first ? 0.7 : SWAP + 0.15, duration: 0.6, easing: "easeOut" },
          hideBeforeEnd: 0.35,
        },
        ...thumbs,
      ],
    });
  }
  return scenes;
}

function buildMozaik(count: number): TwinxTemplate {
  const n = count >= 5 ? 5 : 4;
  return {
    id: "mozaik",
    name: "TWINX Mozaik",
    version: 2,
    fps: 25,
    aspects: ["9:16", "1:1"],
    fonts: [
      { family: HEAD, weight: 800, file: "assets/fonts/video/Outfit-ExtraBold.ttf" },
      { family: HEAD, weight: 600, file: "assets/fonts/video/Outfit-SemiBold.ttf" },
      { family: HEAD, weight: 400, file: "assets/fonts/video/Outfit-Regular.ttf" },
      // A papírcsík felirata: csak ENYHÉN kézírásos, jól olvasható (Google Fonts, OFL).
      { family: NOTE, weight: 500, file: "assets/fonts/video/ShantellSans-Medium.ttf" },
    ],
    palette: {
      shadow: "#3a3631",  // antracit (sötét szöveg, vonalak)
      base: "#f3f1ee",    // márvány alap
      glow: "#e4e0da",    // halvány erezet / árnyalat
      accent: "#a65d36",  // terrakotta (főcím, ár)
      text: "#3a3631",    // antracit szöveg
      muted: "#77716a",   // másodlagos szöveg, erezet
    },
    photos: { min: 4, max: 5 },
    captionMaxChars: 80,
    audio: { volume: 1, fadeIn: 0.6, fadeOut: 2.2 },
    forPhotoCount: (k: number) => buildMozaik(k),

    scenes: [
      {
        id: "nyito",
        role: "intro",
        length: 6,
        background: { type: "color", color: "@base" },
        layers: [marble, ...mosaic(), ...infoGroups()],
      },
      ...galleryScenes(n),
      {
        id: "zaro",
        role: "closing",
        length: 6,
        background: { type: "color", color: "@base" },
        transitionIn: { type: "softDip", duration: 1.0, colors: { fill: "#ffffff" } },
        layers: [
          marble,
          // A zárókép is rombusz-mozaik, de más fotó-sorrenddel, mint a nyitó (nagyban a 2. fotó).
          ...mosaic([2, 3, 4, 1], "zaro-"),
          ...infoGroups().map((l) => ({ ...l, id: `zaro-${l.id}` })),
          {
            id: "logo", kind: "image", bind: "agent.logo", fit: "contain", mask: "rounded",
            // 9:16: bal alsó sarok (a rombuszok alatt) · 1:1: jobb felső sarok (az infó-oszlop fölött).
            box: { x: 0.06, y: 0.9, w: 0.16, h: 0.07 },
            byAspect: { "1:1": { box: { x: 0.82, y: 0.03, w: 0.14, h: 0.08 } } },
            appear: { type: "pop", delay: 1.6, duration: 0.4 },
          },
        ],
      },
    ],
  };
}

export const MOZAIK: TwinxTemplate = buildMozaik(5);
