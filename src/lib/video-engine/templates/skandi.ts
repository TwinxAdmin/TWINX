// TWINX SKANDI — világos, letisztult, skandináv hangulatú videósablon.
//
// Karakter: sok levegő, krém és homok tónusok, tölgy-karamell kiemelés, vékony
// geometrikus betű (Jost). Lágy átúsztatások (a kép krémbe „fehéredik", majd
// előtűnik az új), nyugodt pásztázás. A szöveg mindig világos kártyán, sötét
// betűvel ül — így bármilyen fotón olvasható.
//
// IDŐVONAL (36 mp, 25 kép/mp):
//   0–6   nyitó: 1. fotó + alsó krém adatkártya (cím, település, típus, adatok, ár)
//   6–30  2–5. fotó, fotónként 6 mp, kártyás felirat (a partner adja meg; lent vagy középen)
//   30–36 zárókép: fent az 1. fotó, lent krém panel — ingatlan összegzés + ingatlanos
//
// Szövegbiztonság: minden szöveg dobozban, sor-korláttal; ha nem fér el, a betű
// kisebb lesz (nem vágódik le, nem lóg ki) — 9:16-ban és 1:1-ben is.
import type { TwinxTemplate, TemplateVariant, Layer } from "@/lib/video-engine/template-schema";

const JOST = "Jost";

/** A nyitókártya és a zárópanel tartalma — egy helyen, hogy a két méret egyezzen. */
function introItems(square: boolean) {
  const k = square ? 0.78 : 1; // 1:1-ben arányosan kisebb betűk
  return [
    { type: "text" as const, bind: "property.type" as const, font: { family: JOST, weight: 500, size: 0.024 * k }, color: "@accent" as const, uppercase: true, letterSpacing: 0.004, maxLines: 1 },
    { type: "text" as const, bind: "property.title" as const, font: { family: JOST, weight: 500, size: 0.062 * k }, color: "@text" as const, lineHeight: 1.08, maxLines: 2, gapBefore: 0.014 * k },
    { type: "text" as const, bind: "property.city" as const, font: { family: JOST, weight: 300, size: 0.032 * k }, color: "@muted" as const, maxLines: 1, gapBefore: 0.008 * k },
    { type: "rule" as const, width: 0.07, height: 0.003, color: "@accent" as const, gapBefore: 0.026 * k },
    { type: "text" as const, bind: "property.specs" as const, font: { family: JOST, weight: 400, size: 0.03 * k }, color: "@text" as const, lineHeight: 1.35, maxLines: 3, gapBefore: 0.022 * k },
    { type: "text" as const, bind: "property.price" as const, font: { family: JOST, weight: 500, size: 0.056 * k }, color: "@text" as const, lineHeight: 1, maxLines: 1, gapBefore: 0.024 * k },
  ];
}

/** A zárópanel ingatlanos-része. */
function agentItems(square: boolean) {
  const k = square ? 0.8 : 1;
  return [
    { type: "text" as const, bind: "agent.name" as const, font: { family: JOST, weight: 500, size: 0.042 * k }, color: "@text" as const, maxLines: 1 },
    { type: "text" as const, bind: "agent.phone" as const, font: { family: JOST, weight: 400, size: 0.04 * k }, color: "@accent" as const, maxLines: 1, gapBefore: 0.01 * k },
    { type: "text" as const, bind: "agent.email" as const, font: { family: JOST, weight: 300, size: 0.03 * k }, color: "@muted" as const, maxLines: 1, gapBefore: 0.008 * k },
  ];
}

const photoScene = (n: number): TwinxTemplate["scenes"][number] => ({
  id: `foto-${n}`,
  role: "photo",
  length: 6,
  background: { type: "photo", bind: `photo.${n}`, motion: { type: n % 2 ? "slideLeft" : "slideRight" } },
  transitionIn: { type: "softDip", duration: 1.2, colors: { fill: "@base" } },
  layers: [
    {
      id: "felirat", kind: "component", component: "captionCard",
      bind: `caption.${n}`,
      box: { x: 0, y: 0, w: 1, h: 1 },
      // Egységes, olvasható szöveg a kártyán: a teljes felirat EGY méretben, EGY
      // (Medium) vastagsággal, sötét színnel — legfeljebb 3 sor (lásd captionMaxChars).
      props: { position: "bottom", uniform: true, weightMain: 500 },
      appear: { type: "slideUp", delay: 0.9, duration: 0.7, easing: "easeOut" },
    },
  ],
});

// A nyitókártya ugyanazt a „háztető" formát kapja, mint a zárókép:
//   9:16: lent ülő krém tető, csúcs középen (y ≈ 0.535), oldalak y ≈ 0.62-nél
//   1:1 : bal oldali krém panel, jobb éle csúcsba fut (a csúcs x ≈ 0.575, y 0.5)
// A csúcson kis kiemelő-színű gyűrű — a nyitóképen nincs ingatlanos-fotó.
const introCard: Layer[] = [
  {
    id: "kartya-el", kind: "shape", shape: "polygon",
    box: { x: 0, y: 0.53, w: 1, h: 0.47 },
    points: [[0, 0.1915], [0.5, 0], [1, 0.1915], [1, 1], [0, 1]],
    fill: "@accent",
    byAspect: { "1:1": { box: { x: 0, y: 0, w: 0.58, h: 1 }, points: [[0, 0], [0.86, 0], [1, 0.5], [0.86, 1], [0, 1]] } },
    appear: { type: "slideUp", duration: 0.9, easing: "easeOut" },
  },
  {
    id: "kartya", kind: "shape", shape: "polygon",
    box: { x: 0, y: 0.53, w: 1, h: 0.47 },
    points: [[0, 0.2043], [0.5, 0.0128], [1, 0.2043], [1, 1], [0, 1]],
    fill: "@base", opacity: 0.97,
    byAspect: { "1:1": { box: { x: 0, y: 0, w: 0.58, h: 1 }, points: [[0, 0], [0.8497, 0], [0.9897, 0.5], [0.8497, 1], [0, 1]] } },
    appear: { type: "slideUp", duration: 0.9, easing: "easeOut" },
  },
  {
    id: "nyito-gyuru", kind: "shape", shape: "circle",
    box: { x: 0.482, y: 0.5259, w: 0.036, h: 0.02025 },
    fill: "@accent",
    byAspect: { "1:1": { box: { x: 0.556, y: 0.482, w: 0.036, h: 0.036 } } },
    appear: { type: "fade", delay: 0.6, duration: 0.6 },
  },
  {
    id: "nyito-pont", kind: "shape", shape: "circle",
    box: { x: 0.491, y: 0.53096, w: 0.018, h: 0.010125 },
    fill: "@base",
    byAspect: { "1:1": { box: { x: 0.565, y: 0.491, w: 0.018, h: 0.018 } } },
    appear: { type: "fade", delay: 0.6, duration: 0.6 },
  },
  {
    id: "adatok", kind: "stack",
    box: { x: 0, y: 0.625, w: 1, h: 0.36 },
    align: "left", valign: "middle",
    padding: { left: 0.075, right: 0.075, top: 0.02, bottom: 0.02 },
    appear: { type: "fade", delay: 0.45, duration: 0.8 },
    items: introItems(false),
    byAspect: {
      "1:1": {
        box: { x: 0, y: 0, w: 0.5, h: 1 },
        padding: { left: 0.06, right: 0.05, top: 0.04, bottom: 0.04 },
        items: introItems(true),
      },
    },
  },
];

export const SKANDI: TwinxTemplate = {
  id: "skandi",
  name: "TWINX Skandi",
  version: 1,
  fps: 25,
  aspects: ["9:16", "1:1"],
  fonts: [
    { family: JOST, weight: 300, file: "assets/fonts/video/Jost-Light.ttf" },
    { family: JOST, weight: 400, file: "assets/fonts/video/Jost-Regular.ttf" },
    { family: JOST, weight: 500, file: "assets/fonts/video/Jost-Medium.ttf" },
  ],
  palette: {
    shadow: "#2f2a26", // meleg szénszürke
    base: "#f6f2ec",   // krém — kártyák, panelek, átúsztatás
    glow: "#e8e0d4",   // homok
    accent: "#a9805a", // tölgy-karamell kiemelés
    text: "#2b2622",   // sötét szöveg a világos kártyán
    muted: "#7b7168",  // másodlagos szöveg
  },
  photos: { min: 4, max: 5 },
  // 80 karakter ≈ 3 teljes sor a feliratdobozban (9:16-ban ~30 karakter/sor).
  captionMaxChars: 80,
  audio: { volume: 1, fadeIn: 0.6, fadeOut: 2.2 },

  scenes: [
    {
      id: "nyito",
      role: "intro",
      length: 6,
      background: { type: "photo", bind: "photo.1", motion: { type: "slideLeft" } },
      transitionIn: { type: "fade", duration: 0.9 },
      layers: introCard,
    },
    photoScene(2),
    photoScene(3),
    photoScene(4),
    photoScene(5),
    {
      id: "zaro",
      role: "closing",
      length: 6,
      // Az 1. fotó teljes háttérként; rá egy lent ülő, „háztető" formájú krém
      // panel jön. A tető csúcsa az ingatlanos fotójában végződik — ha nincs fotó,
      // egy kis kiemelő-színű gyűrű díszíti a csúcsot, így akkor is rendezett.
      //   9:16: szimmetrikus tető, csúcs középen (y ≈ 0.50), oldalak y ≈ 0.60-nál
      //   1:1 : aszimmetrikus tető, csúcs a jobb oszlop fölött (x 0.8, y 0.42)
      background: { type: "photo", bind: "photo.1", motion: { type: "none" } },
      transitionIn: { type: "softDip", duration: 1.2, colors: { fill: "@base" } },
      layers: [
        // Kiemelő-színű tetőél: ugyanaz a forma, kicsit feljebb — a krém panel alól
        // vékony vonalként látszik ki a két tetősíkon.
        {
          id: "teto-el", kind: "shape", shape: "polygon",
          box: { x: 0, y: 0.49, w: 1, h: 0.51 },
          points: [[0, 0.1961], [0.5, 0], [1, 0.1961], [1, 1], [0, 1]],
          fill: "@accent",
          byAspect: {
            "1:1": { box: { x: 0, y: 0.41, w: 1, h: 0.59 }, points: [[0, 0.2335], [0.8, 0], [1, 0.0865], [1, 1], [0, 1]] },
          },
          appear: { type: "slideUp", duration: 0.9, easing: "easeOut" },
        },
        {
          id: "teto", kind: "shape", shape: "polygon",
          box: { x: 0, y: 0.49, w: 1, h: 0.51 },
          points: [[0, 0.2079], [0.5, 0.0118], [1, 0.2079], [1, 1], [0, 1]],
          fill: "@base",
          byAspect: {
            "1:1": { box: { x: 0, y: 0.41, w: 1, h: 0.59 }, points: [[0, 0.2437], [0.8, 0.0102], [1, 0.0967], [1, 1], [0, 1]] },
          },
          appear: { type: "slideUp", duration: 0.9, easing: "easeOut" },
        },
        // Csúcsdísz: kis gyűrű a tető csúcsán. Ha van ingatlanos-fotó, az eltakarja.
        {
          id: "csucs-gyuru", kind: "shape", shape: "circle",
          box: { x: 0.482, y: 0.486, w: 0.036, h: 0.02025 },
          fill: "@accent",
          byAspect: { "1:1": { box: { x: 0.782, y: 0.398, w: 0.036, h: 0.036 } } },
          appear: { type: "fade", delay: 0.5, duration: 0.6 },
        },
        {
          id: "csucs-pont", kind: "shape", shape: "circle",
          box: { x: 0.491, y: 0.49106, w: 0.018, h: 0.010125 },
          fill: "@base",
          byAspect: { "1:1": { box: { x: 0.791, y: 0.407, w: 0.018, h: 0.018 } } },
          appear: { type: "fade", delay: 0.5, duration: 0.6 },
        },
        // Ingatlan-összegzés (középre igazítva)
        {
          id: "ingatlan", kind: "stack",
          box: { x: 0.1, y: 0.585, w: 0.8, h: 0.19 },
          align: "center", valign: "middle",
          appear: { type: "fade", delay: 0.4, duration: 0.8 },
          items: [
            { type: "text", bind: "property.type", font: { family: JOST, weight: 500, size: 0.022 }, color: "@accent", uppercase: true, letterSpacing: 0.004, maxLines: 1, align: "center" },
            { type: "text", bind: "property.title", font: { family: JOST, weight: 500, size: 0.05 }, color: "@text", lineHeight: 1.1, maxLines: 2, gapBefore: 0.012, align: "center" },
            { type: "text", bind: "property.city", font: { family: JOST, weight: 300, size: 0.03 }, color: "@muted", maxLines: 1, gapBefore: 0.006, align: "center" },
            { type: "text", bind: "property.price", font: { family: JOST, weight: 500, size: 0.046 }, color: "@text", maxLines: 1, gapBefore: 0.018, align: "center" },
          ],
          byAspect: {
            "1:1": {
              box: { x: 0.05, y: 0.565, w: 0.58, h: 0.415 },
              align: "left",
              items: [
                { type: "text", bind: "property.type", font: { family: JOST, weight: 500, size: 0.019 }, color: "@accent", uppercase: true, letterSpacing: 0.004, maxLines: 1 },
                { type: "text", bind: "property.title", font: { family: JOST, weight: 500, size: 0.038 }, color: "@text", lineHeight: 1.1, maxLines: 2, gapBefore: 0.008 },
                { type: "text", bind: "property.city", font: { family: JOST, weight: 300, size: 0.024 }, color: "@muted", maxLines: 1, gapBefore: 0.005 },
                { type: "text", bind: "property.price", font: { family: JOST, weight: 500, size: 0.036 }, color: "@text", maxLines: 1, gapBefore: 0.012 },
                { type: "rule", width: 0.06, height: 0.003, color: "@accent", gapBefore: 0.02 },
                ...agentItems(true).map((it, i) => ({ ...it, gapBefore: i === 0 ? 0.016 : it.gapBefore })),
              ],
            },
          },
        },
        // Ingatlanos (9:16-ban külön blokk; 1:1-ben a fenti blokk része)
        {
          id: "ugynok", kind: "stack",
          box: { x: 0.06, y: 0.775, w: 0.88, h: 0.125 },
          align: "center", valign: "middle",
          appear: { type: "fade", delay: 0.6, duration: 0.8 },
          items: agentItems(false).map((it) => ({ ...it, align: "center" as const })),
          byAspect: { "1:1": { items: [{ type: "spacer", height: 0.001 }] } },
        },
        {
          id: "ugynok-foto", kind: "image", bind: "agent.photo", mask: "circle", fit: "cover",
          // A kör KÖZEPE a tető csúcsa (9:16: 0.5 / 0.49; 1:1: 0.8 / 0.41).
          box: { x: 0.41, y: 0.44, w: 0.18, h: 0.1 },
          border: { width: 0.007, color: "@base" },
          byAspect: { "1:1": { box: { x: 0.7, y: 0.31, w: 0.2, h: 0.2 } } },
          appear: { type: "fade", delay: 0.3, duration: 0.8 },
        },
        {
          id: "logo", kind: "image", bind: "agent.logo", fit: "contain", mask: "rounded",
          box: { x: 0.44, y: 0.905, w: 0.12, h: 0.065 },
          byAspect: { "1:1": { box: { x: 0.725, y: 0.68, w: 0.15, h: 0.15 } } },
          appear: { type: "fade", delay: 0.7, duration: 0.8 },
        },
      ],
    },
  ],
};

/** Skandi színváltozatok. */
export const SKANDI_VARIANTS: TemplateVariant[] = [
  {
    id: "skandi-zsalya",
    templateId: "skandi",
    name: "TWINX Skandi · Zsálya",
    palette: { base: "#f1f2ec", glow: "#dfe3d6", accent: "#6f8a6a", text: "#26302a", muted: "#6f766c", shadow: "#26302a" },
  },
];
