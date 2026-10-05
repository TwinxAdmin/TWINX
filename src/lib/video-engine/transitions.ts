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
