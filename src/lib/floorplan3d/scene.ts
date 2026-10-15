// 3D-alap (2. lépés): a lakásleírásból (FloorPlan, méter) berendezetlen, méretpontos three.js-jelenet.
// Koordináták: alaprajz (x, y) → three (x, z); a magasság a three y tengelye. 1 egység = 1 méter.
//   • falak: minden NEM nyitott helyiség-élre egy falszelet kifelé — vastagsága a szemközti szomszéd helyiségig tartó rés
//     (ha ≤ 50 cm), különben a konfigurált külső falvastagság; a domború sarkokat a szeletek meghosszabbítása zárja;
//   • nyílászárók: minden falszeletből kivágódnak, amelyen áthaladnak (a két szomszéd oldalán is);
//   • padló minden helyiségben, mennyezet a beltéri helyiségekben (a terasz nyitott).
// A geometria SOHA nem a stílusból jön — a stílus később csak anyagot és berendezést ad (szabály).
import * as THREE from "three";
import type { FloorPlan, Opening, Pt, Room } from "@/lib/floorplan3d/plan";
import { OUTDOOR_KINDS } from "@/lib/floorplan3d/plan";
import { openingSegment, polygonArea, roomEdge } from "@/lib/floorplan3d/geometry";

export type SceneOptions = { interiorWall: number; exteriorWall: number };

const MAX_GAP = 0.5;   // ennél nagyobb rés már nem fal két helyiség között, hanem külső fal + külső tér
const EPS = 0.01;
const TOUCH_WALL = 0.06; // összeérő (nem nyitott) helyiségek közé épülő legvékonyabb válaszfal

/** Egy falszelet alaprajzi leírása (a méréshez és a hibakereséshez is). */
type Slab = { axis: "x" | "y"; line: number; outward: 1 | -1; from: number; to: number; thickness: number; roomId: string };

/** Belső normális (óramutató szerinti körüljárás, y lefelé): a helyiség belseje felé mutat. */
function inward(a: Pt, b: Pt): Pt {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
}

/** A helyiségek élei mentén a falszeletek (vastagság a szomszédig tartó rés szerint, szakaszonként). */
export function wallSlabs(plan: FloorPlan, opts: SceneOptions): Slab[] {
  const slabs: Slab[] = [];
  for (const room of plan.rooms) {
    const open = new Set(room.openEdges ?? []);
    const n = room.polygon.length;
    for (let i = 0; i < n; i++) {
      if (open.has(i)) continue;
      const e = roomEdge(room, i);
      if (!e.axis) continue; // ferde fal: az első fázisban nincs
      const k = e.axis === "x" ? 0 : 1, o = 1 - k;
      const nin = inward(e.a, e.b);
      const outward = (nin[o] > 0 ? -1 : 1) as 1 | -1;
      const line = e.a[o];
      const lo = Math.min(e.a[k], e.b[k]), hi = Math.max(e.a[k], e.b[k]);

      // szemközti szomszéd-élek: párhuzamos, kifelé ≤ MAX_GAP távolságra, átfedő szakasz
      const facing: { from: number; to: number; gap: number }[] = [];
      for (const other of plan.rooms) {
        if (other.id === room.id) continue;
        for (let j = 0; j < other.polygon.length; j++) {
          const f = roomEdge(other, j);
          if (f.axis !== e.axis) continue;
          const gap = (f.a[o] - line) * outward;
          if (gap < -EPS || gap > MAX_GAP) continue;
          const flo = Math.max(lo, Math.min(f.a[k], f.b[k])), fhi = Math.min(hi, Math.max(f.a[k], f.b[k]));
          if (fhi - flo > EPS) facing.push({ from: flo, to: fhi, gap: Math.max(gap, 0) });
        }
      }
      // szakaszolás a szomszédok határainál; minden szakaszra a legkisebb rés (vagy külső fal)
      const cuts = [...new Set([lo, hi, ...facing.flatMap((f) => [f.from, f.to])])].sort((a, b) => a - b);
      for (let c = 0; c < cuts.length - 1; c++) {
        const from = cuts[c], to = cuts[c + 1];
        if (to - from < EPS) continue;
        const mid = (from + to) / 2;
        const cover = facing.filter((f) => f.from <= mid && f.to >= mid);
        const thickness = cover.length ? Math.min(...cover.map((f) => f.gap)) : opts.exteriorWall;
        if (thickness < TOUCH_WALL / 2) {
          // a két helyiség körvonala összeér, de a határ NEM nyitott → vékony válaszfal középre (mindkét oldalon TOUCH_WALL/2-t
          // vesz el; a méretpontosság-mérés ezt kimutatja). Nyitott határon (openEdges) ide el sem jutunk.
          slabs.push({ axis: e.axis, line: line - (outward * TOUCH_WALL) / 2, outward, from, to, thickness: TOUCH_WALL, roomId: room.id });
          continue;
        }
        slabs.push({ axis: e.axis, line, outward, from, to, thickness, roomId: room.id });
      }
    }
  }
  // domború sarkok lezárása: a szelet meghosszabbítása annyival, amennyi a szomszéd él falvastagsága
  // (előbb az EREDETI értékekből számolunk, utána alkalmazzuk — így a sorrend nem számít)
  const ext = slabs.map((s) => {
    let from = 0, to = 0;
    for (const t of slabs) {
      if (t === s || t.roomId !== s.roomId || t.axis === s.axis) continue;
      // t merőleges: ha t vonala s egyik végén van, és t a végponton túlra (kifelé) nyúlik → s nyúljon t vastagságáig
      if (Math.abs(t.line - s.to) < EPS && t.outward === 1 && touches(t, s)) to = Math.max(to, t.thickness);
      if (Math.abs(t.line - s.from) < EPS && t.outward === -1 && touches(t, s)) from = Math.max(from, t.thickness);
    }
    return { from, to };
  });
  slabs.forEach((s, i) => { s.from -= ext[i].from; s.to += ext[i].to; });
  return slabs;
}

/** t (merőleges) szelet egyik vége s vonalán van-e (azaz a sarokban találkoznak)? */
function touches(t: Slab, s: Slab): boolean {
  return Math.abs(t.from - s.line) < EPS || Math.abs(t.to - s.line) < EPS;
}

type AbsOpening = { o: Opening; axis: "x" | "y"; line: number; from: number; to: number };

function absOpenings(plan: FloorPlan): AbsOpening[] {
  const out: AbsOpening[] = [];
  for (const o of plan.openings) {
    const room = plan.rooms.find((r) => r.id === o.roomId);
    if (!room) continue;
    const s = openingSegment(room, o);
    if (!s.axis) continue;
    const k = s.axis === "x" ? 0 : 1, oo = 1 - k;
    out.push({ o, axis: s.axis, line: s.center[oo], from: Math.min(s.a[k], s.b[k]), to: Math.max(s.a[k], s.b[k]) });
  }
  return out;
}

export type BuiltScene = {
  group: THREE.Group;
  /** A falszeletek hálói (a méréshez: a sugarak csak ezekbe ütközhetnek). */
  walls: THREE.Mesh[];
  floors: Map<string, THREE.Mesh>;
  slabs: Slab[];
};

export function buildApartment(plan: FloorPlan, opts: SceneOptions): BuiltScene {
  const H = plan.ceilingHeight;
  const group = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xeeeae3, roughness: 0.95 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xc4b6a2, roughness: 0.9 });
  const outdoorMat = new THREE.MeshStandardMaterial({ color: 0x9d968b, roughness: 1 });
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf7f5f1, roughness: 1, side: THREE.DoubleSide });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xdfe9ee, roughness: 0.05, transmission: 0.9, transparent: true, opacity: 0.35 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0xe8e3dc, roughness: 0.8 });

  const slabs = wallSlabs(plan, opts);
  const opens = absOpenings(plan);
  const walls: THREE.Mesh[] = [];

  /** Egy tömb a falszeleten: hossz menti [a,b], magasság [y0,y1]. */
  const block = (s: Slab, a: number, b: number, y0: number, y1: number) => {
    if (b - a < 0.005 || y1 - y0 < 0.005) return;
    const len = b - a, th = s.thickness, hgt = y1 - y0;
    const midAlong = (a + b) / 2, midAcross = s.line + (s.outward * th) / 2;
    const geo = s.axis === "x" ? new THREE.BoxGeometry(len, hgt, th) : new THREE.BoxGeometry(th, hgt, len);
    const m = new THREE.Mesh(geo, wallMat);
    if (s.axis === "x") m.position.set(midAlong, y0 + hgt / 2, midAcross);
    else m.position.set(midAcross, y0 + hgt / 2, midAlong);
    m.castShadow = true; m.receiveShadow = true;
    m.userData = { kind: "wall", roomId: s.roomId };
    group.add(m); walls.push(m);
  };

  for (const s of slabs) {
    // a szeletet átszelő nyílások (a vonaluk a szelet vastagságán belül van)
    const lo = Math.min(s.line, s.line + s.outward * s.thickness) - 0.02, hi = Math.max(s.line, s.line + s.outward * s.thickness) + 0.02;
    const cutting = opens.filter((p) => p.axis === s.axis && p.line >= lo && p.line <= hi && p.to > s.from && p.from < s.to)
      .sort((a, b) => a.from - b.from);
    let cursor = s.from;
    for (const p of cutting) {
      const a = Math.max(p.from, s.from), b = Math.min(p.to, s.to);
      if (a > cursor) block(s, cursor, a, 0, H);
      const top = Math.min(H, p.o.sill + p.o.height);
      block(s, a, b, 0, p.o.sill);         // parapet
      block(s, a, b, top, H);              // áthidaló
      cursor = Math.max(cursor, b);
    }
    if (cursor < s.to) block(s, cursor, s.to, 0, H);
  }

  // nyílászárók: ablaküveg a nyílás közepén, ajtólap félig nyitva (csak a tájékozódáshoz — a stílus később cseréli)
  for (const p of opens) {
    const room = plan.rooms.find((r) => r.id === p.o.roomId)!;
    const seg = openingSegment(room, p.o);
    const nin = inward(roomEdge(room, p.o.edge).a, roomEdge(room, p.o.edge).b);
    const w = p.to - p.from;
    if (p.o.kind === "window") {
      const geo = p.axis === "x" ? new THREE.BoxGeometry(w, p.o.height, 0.02) : new THREE.BoxGeometry(0.02, p.o.height, w);
      const m = new THREE.Mesh(geo, glassMat);
      const off = -0.06; // a fal síkjától kicsit kijjebb
      m.position.set(seg.center[0] + nin[0] * off, p.o.sill + p.o.height / 2, seg.center[1] + nin[1] * off);
      m.userData = { kind: "window" };
      group.add(m);
    } else {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, p.o.height - 0.01, 0.04), doorMat);
      leaf.position.set(w / 2, p.o.height / 2, 0); // a lap a zsanértól a helyi x tengely mentén
      const pivot = new THREE.Group();
      const hinge = p.o.hinge === "end" ? seg.b : seg.a, other = p.o.hinge === "end" ? seg.a : seg.b;
      pivot.position.set(hinge[0], 0, hinge[1]);
      pivot.add(leaf);
      // u: zsanértól a túlsó tok felé; s: a nyitás oldala (befelé = a helyiség felé); a lap 70°-ra nyitva
      const ul = Math.hypot(other[0] - hinge[0], other[1] - hinge[1]) || 1;
      const u = [(other[0] - hinge[0]) / ul, (other[1] - hinge[1]) / ul];
      const into = p.o.swing === "out" ? -1 : 1;
      const sd = [nin[0] * into, nin[1] * into];
      const c = Math.cos(THREE.MathUtils.degToRad(70)), sn = Math.sin(THREE.MathUtils.degToRad(70));
      const v = [u[0] * c + sd[0] * sn, u[1] * c + sd[1] * sn];
      pivot.rotation.y = Math.atan2(-v[1], v[0]); // helyi x → világ (v.x, v.z)
      pivot.userData = { kind: "door" };
      group.add(pivot);
    }
  }

  // padló + mennyezet
  const floors = new Map<string, THREE.Mesh>();
  for (const room of plan.rooms) {
    const shape = new THREE.Shape(room.polygon.map(([x, y]) => new THREE.Vector2(x, -y)));
    const outdoor = OUTDOOR_KINDS.includes(room.kind);
    const floor = new THREE.Mesh(new THREE.ShapeGeometry(shape), outdoor ? outdoorMat : floorMat);
    floor.rotation.x = -Math.PI / 2; // (x, -y) síkból a vízszintes (x, z) síkba
    floor.receiveShadow = true;
    floor.userData = { kind: "floor", roomId: room.id };
    group.add(floor); floors.set(room.id, floor);
    if (!outdoor) {
      const ceil = new THREE.Mesh(new THREE.ShapeGeometry(shape), ceilMat);
      ceil.rotation.x = -Math.PI / 2;
      ceil.position.y = H;
      ceil.userData = { kind: "ceiling", roomId: room.id };
      group.add(ceil);
    }
  }
  return { group, walls, floors, slabs };
}

// ---------------------------------------------------------------------------
// MÉRETPONTOSSÁG — a KÉSZ modellen mérünk (sugárvetés a falakra + a padlóháló területe), nem a JSON-on
// ---------------------------------------------------------------------------
export type RoomMeasure = {
  roomId: string;
  name: string;
  /** a padlóháló területe vs. a terv területe (m²) */
  floorArea: number; planArea: number;
  /** sugárvetéssel mért tiszta szélesség / mélység vs. a tervből számolt (m); null = nyitott határ miatt nem mérhető */
  width: { model: number; plan: number } | null;
  depth: { model: number; plan: number } | null;
  /** a legnagyobb eltérés milliméterben */
  maxErrorMm: number;
};

function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Egy belső pont (a súlypont, ha bent van; különben a legnagyobb téglalap-sáv közepe). */
function interiorPoint(room: Room): Pt {
  const c: Pt = [room.polygon.reduce((s, p) => s + p[0], 0) / room.polygon.length, room.polygon.reduce((s, p) => s + p[1], 0) / room.polygon.length];
  if (pointInPolygon(c, room.polygon)) return c;
  for (let i = 0; i < room.polygon.length; i++) {
    const a = room.polygon[i], b = room.polygon[(i + 1) % room.polygon.length];
    const n = inward(a, b);
    const q: Pt = [(a[0] + b[0]) / 2 + n[0] * 0.3, (a[1] + b[1]) / 2 + n[1] * 0.3];
    if (pointInPolygon(q, room.polygon)) return q;
  }
  return room.polygon[0];
}

/** A p pontból d irányban a helyiség határáig mért távolság és a határoló él indexe (analitikusan, a tervből). */
function toBoundary(room: Room, p: Pt, d: Pt): { dist: number; edge: number } | null {
  let best: { dist: number; edge: number } | null = null;
  for (let i = 0; i < room.polygon.length; i++) {
    const a = room.polygon[i], b = room.polygon[(i + 1) % room.polygon.length];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const den = d[0] * ey - d[1] * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a[0] - p[0]) * ey - (a[1] - p[1]) * ex) / den;
    const u = ((a[0] - p[0]) * d[1] - (a[1] - p[1]) * d[0]) / den;
    if (t > 1e-6 && u >= -1e-6 && u <= 1 + 1e-6 && (!best || t < best.dist)) best = { dist: t, edge: i };
  }
  return best;
}

export function measureApartment(plan: FloorPlan, built: BuiltScene): RoomMeasure[] {
  const ray = new THREE.Raycaster();
  built.group.updateMatrixWorld(true);
  const heights = [0.45, 1.2, 2.25, Math.max(2.3, plan.ceilingHeight - 0.15)]; // több magasságban: ajtó/ablak nyílásain ne menjen át
  const shoot = (p: Pt, d: Pt): number | null => {
    let best: number | null = null;
    for (const h of heights) {
      ray.set(new THREE.Vector3(p[0], h, p[1]), new THREE.Vector3(d[0], 0, d[1]));
      const hit = ray.intersectObjects(built.walls, false)[0];
      if (hit && (best === null || hit.distance < best)) best = hit.distance;
    }
    return best;
  };
  return plan.rooms.map((room) => {
    const p = interiorPoint(room);
    const open = new Set(room.openEdges ?? []);
    const axisMeasure = (d: Pt) => {
      const f = toBoundary(room, p, d), b = toBoundary(room, p, [-d[0], -d[1]]);
      if (!f || !b || open.has(f.edge) || open.has(b.edge)) return null;
      const mf = shoot(p, d), mb = shoot(p, [-d[0], -d[1]]);
      if (mf === null || mb === null) return null;
      return { model: Math.round((mf + mb) * 1000) / 1000, plan: Math.round((f.dist + b.dist) * 1000) / 1000 };
    };
    const width = axisMeasure([1, 0]), depth = axisMeasure([0, 1]);
    const geo = built.floors.get(room.id)!.geometry;
    const pos = geo.getAttribute("position"), idx = geo.getIndex();
    let fa = 0;
    const tri = (i: number, j: number, k: number) => {
      const ax = pos.getX(i), ay = pos.getY(i), bx = pos.getX(j), by = pos.getY(j), cx = pos.getX(k), cy = pos.getY(k);
      fa += Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;
    };
    if (idx) for (let t = 0; t < idx.count; t += 3) tri(idx.getX(t), idx.getX(t + 1), idx.getX(t + 2));
    const planArea = polygonArea(room.polygon);
    const errs = [width, depth].filter(Boolean).map((m) => Math.abs(m!.model - m!.plan) * 1000);
    return {
      roomId: room.id, name: room.name,
      floorArea: Math.round(fa * 100) / 100, planArea: Math.round(planArea * 100) / 100,
      width, depth, maxErrorMm: Math.round(Math.max(0, ...errs)),
    };
  });
}
