// photo-geometry — a kép GEOMETRIÁJÁNAK korrekciója: ferdeség (roll),
// összetartó függőlegesek (keystone) és objektívtorzítás (radiális).
//
// MIÉRT: a telefont ritkán tartjuk pontosan vízszintesen és függőlegesen. Ha
// felfelé/lefelé döntjük, a falak összetartanak — ez az, amitől egy fotó
// „amatőrnek" hat. A kiegyenesítés adja a „profi géppel készült" benyomást.
//
// FONTOS: itt is CSAK a pixelek helyét számoljuk át, tartalmat nem gyártunk.
// A korrekció mértékét MÉRJÜK a képen található függőleges élekből, és ha nem
// vagyunk biztosak benne, inkább KIHAGYJUK — egy rosszul döntött korrekció
// többet ront, mint amennyit javít.

export type TiltEstimate = {
  /** Elforgatás fokban (pozitív = az óramutató járásával egyezően kell visszaforgatni). */
  rollDeg: number;
  /** A függőleges enyészpont y-koordinátája a képközépponthoz képest, pixelben.
   *  Nagy abszolút érték = a függőlegesek már közel párhuzamosak (nincs teendő). */
  vanishY: number;
  /** Hány használható függőleges élt találtunk. */
  lineCount: number;
  /** 0–1: mennyire megbízható a becslés. 0,5 alatt nem nyúlunk a képhez. */
  confidence: number;
};

export type WarpParams = {
  /** Elforgatás radiánban (a `rollDeg` ellentettje). */
  rotation: number;
  /** Függőleges enyészpont a középponthoz képest (px). 0 = nincs keystone. */
  vanishY: number;
  /** Radiális torzítás együtthatója (negatív = hordó-torzítás javítása). */
  k1: number;
  /** Nagyítás, hogy ne maradjon üres szél a korrekció után. */
  zoom: number;
};

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// 1) ÉLKERESÉS ÉS DŐLÉS-BECSLÉS (tiszta függvények)
// ---------------------------------------------------------------------------

/** Szürkeárnyalatos kép a nyers RGB-ből. */
export function toGray(rgb: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    out[i] = (0.2126 * rgb[i * 3] + 0.7152 * rgb[i * 3 + 1] + 0.0722 * rgb[i * 3 + 2]) | 0;
  }
  return out;
}

/**
 * FÜGGŐLEGES élek keresése és a hozzájuk tartozó dőlés megbecslése.
 *
 * Módszer: Sobel-gradiens → a FÜGGŐLEGES élek ott vannak, ahol a gradiens
 * VÍZSZINTES (|gx| > |gy|). Ezekre egy szűkített Hough-szavazás fut: minden
 * élpont minden szóba jöhető dőlésszögre „megszavazza", hol metszené a kép
 * középső sorát. A sok szavazatot kapó (szög, metszéspont) párok a valódi élek.
 */
export function estimateTilt(gray: Uint8Array, w: number, h: number): TiltEstimate {
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;

  // --- Sobel + a függőleges élpontok összegyűjtése ---
  type Pt = { x: number; y: number; mag: number };
  const pts: Pt[] = [];
  let magSum = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gray[i - w - 1] + gray[i - w + 1] +
        -2 * gray[i - 1] + 2 * gray[i + 1] +
        -gray[i + w - 1] + gray[i + w + 1];
      const gy =
        -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1] +
        gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
      const agx = Math.abs(gx), agy = Math.abs(gy);
      // Függőleges él: a gradiens jóval inkább vízszintes.
      if (agx > agy * 2) {
        const mag = agx;
        pts.push({ x, y, mag });
        magSum += mag;
      }
    }
  }
  if (pts.length < 60) {
    return { rollDeg: 0, vanishY: 0, lineCount: 0, confidence: 0 };
  }

  // Csak az erős élek számítanak — a zaj ne szavazzon. FONTOS: a küszöb az
  // átlag FELE, nem az átlag: egy tiszta, egyenletes kontrasztú képen minden
  // élpont pontosan átlagos erősségű lenne, és a szigorúbb szűrő mindet kidobná.
  const avgMag = magSum / pts.length;
  const strong = pts.filter((p) => p.mag >= avgMag * 0.5);

  // --- Hough: szög × középsor-metszéspont ---
  // A vizsgált szögtartomány ±14°: ennél nagyobb dőlés már nem véletlen
  // kézremegés, hanem szándékos kompozíció (pl. átlós felvétel) — abba nem
  // szólunk bele.
  const ANGLES = 57; // −14°…+14°, fél fokonként (a durvább lépés önmagában
                     // akkora szög-hibát vitt be, hogy elrontotta a megbízhatóságot)
  const bins = 96;
  const binW = w / bins;
  const acc = new Float64Array(ANGLES * bins);
  for (const p of strong) {
    const dy = p.y - cy;
    for (let a = 0; a < ANGLES; a++) {
      const phi = ((a - (ANGLES - 1) / 2) / 2) * DEG;
      const x0 = p.x - dy * Math.tan(phi);
      const b = Math.floor(x0 / binW);
      if (b >= 0 && b < bins) acc[a * bins + b] += p.mag;
    }
  }

  // --- Csúcsok: minden oszlop-sávban a legjobb szög ---
  type Line = { phi: number; x0: number; weight: number };
  const lines: Line[] = [];
  for (let b = 0; b < bins; b++) {
    let bestA = -1, bestV = 0;
    for (let a = 0; a < ANGLES; a++) {
      const v = acc[a * bins + b];
      if (v > bestV) { bestV = v; bestA = a; }
    }
    if (bestA >= 0) lines.push({
      phi: ((bestA - (ANGLES - 1) / 2) / 2) * DEG,
      x0: (b + 0.5) * binW - cx,
      weight: bestV,
    });
  }
  // CSAK a valódi élek: minden sáv ad egy „legjobb szöget", de ahol nincs igazi
  // vonal, ott ez csak a szomszédos élek elkenődött szavazata — súlya töredéke a
  // valódiakénak. A leghangosabb él 35%-a alatti sávokat eldobjuk, különben a zaj
  // rontja el az illesztést (emiatt maradt korábban 10% körül a megbízhatóság).
  lines.sort((a, b) => b.weight - a.weight);
  const maxW = lines[0]?.weight ?? 0;
  const keep = lines.filter((l) => l.weight >= maxW * 0.35).slice(0, 40);
  if (keep.length < 4) return { rollDeg: 0, vanishY: 0, lineCount: keep.length, confidence: 0 };

  // --- Illesztés: tan(phi) = m·x0 + c ---
  // Egy közös enyészpontba (xv, yv) futó egyenesekre: x0 = xv − (yv−cy)·tan(phi),
  // azaz tan(phi) = (xv − x0) / (yv − cy). Tehát a DŐLÉS függ a vízszintes
  // helytől, és nem fordítva — ezért a tan(phi)-t illesztjük az x0-ra.
  //
  // Miért így: ha a kép csak FERDE (az enyészpont a végtelenben van), akkor
  // minden vonal dőlése azonos, viszont az x0-juk szanaszét van. A fordított
  // illesztés (x0 a dőlésből) ilyenkor értelmezhetetlen, és tévesen nulla
  // megbízhatóságot adna egy tökéletesen felismerhető ferdeségre.
  let sw = 0, sx = 0, st = 0, sxx = 0, sxt = 0;
  for (const l of keep) {
    const t = Math.tan(l.phi);
    sw += l.weight; sx += l.weight * l.x0; st += l.weight * t;
    sxx += l.weight * l.x0 * l.x0; sxt += l.weight * l.x0 * t;
  }
  const meanX = sx / sw, meanT = st / sw;
  const varX = sxx / sw - meanX * meanX;
  const covXT = sxt / sw - meanX * meanT;
  // Meredekség: csak akkor értelmes, ha a vonalak vízszintesen tényleg szórnak.
  const m = varX > (w * 0.02) ** 2 ? covXT / varX : 0;
  const c = meanT - m * meanX;

  // Maradék: mennyire illeszkednek a mért dőlések a modellre.
  let resid = 0;
  for (const l of keep) resid += l.weight * Math.abs(Math.tan(l.phi) - (m * l.x0 + c));
  const meanResid = resid / sw;
  // 0,035 ≈ 2° szórás — ennél pontosabb illeszkedés teljes megbízhatóság.
  const confidence = Math.max(0, Math.min(1, 1 - meanResid / 0.035));

  // A képközépi dőlés adja a ferdeséget; a meredekség az enyészpontot.
  const rollDeg = Math.atan(c) / DEG;
  const vanishY = m !== 0 ? -1 / m : 0;

  return { rollDeg, vanishY, lineCount: keep.length, confidence };
}

// ---------------------------------------------------------------------------
// 2) DÖNTÉS: nyúljunk-e a képhez, és mennyire
// ---------------------------------------------------------------------------

export type GeometryPlan = {
  apply: boolean;
  params: WarpParams;
  /** Mennyit vág le a szélekből, százalékban (tájékoztató). */
  cropPct: number;
  notes: string[];
};

export function planGeometry(
  est: TiltEstimate,
  w: number,
  h: number,
  opts: { maxZoom?: number; k1?: number; strength?: number } = {}
): GeometryPlan {
  // Egy erősebb keystone-korrekció ~20% vágást igényel; ez alatt inkább
  // kihagyjuk a javítást, mint hogy a kép széléből túl sokat áldozzunk.
  const maxZoom = opts.maxZoom ?? 1.2;
  const strength = opts.strength ?? 0.85; // nem visszük végig teljesen
  const notes: string[] = [];

  // Nem vagyunk elég biztosak → hozzá sem nyúlunk.
  if (est.confidence < 0.5 || est.lineCount < 4) {
    return { apply: false, params: { rotation: 0, vanishY: 0, k1: 0, zoom: 1 }, cropPct: 0, notes: [] };
  }

  // Az enyészpont a képen BELÜL nem lehet valós (az égbolt/padló felé mutat);
  // ilyenkor a becslés hibás, inkább kihagyjuk.
  const minVanish = h * 0.75;
  let vanishY = Math.abs(est.vanishY) > minVanish ? est.vanishY : 0;
  // Nagyon távoli enyészpont = a függőlegesek már párhuzamosak, nincs teendő.
  if (Math.abs(vanishY) > h * 12) vanishY = 0;
  if (vanishY) vanishY = vanishY / strength; // gyengítés: távolabbi VP = kisebb hatás

  // A roll csak akkor érdekes, ha érzékelhető, de nem szándékos.
  const rollDeg = Math.abs(est.rollDeg) > 0.35 && Math.abs(est.rollDeg) < 12 ? est.rollDeg * strength : 0;

  if (!vanishY && !rollDeg && !opts.k1) {
    return { apply: false, params: { rotation: 0, vanishY: 0, k1: 0, zoom: 1 }, cropPct: 0, notes: [] };
  }

  const base: WarpParams = { rotation: -rollDeg * DEG, vanishY, k1: opts.k1 ?? 0, zoom: 1 };
  const zoom = solveZoom(base, w, h, maxZoom);
  if (zoom === null) {
    // Túl nagy vágás kellene → nem éri meg.
    return { apply: false, params: base, cropPct: 0, notes: [] };
  }

  if (rollDeg) notes.push("Ferde kép kiegyenesítve");
  if (vanishY) notes.push("Összetartó falak kiegyenesítve");
  if (opts.k1) notes.push("Objektívtorzítás javítva");

  return { apply: true, params: { ...base, zoom }, cropPct: Math.round((1 - 1 / zoom) * 100), notes };
}

// ---------------------------------------------------------------------------
// 3) TRANSZFORMÁCIÓ — kimenet → forrás leképezés és újramintavételezés
// ---------------------------------------------------------------------------

/**
 * Egy kimeneti pont forrás-koordinátája. Sorrend: nagyítás → keystone →
 * elforgatás → radiális torzítás. Középpontos koordinátákkal dolgozunk.
 */
export function mapToSource(
  ux: number, uy: number, p: WarpParams, halfDiag: number
): { x: number; y: number } {
  // 1) nagyítás (a vágás)
  let x = ux / p.zoom;
  let y = uy / p.zoom;

  // 2) keystone: az enyészpontot a végtelenbe küldő homográfia INVERZE
  if (p.vanishY) {
    const s = p.vanishY / (p.vanishY + y);
    x *= s;
    y *= s;
  }

  // 3) elforgatás
  if (p.rotation) {
    const c = Math.cos(p.rotation), si = Math.sin(p.rotation);
    const rx = x * c - y * si;
    const ry = x * si + y * c;
    x = rx; y = ry;
  }

  // 4) radiális (hordó-)torzítás javítása
  if (p.k1) {
    const r2 = (x * x + y * y) / (halfDiag * halfDiag);
    const f = 1 + p.k1 * r2;
    x *= f; y *= f;
  }

  return { x, y };
}

/** A legkisebb nagyítás, aminél már nem lóg ki a kép sarka (null = túl sok kellene). */
function solveZoom(p: WarpParams, w: number, h: number, maxZoom: number): number | null {
  const halfW = w / 2, halfH = h / 2;
  const halfDiag = Math.hypot(halfW, halfH);
  const corners: [number, number][] = [
    [-halfW, -halfH], [halfW, -halfH], [-halfW, halfH], [halfW, halfH],
  ];
  for (let z = 1; z <= maxZoom + 1e-6; z += 0.005) {
    const test = { ...p, zoom: z };
    let ok = true;
    for (const [ux, uy] of corners) {
      const s = mapToSource(ux, uy, test, halfDiag);
      if (Math.abs(s.x) > halfW - 0.5 || Math.abs(s.y) > halfH - 0.5) { ok = false; break; }
    }
    if (ok) return Math.round(z * 1000) / 1000;
  }
  return null;
}

/** Bilineáris újramintavételezés — egyetlen menetben, hogy egyszer veszítsünk minőséget. */
export function warpImage(
  rgb: Uint8Array, w: number, h: number, p: WarpParams
): Uint8Array {
  const out = new Uint8Array(w * h * 3);
  const halfW = w / 2, halfH = h / 2;
  const halfDiag = Math.hypot(halfW, halfH);

  for (let oy = 0; oy < h; oy++) {
    const uy = oy - halfH + 0.5;
    for (let ox = 0; ox < w; ox++) {
      const ux = ox - halfW + 0.5;
      const s = mapToSource(ux, uy, p, halfDiag);
      const sx = s.x + halfW - 0.5;
      const sy = s.y + halfH - 0.5;
      const o = (oy * w + ox) * 3;

      if (sx < 0 || sy < 0 || sx > w - 1 || sy > h - 1) {
        // A vágás után ilyen elvileg nincs; ha mégis, a szélső pixelt vesszük.
        const cxi = Math.min(w - 1, Math.max(0, Math.round(sx)));
        const cyi = Math.min(h - 1, Math.max(0, Math.round(sy)));
        const si = (cyi * w + cxi) * 3;
        out[o] = rgb[si]; out[o + 1] = rgb[si + 1]; out[o + 2] = rgb[si + 2];
        continue;
      }

      const x0 = sx | 0, y0 = sy | 0;
      const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
      const fx = sx - x0, fy = sy - y0;
      const i00 = (y0 * w + x0) * 3, i10 = (y0 * w + x1) * 3;
      const i01 = (y1 * w + x0) * 3, i11 = (y1 * w + x1) * 3;
      for (let c = 0; c < 3; c++) {
        const top = rgb[i00 + c] * (1 - fx) + rgb[i10 + c] * fx;
        const bot = rgb[i01 + c] * (1 - fx) + rgb[i11 + c] * fx;
        out[o + c] = (top * (1 - fy) + bot * fy + 0.5) | 0;
      }
    }
  }
  return out;
}
