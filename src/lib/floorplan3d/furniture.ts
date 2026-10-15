// Berendezés leírása (3. lépés, F3b) — tiszta függvények, three.js nélkül (gépen is tesztelhető).
// Egy bútor = típus + közép (alaprajzi x, y, méter) + elforgatás + méret + anyagok. Ugyanezt a formát adja az építő (F3c).
// Elforgatás (rot, fok): 0 → a bútor ELEJE +y felé néz (alaprajzon „lefelé"); helyi (lx, ly) → alaprajz:
//   (x + lx·cosθ − ly·sinθ,  y + lx·sinθ + ly·cosθ). Helyi x = szélesség, helyi y = mélység (hát −d/2, eleje +d/2).
// A szabályalapú alap-elrendezés (livingRoomLayout) az építő kiindulópontja és tartaléka.
import type { FloorPlan, Pt, Room } from "@/lib/floorplan3d/plan";
import { openingSegment, roomEdge } from "@/lib/floorplan3d/geometry";

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
export const FURNITURE_DEFAULTS: Record<FurnitureType, { w: number; d: number; h: number; label: string; materials: FurnitureMaterials }> = {
  sofa: { w: 2.2, d: 0.9, h: 0.72, label: "Alacsony lenkanapé", materials: { body: "light_oak_matte", upholstery: "linen" } },
  armchair: { w: 0.78, d: 0.8, h: 0.72, label: "Buklé fotel", materials: { body: "light_oak_matte", upholstery: "boucle" } },
  coffee_table: { w: 1.1, d: 0.6, h: 0.36, label: "Tölgy dohányzóasztal", materials: { body: "light_oak_matte" } },
  side_table: { w: 0.45, d: 0.45, h: 0.5, label: "Kisasztal", materials: { body: "light_oak_matte" } },
  shelf: { w: 1.2, d: 0.35, h: 1.6, label: "Nyitott tölgypolc", materials: { body: "light_oak_matte", accent: "ceramic" } },
  sideboard: { w: 1.6, d: 0.42, h: 0.55, label: "Alacsony komód", materials: { body: "light_oak_matte" } },
  rug: { w: 2.4, d: 1.7, h: 0.012, label: "Egyszínű szőnyeg", materials: { upholstery: "wool_rug" } },
  pendant_lamp: { w: 0.55, d: 0.55, h: 0.4, label: "Rizspapír függőlámpa", materials: { accent: "rice_paper" } },
  floor_lamp: { w: 0.4, d: 0.4, h: 1.5, label: "Lenbúrás állólámpa", materials: { body: "black_metal", accent: "linen" } },
  plant: { w: 0.55, d: 0.55, h: 1.3, label: "Nagy növény", materials: { body: "ceramic" } },
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
