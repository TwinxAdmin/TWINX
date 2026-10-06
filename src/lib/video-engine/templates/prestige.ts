// TWINX PRESTIGE — luxus videósablon (élesítve: 2026-10-06).
//
// Karakter: mély fekete + pezsgőarany, talpas (serif) címbetű, sok levegő. A felső
// sávban az ingatlanos landing vékony vonalas ikonjai ülnek egy sorban (ház, kulcs,
// térképjel, épület, „Eladó" tábla) — díszként, végig a helyükön.
// ÁTTŰNÉS: valódi filmes „FILMBURN" klip (fény-beégés) Screen-keveréssel, a saját
// hangjával (fele hangerőn, a zene alatt). A klip bal szélén a filmkocka kis
// perforációs téglalapjának csak a FELE látszik — ez a klasszikus filmburn-hatás.
// A jelenetváltás a klip legvilágosabb pillanatára esik, így a vágás láthatatlan.
// (A korábbi szimbólumos „átlépés" áttűnés a motorban megmaradt: type "symbolZoom".)
//
// IDŐVONAL (36 mp, 25 kép/mp):
//   0–6   nyitó: 1. fotó, alul sötét átmenet + adatblokk, arany keret, lebegő ikonok
//   6–30  2–5. fotó, fotónként 6 mp, sötét kártyás felirat (max 80 karakter)
//   30–36 zárókép: elsötétített fotó, középen ingatlanos (fotó arany gyűrűben) + összegzés
import type { TwinxTemplate, Layer, StackItem } from "@/lib/video-engine/template-schema";

const SERIF = "Cormorant Garamond";
const SANS = "Jost";

// --- Az ikonsor (a vászon SZÉLESSÉGÉNEK arányában — 9:16-ban és 1:1-ben is 1080 px széles) ---
const SYMBOLS = ["house", "key", "pin", "building", "sold"] as const;
const ICON = 0.058;      // ikon mérete
const GAP = 0.04;        // ikonok közti hely
const ROW_Y = 0.05;      // a sor teteje (szélesség-arányban)
const ROW_X0 = (1 - (SYMBOLS.length * ICON + (SYMBOLS.length - 1) * GAP)) / 2;
const iconX = (i: number) => ROW_X0 + i * (ICON + GAP);

/** Szélesség-arányú y → a vászon MAGASSÁGÁNAK aránya (a rétegdobozok így várják). */
const yFor = (yW: number, aspect: "9:16" | "1:1") => (aspect === "9:16" ? yW * (1080 / 1920) : yW);

/**
 * Az ikonsor rétegei. A `landing` ikon (amelyik épp visszarepül a helyére) csak az
 * áttűnés végén jelenik meg — így pontosan a repülő példány „érkezik meg" a helyére.
 */
function iconRow(landing: number | null, landAt = 0, appear: Layer["appear"] = { type: "fade", delay: 0.2, duration: 0.8 }): Layer[] {
  const rows: Layer[] = SYMBOLS.map((sym, i) => ({
    id: `ikon-${i}`, kind: "symbol" as const, symbol: sym, stroke: "@accent" as const,
    box: { x: iconX(i), y: yFor(ROW_Y, "9:16"), w: ICON, h: yFor(ICON, "9:16") },
    byAspect: { "1:1": { box: { x: iconX(i), y: yFor(ROW_Y, "1:1"), w: ICON, h: ICON } } },
    appear: i === landing ? { type: "fade" as const, delay: landAt, duration: 0.05 } : appear,
  }));
  // Két vékony arany vonal az ikonsor két oldalán — „címersáv".
  const lineY = ROW_Y + ICON * 0.55;
  const side = (id: string, x: number, w: number): Layer => ({
    id, kind: "shape", shape: "rect", fill: "@accent", opacity: 0.55,
    box: { x, y: yFor(lineY, "9:16"), w, h: 0.0012 },
    byAspect: { "1:1": { box: { x, y: yFor(lineY, "1:1"), w, h: 0.002 } } },
    appear,
  });
  return [...rows, side("sor-bal", 0.06, ROW_X0 - 0.09), side("sor-jobb", iconX(SYMBOLS.length - 1) + ICON + 0.03, ROW_X0 - 0.09)];
}

/** Vékony arany keret a vászon szélén (nyitó- és zárókép). */
function goldFrame(): Layer[] {
  const t = 0.0018, m = 0.035;
  const mH = (a: "9:16" | "1:1") => (a === "9:16" ? m * (1080 / 1920) : m);
  const ap = { type: "fade" as const, delay: 0.3, duration: 1 };
  return [
    { id: "keret-f", kind: "shape", shape: "rect", fill: "@accent", opacity: 0.6, box: { x: m, y: mH("9:16"), w: 1 - 2 * m, h: t * 0.6 }, byAspect: { "1:1": { box: { x: m, y: m, w: 1 - 2 * m, h: t } } }, appear: ap },
    { id: "keret-a", kind: "shape", shape: "rect", fill: "@accent", opacity: 0.6, box: { x: m, y: 1 - mH("9:16"), w: 1 - 2 * m, h: t * 0.6 }, byAspect: { "1:1": { box: { x: m, y: 1 - m - t, w: 1 - 2 * m, h: t } } }, appear: ap },
    { id: "keret-b", kind: "shape", shape: "rect", fill: "@accent", opacity: 0.6, box: { x: m, y: mH("9:16"), w: t, h: 1 - 2 * mH("9:16") }, byAspect: { "1:1": { box: { x: m, y: m, w: t, h: 1 - 2 * m } } }, appear: ap },
    { id: "keret-j", kind: "shape", shape: "rect", fill: "@accent", opacity: 0.6, box: { x: 1 - m - t, y: mH("9:16"), w: t, h: 1 - 2 * mH("9:16") }, byAspect: { "1:1": { box: { x: 1 - m - t, y: m, w: t, h: 1 - 2 * m } } }, appear: ap },
  ];
}

/** Lebegő, halvány arany ikonok (a landing „Három lépés" blokkjának hangulata). */
function floaters(spots: Array<[typeof SYMBOLS[number], number, number, number]>): Layer[] {
  return spots.map(([sym, x, y, size], i) => ({
    id: `lebego-${i}`, kind: "symbol" as const, symbol: sym, stroke: "@accent" as const, opacity: 0.32,
    box: { x, y, w: size, h: size * (1080 / 1920) },
    byAspect: { "1:1": { box: { x, y, w: size, h: size } } },
    // Két lebegő csoport, ellentétes ütemben (kevesebb réteg = gyorsabb render).
    appear: { type: "float" as const, delay: 0.4 + (i % 2) * 0.5, duration: 5 + (i % 2) * 1.5, amount: 0.006 },
  }));
}

/** A nyitókép adatblokkja. */
function introItems(square: boolean): StackItem[] {
  // 9:16-ban nagyobb, jól olvasható betűk (a doboz is nagyobb, így nem csúsznak össze).
  const k = square ? 0.86 : 1.22;
  return [
    { type: "text", bind: "property.type", font: { family: SANS, weight: 400, size: 0.024 * k }, color: "@accent", uppercase: true, letterSpacing: 0.006, maxLines: 1 },
    { type: "text", bind: "property.title", font: { family: SERIF, weight: 600, size: 0.074 * k }, color: "@text", lineHeight: 1.04, maxLines: square ? 3 : 2, gapBefore: 0.012 * k },
    { type: "text", bind: "property.city", font: { family: SANS, weight: 400, size: 0.03 * k }, color: "@muted", maxLines: 1, gapBefore: 0.008 * k },
    { type: "rule", width: 0.09, height: 0.0025, color: "@accent", gapBefore: 0.026 * k },
    { type: "text", bind: "property.specs", font: { family: SANS, weight: 400, size: 0.03 * k }, color: "@text", lineHeight: 1.35, maxLines: 3, gapBefore: 0.022 * k },
    { type: "text", bind: "property.price", font: { family: SERIF, weight: 600, size: 0.07 * k }, color: "@accent", lineHeight: 1, maxLines: 1, gapBefore: 0.022 * k },
  ];
}

// --- Áttűnés: filmburn klip + hang (fele hangerő), mindkét méretre előre kivágva ---
const FILM_BURN: NonNullable<TwinxTemplate["scenes"][number]["transitionIn"]> = {
  type: "filmBurn", duration: 1.17, fx: "filmburn6", fxVolume: 0.5,
};

const photoScene = (n: number): TwinxTemplate["scenes"][number] => ({
  id: `foto-${n}`,
  role: "photo",
  length: 6,
  background: { type: "photo", bind: `photo.${n}`, motion: { type: n % 2 ? "slideLeft" : "slideRight" } },
  transitionIn: FILM_BURN,
  layers: [
    // Halvány sötét sáv felül, hogy az arany ikonsor bármilyen fotón látsszon.
    {
      id: "felso-arnyek", kind: "shape", shape: "rect",
      box: { x: 0, y: 0, w: 1, h: 0.12 }, byAspect: { "1:1": { box: { x: 0, y: 0, w: 1, h: 0.2 } } },
      fill: { gradient: "linear", angle: 180, stops: [[0, "@shadow", 0.55], [1, "@shadow", 0]] },
    },
    ...iconRow(null, 0, { type: "none" }),
    {
      id: "felirat", kind: "component", component: "captionCard",
      bind: `caption.${n}`,
      box: { x: 0, y: 0, w: 1, h: 1 },
      // 9:16-ban nagyobb, szélesebb kártya, nagyobb betűvel; a 80 karakter 4 sorba is férhet.
      props: { position: "bottom", uniform: true, weightMain: 600, portraitScale: 1.2, portraitWidth: 0.9, portraitLines: 4 },
      appear: { type: "slideUp", delay: 1.0, duration: 0.8, easing: "easeOut" },
    },
  ],
});

export const PRESTIGE: TwinxTemplate = {
  id: "prestige",
  name: "TWINX Prestige",
  version: 1,
  fps: 25,
  aspects: ["9:16", "1:1"],
  // Az első betű a feliratkártyáké: elegáns talpas.
  fonts: [
    { family: SERIF, weight: 600, file: "assets/fonts/video/CormorantGaramond-SemiBold.ttf" },
    { family: SERIF, weight: 500, file: "assets/fonts/video/CormorantGaramond-Medium.ttf" },
    { family: SANS, weight: 400, file: "assets/fonts/video/Jost-Regular.ttf" },
  ],
  palette: {
    shadow: "#0b0a09", // mély fekete
    base: "#14110e",   // a feliratkártya sötét alapja
    glow: "#c9a96e",   // pezsgőarany
    accent: "#c9a96e", // arany: ikonok, vonalak, ár
    text: "#f5efe4",   // elefántcsont szöveg
    muted: "#bfb29c",  // másodlagos szöveg
  },
  photos: { min: 4, max: 5 },
  captionMaxChars: 80,
  audio: { volume: 1, fadeIn: 0.8, fadeOut: 2.4 },

  scenes: [
    {
      id: "nyito",
      role: "intro",
      length: 6,
      background: { type: "photo", bind: "photo.1", motion: { type: "slideLeft" } },
      transitionIn: { type: "fade", duration: 1.0 },
      layers: [
        {
          id: "also-arnyek", kind: "shape", shape: "rect",
          box: { x: 0, y: 0.36, w: 1, h: 0.64 }, byAspect: { "1:1": { box: { x: 0, y: 0.3, w: 1, h: 0.7 } } },
          fill: { gradient: "linear", angle: 180, stops: [[0, "@shadow", 0], [0.45, "@shadow", 0.78], [1, "@shadow", 0.94]] },
          appear: { type: "fade", duration: 1.2 },
        },
        {
          id: "felso-arnyek", kind: "shape", shape: "rect",
          box: { x: 0, y: 0, w: 1, h: 0.14 }, byAspect: { "1:1": { box: { x: 0, y: 0, w: 1, h: 0.22 } } },
          fill: { gradient: "linear", angle: 180, stops: [[0, "@shadow", 0.6], [1, "@shadow", 0]] },
        },
        ...goldFrame(),
        ...iconRow(null),
        ...floaters([["key", 0.82, 0.2, 0.05], ["pin", 0.1, 0.27, 0.04], ["house", 0.86, 0.36, 0.035]]),
        {
          id: "adatok", kind: "stack",
          box: { x: 0, y: 0.52, w: 1, h: 0.44 },
          align: "left", valign: "bottom",
          padding: { left: 0.09, right: 0.09, top: 0.02, bottom: 0.03 },
          appear: { type: "slideUp", delay: 0.5, duration: 1.0, easing: "easeOut" },
          items: introItems(false),
          byAspect: {
            "1:1": { box: { x: 0, y: 0.42, w: 1, h: 0.54 }, padding: { left: 0.09, right: 0.09, top: 0.02, bottom: 0.04 }, items: introItems(true) },
          },
        },
      ],
    },
    photoScene(2),
    photoScene(3),
    photoScene(4),
    photoScene(5),
    {
      id: "zaro",
      role: "closing",
      length: 6,
      background: { type: "photo", bind: "photo.1", motion: { type: "none" } },
      transitionIn: FILM_BURN,
      layers: [
        {
          id: "sotetites", kind: "shape", shape: "rect",
          box: { x: 0, y: 0, w: 1, h: 1 }, fill: "@shadow", opacity: 0.82,
        },
        ...goldFrame(),
        ...iconRow(null, 0, { type: "none" }),
        ...floaters([["house", 0.12, 0.8, 0.045], ["key", 0.84, 0.74, 0.04], ["building", 0.8, 0.88, 0.035]]),
        {
          id: "ugynok-foto", kind: "image", bind: "agent.photo", mask: "circle", fit: "cover",
          box: { x: 0.34, y: 0.12, w: 0.32, h: 0.18 },
          border: { width: 0.006, color: "@accent" },
          byAspect: { "1:1": { box: { x: 0.41, y: 0.16, w: 0.18, h: 0.18 } } },
          appear: { type: "fade", delay: 0.9, duration: 0.8 },
        },
        {
          id: "osszegzes", kind: "stack",
          box: { x: 0.07, y: 0.32, w: 0.86, h: 0.52 },
          align: "center", valign: "top",
          appear: { type: "fade", delay: 1.1, duration: 0.9 },
          items: [
            // 9:16: kb. 22%-kal nagyobb betűk (a doboz is nagyobb lett).
            { type: "text", bind: "agent.name", font: { family: SERIF, weight: 600, size: 0.08 }, color: "@text", maxLines: 1, align: "center" },
            { type: "text", bind: "agent.phone", font: { family: SANS, weight: 400, size: 0.052 }, color: "@accent", maxLines: 1, gapBefore: 0.014, align: "center" },
            { type: "text", bind: "agent.email", font: { family: SANS, weight: 400, size: 0.037 }, color: "@muted", maxLines: 1, gapBefore: 0.01, align: "center" },
            { type: "rule", width: 0.14, height: 0.0028, color: "@accent", gapBefore: 0.05 },
            { type: "text", bind: "property.title", font: { family: SERIF, weight: 500, size: 0.062 }, color: "@text", lineHeight: 1.08, maxLines: 2, gapBefore: 0.045, align: "center" },
            { type: "text", bind: "property.price", font: { family: SERIF, weight: 600, size: 0.072 }, color: "@accent", maxLines: 1, gapBefore: 0.016, align: "center" },
          ],
          byAspect: {
            "1:1": {
              box: { x: 0.1, y: 0.37, w: 0.8, h: 0.5 },
              items: [
                { type: "text", bind: "agent.name", font: { family: SERIF, weight: 600, size: 0.054 }, color: "@text", maxLines: 1, align: "center" },
                { type: "text", bind: "agent.phone", font: { family: SANS, weight: 400, size: 0.034 }, color: "@accent", maxLines: 1, gapBefore: 0.008, align: "center" },
                { type: "text", bind: "agent.email", font: { family: SANS, weight: 400, size: 0.026 }, color: "@muted", maxLines: 1, gapBefore: 0.006, align: "center" },
                { type: "rule", width: 0.1, height: 0.003, color: "@accent", gapBefore: 0.03 },
                { type: "text", bind: "property.title", font: { family: SERIF, weight: 500, size: 0.042 }, color: "@text", lineHeight: 1.08, maxLines: 2, gapBefore: 0.026, align: "center" },
                { type: "text", bind: "property.price", font: { family: SERIF, weight: 600, size: 0.048 }, color: "@accent", maxLines: 1, gapBefore: 0.01, align: "center" },
              ],
            },
          },
        },
        {
          id: "logo", kind: "image", bind: "agent.logo", fit: "contain", mask: "rounded",
          box: { x: 0.42, y: 0.86, w: 0.16, h: 0.07 },
          byAspect: { "1:1": { box: { x: 0.43, y: 0.84, w: 0.14, h: 0.1 } } },
          appear: { type: "fade", delay: 1.4, duration: 0.8 },
        },
      ],
    },
  ],
};
