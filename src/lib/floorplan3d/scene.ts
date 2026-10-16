// 3D-alap (2. lépés): a lakásleírásból (FloorPlan, méter) berendezetlen, méretpontos three.js-jelenet.
// Koordináták: alaprajz (x, y) → three (x, z); a magasság a three y tengelye. 1 egység = 1 méter.
//   • falak: minden NEM nyitott helyiség-élre egy falszelet kifelé — vastagsága a szemközti szomszéd helyiségig tartó rés
//     (ha ≤ 50 cm), különben a konfigurált külső falvastagság; a domború sarkokat a szeletek meghosszabbítása zárja;
//   • nyílászárók: minden falszeletből kivágódnak, amelyen áthaladnak (a két szomszéd oldalán is);
//   • padló minden helyiségben, mennyezet a beltéri helyiségekben (a terasz nyitott).
// A geometria SOHA nem a stílusból jön — a stílus később csak anyagot és berendezést ad (szabály).
import * as THREE from "three";
import type { FloorPlan, Opening, Pt, Room } from "@/lib/floorplan3d/plan";
import { OUTDOOR_KINDS, leavesOf } from "@/lib/floorplan3d/plan";
import { doorClosed, openingSegment, polygonArea, roomEdge } from "@/lib/floorplan3d/geometry";

export type SceneOptions = { interiorWall: number; exteriorWall: number };

const MAX_GAP = 0.5;   // ennél nagyobb rés már nem fal két helyiség között, hanem külső fal + külső tér
const EPS = 0.01;
const TOUCH_WALL = 0.06; // összeérő (nem nyitott) helyiségek közé épülő legvékonyabb válaszfal

/** Egy falszelet alaprajzi leírása (a méréshez és a hibakereséshez is). */
type Slab = { axis: "x" | "y"; line: number; outward: 1 | -1; from: number; to: number; thickness: number; roomId: string; edge: number };

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
      const facing: { from: number; to: number; gap: number; open: boolean }[] = [];
      for (const other of plan.rooms) {
        if (other.id === room.id) continue;
        for (let j = 0; j < other.polygon.length; j++) {
          const f = roomEdge(other, j);
          if (f.axis !== e.axis) continue;
          const gap = (f.a[o] - line) * outward;
          if (gap < -EPS || gap > MAX_GAP) continue;
          const flo = Math.max(lo, Math.min(f.a[k], f.b[k])), fhi = Math.min(hi, Math.max(f.a[k], f.b[k]));
          // open: a szomszéd ezt a határt NYITOTTNAK jelölte (pl. közlekedő → előtér) — akkor ezen az oldalon sem épül fal
          if (fhi - flo > EPS) facing.push({ from: flo, to: fhi, gap: Math.max(gap, 0), open: (other.openEdges ?? []).includes(j) });
        }
      }
      // szakaszolás a szomszédok határainál; minden szakaszra a legkisebb rés (vagy külső fal)
      const cuts = [...new Set([lo, hi, ...facing.flatMap((f) => [f.from, f.to])])].sort((a, b) => a - b);
      const segs: { from: number; to: number; cover: typeof facing }[] = [];
      for (let c = 0; c < cuts.length - 1; c++) {
        const from = cuts[c], to = cuts[c + 1];
        if (to - from < EPS) continue;
        const mid = (from + to) / 2;
        segs.push({ from, to, cover: facing.filter((f) => f.from <= mid && f.to >= mid) });
      }
      const axis = e.axis; // (a zárt függvényben is szűkített típus)
      segs.forEach((g, gi) => {
        const { from, to, cover } = g;
        if (cover.some((f) => f.open)) return; // a szemközti oldal nyitott határ → itt sincs fal (nem marad „fal-csonk")
        let thickness = cover.length ? Math.min(...cover.map((f) => f.gap)) : opts.exteriorWall;
        // rövid, szomszéd nélküli rés KÉT fedett szakasz között (falcsatlakozás, pl. két helyiség közti 9 cm): nem külső fal,
        // hanem a két szomszédos falvastagság nagyobbika — különben 30 cm-es csonk lógna a csatlakozásba (2026-10-16, Tábornok 27.)
        // ugyanez a fal VÉGÉN (a sarkánál) lévő rövid, fedetlen szakaszra is: a szomszédos fedett szakasz vastagsága — különben a
        // 30 cm-es csonk belelóg a szomszéd ajtajába (2026-10-16, Tábornok 27. eredeti piszkozata: a közlekedőajtó beszűkült)
        if (!cover.length && to - from < MAX_GAP) {
          const prev = segs[gi - 1], next = segs[gi + 1];
          const th = [prev, next].filter((g) => g?.cover.length).map((g) => Math.min(...g!.cover.map((f) => f.gap)));
          if (th.length) thickness = Math.max(...th);
        }
        if (thickness < TOUCH_WALL / 2) {
          // a két helyiség körvonala összeér, de a határ NEM nyitott → vékony válaszfal középre (mindkét oldalon TOUCH_WALL/2-t
          // vesz el; a méretpontosság-mérés ezt kimutatja). Nyitott határon (openEdges) ide el sem jutunk.
          slabs.push({ axis, line: line - (outward * TOUCH_WALL) / 2, outward, from, to, thickness: TOUCH_WALL, roomId: room.id, edge: i });
          return;
        }
        slabs.push({ axis, line, outward, from, to, thickness, roomId: room.id, edge: i });
      });
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

/** Ferde fal (nem tengelyirányú él): a helyiségen KÍVÜL, a sokszög élére illesztve. Nyílászáró egyelőre nem kerülhet rá
 *  (a digitalizálás és a javító sem tesz ferde falra nyílást). Vastagság: a külső fal (a ferde fal szinte mindig homlokzat).
 *  2026-10-16: eddig a ferde falnak a 3D-ben egyáltalán nem épült fal (a Tábornok 27. szobája oldalt nyitva maradt). */
export type SlantWall = { a: Pt; b: Pt; outward: Pt; thickness: number; roomId: string; edge: number };
export function slantWalls(plan: FloorPlan, opts: SceneOptions): SlantWall[] {
  const out: SlantWall[] = [];
  for (const room of plan.rooms) {
    const open = new Set(room.openEdges ?? []);
    room.polygon.forEach((_, i) => {
      if (open.has(i)) return;
      const e = roomEdge(room, i);
      if (e.axis || e.length < 0.05) return;
      const nin = inward(e.a, e.b);
      out.push({ a: e.a, b: e.b, outward: [-nin[0], -nin[1]], thickness: opts.exteriorWall, roomId: room.id, edge: i });
    });
  }
  return out;
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
    m.userData = { kind: "wall", roomId: s.roomId, edge: s.edge };
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

  // ferde falak: elforgatott tömb a helyiségen kívül (a két végén a falvastagsággal meghosszabbítva, hogy a sarok zárjon)
  for (const w of slantWalls(plan, opts)) {
    const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]), u: Pt = [(w.b[0] - w.a[0]) / len, (w.b[1] - w.a[1]) / len];
    const ext = w.thickness;
    const m = new THREE.Mesh(new THREE.BoxGeometry(len + 2 * ext, H, w.thickness), wallMat);
    m.position.set((w.a[0] + w.b[0]) / 2 + (w.outward[0] * w.thickness) / 2, H / 2, (w.a[1] + w.b[1]) / 2 + (w.outward[1] * w.thickness) / 2);
    m.rotation.y = -Math.atan2(u[1], u[0]);
    m.castShadow = true; m.receiveShadow = true;
    m.userData = { kind: "wall", roomId: w.roomId, edge: w.edge };
    group.add(m); walls.push(m);
  }

  // nyílászárók (2026-10-16): ablak kerettel / osztóval / párkánnyal · ajtó egy- vagy kétszárnyú, üvegezve kerettel ·
  // a NYITOTT ajtó 90°-ra kinyitva (nem lóg a térbe ferdén), a BECSUKOTT (closed — pl. erkélyajtó) a nyílásban;
  // a lapok forgáspontja (pivot) adatot visz, hogy a bejárás odasétáláskor ki tudja nyitni (doorPivot) · átjárónál nincs lap
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xf3efe8, roughness: 0.7 });
  const FW = 0.06; // keret szélessége
  for (const p of opens) {
    if (p.o.kind === "passage") continue;
    const room = plan.rooms.find((r) => r.id === p.o.roomId)!;
    const seg = openingSegment(room, p.o);
    const edge = roomEdge(room, p.o.edge);
    const nin = inward(edge.a, edge.b);
    const w = p.to - p.from;
    const rotY = -Math.atan2(edge.b[1] - edge.a[1], edge.b[0] - edge.a[0]);
    const double = leavesOf(p.o) === 2;
    if (p.o.kind === "window") {
      // keret + üveg (+ középső osztó) a falsík közepén, kívül párkány
      const fr = new THREE.Group();
      fr.position.set(seg.center[0] - nin[0] * 0.05, p.o.sill, seg.center[1] - nin[1] * 0.05);
      fr.rotation.y = rotY;
      const bars: [number, number, number, number][] = [[w, FW, 0, FW / 2], [w, FW, 0, p.o.height - FW / 2], [FW, p.o.height, -w / 2 + FW / 2, p.o.height / 2], [FW, p.o.height, w / 2 - FW / 2, p.o.height / 2]];
      if (double) bars.push([FW, p.o.height, 0, p.o.height / 2]);
      for (const [bw, bh, x, y] of bars) { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.06), frameMat); m.position.set(x, y, 0); m.castShadow = true; fr.add(m); }
      const glass = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.01, w - 2 * FW), Math.max(0.01, p.o.height - 2 * FW), 0.012), glassMat);
      glass.position.set(0, p.o.height / 2, 0); glass.userData = { kind: "window-glass" }; fr.add(glass);
      const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.03, 0.2), frameMat);
      sill.position.set(0, 0, 0.06); fr.add(sill);
      fr.userData = { kind: "window", openingId: p.o.id };
      group.add(fr);
      continue;
    }
    // ajtó: lapok (egy / kettő), mindegyik a saját zsanérján forog
    const into = p.o.swing === "out" ? -1 : 1;
    const sd: Pt = [nin[0] * into, nin[1] * into];
    const leaves: { hinge: Pt; other: Pt; lw: number }[] = double
      ? [{ hinge: seg.a, other: seg.center, lw: w / 2 }, { hinge: seg.b, other: seg.center, lw: w / 2 }]
      : [{ hinge: p.o.hinge === "end" ? seg.b : seg.a, other: p.o.hinge === "end" ? seg.a : seg.b, lw: w }];
    for (const { hinge, other, lw } of leaves) {
      const ul = Math.hypot(other[0] - hinge[0], other[1] - hinge[1]) || 1;
      const u: Pt = [(other[0] - hinge[0]) / ul, (other[1] - hinge[1]) / ul];
      const base = Math.atan2(-u[1], u[0]);                 // becsukva: a lap a nyílásban (helyi x → u)
      let dir = Math.atan2(-sd[1], sd[0]) - base;           // a nyitás iránya (±90°)
      dir = Math.atan2(Math.sin(dir), Math.cos(dir)) > 0 ? 1 : -1;
      const pivot = new THREE.Group();
      pivot.position.set(hinge[0], 0, hinge[1]);
      const H0 = p.o.height - 0.01, W0 = lw - 0.01;
      if (p.o.glazed) {
        // keretes üveglap (ki lehet látni rajta), középmagasságban vízszintes osztó
        for (const [bw, bh, x, y] of [[W0, FW, W0 / 2, FW / 2], [W0, FW, W0 / 2, H0 - FW / 2], [FW, H0, FW / 2, H0 / 2], [FW, H0, W0 - FW / 2, H0 / 2], [W0, FW, W0 / 2, 0.95]] as const) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.05), doorMat); m.position.set(x, y, 0); m.castShadow = true; pivot.add(m);
        }
        const g = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.01, W0 - 2 * FW), Math.max(0.01, H0 - 2 * FW), 0.012), glassMat);
        g.position.set(W0 / 2, H0 / 2, 0); g.userData = { kind: "door-glass" }; pivot.add(g);
      } else {
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(W0, H0, 0.04), doorMat);
        leaf.position.set(W0 / 2, H0 / 2, 0); leaf.castShadow = true; pivot.add(leaf);
      }
      const closed = doorClosed(plan, p.o);
      const angle = closed ? 0 : Math.PI / 2;
      pivot.rotation.y = base + dir * angle;
      pivot.userData = { kind: "door", openingId: p.o.id, doorPivot: { openingId: p.o.id, base, dir, closed, center: seg.center } };
      group.add(pivot);
    }
  }

  // tartóoszlopok: teljes belmagasságban (a méréshez nem számítanak fal-felületnek)
  for (const c of plan.columns ?? []) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(c.w, H, c.d), wallMat);
    m.position.set(c.x, H / 2, c.y); m.castShadow = true; m.receiveShadow = true;
    m.userData = { kind: "column", columnId: c.id };
    group.add(m);
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
/** Terasz / erkély MEGJELENÍTÉSE (Márk szabálya, 2026-10-16): a külső falai — amelyek túloldalán nincs beltéri helyiség — SOHA nem
 *  teljes belmagasságúak, hanem ~1 m-es mellvédek, fölöttük szabad ég; a lakás felőli homlokzatfal marad teljes magas.
 *  Csak a látványt módosítja (a méréshez külön épített modell kell — measureApartment —, az ütközés a falszeletekből számol). */
export const RAIL_HEIGHT = 1.0;
export function railOutdoorWalls(plan: FloorPlan, built: BuiltScene): void {
  const outdoorIds = new Set(plan.rooms.filter((r) => OUTDOOR_KINDS.includes(r.kind)).map((r) => r.id));
  if (!outdoorIds.size) return;
  const insidePoly = (p: Pt, poly: Pt[]) => {
    let r = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) r = !r;
    }
    return r;
  };
  const indoorAt = (p: Pt) => plan.rooms.some((r) => !OUTDOOR_KINDS.includes(r.kind) && insidePoly(p, r.polygon));
  for (const w of built.walls) {
    if (!outdoorIds.has(w.userData.roomId)) continue;
    const bb = new THREE.Box3().setFromObject(w), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
    const thinX = sz.x < sz.z, t = (thinX ? sz.x : sz.z) / 2 + 0.3;
    if (indoorAt(thinX ? [c.x - t, c.z] : [c.x, c.z - t]) || indoorAt(thinX ? [c.x + t, c.z] : [c.x, c.z + t])) continue; // homlokzat a lakás felé
    if (bb.min.y >= RAIL_HEIGHT - 0.01) { w.visible = false; continue; }
    if (bb.max.y > RAIL_HEIGHT) { w.scale.y = (RAIL_HEIGHT - bb.min.y) / sz.y; w.position.y = bb.min.y + (RAIL_HEIGHT - bb.min.y) / 2; }
  }
}

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
