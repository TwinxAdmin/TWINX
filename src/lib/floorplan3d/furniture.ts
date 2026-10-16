// Berendezés leírása (3. lépés, F3b) — tiszta függvények, three.js nélkül (gépen is tesztelhető).
// Egy bútor = típus + közép (alaprajzi x, y, méter) + elforgatás + méret + anyagok. Ugyanezt a formát adja az építő (F3c).
// Elforgatás (rot, fok): 0 → a bútor ELEJE +y felé néz (alaprajzon „lefelé"); helyi (lx, ly) → alaprajz:
//   (x + lx·cosθ − ly·sinθ,  y + lx·sinθ + ly·cosθ). Helyi x = szélesség, helyi y = mélység (hát −d/2, eleje +d/2).
// A szabályalapú alap-elrendezés (livingRoomLayout) az építő kiindulópontja és tartaléka.
import type { FloorPlan, Pt, Room } from "@/lib/floorplan3d/plan";
import { openingSegment, roomEdge } from "@/lib/floorplan3d/geometry";
import { catalogModel } from "@/lib/floorplan3d/catalog";

export const FURNITURE_TYPES = [
  "sofa", "armchair", "coffee_table", "side_table", "shelf", "sideboard", "rug", "pendant_lamp", "floor_lamp", "plant",
] as const;
export type FurnitureType = (typeof FURNITURE_TYPES)[number];

/** Anyag-szerepek → anyagkönyvtári nevek (materials.ts). */
export type FurnitureMaterials = { body?: string; upholstery?: string; accent?: string };

export type FurnitureItem = {
  id: string;
  type: FurnitureType;
  x: number; y: number;
  rot: number;
  w: number; d: number; h: number;
  materials?: FurnitureMaterials;
  /** padlón áll (false: függ, pl. lámpa) — az ütközésvizsgálat a padlón állókra vonatkozik */
  label?: string;
};

/** Szabványos méretek (m) — japandi: alacsony, egyenes vonalú. */
/** Alapméretek (m) és feliratok. A katalógusos típusoknál (catalog.ts) a méret a 3D-modell VALÓS mérete — rögzített.
 *  (2026-10-16: a berendezésből a stílus egyelőre kimaradt → semleges, modern bútorok; a kódos kanapé és szőnyeg marad.) */
export const FURNITURE_DEFAULTS: Record<FurnitureType, { w: number; d: number; h: number; label: string; materials: FurnitureMaterials }> = {
  sofa: { w: 2.2, d: 0.9, h: 0.75, label: "Kanapé", materials: { body: "light_oak_matte", upholstery: "linen" } },
  armchair: { w: 0.82, d: 0.99, h: 1.02, label: "Fotel", materials: {} },
  coffee_table: { w: 1.2, d: 0.6, h: 0.39, label: "Dohányzóasztal", materials: {} },
  side_table: { w: 0.55, d: 0.45, h: 0.55, label: "Kisasztal", materials: {} },
  shelf: { w: 1.08, d: 0.37, h: 1.56, label: "Polc", materials: {} },
  sideboard: { w: 2.44, d: 0.52, h: 0.68, label: "Komód", materials: {} },
  rug: { w: 2.4, d: 1.7, h: 0.012, label: "Szőnyeg", materials: { upholstery: "wool_rug" } },
  pendant_lamp: { w: 0.43, d: 0.43, h: 0.95, label: "Mennyezeti lámpa", materials: {} },
  floor_lamp: { w: 0.4, d: 0.4, h: 1.5, label: "Állólámpa", materials: { body: "black_metal", accent: "linen" } },
  plant: { w: 0.7, d: 0.66, h: 0.84, label: "Növény", materials: {} },
};

/** Ezek nem foglalnak padlót az ütközésvizsgálatban (a szőnyeg alá-fölé lehet tenni, a lámpa lóg). */
const NON_BLOCKING: FurnitureType[] = ["rug", "pendant_lamp"];

/** A bútor alaprajzi körvonala (4 sarok). */
export function footprint(it: Pick<FurnitureItem, "x" | "y" | "rot" | "w" | "d">): Pt[] {
  const t = (it.rot * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([a, b]) => {
    const lx = (a * it.w) / 2, ly = (b * it.d) / 2;
    return [it.x + lx * c - ly * s, it.y + lx * s + ly * c] as Pt;
  });
}

// ---------------------------------------------------------------------------
// ELLENŐRZÉS — bent van-e, nem takar-e ajtót, nem ütközik-e (a kritikus és az építő is ezt használja)
// ---------------------------------------------------------------------------
function inside(p: Pt, poly: Pt[]): boolean {
  let r = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) r = !r;
  }
  return r;
}

/** Két konvex sokszög átfedése (szeparáló tengely). */
function overlap(a: Pt[], b: Pt[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const n = [q[1] - p[1], p[0] - q[0]];
      const pa = a.map((v) => v[0] * n[0] + v[1] * n[1]), pb = b.map((v) => v[0] * n[0] + v[1] * n[1]);
      if (Math.max(...pa) <= Math.min(...pb) + 1e-6 || Math.max(...pb) <= Math.min(...pa) + 1e-6) return false;
    }
  }
  return true;
}

export type WallOpening = { edge: number; from: number; to: number; kind: "door" | "window"; sill: number };

/** A helyiség falain lévő nyílások (a saját nyílászárói + a szomszédé, ha a közös falon van), élenkénti szakaszként. */
export function roomOpenings(plan: FloorPlan, room: Room): WallOpening[] {
  const out: WallOpening[] = [];
  for (const o of plan.openings) {
    const owner = plan.rooms.find((r) => r.id === o.roomId);
    if (!owner) continue;
    const s = openingSegment(owner, o);
    if (!s.axis) continue;
    const k = s.axis === "x" ? 0 : 1, q = 1 - k;
    for (let i = 0; i < room.polygon.length; i++) {
      const e = roomEdge(room, i);
      if (e.axis !== s.axis || Math.abs(e.a[q] - s.center[q]) > 0.5) continue;
      const lo = Math.min(e.a[k], e.b[k]), hi = Math.max(e.a[k], e.b[k]);
      const from = Math.max(lo, Math.min(s.a[k], s.b[k])), to = Math.min(hi, Math.max(s.a[k], s.b[k]));
      if (to - from < 0.05) continue;
      // az él elejétől mért szakasz
      const dir = e.b[k] >= e.a[k] ? 1 : -1;
      const f = dir > 0 ? from - e.a[k] : e.a[k] - to, t = dir > 0 ? to - e.a[k] : e.a[k] - from;
      out.push({ edge: i, from: f, to: t, kind: o.kind, sill: o.sill });
    }
  }
  return out;
}

/** Az ajtók előtti szabad sáv (ajtószélesség × 0,9 m a helyiség felé) — ide nem kerülhet padlón álló bútor. */
export function doorZones(plan: FloorPlan, room: Room): Pt[][] {
  return roomOpenings(plan, room).filter((o) => o.kind === "door").map((o) => {
    const e = roomEdge(room, o.edge), len = e.length || 1;
    const u = [(e.b[0] - e.a[0]) / len, (e.b[1] - e.a[1]) / len], n = [-u[1], u[0]];
    const at = (t: number, dd: number): Pt => [e.a[0] + u[0] * t + n[0] * dd, e.a[1] + u[1] * t + n[1] * dd];
    return [at(o.from - 0.05, 0), at(o.to + 0.05, 0), at(o.to + 0.05, 0.9), at(o.from - 0.05, 0.9)];
  });
}

export type LayoutIssue = { itemId: string; text: string };

/** A berendezés ellenőrzése: helyiségen belül · ajtósávon kívül · nem ütközik (szőnyeg, függőlámpa kivétel). */
export function checkLayout(plan: FloorPlan, room: Room, items: FurnitureItem[]): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  const zones = doorZones(plan, room);
  const fps = items.map((it) => footprint(it));
  items.forEach((it, i) => {
    const fp = fps[i];
    if (!fp.every((p) => inside(p, room.polygon))) issues.push({ itemId: it.id, text: `${it.label ?? it.type}: kilóg a helyiségből.` });
    if (NON_BLOCKING.includes(it.type)) return;
    if (zones.some((z) => overlap(fp, z))) issues.push({ itemId: it.id, text: `${it.label ?? it.type}: elzárja egy ajtó előtti szabad sávot.` });
    items.forEach((other, j) => {
      if (j <= i || NON_BLOCKING.includes(other.type)) return;
      if (overlap(fp, fps[j])) issues.push({ itemId: it.id, text: `${it.label ?? it.type} ütközik ezzel: ${other.label ?? other.type}.` });
    });
  });
  return issues;
}

// ---------------------------------------------------------------------------
// SZABÁLYALAPÚ ALAP-ELRENDEZÉS — nappali (az építő kiindulópontja / tartaléka)
// ---------------------------------------------------------------------------
type Slot = { edge: number; from: number; to: number; len: number };

/** Egy fal ajtómentes szakaszai (ablak alá alacsony bútor mehet, ha a parapet ≥ maxHeight). */
function freeSlots(plan: FloorPlan, room: Room, maxHeight: number): Slot[] {
  const ops = roomOpenings(plan, room);
  const open = new Set(room.openEdges ?? []);
  const slots: Slot[] = [];
  room.polygon.forEach((_, i) => {
    if (open.has(i)) return;
    const e = roomEdge(room, i);
    if (!e.axis) return;
    const blockers = ops.filter((o) => o.edge === i && (o.kind === "door" || o.sill < maxHeight + 0.05))
      .map((o) => [o.from - (o.kind === "door" ? 0.15 : 0.05), o.to + (o.kind === "door" ? 0.15 : 0.05)] as const)
      .sort((a, b) => a[0] - b[0]);
    let cur = 0.1; // 10 cm a saroktól
    for (const [a, b] of blockers) {
      if (a - cur > 0.3) slots.push({ edge: i, from: cur, to: a, len: a - cur });
      cur = Math.max(cur, b);
    }
    if (e.length - 0.1 - cur > 0.3) slots.push({ edge: i, from: cur, to: e.length - 0.1, len: e.length - 0.1 - cur });
  });
  return slots.sort((a, b) => b.len - a.len);
}

/** Bútor a fal mellé: háttal a falnak, a szakasz közepén (vagy a megadott helyen), befelé nézve. */
function againstWall(room: Room, slot: Slot, type: FurnitureType, along?: number, gap = 0.04): FurnitureItem {
  const def = FURNITURE_DEFAULTS[type];
  const e = roomEdge(room, slot.edge), len = e.length || 1;
  const u = [(e.b[0] - e.a[0]) / len, (e.b[1] - e.a[1]) / len], n = [-u[1], u[0]]; // n: befelé
  const w = Math.min(def.w, slot.len);
  const t = along ?? (slot.from + slot.to) / 2;
  const c: Pt = [e.a[0] + u[0] * t + n[0] * (def.d / 2 + gap), e.a[1] + u[1] * t + n[1] * (def.d / 2 + gap)];
  const rot = (Math.atan2(-n[0], n[1]) * 180) / Math.PI; // az eleje (helyi +y) a befelé mutató n irányába
  return { id: `${type}_${Math.random().toString(36).slice(2, 7)}`, type, x: c[0], y: c[1], rot, w, d: def.d, h: def.h, materials: def.materials, label: def.label };
}

const r2 = (v: number) => Math.round(v * 1000) / 1000;
const tidy = (it: FurnitureItem): FurnitureItem => ({ ...it, x: r2(it.x), y: r2(it.y), rot: Math.round(it.rot * 10) / 10 });

/**
 * Nappali alap-elrendezése: kanapé a leghosszabb ajtómentes falnál (ablak alá is mehet, ha a parapet magasabb a háttámlánál),
 * előtte dohányzóasztal és szőnyeg, a kanapé mellett fotel, nyitott polc egy másik falnál, függőlámpa az asztal fölött,
 * növény a kanapé melletti sarokba. Amit nem lehet szabályosan elhelyezni, azt kihagyja (és jelzi).
 */
export function livingRoomLayout(plan: FloorPlan, room: Room): { items: FurnitureItem[]; skipped: string[] } {
  const items: FurnitureItem[] = [];
  const skipped: string[] = [];
  /** Egy bútor felvétele, ha szabályos; különben a hiba szövege (a hívó dönti el, jelzi-e). */
  const place = (it: FurnitureItem | null): string | null => {
    if (!it) return "nincs hely";
    const bad = checkLayout(plan, room, [...items, it]).filter((x) => x.itemId === it.id);
    if (bad.length) return bad[0].text;
    items.push(tidy(it)); return null;
  };
  const tryAdd = (it: FurnitureItem | null, why: string) => { const err = place(it); if (err) skipped.push(`${why} (${err})`); return !err; };
  /** Több jelölt közül az első, ami elfér; ha egyik sem, egyetlen jelzés. */
  const tryFirst = (cands: FurnitureItem[], why: string) => {
    let last = "nincs hely";
    for (const c of cands) { const err = place(c); if (!err) return true; last = err; }
    skipped.push(`${why} (${last})`); return false;
  };

  const slots = freeSlots(plan, room, FURNITURE_DEFAULTS.sofa.h);
  const sofaSlot = slots.find((s) => s.len >= 1.6);
  if (!sofaSlot || !tryAdd(againstWall(room, sofaSlot, "sofa"), "Kanapé: nincs elég hosszú ajtómentes fal")) return { items, skipped };
  const sofa = items[0];
  const t = (sofa.rot * Math.PI) / 180, fwd: Pt = [-Math.sin(t), Math.cos(t)], side: Pt = [Math.cos(t), Math.sin(t)];
  const at = (f: number, s: number): [number, number] => [sofa.x + fwd[0] * f + side[0] * s, sofa.y + fwd[1] * f + side[1] * s];

  // dohányzóasztal a kanapé előtt (45 cm térköz), szőnyeg alatta
  const ct = FURNITURE_DEFAULTS.coffee_table;
  const [cx, cy] = at(sofa.d / 2 + 0.45 + ct.d / 2, 0);
  tryAdd({ id: "coffee_table_1", type: "coffee_table", x: cx, y: cy, rot: sofa.rot, w: ct.w, d: ct.d, h: ct.h, materials: ct.materials, label: ct.label }, "Dohányzóasztal");
  const rug = FURNITURE_DEFAULTS.rug;
  const [rx, ry] = at(sofa.d / 2 + 0.55, 0);
  tryAdd({ id: "rug_1", type: "rug", x: rx, y: ry, rot: sofa.rot, w: Math.min(rug.w, sofa.w + 0.4), d: rug.d, h: rug.h, materials: rug.materials, label: rug.label }, "Szőnyeg");

  // fotel az asztal egyik oldalán, az asztal felé fordítva (amelyik oldalon elfér)
  const ac = FURNITURE_DEFAULTS.armchair;
  tryFirst([1, -1].map((sgn) => {
    const [ax, ay] = at(sofa.d / 2 + 0.45 + ct.d / 2, sgn * (ct.w / 2 + 0.45 + ac.w / 2));
    return { id: "armchair_1", type: "armchair" as const, x: ax, y: ay, rot: sofa.rot + sgn * 90, w: ac.w, d: ac.d, h: ac.h, materials: ac.materials, label: ac.label };
  }), "Fotel");

  // nyitott polc egy másik falnál (nem a kanapéén), ablakmentes szakaszon
  const shelfSlot = freeSlots(plan, room, FURNITURE_DEFAULTS.shelf.h).find((s) => s.edge !== sofaSlot.edge && s.len >= 0.9);
  tryAdd(shelfSlot ? againstWall(room, shelfSlot, "shelf") : null, "Polc: nincs ablak- és ajtómentes falszakasz");

  // növény a kanapé végénél, a fal mellett
  const pl = FURNITURE_DEFAULTS.plant;
  tryFirst([-1, 1].map((sgn) => {
    const [px, py] = at(-sofa.d / 2 + pl.d / 2 + 0.02, sgn * (sofa.w / 2 + 0.1 + pl.w / 2));
    return { id: "plant_1", type: "plant" as const, x: px, y: py, rot: sofa.rot, w: pl.w, d: pl.d, h: pl.h, materials: pl.materials, label: pl.label };
  }), "Növény");

  // függőlámpa az asztal fölött (nem foglal padlót)
  const pd = FURNITURE_DEFAULTS.pendant_lamp;
  tryAdd({ id: "pendant_1", type: "pendant_lamp", x: cx, y: cy, rot: 0, w: pd.w, d: pd.d, h: pd.h, materials: pd.materials, label: pd.label }, "Függőlámpa");

  return { items, skipped };
}

// ---------------------------------------------------------------------------
// EGYSZERŰ BERENDEZÉS a többi helyiségbe (4. lépés, 2026-10-16) — „pár bútor", hogy a bejárás ne üres terekben menjen.
// Szabályalapú, ingyenes (nincs AI-hívás), CSAK a meglévő katalógusból; a katalógus bővítése később (ágy, étkezőasztal, konyha…).
// Minden bútor fal mellé kerül; ami nem szabályos (ütközés, ajtósáv) vagy elzárná a közlekedőutat, kimarad.
// ---------------------------------------------------------------------------
// Függőlámpa NEM kerül ide: a katalógusmodell 95 cm-t lóg (alja ~1,65 m) — közlekedőben szemmagasságba ér; csak asztal fölé való.
const BASIC_SETS: Partial<Record<Room["kind"], FurnitureType[]>> = {
  haloszoba: ["sideboard", "armchair", "plant"],
  gyerekszoba: ["shelf", "armchair", "plant"],
  dolgozoszoba: ["shelf", "armchair", "plant"],
  etkezo: ["sideboard", "plant"],
  eloszoba: ["side_table", "plant"],
  konyha: ["plant"],
  terasz: ["armchair", "plant"],
  egyeb: ["plant"],
};

export function basicRoomLayout(plan: FloorPlan, room: Room): FurnitureItem[] {
  const set = BASIC_SETS[room.kind];
  if (!set) return [];
  const items: FurnitureItem[] = [];
  const baseWalk = walkwayIssues(plan, room, []).length;
  const ok = (it: FurnitureItem) => {
    const next = [...items, it];
    return checkLayout(plan, room, next).every((x) => x.itemId !== it.id) && walkwayIssues(plan, room, next).length <= baseWalk;
  };
  const used = new Set<number>(); // falanként egy nagyobb bútor (ne zsúfolódjon)
  for (const type of set) {
    const def = FURNITURE_DEFAULTS[type];
    const slots = freeSlots(plan, room, def.h).filter((s) => s.len >= def.w + 0.05);
    const small = type === "plant" || type === "side_table";
    let placed = false;
    for (const s of [...slots.filter((x) => !used.has(x.edge)), ...slots.filter((x) => used.has(x.edge))]) {
      // kis bútor a szakasz végére (sarokba), nagy a közepére; mindkét irány próbálva
      const alongs = small ? [s.from + def.w / 2 + 0.05, s.to - def.w / 2 - 0.05] : [(s.from + s.to) / 2, s.from + def.w / 2 + 0.05, s.to - def.w / 2 - 0.05];
      for (const t of alongs) {
        const it = { ...againstWall(room, s, type, t), id: `${type}_${room.id}` };
        if (ok(it)) { items.push(tidy(it)); if (!small) used.add(s.edge); placed = true; break; }
      }
      if (placed) break;
    }
  }
  return items;
}

/** A TELJES lakás berendezése (a stúdió és a megosztott link is ezt mutatja — ugyanaz a bútor mindkettőn):
 *  helyiségenként a mentett berendezés, ha van; a nappaliban különben a szabályalapú alap-elrendezés; a többiben a „pár bútor". */
export function apartmentFurniture(plan: FloorPlan, furnishing: Record<string, { items?: FurnitureItem[] } | undefined> | null | undefined): FurnitureItem[] {
  const out: FurnitureItem[] = [];
  for (const r of plan.rooms) {
    const saved = furnishing?.[r.id]?.items;
    if (saved?.length) out.push(...saved);
    else if (r.kind === "nappali") out.push(...livingRoomLayout(plan, r).items);
    else out.push(...basicRoomLayout(plan, r));
  }
  return out;
}

// ---------------------------------------------------------------------------
// KÖZLEKEDŐÚT — a helyiség bejáratai (ajtók + nyitott határok) a bútorok között is összeérjenek, legalább ~80 cm széles úton
// ---------------------------------------------------------------------------
const PATH_GRID = 0.1;        // rács (m)
const CLEAR_FURNITURE = 0.4;  // a bútoroktól (az út fele: 2 × 0,4 = 0,8 m)
const CLEAR_WALL = 0.3;       // a falaktól (a test elfér a fal mellett)

function distSeg(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function distPoly(p: Pt, poly: Pt[]): number {
  if (inside(p, poly)) return 0;
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) d = Math.min(d, distSeg(p, poly[i], poly[(i + 1) % poly.length]));
  return d;
}

/** A bejáratok „belépési pontjai": az ajtók és a nyitott határok közepe, 45 cm-rel a helyiség belseje felé. */
export function entrances(plan: FloorPlan, room: Room): { label: string; p: Pt }[] {
  const out: { label: string; p: Pt }[] = [];
  const inward = (edge: number, t: number): Pt => {
    const e = roomEdge(room, edge), len = e.length || 1;
    const u = [(e.b[0] - e.a[0]) / len, (e.b[1] - e.a[1]) / len], n = [-u[1], u[0]];
    return [e.a[0] + u[0] * t + n[0] * 0.45, e.a[1] + u[1] * t + n[1] * 0.45];
  };
  for (const o of roomOpenings(plan, room)) if (o.kind === "door") out.push({ label: "ajtó", p: inward(o.edge, (o.from + o.to) / 2) });
  for (const i of room.openEdges ?? []) out.push({ label: "átjáró", p: inward(i, roomEdge(room, i).length / 2) });
  return out;
}

/**
 * Közlekedőút-ellenőrzés: rácson keres utat a bejáratok között (bútoroktól ≥ 40 cm, faltól ≥ 30 cm; szőnyeg és függőlámpa
 * nem akadály). Hibát ad, ha egy bejárat elé bútor került, vagy két bejárat között nincs elég széles út.
 */
export function walkwayIssues(plan: FloorPlan, room: Room, items: FurnitureItem[]): string[] {
  const ents = entrances(plan, room);
  if (!ents.length) return [];
  const blockers = items.filter((it) => !NON_BLOCKING.includes(it.type)).map((it) => footprint(it));
  const xs = room.polygon.map((p) => p[0]), ys = room.polygon.map((p) => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const nx = Math.ceil((Math.max(...xs) - x0) / PATH_GRID) + 1, ny = Math.ceil((Math.max(...ys) - y0) / PATH_GRID) + 1;
  const free = (p: Pt) => inside(p, room.polygon)
    && room.polygon.every((_, i) => distSeg(p, room.polygon[i], room.polygon[(i + 1) % room.polygon.length]) >= CLEAR_WALL)
    && blockers.every((fp) => distPoly(p, fp) >= CLEAR_FURNITURE);
  const cell = (p: Pt): [number, number] => [Math.round((p[0] - x0) / PATH_GRID), Math.round((p[1] - y0) / PATH_GRID)];
  const ok = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) ok[j * nx + i] = free([x0 + i * PATH_GRID, y0 + j * PATH_GRID]) ? 1 : 0;

  const issues: string[] = [];
  // a belépési pont közvetlen környezetében (≤ 25 cm) legyen szabad cella
  const startCells = ents.map((e) => {
    const [ci, cj] = cell(e.p);
    for (let r = 0; r <= 2; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const i = ci + di, j = cj + dj;
      if (i >= 0 && j >= 0 && i < nx && j < ny && ok[j * nx + i]) return j * nx + i;
    }
    issues.push(`Egy ${e.label} elé bútor került (nincs 80 cm szabad hely a bejáratnál).`);
    return -1;
  });
  const valid = startCells.filter((c) => c >= 0);
  if (valid.length < 2) return issues;
  // szélességi keresés az első bejárattól
  const seen = new Uint8Array(nx * ny);
  const queue = [valid[0]];
  seen[valid[0]] = 1;
  while (queue.length) {
    const c = queue.shift()!;
    const i = c % nx, j = (c - i) / nx;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
      const k = b * nx + a;
      if (!seen[k] && ok[k]) { seen[k] = 1; queue.push(k); }
    }
  }
  startCells.forEach((c, idx) => {
    if (c >= 0 && !seen[c]) issues.push(`Nincs 80 cm széles közlekedőút a(z) ${ents[idx].label} és a többi bejárat között.`);
  });
  return issues;
}

// ---------------------------------------------------------------------------
// SZERKEZETI ELLENŐRZÉS — az építőtől (vagy a klienstől) érkező bútorlista. Ismeretlen típus kimarad; a méret a szabványos
// méret ±40%-án belülre szorul (a stíluslap arányai ne torzuljanak); legfeljebb 30 bútor helyiségenként.
// ---------------------------------------------------------------------------
export const FURNITURE_SIZE_RANGE = 0.4;
const TYPE_SET = new Set<string>(FURNITURE_TYPES);

export function sanitizeItems(raw: unknown): FurnitureItem[] {
  if (!Array.isArray(raw)) return [];
  const out: FurnitureItem[] = [];
  for (const r of raw.slice(0, 30) as Record<string, unknown>[]) {
    if (!r || !TYPE_SET.has(String(r.type))) continue;
    const type = r.type as FurnitureType, def = FURNITURE_DEFAULTS[type];
    const n = (v: unknown, fb: number) => (typeof v === "number" && Number.isFinite(v) ? v : fb);
    const clamp = (v: number, base: number) => Math.min(base * (1 + FURNITURE_SIZE_RANGE), Math.max(base * (1 - FURNITURE_SIZE_RANGE), v));
    const x = n(r.x, NaN), y = n(r.y, NaN);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    out.push({
      id: typeof r.id === "string" && r.id ? r.id.slice(0, 40) : `${type}_${out.length + 1}`,
      type, x: r2(x), y: r2(y), rot: Math.round((((n(r.rot, 0) % 360) + 360) % 360) * 10) / 10,
      // katalógusos (valódi 3D-modell): a méret RÖGZÍTETT — a modell valós mérete (méretarányosság); kódos bútor: ±40%
      ...(catalogModel(type) ? { w: def.w, d: def.d, h: def.h }
        : { w: r2(clamp(n(r.w, def.w), def.w)), d: r2(clamp(n(r.d, def.d), def.d)), h: r2(clamp(n(r.h, def.h), def.h)) }),
      materials: def.materials, label: def.label,
    });
  }
  return out;
}
