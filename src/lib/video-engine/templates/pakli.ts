// TWINX PAKLI — „fotópakli” sablon (FEJLESZTÉS ALATT: csak localhoston — devOnly).
//
// A referencia: telt színű háttéren (bíborpiros / drámai kék) egy pakli előhívott fotó.
// • A FŐ INFORMÁCIÓK végig FENT állnak; a nyitóképen lendületesen, egymás után úsznak be
//   (cím balra, település jobbra zárva, az ár mögött kihúzódó kiemelő sáv — mint a referencián).
// • A fotónkénti szöveg LENT, ugyanilyen lendületes beúszással.
// • Képváltás: a szél LEFÚJJA a pakli tetejéről a legfelső képet — alatta már ott a következő.
// • Zárókép: a pakli legalsó lapja egy üres papírlap, rajta az ingatlanos elérhetősége.
// Betű: Liberation Sans (Helvetica-jellegű grotesk, szoros betűközzel — a referencia betűképe; a repóban).
//
// IDŐVONAL (5 fotó, 30,4 mp): 0–5,2 nyitó (1. fotó) · 4 × 4,8 mp (2–5. fotó) · 6 mp zárókép
import type { TwinxTemplate, Layer, AspectId, Box, TemplateVariant, TextLayer } from "@/lib/video-engine/template-schema";

const SANS = "Liberation Sans";
const PAPER = "#f2ede3";
const INK = "#2b2622";
const BLOW = 0.95;     // a lefújás hossza (mp)
const GLEN = 4.8;      // fotójelenet hossza (mp) — egész képkocka (120)
const INTRO = 5.2;     // nyitókép (130 képkocka)
const CLOSE = 6;
/** A fotók kis, egyedi dőlése (fok) — a pakli „kézzel rakott” hatású. */
const ROT = [0, -1.4, 1.1, -0.7, 1.5];
const BORDER = 0.035;

/** A kártya (papír-keretes, 3:2-es fotó) doboza méretenként. */
function cardBox(aspect: AspectId): Box {
  const W = 1080, H = aspect === "9:16" ? 1920 : 1080;
  // NAGY képek: álló méretben szinte a teljes szélesség, négyzetesben ~70%.
  const wR = aspect === "9:16" ? 0.94 : 0.66;
  const cy = aspect === "9:16" ? 0.53 : 0.565;
  const wpx = wR * W;
  const hpx = (wpx * (1 - 2 * BORDER)) / 1.5 + 2 * BORDER * wpx;
  return { x: (1 - wR) / 2, y: cy - hpx / H / 2, w: wR, h: hpx / H };
}
const C9 = cardBox("9:16"), C1 = cardBox("1:1");
const shift = (b: Box, dx: number, dy: number): Box => ({ ...b, x: b.x + dx, y: b.y + dy });

/** A pakli alsó, üres lapjai (dísz, mindig ugyanott). */
function deck(): Layer[] {
  const blanks: Array<[number, number, number, string]> = [
    [-4.5, -0.012, 0.012, "#e7e0d2"], [3.2, 0.014, -0.006, "#ede6d9"], [-1.8, -0.004, 0.016, "#efe9de"],
  ];
  return blanks.map(([rot, dx, dy, paper], i) => ({
    id: `pakli-${i}`, kind: "component" as const, component: "photoCard" as const,
    box: shift(C9, dx, dy * (1080 / 1920)), byAspect: { "1:1": { box: shift(C1, dx * 0.8, dy * 0.8) } },
    props: { blank: true, rotate: rot, paper, shadow: 0.28 },
  }));
}

/** Egy fotókártya (n. fotó) a pakli tetején. */
function card(n: number, extra: Partial<Layer> = {}): Layer {
  return {
    id: `kartya-${n}`, kind: "component", component: "photoCard", bind: `photo.${n}`,
    box: C9, byAspect: { "1:1": { box: C1 } },
    props: { rotate: ROT[(n - 1) % ROT.length], border: BORDER, paper: PAPER, shadow: 0.38 },
    // Saját rajzcsoport (a pakli alsó lapjai így jelenetenként újrahasznosíthatók — gyorsabb).
    appear: { type: "none" },
    ...extra,
  } as Layer;
}

/** Egy szövegsor-réteg (szoros betűköz, egy sor; ha nem fér ki, kisebb lesz). */
function line(id: string, o: {
  bind?: TextLayer["bind"]; text?: string; box: Box; box1: Box; size: number; weight: 400 | 700;
  align: "left" | "right"; color?: TextLayer["color"]; upper?: boolean; maxLines?: number; k1?: number;
}): TextLayer {
  const ls = o.upper ? 0.003 : -0.025 * o.size; // a cím szoros, a kis felirat ritkított
  return {
    id, kind: "text", bind: o.bind, text: o.text, box: o.box, valign: "middle", align: o.align,
    font: { family: SANS, weight: o.weight, size: o.size }, color: o.color ?? "@text",
    letterSpacing: ls, uppercase: o.upper, lineHeight: 1.05, maxLines: o.maxLines ?? 1,
    byAspect: { "1:1": { box: o.box1, font: { family: SANS, weight: o.weight, size: o.size * (o.k1 ?? 0.74) }, letterSpacing: ls * (o.k1 ?? 0.74) } },
  };
}

/**
 * A FŐ INFORMÁCIÓK (fent), a referencia szerkezetében: kis típus-felirat · NAGY félkövér cím
 * (balra) · település vékonyabban, JOBBRA zárva · ár félkövéren, mögötte kihúzódó kiemelő sáv.
 * `animate`: a nyitóképen egymás után, lendületesen úsznak be; később állnak.
 */
function mainInfo(animate: boolean): Layer[] {
  const a = (delay: number, type: "rise" | "wipe" = "rise", duration = 0.5) =>
    animate ? { appear: { type, delay, duration } } : {};
  const priceProps = (part: "bar" | "text") => ({
    part, size: 0.084, weight: 700, family: SANS, color: "@text", bar: "@shadow", padX: 0.2, letterSpacing: -0.025,
  });
  return [
    { ...line("tipus", { bind: "property.type", box: { x: 0.07, y: 0.045, w: 0.86, h: 0.032 }, box1: { x: 0.07, y: 0.03, w: 0.86, h: 0.04 }, size: 0.034, weight: 400, align: "left", color: "@muted", upper: true }), ...a(0.25) },
    { ...line("cim", { bind: "property.title", box: { x: 0.07, y: 0.08, w: 0.86, h: 0.075 }, box1: { x: 0.07, y: 0.07, w: 0.86, h: 0.08 }, size: 0.112, weight: 700, align: "left", k1: 0.6 }), ...a(0.38) },
    { ...line("telepules", { bind: "property.city", box: { x: 0.07, y: 0.158, w: 0.86, h: 0.045 }, box1: { x: 0.07, y: 0.15, w: 0.86, h: 0.055 }, size: 0.064, weight: 400, align: "right", k1: 0.62 }), ...a(0.52) },
    // Ár: előbb a kiemelő sáv húzódik ki balról jobbra, aztán ráúszik a szöveg.
    { id: "ar-sav", kind: "component", component: "hlText", bind: "property.price", box: { x: 0.07, y: 0.218, w: 0.86, h: 0.06 }, props: priceProps("bar"),
      byAspect: { "1:1": { box: { x: 0.07, y: 0.215, w: 0.86, h: 0.07 }, props: { ...priceProps("bar"), size: 0.05 } } }, ...a(0.66, "wipe", 0.45) },
    { id: "ar", kind: "component", component: "hlText", bind: "property.price", box: { x: 0.07, y: 0.218, w: 0.86, h: 0.06 }, props: priceProps("text"),
      byAspect: { "1:1": { box: { x: 0.07, y: 0.215, w: 0.86, h: 0.07 }, props: { ...priceProps("text"), size: 0.05 } } }, ...a(0.8) },
  ];
}

/**
 * MOZGÓ DÍSZEK a szövegek körül (a referencia „✳” jelvénye nyomán):
 *  • jobb felső sarokban lassan FORGÓ csillagos jelvény;
 *  • a település előtt balról kihúzódó vékony vonal;
 *  • az ár mellett két apró, CSILLOGÓ (lüktető) csillag.
 * A forgás/lüktetés abszolút időt követ → jelenetváltáskor folytatódik, nem ugrik.
 */
function decor(animate: boolean): Layer[] {
  const fade = (delay: number) => (animate ? { appear: { type: "fade" as const, delay, duration: 0.5 } } : {});
  return [
    { id: "d-jelveny", kind: "component", component: "sparkle", box: { x: 0.835, y: 0.034, w: 0.105, h: 0.058 },
      byAspect: { "1:1": { box: { x: 0.855, y: 0.025, w: 0.09, h: 0.09 } } },
      props: { style: "badge", color: "#ffffff", ink: "@base" }, spin: { period: 9 }, ...fade(0.2) },
    { id: "d-vonal", kind: "shape", shape: "rect", fill: "@text", opacity: 0.85,
      box: { x: 0.07, y: 0.1795, w: 0.12, h: 0.0016 }, byAspect: { "1:1": { box: { x: 0.07, y: 0.176, w: 0.16, h: 0.0028 } } },
      ...(animate ? { appear: { type: "wipe" as const, delay: 0.55, duration: 0.5 } } : {}) },
    { id: "d-csillag-1", kind: "component", component: "sparkle", box: { x: 0.74, y: 0.208, w: 0.085, h: 0.048 },
      byAspect: { "1:1": { box: { x: 0.8, y: 0.215, w: 0.055, h: 0.055 } } },
      props: { style: "star4", color: "#ffffff" }, pulse: { period: 1.8, amount: 0.6, phase: 0 }, ...fade(0.9) },
    { id: "d-csillag-2", kind: "component", component: "sparkle", box: { x: 0.835, y: 0.245, w: 0.055, h: 0.031 },
      byAspect: { "1:1": { box: { x: 0.875, y: 0.262, w: 0.034, h: 0.034 } } },
      props: { style: "star4", color: "@muted" }, pulse: { period: 1.8, amount: 0.6, phase: 0.5 }, ...fade(1.0) },
  ];
}

/** A felirat előtti kis, forgó csillag-jel (a felirattal együtt jön és megy). */
function captionMark(): Layer {
  return {
    id: "felirat-jel", kind: "component", component: "sparkle", box: { x: 0.07, y: 0.787, w: 0.042, h: 0.024 },
    byAspect: { "1:1": { box: { x: 0.07, y: 0.838, w: 0.034, h: 0.034 } } },
    props: { style: "asterisk", color: "@text" }, spin: { period: 6 },
    appear: { type: "fade", delay: BLOW + 0.05, duration: 0.4 }, hideBeforeEnd: 0.3,
  };
}

/** A fotó szövege (lent, a kép ALATT — nem lóg bele), lendületes beúszással. */
function caption(n: number): Layer {
  return {
    id: "felirat", kind: "text", bind: `caption.${n}`, box: { x: 0.135, y: 0.785, w: 0.8, h: 0.13 }, valign: "top", align: "left",
    font: { family: SANS, weight: 400, size: 0.056 }, color: "@text", letterSpacing: -0.0014, lineHeight: 1.12, maxLines: 3,
    byAspect: { "1:1": { box: { x: 0.125, y: 0.835, w: 0.81, h: 0.15 }, font: { family: SANS, weight: 400, size: 0.036 }, letterSpacing: -0.0009 } },
    appear: { type: "rise", delay: BLOW + 0.05, duration: 0.55 },
    hideBeforeEnd: 0.3,
  };
}

function buildPakli(count: number): TwinxTemplate {
  const n = count >= 5 ? 5 : 4;
  const photoScenes: TwinxTemplate["scenes"] = [];
  for (let m = 2; m <= n; m++) {
    photoScenes.push({
      id: `foto-${m}`, role: "photo", length: GLEN,
      background: { type: "color", color: "@base" },
      layers: [
        ...deck(),
        card(m),
        // Az előző legfelső lapot most fújja le a szél (felváltva jobbra / balra).
        card(m - 1, { id: `lefujt-${m - 1}`, blow: { duration: BLOW, dir: m % 2 ? -1 : 1 } }),
        ...mainInfo(false),
        ...decor(false),
        captionMark(),
        caption(m),
      ],
    });
  }
  // Elérhetőség a záró papírlapon: soronként, egymás után beúszva (sötét tinta, balra zárva).
  const onCard = (c: Box, fy: number, fh: number): Box => ({ x: c.x + c.w * 0.09, y: c.y + c.h * fy, w: c.w * 0.82, h: c.h * fh });
  const contact = (id: string, bind: TextLayer["bind"] | undefined, text: string | undefined, fy: number, fh: number, size: number, weight: 400 | 700, delay: number, upper = false): Layer => ({
    ...line(id, { bind, text, box: onCard(C9, fy, fh), box1: onCard(C1, fy, fh), size, weight, align: "left", color: upper ? "#6d645b" : INK, upper, k1: 0.72 }),
    appear: { type: "rise", delay, duration: 0.5 },
  });
  return {
    id: "pakli",
    name: "TWINX Pakli",
    devOnly: true, // FEJLESZTÉS ALATT — élesben nem jelenik meg
    version: 1,
    fps: 25,
    aspects: ["9:16", "1:1"],
    fonts: [
      { family: SANS, weight: 400, file: "assets/fonts/video/LiberationSans-Regular.ttf" },
      { family: SANS, weight: 700, file: "assets/fonts/video/LiberationSans-Bold.ttf" },
    ],
    palette: {
      shadow: "#5c0713",  // mély bordó
      base: "#ad1328",    // BÍBORPIROS háttér (a referencia színe)
      glow: "#c42239",
      accent: "#ffffff",  // fehér kiemelés
      text: "#ffffff",    // világos szöveg (a régi-film tónus után is jól olvasható)
      muted: "#f1d3cf",   // halvány rózsás másodlagos szöveg
    },
    photos: { min: 4, max: 5 },
    captionMaxChars: 80,
    audio: { volume: 1, fadeIn: 0.6, fadeOut: 2.2 },
    // „Régi fotó / old film” hangulat: szemcse, sötétedő szélek, fakó-meleg tónus, enyhe vibrálás.
    look: { grain: 16, vignette: 0.4, fade: 0.6, warm: 0.6, flicker: 0.5 },
    forPhotoCount: (k: number) => buildPakli(k),
    scenes: [
      {
        id: "nyito", role: "intro", length: INTRO,
        background: { type: "color", color: "@base" },
        layers: [...deck(), card(1), ...mainInfo(true), ...decor(true)],
      },
      ...photoScenes,
      {
        id: "zaro", role: "closing", length: CLOSE,
        background: { type: "color", color: "@base" },
        layers: [
          ...deck(),
          // A pakli legalsó lapja: üres papír — rajta az elérhetőség (gépelve, sötét tintával).
          { id: "zarolap", kind: "component", component: "photoCard", box: C9, byAspect: { "1:1": { box: C1 } }, props: { blank: true, rotate: 0, paper: PAPER, shadow: 0.38 } },
          contact("k-cimke", undefined, "Kapcsolat", 0.2, 0.1, 0.034, 400, BLOW + 0.1, true),
          contact("k-nev", "agent.name", undefined, 0.32, 0.16, 0.084, 700, BLOW + 0.22),
          contact("k-tel", "agent.phone", undefined, 0.52, 0.12, 0.062, 400, BLOW + 0.34),
          contact("k-mail", "agent.email", undefined, 0.66, 0.11, 0.048, 400, BLOW + 0.46),
          {
            id: "logo", kind: "image", bind: "agent.logo", fit: "contain", mask: "rounded",
            box: { x: C9.x + C9.w - 0.2, y: C9.y + C9.h + 0.02, w: 0.16, h: 0.06 },
            byAspect: { "1:1": { box: { x: C1.x + C1.w - 0.14, y: C1.y + C1.h + 0.02, w: 0.12, h: 0.07 } } },
            appear: { type: "fade", delay: 2.8, duration: 0.6 },
          },
          // Kis forgó jelvény a záró lap jobb felső sarkában (sötét tinta, papírszínű csillag).
          { id: "k-jelveny", kind: "component", component: "sparkle",
            box: { x: C9.x + C9.w * 0.82, y: C9.y + C9.h * 0.1, w: C9.w * 0.1, h: C9.w * 0.1 * (1080 / 1920) },
            byAspect: { "1:1": { box: { x: C1.x + C1.w * 0.82, y: C1.y + C1.h * 0.1, w: C1.w * 0.1, h: C1.w * 0.1 } } },
            props: { style: "badge", color: INK, ink: PAPER }, spin: { period: 9 },
            appear: { type: "fade", delay: BLOW + 0.3, duration: 0.5 } },
          card(n, { id: `lefujt-${n}`, blow: { duration: BLOW, dir: 1 } }),
          ...mainInfo(false),
          ...decor(false),
        ],
      },
    ],
  };
}

export const PAKLI: TwinxTemplate = buildPakli(5);

/** Második színvilág: DRÁMAI KÉK (a fehér betű jól olvasható rajta). */
export const PAKLI_VARIANTS: TemplateVariant[] = [
  {
    id: "pakli-kek", templateId: "pakli", name: "TWINX Pakli — Drámai kék",
    palette: { shadow: "#06143a", base: "#11307f", glow: "#1d45a6", muted: "#cfdcf5" },
  },
];
