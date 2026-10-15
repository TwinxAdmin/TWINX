// GEOMETRIA-HŰSÉG (3. lépés, F3d) — CSAK szerveroldal. Megtartotta-e a célkép a berendezetlen fotó szerkezetét?
// A berendezetlen 3D-fotón a szerkezeti élek (falsarkok, fal–mennyezet vonal, ablak- és ajtókontúrok) élesek és tiszták. A célképen
// ezeknek a HORIZONT FÖLÖTTI sávban (ahol bútor alig takar) a helyükön kell maradniuk — és ott nem jelenhet meg sok új, hosszú szerkezeti él
// (pl. kitalált üvegfal, beépített polcfal). Gépi, determinisztikus, olcsó (sharp + Sobel), nincs AI-hívás.
import sharp from "sharp";

const W = 320, H = 180;          // összehasonlító felbontás (16:9, mint a fotó és a célkép)
const UPPER = 0.42;              // a kép felső 42%-a: a horizont (szemmagasság) fölött — mennyezet, falak felső része, ablakok teteje
const RADIUS = 3;                // ennyi képponton belül számít „ugyanott lévő" élnek

async function edges(bytes: Uint8Array): Promise<Float32Array> {
  const { data } = await sharp(bytes).resize(W, H, { fit: "fill" }).greyscale().blur(1.1).raw().toBuffer({ resolveWithObject: true });
  const g = new Float32Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const p = (dx: number, dy: number) => data[(y + dy) * W + (x + dx)];
    const gx = -p(-1, -1) - 2 * p(-1, 0) - p(-1, 1) + p(1, -1) + 2 * p(1, 0) + p(1, 1);
    const gy = -p(-1, -1) - 2 * p(0, -1) - p(1, -1) + p(-1, 1) + 2 * p(0, 1) + p(1, 1);
    g[y * W + x] = Math.hypot(gx, gy);
  }
  return g;
}

/** Bináris élmaszk: a felső sáv legerősebb `share` hányada. */
function mask(g: Float32Array, share: number): Uint8Array {
  const rows = Math.floor(H * UPPER);
  const vals = Array.from(g.subarray(0, rows * W)).sort((a, b) => b - a);
  const thr = Math.max(8, vals[Math.floor(vals.length * share)] ?? 0);
  const m = new Uint8Array(W * H);
  for (let i = 0; i < rows * W; i++) m[i] = g[i] >= thr ? 1 : 0;
  return m;
}

function dilate(m: Uint8Array, r: number): Uint8Array {
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!m[y * W + x]) continue;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const a = x + dx, b = y + dy;
      if (a >= 0 && b >= 0 && a < W && b < H) out[b * W + a] = 1;
    }
  }
  return out;
}

export type Fidelity = {
  /** a berendezetlen fotó szerkezeti éleinek hány %-a maradt meg a célképen (felső sáv) */
  kept: number;
  /** a célkép felső sávjában a szerkezeti élek hány %-a ÚJ (nincs a berendezetlen fotón) */
  added: number;
  ok: boolean;
};

/** Küszöbök: config.ts (fidelityMinKept / fidelityMaxAdded) — a kalibrálás a tanulságnaplóban. */
export async function geometryFidelity(empty: Uint8Array, target: Uint8Array, minKept: number, maxAdded: number): Promise<Fidelity> {
  const [ge, gt] = await Promise.all([edges(empty), edges(target)]);
  const me = mask(ge, 0.06), mt = mask(gt, 0.1);
  const dt = dilate(mt, RADIUS), de = dilate(me, RADIUS);
  let ne = 0, keep = 0, nt = 0, add = 0;
  for (let i = 0; i < W * H; i++) {
    if (me[i]) { ne++; if (dt[i]) keep++; }
    if (mt[i]) { nt++; if (!de[i]) add++; }
  }
  const kept = ne ? Math.round((keep / ne) * 1000) / 1000 : 1;
  const added = nt ? Math.round((add / nt) * 1000) / 1000 : 0;
  return { kept, added, ok: kept >= minKept && added <= maxAdded };
}
