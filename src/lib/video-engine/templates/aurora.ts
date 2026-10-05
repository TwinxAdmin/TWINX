// TWINX AURORA — a mostani (Shotstack-alapú) „TWINX Aurora" videósablon leírása
// a SAJÁT sablon-formátumban. Ez a mérce: a saját motor eredményét ehhez a
// leíráshoz és a Shotstack-videóhoz hasonlítjuk.
//
// Forrás (amit leképez):
//  • src/lib/video-json/modern-sarga-9x16.json és -1x1.json  (idővonal, zárókártya)
//  • src/lib/video-frames.tsx → renderModernIntro            (nyitókép ferde panelje)
//  • src/lib/video-frames.tsx → renderCaptionOverlay         (fotónkénti feliratsáv)
//
// IDŐVONAL (36 mp, 25 kép/mp):
//   0–6   nyitó: 1. fotó + ferde adatpanel (balról úszik be)
//   6–30  2–5. fotó, fotónként 6 mp, alul feliratsáv; a váltásoknál nyíl-áttűnés
//   30–36 zárókártya: felnyíló átlós panelek, rajta az ingatlan és az ingatlanos adatai
//
// A színek MIND palettahivatkozások — a Nocturne csak egy másik paletta (lent).
import type { TwinxTemplate, TemplateVariant } from "@/lib/video-engine/template-schema";

const MANROPE = "Manrope";

export const AURORA: TwinxTemplate = {
  id: "aurora",
  name: "TWINX Aurora",
  version: 1,
  fps: 25,
  aspects: ["9:16", "1:1"],
  fonts: [
    { family: MANROPE, weight: 800, file: "assets/fonts/video/Manrope-ExtraBold.ttf" },
    { family: MANROPE, weight: 700, file: "assets/fonts/video/Manrope-Bold.ttf" },
    { family: MANROPE, weight: 400, file: "assets/fonts/video/Manrope-Regular.ttf" },
    { family: MANROPE, weight: 300, file: "assets/fonts/video/Manrope-Light.ttf" },
  ],
  // Az eredeti színek (mérve a Shotstack-grafikákon és a JSON-ban).
  palette: {
    shadow: "#110420", // mély indigó: a nyíl-áttűnés és a zárópanel alapja
    base: "#1a1230",   // a nyitópanel és a zárókártya felülete
    glow: "#a17a3e",   // meleg borostyán izzás az áttűnésekben
    accent: "#f0c20c", // sárga kiemelés: cím, ár, ügynök neve, csíkok
    text: "#ffffff",
    muted: "#e8e4ee",
  },
  photos: { min: 4, max: 5 },
  audio: { volume: 1, fadeIn: 0, fadeOut: 2 },

  scenes: [
    // ------------------------------------------------------------------ 0–6 mp
    {
      id: "nyito",
      role: "intro",
      length: 6,
      background: { type: "photo", bind: "photo.1", motion: { type: "zoomIn", amount: 0.1, easing: "linear" } },
      transitionIn: { type: "fade", duration: 1 },
      layers: [
        // Túlméretezett, ferde (−9°) panel a bal oldalon — a szöveg mögött.
        {
          id: "panel", kind: "shape", shape: "rect",
          box: { x: -0.45, y: -0.35, w: 1.05, h: 1.7 }, skewX: -9,
          fill: "@base", opacity: 0.94,
          appear: { type: "slideRight", duration: 0.8, easing: "easeOut" },
        },
        // Vékony kiemelő csík a panel ferde élén.
        {
          id: "panel-el", kind: "shape", shape: "rect",
          box: { x: 0.6, y: -0.35, w: 0.0083, h: 1.7 }, skewX: -9,
          fill: "@accent",
          appear: { type: "slideRight", duration: 0.8, easing: "easeOut" },
        },
        // Adatblokk: kis csík, cím, elhelyezkedés, típus, adatok, ár.
        // 9:16-ban felül indul, 1:1-ben középre igazodik.
        {
          id: "adatok", kind: "stack",
          box: { x: 0, y: 0, w: 0.58, h: 1 },
          align: "left", valign: "top",
          padding: { top: 0.213 /* = a magasság 12%-a 9:16-ban */, left: 0.07, right: 0.044 },
          appear: { type: "slideRight", delay: 0.15, duration: 0.8, easing: "easeOut" },
          byAspect: { "1:1": { valign: "middle", padding: { top: 0, left: 0.07, right: 0.044 } } },
          items: [
            { type: "rule", width: 0.078, height: 0.0065, color: "@accent" },
            { type: "text", bind: "property.title", font: { family: MANROPE, weight: 800, size: 0.085 }, color: "@accent", lineHeight: 1.03, maxLines: 3, gapBefore: 0.022 },
            { type: "text", bind: "property.city", font: { family: MANROPE, weight: 400, size: 0.034 }, color: "@text", gapBefore: 0.014 },
            { type: "text", bind: "property.type", font: { family: MANROPE, weight: 800, size: 0.031 }, color: "@accent", uppercase: true, letterSpacing: 0.002, gapBefore: 0.022 },
            { type: "text", bind: "property.specs", font: { family: MANROPE, weight: 700, size: 0.043 }, color: "@text", lineHeight: 1.15, maxLines: 3, gapBefore: 0.155 },
            { type: "text", bind: "property.price", font: { family: MANROPE, weight: 800, size: 0.081 }, color: "@accent", lineHeight: 1, gapBefore: 0.155 },
          ],
        },
      ],
    },

    // ------------------------------------------------------------------ 6–30 mp
    ...([
      ["foto-2", 2, "slideLeft"],
      ["foto-3", 3, "slideRight"],
      ["foto-4", 4, "slideUp"],
      ["foto-5", 5, "slideLeft"],
    ] as const).map(([id, n, motion]) => ({
      id,
      role: "photo" as const,
      length: 6,
      background: { type: "photo" as const, bind: `photo.${n}` as const, motion: { type: motion, amount: 0.08, easing: "linear" as const } },
      // Nyíl alakú törlő a váltásnál — 3 mp, a határ közepén (ahogy a Shotstack-sablonban).
      transitionIn: { type: "chevronWipe" as const, duration: 3, direction: "right" as const, colors: { fill: "@shadow" as const, glow: "@glow" as const } },
      layers: [
        {
          id: "felirat", kind: "component" as const, component: "captionBar" as const,
          bind: `caption.${n}` as const,
          box: { x: 0, y: 0.78, w: 1, h: 0.22 },
          props: { position: "bottom" },
          appear: { type: "fade" as const, delay: 1.6, duration: 0.6 },
        },
      ],
    })),

    // ------------------------------------------------------------------ 30–36 mp
    {
      id: "zaro",
      role: "closing",
      length: 6,
      // A zárókártya alatt halványan az 1. fotó látszik (mint a Shotstack-változatban).
      background: { type: "photo", bind: "photo.1", motion: { type: "zoomIn", amount: 0.06 } },
      // Felnyíló átlós panelek: 1 mp-cel a határ előtt indul (29 mp), 2 mp hosszú.
      transitionIn: { type: "panelReveal", duration: 2, colors: { fill: "@shadow", glow: "@glow", shadow: "@base" } },
      layers: [
        // A panelek végállapota: felül sötét felület halvány szürke fénnyel…
        {
          id: "panel-felso", kind: "shape", shape: "rect",
          box: { x: 0, y: 0, w: 1, h: 1 },
          fill: { gradient: "radial", stops: [[0, "#ffffff", 0.22], [0.55, "@shadow", 0.92], [1, "@shadow", 0.96]] },
        },
        // …alul csúcsos tetejű panel, borostyánból mély alapszínbe.
        {
          id: "panel-also", kind: "shape", shape: "polygon",
          box: { x: 0, y: 0.6, w: 1, h: 0.4 },
          points: [[0, 0.12], [0.55, 0], [1, 0.1], [1, 1], [0, 1]],
          fill: { gradient: "linear", angle: 60, stops: [[0, "@glow", 0.95], [0.55, "@shadow", 0.95], [1, "@shadow", 0.95]] },
        },
        // Szövegek — a Shotstack-sablon pontos helyein (függőleges közép, magasság).
        text("cim", "property.title", 0.080, 0.1016, 800, 0.0676, "@accent", { cy: 0.060, h: 0.1444, size: 0.0509 }, 2),
        text("hely", "property.city", 0.150, 0.0406, 300, 0.0407, "@text", { cy: 0.145, h: 0.0602, size: 0.0315 }),
        text("tipus", "property.type", 0.210, 0.0339, 800, 0.0389, "@accent", { cy: 0.210, h: 0.0537, size: 0.0287 }),
        text("ar", "property.price", 0.285, 0.0406, 800, 0.0528, "@accent", { cy: 0.295, h: 0.0667, size: 0.0407 }),
        text("adatok", "property.specs", 0.365, 0.0339, 300, 0.0361, "@text", { cy: 0.370, h: 0.0537, size: 0.0269 }),
        {
          id: "ugynok-foto", kind: "image", bind: "agent.photo", mask: "circle", fit: "cover",
          box: { x: 0.398, y: 0.463, w: 0.204, h: 0.1146 },
          byAspect: { "1:1": { box: { x: 0.4305, y: 0.4806, w: 0.139, h: 0.1389 } } },
          appear: { type: "fade", delay: 0.2, duration: 0.6 },
        },
        text("nev", "agent.name", 0.685, 0.0406, 800, 0.0528, "@accent", { cy: 0.675, h: 0.0574, size: 0.0389 }),
        text("telefon", "agent.phone", 0.765, 0.0375, 800, 0.0435, "@text", { cy: 0.750, h: 0.0509, size: 0.0287 }),
        text("email", "agent.email", 0.835, 0.0375, 300, 0.0361, "@text", { cy: 0.810, h: 0.0481, size: 0.0241 }),
        {
          id: "logo", kind: "image", bind: "agent.logo", fit: "contain",
          box: { x: 0.4445, y: 0.8888, w: 0.111, h: 0.0625 },
          byAspect: { "1:1": { box: { x: 0.4605, y: 0.8557, w: 0.079, h: 0.0787 } } },
          appear: { type: "fade", delay: 0.2, duration: 0.6 },
        },
      ],
    },
  ],
};

/**
 * Középre igazított, egy-két soros szöveg a zárókártyán, a Shotstack-sablon
 * függőleges középvonala (cy) és dobozmagassága (h) szerint; 1:1-hez külön értékek.
 */
function text(
  id: string,
  bind: "property.title" | "property.city" | "property.type" | "property.price" | "property.specs" | "agent.name" | "agent.phone" | "agent.email",
  cy: number, h: number, weight: 800 | 300, size: number,
  color: "@accent" | "@text",
  square: { cy: number; h: number; size: number },
  maxLines = 1,
) {
  return {
    id, kind: "text" as const, bind,
    box: { x: 0.04, y: cy - h / 2, w: 0.92, h },
    font: { family: MANROPE, weight, size },
    color, align: "center" as const, valign: "middle" as const,
    lineHeight: weight === 800 ? 1.1 : 1.2, maxLines,
    appear: { type: "fade" as const, delay: 0.2, duration: 0.6 },
    byAspect: {
      "1:1": {
        box: { x: 0.04, y: square.cy - square.h / 2, w: 0.92, h: square.h },
        font: { family: MANROPE, weight, size: square.size },
      },
    },
  };
}

/** Színváltozatok — ugyanaz a sablon, más paletta. */
export const AURORA_VARIANTS: TemplateVariant[] = [
  {
    id: "nocturne",
    templateId: "aurora",
    name: "TWINX Nocturne",
    // A Videó-generátor éles Nocturne-változatának színei (video-color.ts).
    palette: {
      shadow: "#08142c",
      base: "#0b1a36",
      glow: "#c99a5e",
      accent: "#dcb985",
      text: "#ffffff",
      muted: "#dcdfe6",
    },
  },
];
