// SAJÁT ÁTTŰNÉS-KÖNYVTÁR — kódból rajzolt, palettából színezett áttűnések.
//
// Minden áttűnés egy függvény: (haladás 0–1, vászonméret, színek) → egy képkocka
// vektoros leírása (Satori-elem <svg>-vel). A motor ebből rajzol átlátszó PNG-
// képkockákat, és ráülteti a videóra. Mivel csak a palettától és a mérettől
// függ (a partner adataitól NEM), sablononként/színenként/méretenként egyszer kell
// legyártani, utána újrahasznosítható.
//
// KLIENS-/SZERVER-FÜGGETLEN: nincs benne Node-import.

export type Rgb = string; // "#rrggbb"

/** Satori-kompatibilis elem (React nélkül). */
export type SatoriNode = { type: string; props: Record<string, unknown> & { children?: unknown } };
const h = (type: string, props: Record<string, unknown>, ...children: unknown[]): SatoriNode =>
  ({ type, props: children.length ? { ...props, children: children.length === 1 ? children[0] : children } : props });

/** Lassulási görbe: lágy indulás és megállás (mint a profi áttűnéseknél). */
export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** easeInOutCubic inverze (melyik időpontban ér el a görbe egy adott értéket). */
export function inverseEase(e: number): number {
  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (easeInOutCubic(mid) < e) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// =========================================================================
// NYÍL-TÖRLŐ (chevronWipe) — az Aurora jellegzetes áttűnése
//
// Egy jobbra mutató nyíl alakú, tömör felület söpör végig balról jobbra, mögötte
// félig áttetsző „uszály", a bal alsó részén meleg izzás. A képváltás abban a
// pillanatban történik, amikor a tömör rész TELJESEN takarja a vásznat — így a
// vágás láthatatlan.
// =========================================================================

export type ChevronGeometry = {
  depth: number;     // a nyílhegy mélysége, a szélesség arányában
  body: number;      // a tömör test hossza, a szélesség arányában
  tail: number;      // az áttetsző uszály hossza
  tailOpacity: number;
};

export const CHEVRON: ChevronGeometry = { depth: 0.35, body: 2.2, tail: 1.0, tailOpacity: 0.53 };

/** A hegy vízszintes helye (px) az adott görbeértéknél. */
function tipX(e: number, W: number, g: ChevronGeometry): number {
  const travel = W * (1 + g.depth + g.body + g.tail); // belépéstől a teljes kilépésig
  return e * travel;
}

/**
 * Melyik haladásnál (0–1, IDŐBEN) takarja a tömör test a teljes vásznat a
 * legbiztosabban — ide kell tenni a képváltást.
 */
export function chevronCutProgress(W: number, g: ChevronGeometry = CHEVRON): number {
  const travel = W * (1 + g.depth + g.body + g.tail);
  // Teljes takarás: a hegy töve (X − mélység) ≥ W ÉS a test vége (X − mélység − test) ≤ 0.
  const xFrom = W * (1 + g.depth);
  const xTo = W * (g.depth + g.body);
  return inverseEase(((xFrom + xTo) / 2) / travel);
}

export type WipeDirection = "right" | "left" | "up" | "down";

/**
 * A nyíl-törlő egy képkockája. Irány: merre halad a nyíl
 * (right = balról jobbra, left = jobbról balra, up = alulról felfelé, down = felülről lefelé).
 *
 * A rajz egy „virtuális" sávban készül (hossz = a haladás iránya, keresztirány = a
 * másik oldal), és onnan forgatjuk/tükrözzük a valódi vászonra. Így minden irány
 * ugyanazt a formát és időzítést kapja. Az izzás mindig a nyíl BELÉPÉSI oldalának
 * bal/alsó sarkából árad.
 */
export function chevronWipeFrame(
  progress: number,
  W: number,
  H: number,
  colors: { fill: Rgb; glow: Rgb },
  direction: WipeDirection = "right",
  g: ChevronGeometry = CHEVRON,
): SatoriNode {
  const vertical = direction === "up" || direction === "down";
  const A = vertical ? H : W;       // haladási hossz
  const C = vertical ? W : H;       // keresztirány
  // Virtuális (a, c) → valódi (x, y)
  const map = (a: number, c: number): [number, number] => {
    switch (direction) {
      case "left": return [W - a, c];
      case "down": return [c, a];
      case "up": return [c, H - a];
      default: return [a, c];
    }
  };
  const pts = (list: Array<[number, number]>) =>
    list.map(([a, c]) => map(a, c).map((v) => v.toFixed(1)).join(",")).join(" ");

  const e = easeInOutCubic(progress);
  const X = tipX(e, A, g);
  const k = A * g.depth;
  const L = A * g.body;
  const T = A * g.tail;
  const mid = C / 2;
  const arrow = (front: number, back: number): Array<[number, number]> => [
    [front - k - back, 0], [front - k, 0], [front, mid], [front - k, C], [front - k - back, C],
  ];

  const [gx, gy] = map(0, C);       // a belépési oldal „alsó" sarka
  const glowR = Math.min(W, H) * 1.1;
  const blur = Math.max(1.5, Math.min(W, H) * 0.006);
  return h("div", { style: { width: W, height: H, display: "flex", background: "transparent" } },
    h("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` },
      h("defs", {},
        h("filter", { id: "b", x: "-10%", y: "-10%", width: "120%", height: "120%" },
          h("feGaussianBlur", { stdDeviation: String(blur) }),
        ),
        h("radialGradient", { id: "g", gradientUnits: "userSpaceOnUse", cx: gx, cy: gy, r: glowR },
          h("stop", { offset: "0", "stop-color": colors.glow, "stop-opacity": "0.95" }),
          h("stop", { offset: "0.6", "stop-color": colors.glow, "stop-opacity": "0" }),
        ),
      ),
      h("polygon", { points: pts(arrow(X - L, T)), fill: colors.fill, "fill-opacity": String(g.tailOpacity), filter: "url(#b)" }),
      h("polygon", { points: pts(arrow(X, L)), fill: colors.fill, filter: "url(#b)" }),
      h("polygon", { points: pts(arrow(X, L)), fill: "url(#g)", filter: "url(#b)" }),
    ),
  );
}

// =========================================================================
// FELNYÍLÓ PANELEK (panelReveal) — az Aurora zárókártyájának bevezetése
//
// Az élő Shotstack-videó képkockái alapján (29–31 mp):
//  1. alulról ferde felső élű, sötét panel söpör fel, és eltakarja a képet;
//  2. a takarás alatt egy világosabb, ferde sáv fut át rajta (mélységérzet);
//  3. a panel lágyan elhalványul, alóla előtűnik a zárókártya.
// A jelenetváltás (vágás) a teljes takarás közepén történik → `PANEL_CUT`.
// =========================================================================

export const PANEL_CUT = 0.48;

function clamp01(x: number): number { return Math.min(1, Math.max(0, x)); }

export function panelRevealFrame(
  progress: number,
  W: number,
  H: number,
  colors: { fill: Rgb; band: Rgb },
): SatoriNode {
  const p = clamp01(progress);
  // 1) Felsöprés: 0 → 0.25
  const rise = easeInOutCubic(clamp01(p / 0.25));
  const slant = H * 0.07;
  const top = H + slant - rise * (H + slant * 2);           // a ferde él bal oldali magassága
  // 2) Világosabb sáv: 0.2 → 0.5
  const bandP = easeInOutCubic(clamp01((p - 0.2) / 0.3));
  const bandTop = H + slant - bandP * (H + slant * 3);
  // 3) Elhalványulás: 0.5 → 1
  const fade = 1 - easeInOutCubic(clamp01((p - 0.5) / 0.5));

  const panel = `0,${top + slant} ${W},${top} ${W},${H} 0,${H}`;
  const band = `0,${bandTop + slant} ${W},${bandTop} ${W},${bandTop + H * 0.22} 0,${bandTop + slant + H * 0.22}`;
  return h("div", { style: { width: W, height: H, display: "flex", background: "transparent", opacity: fade } },
    h("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` },
      h("polygon", { points: panel, fill: colors.fill }),
      bandP > 0 && bandP < 1 ? h("polygon", { points: band, fill: colors.band, "fill-opacity": "0.55" }) : null,
    ),
  );
}

// =========================================================================
// LÁGY ÁTÚSZTATÁS (softDip) — a Skandi áttűnése
//
// A kép lágyan „kifehéredik" egy világos (krém) tónusba, majd az új kép ugyanígy
// előtűnik belőle. A vágás a teljes takarás pillanatában (a közepén) történik.
// =========================================================================
export const DIP_CUT = 0.5;

export function softDipFrame(progress: number, W: number, H: number, color: Rgb): SatoriNode {
  const p = Math.min(1, Math.max(0, progress));
  // Háromszög-görbe lágyítva: 0 → 1 (közép) → 0; a közepén rövid ideig teljes takarás.
  const tri = 1 - Math.abs(2 * p - 1);
  const o = Math.min(1, easeInOutCubic(Math.min(1, tri * 1.15)));
  return h("div", { style: { width: W, height: H, display: "flex", background: color, opacity: Number(o.toFixed(3)) } });
}

// =========================================================================
// SZIMBÓLUM-ZOOM (symbolZoom) — a Prestige jellegzetes áttűnése
//
// Egy kis, vonalas ingatlanos szimbólum (ház, kulcs, térképjel, épület, tábla)
// a helyéről GYORSULVA a kamera felé repül: egyre nagyobb lesz, mi pedig „berepülünk"
// a belsejébe (a ház ajtaján, a kulcs karikáján…), míg a tömör belseje az egész
// vásznat kitölti. Ekkor történik a képváltás. Utána a szimbólum visszaszalad a
// helyére — de körülötte már az ÚJ fotó látszik.
//
// A szimbólum rajza ugyanaz, mint a jelenetek kis jelvénye (`symbolSvg`), így a
// visszaérkezés után a jelvény pontosan a helyén marad.
// =========================================================================

export type EstateSymbol = "house" | "key" | "pin" | "building" | "sold";

type SymbolDef = {
  /** Tömör sziluett (a háttérszínnel kitöltve) — ez takarja a vásznat a vágáskor. */
  fill: string;
  /** Vonalas rajz (kiemelő szín) — a landing ikonjainak stílusa. */
  strokes: string[];
  /** A „berepülés" pontja és a körülötte biztosan a sziluetten belül eső téglalap fél-mérete (egységben). */
  focus: [number, number];
  safe: [number, number];
};

/** 24×24-es rácson rajzolt szimbólumok (a /ingatlan oldal EstateIcons ikonjai). */
export const ESTATE_SYMBOLS: Record<EstateSymbol, SymbolDef> = {
  // Berepülés az AJTÓN át.
  house: {
    fill: "M12 4 21 11.5V20H3V11.5Z",
    strokes: ["M3 11.5 12 4l9 7.5", "M5 10.5V20h14v-9.5", "M10 20v-5h4v5"],
    focus: [12, 15.2], safe: [5.5, 4.2],
  },
  // Berepülés a kulcs KARIKÁJÁN át.
  key: {
    fill: "M7.5 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7Z",
    strokes: ["M7.5 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7Z", "M11 12h10M18 12v3M15 12v2.5"],
    focus: [7.5, 12], safe: [1.65, 2.95],
  },
  // Berepülés a térképjel FEJÉBE.
  pin: {
    fill: "M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11Z",
    strokes: ["M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11Z", "M12 7.6a2.4 2.4 0 1 0 0 4.8a2.4 2.4 0 1 0 0-4.8Z"],
    focus: [12, 9.6], safe: [2.6, 4.4],
  },
  // Berepülés a TORONYHÁZ falába.
  building: {
    fill: "M4 21V6.5L12 3v6.5h8V21Z",
    strokes: ["M4 21V6.5L12 3v18", "M12 9.5h8V21", "M7 9h2M7 12.5h2M7 16h2M15 13h2M15 16.5h2", "M3 21h18"],
    focus: [8, 14], safe: [3.6, 6.6],
  },
  // Berepülés az „ELADÓ" TÁBLÁBA.
  sold: {
    fill: "M4.6 4h10.8a1.6 1.6 0 0 1 1.6 1.6v6.3a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 11.9V5.6A1.6 1.6 0 0 1 4.6 4Z",
    strokes: ["M4.6 4h10.8a1.6 1.6 0 0 1 1.6 1.6v6.3a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 11.9V5.6A1.6 1.6 0 0 1 4.6 4Z", "M10 13.5V21M7 21h6", "M6.5 8.5h7"],
    focus: [10, 8.75], safe: [6.6, 4.4],
  },
};

const STROKE_UNITS = 1.6;

/** A szimbólum SVG-csoportja adott helyen és léptékben (a fókuszpont kerül a (cx, cy) pontra). */
function symbolGroup(sym: EstateSymbol, cx: number, cy: number, unit: number, unit0: number, colors: { fill: Rgb; stroke: Rgb }): SatoriNode {
  const d = ESTATE_SYMBOLS[sym];
  // A vonal képernyőn mért vastagsága csak lassan nő a nagyítással (különben a
  // nagy léptéknél vaskos sávvá hízna) — így végig elegáns, vékony vonal marad.
  const strokePx = STROKE_UNITS * unit0 * Math.pow(unit / unit0, 0.32);
  const sw = strokePx / unit;
  return h("g", { transform: `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) scale(${unit.toFixed(4)}) translate(${-d.focus[0]} ${-d.focus[1]})` },
    h("path", { d: d.fill, fill: colors.fill }),
    ...d.strokes.map((s) => h("path", {
      d: s, fill: "none", stroke: colors.stroke, "stroke-width": sw.toFixed(4),
      "stroke-linecap": "round", "stroke-linejoin": "round",
    })),
  );
}

/** A jelenetek kis jelvénye: a szimbólum a (cx, cy) fókuszponttal, `sizePx` méretű rácsdobozban. */
export function symbolSvg(sym: EstateSymbol, sizePx: number, colors: { fill: Rgb; stroke: Rgb }): SatoriNode {
  const unit = sizePx / 24;
  const d = ESTATE_SYMBOLS[sym];
  return h("svg", { width: sizePx, height: sizePx, viewBox: `0 0 ${sizePx} ${sizePx}` },
    symbolGroup(sym, d.focus[0] * unit, d.focus[1] * unit, unit, unit, colors));
}

/** A vágás pillanata (ekkor a szimbólum belseje teljesen takarja a vásznat). */
export const SYMBOL_CUT = 0.5;

export type SymbolZoomOptions = {
  symbol: EstateSymbol;
  /** A jelvény helye: a rácsdoboz bal felső sarka (px) és mérete (px). */
  origin: { x: number; y: number; size: number };
  colors: { fill: Rgb; stroke: Rgb };
};

/**
 * Egy képkocka a szimbólum-zoomból. 0 → SYMBOL_CUT: a szimbólum gyorsulva a kamera
 * felé jön és a fókuszpontja a vászon közepére úszik; SYMBOL_CUT-nál teljes takarás;
 * utána ugyanez visszafelé, lassulva, egészen a jelvény helyéig.
 */
function symbolZoomGeometry(progress: number, W: number, H: number, o: SymbolZoomOptions) {
  const p = Math.min(1, Math.max(0, progress));
  const d = ESTATE_SYMBOLS[o.symbol];
  const unit0 = o.origin.size / 24;
  const fx0 = o.origin.x + d.focus[0] * unit0;
  const fy0 = o.origin.y + d.focus[1] * unit0;
  // A teljes takaráshoz szükséges lépték: a biztos téglalap fedje a vásznat (+12% ráhagyás).
  const unitMax = Math.max(W / 2 / d.safe[0], H / 2 / d.safe[1]) * 1.12;
  // Oda: gyorsuló (a végén szinte „becsapódik"); vissza: lassuló (puhán érkezik a helyére).
  // t: 0 a jelvény helyén, 1 a vágásnál. k = t^2,2 → oda gyorsul, vissza a vágás
  // után gyorsan indul és puhán, lassulva érkezik a helyére.
  const t = p <= SYMBOL_CUT ? p / SYMBOL_CUT : (1 - p) / (1 - SYMBOL_CUT);
  const k = Math.min(1, Math.max(0, Math.pow(t, 2.2)));
  // Léptékek mértani (exponenciális) közelítése — a kamera felé repülés így érződik egyenletesnek.
  const unit = unit0 * Math.pow(unitMax / unit0, k);
  // A fókuszpont a jelvény helyéről a vászon közepére úszik (a lépték növekedésével együtt).
  const m = easeInOutCubic(Math.min(1, k * 1.25));
  const cx = fx0 + (W / 2 - fx0) * m;
  const cy = fy0 + (H / 2 - fy0) * m;
  return { cx, cy, unit, unit0 };
}

/**
 * A látható réteg: a szimbólum vonalai (és ha `colors.fill` nem "none", a tömör belseje).
 * „Átlépés a következő szobába" módban a belső ÁTLÁTSZÓ — ott a maszk mutatja az új fotót.
 */
export function symbolZoomFrame(progress: number, W: number, H: number, o: SymbolZoomOptions): SatoriNode {
  const g = symbolZoomGeometry(progress, W, H, o);
  return h("div", { style: { width: W, height: H, display: "flex" } },
    h("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` },
      symbolGroup(o.symbol, g.cx, g.cy, g.unit, g.unit0, o.colors)));
}

/**
 * MASZK a vágás előtti szakaszhoz: fekete háttér, FEHÉR szimbólum-belső. Ahol fehér,
 * ott már a következő jelenet látszik („átlátunk a következő szobába").
 */
export function symbolMaskFrame(progress: number, W: number, H: number, o: SymbolZoomOptions): SatoriNode {
  const g = symbolZoomGeometry(progress, W, H, o);
  const d = ESTATE_SYMBOLS[o.symbol];
  return h("div", { style: { width: W, height: H, display: "flex", background: "#000000" } },
    h("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}` },
      h("g", { transform: `translate(${g.cx.toFixed(2)} ${g.cy.toFixed(2)}) scale(${g.unit.toFixed(4)}) translate(${-d.focus[0]} ${-d.focus[1]})` },
        h("path", { d: d.fill, fill: "#ffffff" }))));
}
