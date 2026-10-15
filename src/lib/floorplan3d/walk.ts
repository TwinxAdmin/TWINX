// BEJÁRÁS — mozgás és ütközés (4. lépés, F4a). Tiszta függvények, three.js nélkül (gépen tesztelhető).
//   • ütközők: a falszeletek PADLÓSZINTEN — az ajtók helyén lyukkal (át lehet menni), ablaknál nem (ott parapetfal van);
//     + a padlón álló bútorok alapterülete (szőnyeg, függőlámpa nem akadály);
//   • test: kör (BODY_R sugár) — falnál TENGELYENKÉNT csúszik, hogy ne akadjon el ferdén nekimenve;
//   • kezdőpont: az előszoba (ha van) bejáratától befelé, a helyiség közepe felé nézve.
import { OUTDOOR_KINDS, type FloorPlan, type Pt } from "@/lib/floorplan3d/plan";
import { openingSegment } from "@/lib/floorplan3d/geometry";
import { wallSlabs, type SceneOptions } from "@/lib/floorplan3d/scene";
import { footprint, type FurnitureItem } from "@/lib/floorplan3d/furniture";
import { roomViewpoint } from "@/lib/floorplan3d/camera";

export const BODY_R = 0.22;          // a „test" sugara (m) — 44 cm széles ember fér át egy 80 cm-es ajtón
export const EYE_HEIGHT = 1.6;

/** Tengelyirányú téglalap az alaprajzon. */
export type Rect = { x0: number; y0: number; x1: number; y1: number };

const NON_BLOCKING = new Set(["rug", "pendant_lamp"]);

/** Ütközők a tervből (falak, ajtólyukkal) és a berendezésből (bútor-alapterületek befoglaló téglalapja). */
export function colliders(plan: FloorPlan, opts: SceneOptions, furniture: FurnitureItem[] = []): Rect[] {
  const doors = plan.openings.filter((o) => o.kind === "door").map((o) => {
    const room = plan.rooms.find((r) => r.id === o.roomId);
    if (!room) return null;
    const s = openingSegment(room, o);
    if (!s.axis) return null;
    const k = s.axis === "x" ? 0 : 1, q = 1 - k;
    return { axis: s.axis, line: s.center[q], from: Math.min(s.a[k], s.b[k]), to: Math.max(s.a[k], s.b[k]) };
  }).filter((d): d is NonNullable<typeof d> => !!d);

  const out: Rect[] = [];
  for (const s of wallSlabs(plan, opts)) {
    const lo = Math.min(s.line, s.line + s.outward * s.thickness), hi = Math.max(s.line, s.line + s.outward * s.thickness);
    // a szeletet átszelő ajtók (a vonaluk a szelet vastagságán belül van) — ott lyuk
    const cuts = doors.filter((d) => d.axis === s.axis && d.line >= lo - 0.02 && d.line <= hi + 0.02 && d.to > s.from && d.from < s.to)
      .sort((a, b) => a.from - b.from);
    let cur = s.from;
    const push = (a: number, b: number) => {
      if (b - a < 0.01) return;
      out.push(s.axis === "x" ? { x0: a, x1: b, y0: lo, y1: hi } : { x0: lo, x1: hi, y0: a, y1: b });
    };
    for (const d of cuts) { push(cur, Math.max(cur, d.from)); cur = Math.max(cur, d.to); }
    push(cur, s.to);
  }
  for (const it of furniture) {
    if (NON_BLOCKING.has(it.type)) continue;
    const fp = footprint(it);
    out.push({ x0: Math.min(...fp.map((p) => p[0])), x1: Math.max(...fp.map((p) => p[0])), y0: Math.min(...fp.map((p) => p[1])), y1: Math.max(...fp.map((p) => p[1])) });
  }
  return out;
}

/** Ütközik-e a kör (p, BODY_R) valamelyik téglalappal? */
export function blocked(p: Pt, rects: Rect[], r = BODY_R): boolean {
  for (const q of rects) {
    const cx = Math.max(q.x0, Math.min(p[0], q.x1)), cy = Math.max(q.y0, Math.min(p[1], q.y1));
    if ((p[0] - cx) ** 2 + (p[1] - cy) ** 2 < r * r) return true;
  }
  return false;
}

/** Elmozdulás ütközéssel: előbb az egész lépés, ha nem megy, tengelyenként (csúszás a fal mentén). Kis lépésekre bontva, hogy ne „ugorjon át" vékony falon. */
export function moveWithCollision(p: Pt, d: Pt, rects: Rect[]): Pt {
  const len = Math.hypot(d[0], d[1]);
  const steps = Math.max(1, Math.ceil(len / 0.05));
  let cur: Pt = [p[0], p[1]];
  for (let i = 0; i < steps; i++) {
    const sx = d[0] / steps, sy = d[1] / steps;
    const full: Pt = [cur[0] + sx, cur[1] + sy];
    if (!blocked(full, rects)) { cur = full; continue; }
    const onlyX: Pt = [cur[0] + sx, cur[1]];
    if (sx && !blocked(onlyX, rects)) { cur = onlyX; continue; }
    const onlyY: Pt = [cur[0], cur[1] + sy];
    if (sy && !blocked(onlyY, rects)) { cur = onlyY; continue; }
    break;
  }
  return cur;
}

function insidePoly(p: Pt, poly: Pt[]): boolean {
  let r = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) r = !r;
  }
  return r;
}

/** Kezdő helyzet: az előszoba (ha van) nézőpontja; különben az első beltéri helyiségé. yaw: a nézési irány szöge az alaprajzon (rad).
 *  Ha az ütközők adottak, abba az irányba néz, amerre a legmesszebb ellát (ne egy közeli falra nézzen a belépéskor). */
export function startPose(plan: FloorPlan, rects?: Rect[]): { pos: Pt; yaw: number } {
  const room = plan.rooms.find((r) => r.kind === "eloszoba") ?? plan.rooms.find((r) => r.kind !== "terasz") ?? plan.rooms[0];
  const v = roomViewpoint(plan, room);
  let yaw = Math.atan2(v.target[1] - v.pos[1], v.target[0] - v.pos[0]);
  if (rects) {
    let best = -1;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      let d = 0.1;
      const at = (t: number): Pt => [v.pos[0] + Math.cos(a) * t, v.pos[1] + Math.sin(a) * t];
      // csak a lakáson BELÜL mért rálátás (a bejárati ajtón át kifelé nézés nem számít)
      // (a helyiségek közti fal-rés — belső ajtó — legfeljebb 40 cm „kint" lehet)
      let outside = 0;
      while (d < 15 && !blocked(at(d), rects, 0.03) && outside < 0.4) {
        outside = plan.rooms.some((r) => !OUTDOOR_KINDS.includes(r.kind) && insidePoly(at(d), r.polygon)) ? 0 : outside + 0.05;
        d += 0.05;
      }
      d -= outside;
      if (d > best + 0.05) { best = d; yaw = a; }
    }
  }
  return { pos: v.pos, yaw };
}

/** Szabad-e az egyenes út a két pont között (5 cm-enként mintázva)? */
export function clearLine(a: Pt, b: Pt, rects: Rect[]): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.05));
  for (let i = 1; i <= n; i++) if (blocked([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n], rects)) return false;
  return true;
}

/** Útkeresés (kattintásra odasétálás): A* 10 cm-es rácson, 8 irányban, majd „kifeszítve" (csak a szükséges töréspontok).
 *  Ha a cél foglalt (bútor, fal mellett), a legközelebbi szabad pontig vezet. null: nincs út (pl. zárt helyiség). */
export function findPath(from: Pt, to: Pt, rects: Rect[], bounds: { minX: number; minY: number; maxX: number; maxY: number }, cell = 0.1): Pt[] | null {
  const ox = bounds.minX - 0.5, oy = bounds.minY - 0.5;
  const W = Math.ceil((bounds.maxX - bounds.minX + 1) / cell), H = Math.ceil((bounds.maxY - bounds.minY + 1) / cell);
  if (W * H > 400_000) return null; // védőkorlát: irreálisan nagy terv
  const free = new Int8Array(W * H).fill(-1); // -1: még nem vizsgált, 0: foglalt, 1: szabad (lustán számolva)
  const isFree = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= W || j >= H) return false;
    const k = j * W + i;
    if (free[k] < 0) free[k] = blocked([ox + (i + 0.5) * cell, oy + (j + 0.5) * cell], rects) ? 0 : 1;
    return free[k] === 1;
  };
  const toCell = (p: Pt): [number, number] => [Math.floor((p[0] - ox) / cell), Math.floor((p[1] - oy) / cell)];
  const center = (i: number, j: number): Pt => [ox + (i + 0.5) * cell, oy + (j + 0.5) * cell];
  // a cél: ha foglalt, a legközelebbi szabad cella (max. 1 m-en belül)
  let [ti, tj] = toCell(to);
  if (!isFree(ti, tj)) {
    let best: [number, number] | null = null, bd = Infinity;
    for (let dj = -10; dj <= 10; dj++) for (let di = -10; di <= 10; di++) {
      const d = di * di + dj * dj;
      if (d < bd && isFree(ti + di, tj + dj)) { bd = d; best = [ti + di, tj + dj]; }
    }
    if (!best) return null;
    [ti, tj] = best;
  }
  const [si, sj] = toCell(from);
  const start = sj * W + si, goal = tj * W + ti;
  const g = new Float32Array(W * H).fill(Infinity), came = new Int32Array(W * H).fill(-1);
  const open: { k: number; f: number }[] = [];
  const h = (k: number) => Math.hypot((k % W) - ti, Math.floor(k / W) - tj);
  g[start] = 0; open.push({ k: start, f: h(start) });
  const closed = new Uint8Array(W * H);
  const N = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  let found = false;
  while (open.length) {
    // egyszerű bináris kupac helyett: a legkisebb f kiválasztása (a rács kicsi, a lusta szabadság-vizsgálat a drága rész)
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const { k } = open[bi]; open[bi] = open[open.length - 1]; open.pop();
    if (closed[k]) continue;
    closed[k] = 1;
    if (k === goal) { found = true; break; }
    const ci = k % W, cj = Math.floor(k / W);
    for (const [di, dj, c] of N) {
      const ni = ci + di, nj = cj + dj;
      if (!isFree(ni, nj)) continue;
      if (di && dj && (!isFree(ci + di, cj) || !isFree(ci, cj + dj))) continue; // átlósan sarkot nem vág
      const nk = nj * W + ni, ng = g[k] + c;
      if (ng < g[nk]) { g[nk] = ng; came[nk] = k; open.push({ k: nk, f: ng + h(nk) }); }
    }
  }
  if (!found) return null;
  const cells: Pt[] = [];
  for (let k = goal; k !== -1 && k !== start; k = came[k]) cells.push(center(k % W, Math.floor(k / W)));
  cells.reverse();
  // kifeszítés: a jelenlegi pontból a legtávolabbi, még egyenesen elérhető pontig
  const out: Pt[] = [];
  let cur = from, i = 0;
  while (i < cells.length) {
    let j = cells.length - 1;
    while (j > i && !clearLine(cur, cells[j], rects)) j--;
    out.push(cells[j]); cur = cells[j]; i = j + 1;
  }
  return out;
}
