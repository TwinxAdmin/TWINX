// SZERKESZTŐ-MŰVELETEK (a javító felülethez, 2026-10-16) — tiszta függvények, three.js és React nélkül (gépen tesztelhetők).
// Mindegyik ÚJ tervet ad (a régi nem változik) — így a visszavonás egyszerű pillanatképekből áll.
//   • falhúzás: tengelyirányú fal merőleges eltolása; a szomszéd helyiség szemközti fala vele mozog (a falvastagság megmarad);
//     mágnes: más falak síkjához / a falvastagságnyira lévő túloldalhoz illeszt;
//   • sarokpont: mozgatás (illesztés más pontok x/y-jához), beszúrás egy falra, törlés — az él-indexek (nyílászárók, nyitott
//     határok) KÖVETKEZETESEN átszámolva;
//   • nyílászáró: lerakás szabványos méretből, típusváltás (ajtó / üvegajtó / ablak / átjáró), mozgatás a fal mentén;
//   • oszlop: lerakás, mozgatás falhoz illesztéssel, méret.
import type { Column, FloorPlan, Opening, Pt, Room } from "@/lib/floorplan3d/plan";
import { OPENING_PRESETS, newId, type OpeningPreset } from "@/lib/floorplan3d/plan";
import { openingSegment, polygonArea, roomEdge } from "@/lib/floorplan3d/geometry";

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r2 = (n: number) => Math.round(n * 100) / 100;
const MAX_GAP = 0.5;       // ennél közelebbi párhuzamos szomszéd-él = ugyanaz a fal két oldala
export const SNAP = 0.04;  // mágnes távolsága (m)

const patchRoom = (plan: FloorPlan, id: string, f: (r: Room) => Room): FloorPlan => ({ ...plan, rooms: plan.rooms.map((r) => (r.id === id ? f(r) : r)) });
const clampOffset = (o: Opening, len: number): Opening => ({ ...o, width: Math.min(o.width, Math.max(0.3, len)), offset: r3(Math.min(Math.max(o.offset, Math.min(o.width, len) / 2), Math.max(Math.min(o.width, len) / 2, len - Math.min(o.width, len) / 2))) });
/** A falaik változása után a nyílászárók a falukon belül maradnak — CSAK a megadott (módosított) helyiségekben, hogy egy
 *  másik helyiség meglévő (pl. 1 mm-rel kilógó) nyílászárója ne változzon csendben. */
function refitOpenings(plan: FloorPlan, roomIds: string[]): FloorPlan {
  const only = new Set(roomIds);
  return { ...plan, openings: plan.openings.map((o) => {
    if (!only.has(o.roomId)) return o;
    const r = plan.rooms.find((x) => x.id === o.roomId);
    return r ? clampOffset(o, roomEdge(r, o.edge).length) : o;
  }) };
}

// ---------------------------------------------------------------------------
// FALHÚZÁS
// ---------------------------------------------------------------------------
/** A fal szomszédos, szemközti élei (más helyiségekben): párhuzamos, kifelé ≤ 50 cm, átfedő szakasz. */
export function facingEdges(plan: FloorPlan, roomId: string, edge: number): { roomId: string; edge: number; gap: number }[] {
  const room = plan.rooms.find((r) => r.id === roomId);
  if (!room) return [];
  const e = roomEdge(room, edge);
  if (!e.axis) return [];
  const k = e.axis === "x" ? 0 : 1, q = 1 - k, len = e.length || 1;
  const nin: Pt = [-(e.b[1] - e.a[1]) / len, (e.b[0] - e.a[0]) / len];
  const out = nin[q] > 0 ? -1 : 1; // kifelé mutató irány a q tengelyen
  const lo = Math.min(e.a[k], e.b[k]), hi = Math.max(e.a[k], e.b[k]);
  const res: { roomId: string; edge: number; gap: number }[] = [];
  for (const o of plan.rooms) {
    if (o.id === roomId) continue;
    o.polygon.forEach((_, j) => {
      const f = roomEdge(o, j);
      if (f.axis !== e.axis) return;
      const gap = (f.a[q] - e.a[q]) * out;
      if (gap < -0.01 || gap > MAX_GAP) return;
      const ov = Math.min(hi, Math.max(f.a[k], f.b[k])) - Math.max(lo, Math.min(f.a[k], f.b[k]));
      if (ov > 0.05) res.push({ roomId: o.id, edge: j, gap });
    });
  }
  return res;
}

/** Mágnes-jelöltek a fal síkjához: más helyiségek párhuzamos falai — maga a sík és a falvastagságnyira lévő túloldal. */
function snapTargets(plan: FloorPlan, axis: "x" | "y", skip: Set<string>, wall: number): number[] {
  const q = axis === "x" ? 1 : 0, out: number[] = [];
  for (const r of plan.rooms) r.polygon.forEach((_, j) => {
    if (skip.has(`${r.id}:${j}`)) return;
    const f = roomEdge(r, j);
    if (f.axis !== axis) return;
    out.push(f.a[q], f.a[q] - wall, f.a[q] + wall);
  });
  return out;
}

export type EdgeMove = { plan: FloorPlan; value: number; snapped: number | null; moved: string[] };

/**
 * Tengelyirányú fal merőleges eltolása a `value` síkra (méter, a fal vonala). withNeighbors: a szemközti szomszéd-élek is
 * ugyanennyit mozognak. A végpontok a két szomszédos élen csúsznak (azok hossza változik). Mágnes: SNAP-en belül illeszt.
 */
export function moveEdgeTo(plan: FloorPlan, roomId: string, edge: number, value: number, opts: { withNeighbors: boolean; wall: number }): EdgeMove | null {
  const room = plan.rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const e = roomEdge(room, edge);
  if (!e.axis) return null;
  const q = e.axis === "x" ? 1 : 0;
  const neighbors = opts.withNeighbors ? facingEdges(plan, roomId, edge) : [];
  const skip = new Set([`${roomId}:${edge}`, ...neighbors.map((n) => `${n.roomId}:${n.edge}`)]);
  let v = r2(value), snapped: number | null = null;
  for (const t of snapTargets(plan, e.axis, skip, opts.wall)) if (Math.abs(t - v) < SNAP) { v = r3(t); snapped = v; break; }
  const delta = v - e.a[q];
  const shiftEdge = (r: Room, i: number): Room => {
    const j = (i + 1) % r.polygon.length;
    return { ...r, polygon: r.polygon.map((p, idx) => (idx === i || idx === j ? (q === 1 ? [p[0], r3(p[1] + delta)] : [r3(p[0] + delta), p[1]]) as Pt : p)) };
  };
  let next = patchRoom(plan, roomId, (r) => shiftEdge(r, edge));
  for (const n of neighbors) next = patchRoom(next, n.roomId, (r) => shiftEdge(r, n.edge));
  // egy helyiség sem lapulhat össze
  if (next.rooms.some((r) => polygonArea(r.polygon) < 0.1 || r.polygon.some((_, i) => roomEdge(r, i).length < 0.02))) return null;
  const moved = [roomId, ...neighbors.map((n) => n.roomId)];
  return { plan: refitOpenings(next, moved), value: v, snapped, moved };
}

/** Az él nyitott (fal nélküli) szakaszai [s, t] az él elejétől: ha ez az él nyitott, az egész; különben ahol egy szomszéd
 *  párhuzamos, szemközti (≤ 50 cm) éle nyitott — ugyanaz a szabály, mint a 3D falépítőben (wallSlabs): nincs „fal-csonk". */
export function openSpans(plan: FloorPlan, roomId: string, edge: number): [number, number][] {
  const room = plan.rooms.find((r) => r.id === roomId);
  if (!room) return [];
  const e = roomEdge(room, edge);
  if ((room.openEdges ?? []).includes(edge)) return [[0, e.length]];
  if (!e.axis) return [];
  const len = e.length || 1, u: Pt = [(e.b[0] - e.a[0]) / len, (e.b[1] - e.a[1]) / len];
  const proj = (p: Pt) => (p[0] - e.a[0]) * u[0] + (p[1] - e.a[1]) * u[1];
  const out: [number, number][] = [];
  for (const f of facingEdges(plan, roomId, edge)) {
    const o = plan.rooms.find((r) => r.id === f.roomId)!;
    if (!(o.openEdges ?? []).includes(f.edge)) continue;
    const fe = roomEdge(o, f.edge), a = proj(fe.a), b = proj(fe.b);
    const s0 = Math.max(0, Math.min(a, b)), t0 = Math.min(e.length, Math.max(a, b));
    if (t0 - s0 > 0.05) out.push([s0, t0]);
  }
  out.sort((x, y) => x[0] - y[0]);
  const m: [number, number][] = [];
  for (const q of out) { if (m.length && q[0] <= m[m.length - 1][1] + 0.02) m[m.length - 1][1] = Math.max(m[m.length - 1][1], q[1]); else m.push([...q]); }
  return m;
}

// ---------------------------------------------------------------------------
// SAROKPONTOK
// ---------------------------------------------------------------------------
/** Sarokpont mozgatása; illesztés más pontok x / y koordinátájához (SNAP-en belül) — így a falak derékszögesek maradnak. */
export function moveVertex(plan: FloorPlan, roomId: string, index: number, p: Pt): { plan: FloorPlan; snapX: number | null; snapY: number | null } | null {
  const room = plan.rooms.find((r) => r.id === roomId);
  if (!room || index < 0 || index >= room.polygon.length) return null;
  let x = r2(p[0]), y = r2(p[1]), snapX: number | null = null, snapY: number | null = null;
  for (const r of plan.rooms) r.polygon.forEach((q, i) => {
    if (r.id === roomId && i === index) return;
    if (snapX === null && Math.abs(q[0] - x) < SNAP) { x = q[0]; snapX = q[0]; }
    if (snapY === null && Math.abs(q[1] - y) < SNAP) { y = q[1]; snapY = q[1]; }
  });
  const next = patchRoom(plan, roomId, (r) => ({ ...r, polygon: r.polygon.map((q, i) => (i === index ? [r3(x), r3(y)] as Pt : q)) }));
  const nr = next.rooms.find((r) => r.id === roomId)!;
  if (polygonArea(nr.polygon) < 0.1 || nr.polygon.some((_, i) => roomEdge(nr, i).length < 0.02)) return null;
  return { plan: refitOpenings(next, [roomId]), snapX, snapY };
}

/** Új sarokpont a falon (a fal elejétől t méterre): a fal kettéválik; a nyílászárók és a nyitott határ a megfelelő félre kerülnek. */
export function insertVertex(plan: FloorPlan, roomId: string, edge: number, t: number): FloorPlan | null {
  const room = plan.rooms.find((r) => r.id === roomId);
  if (!room || room.polygon.length >= 40) return null;
  const e = roomEdge(room, edge);
  // nyílászáró alá nem kerülhet sarokpont (egy nyílás nem lehet két falon): a pont a nyílás közelebbi végéhez igazodik
  for (const o of plan.openings) {
    if (o.roomId !== roomId || o.edge !== edge) continue;
    const s0 = o.offset - o.width / 2, s1 = o.offset + o.width / 2;
    if (t > s0 && t < s1) t = t - s0 < s1 - t ? s0 - 0.01 : s1 + 0.01;
  }
  if (t < 0.05 || t > e.length - 0.05) return null;
  const len = e.length || 1;
  const np: Pt = [r3(e.a[0] + ((e.b[0] - e.a[0]) * t) / len), r3(e.a[1] + ((e.b[1] - e.a[1]) * t) / len)];
  const polygon = [...room.polygon.slice(0, edge + 1), np, ...room.polygon.slice(edge + 1)];
  const open = new Set(room.openEdges ?? []);
  const openEdges = [...open].flatMap((i) => (i < edge ? [i] : i === edge ? [edge, edge + 1] : [i + 1]));
  const openings = plan.openings.map((o) => {
    if (o.roomId !== roomId) return o;
    if (o.edge < edge) return o;
    if (o.edge > edge) return { ...o, edge: o.edge + 1 };
    return o.offset <= t ? o : { ...o, edge: edge + 1, offset: r3(o.offset - t) };
  });
  return refitOpenings({ ...plan, rooms: plan.rooms.map((r) => (r.id === roomId ? { ...r, polygon, openEdges } : r)), openings }, [roomId]);
}

/** Sarokpont törlése (legalább 3 marad): a két szomszédos fal egybeolvad; a nyílászárók a középpontjuk vetületével követik. */
export function deleteVertex(plan: FloorPlan, roomId: string, index: number): FloorPlan | null {
  const room = plan.rooms.find((r) => r.id === roomId);
  if (!room || room.polygon.length <= 3) return null;
  const n = room.polygon.length, prev = (index - 1 + n) % n;
  const polygon = room.polygon.filter((_, i) => i !== index);
  if (polygonArea(polygon) < 0.1) return null;
  // régi él-index → új él-index: a „prev" és az „index" él összeolvad (az új index: prev, ha prev < index; különben prev−1)
  const map = (i: number) => (i === index ? (prev < index ? prev : prev - 1) : i > index ? i - 1 : i);
  const merged = map(prev);
  const open = new Set(room.openEdges ?? []);
  const openEdges = [...new Set([...open].filter((i) => i !== prev && i !== index).map(map))];
  if (open.has(prev) && open.has(index)) openEdges.push(merged);
  const nr = { ...room, polygon, openEdges };
  const ne = roomEdge(nr, merged), nlen = ne.length || 1;
  const openings = plan.openings.map((o) => {
    if (o.roomId !== roomId) return o;
    if (o.edge !== prev && o.edge !== index) return { ...o, edge: map(o.edge) };
    const c = openingSegment(room, o).center;
    const t = ((c[0] - ne.a[0]) * (ne.b[0] - ne.a[0]) + (c[1] - ne.a[1]) * (ne.b[1] - ne.a[1])) / nlen;
    return { ...o, edge: merged, offset: r3(t) };
  });
  return refitOpenings({ ...plan, rooms: plan.rooms.map((r) => (r.id === roomId ? nr : r)), openings }, [roomId]);
}

// ---------------------------------------------------------------------------
// NYÍLÁSZÁRÓK
// ---------------------------------------------------------------------------
/** A felületi típus: ajtó / üvegajtó (ajtóként nyílik, ki lehet látni rajta) / ablak / átjáró. */
export type OpeningType = "door" | "glassdoor" | "window" | "passage";
export const typeOf = (o: Pick<Opening, "kind" | "glazed">): OpeningType => (o.kind === "door" && o.glazed ? "glassdoor" : o.kind);
export const presetsOfType = (t: OpeningType): OpeningPreset[] =>
  OPENING_PRESETS.filter((p) => (t === "glassdoor" ? p.kind === "door" && p.glazed : t === "door" ? p.kind === "door" && !p.glazed : p.kind === t));

/** Új nyílászáró a falon a szabványos méretből (a közepe a fal elejétől `offset`-re). */
export function placeOpening(plan: FloorPlan, roomId: string, edge: number, offset: number, preset: OpeningPreset): FloorPlan {
  const room = plan.rooms.find((r) => r.id === roomId);
  if (!room) return plan;
  const o: Opening = {
    id: newId(preset.kind === "window" ? "w" : preset.kind === "passage" ? "p" : "d"), kind: preset.kind, roomId, edge, offset: r3(offset),
    width: preset.width, height: preset.kind === "passage" ? plan.ceilingHeight : preset.height, sill: preset.sill,
    ...(preset.kind === "door" ? { hinge: "start" as const, swing: "in" as const, ...(preset.glazed ? { glazed: true } : {}) } : {}),
  };
  return refitOpenings({ ...plan, openings: [...plan.openings, o] }, [roomId]);
}

/** Egy kattintásos típusváltás: a helye megmarad, a méret ésszerű (azonos szélességű szabványos, ha van; különben a szélesség marad). */
export function convertOpening(plan: FloorPlan, id: string, to: OpeningType): FloorPlan {
  return { ...plan, openings: plan.openings.map((o) => {
    if (o.id !== id || typeOf(o) === to) return o;
    const from = typeOf(o);
    const kind: Opening["kind"] = to === "glassdoor" ? "door" : to;
    const base: Opening = { id: o.id, kind, roomId: o.roomId, edge: o.edge, offset: o.offset, width: o.width, height: o.height, sill: o.sill, ...(o.leaves ? { leaves: o.leaves } : {}) };
    if (!((from === "door" && to === "glassdoor") || (from === "glassdoor" && to === "door"))) {
      const same = presetsOfType(to).find((p) => Math.abs(p.width - o.width) < 0.005);
      if (same) Object.assign(base, { width: same.width, height: same.height, sill: same.sill });
      else if (to === "window") Object.assign(base, { height: 1.5, sill: 0.9 });
      else if (to === "glassdoor") Object.assign(base, { height: 2.4, sill: 0 });
      else if (to === "door") Object.assign(base, { height: o.width >= 1.2 ? 2.4 : 2.1, sill: 0 });
    }
    if (to === "passage") { base.height = plan.ceilingHeight; base.sill = 0; delete base.leaves; }
    if (kind === "door") Object.assign(base, { hinge: o.hinge ?? "start", swing: o.swing ?? "in", ...(to === "glassdoor" ? { glazed: true } : {}), ...(o.closed !== undefined ? { closed: o.closed } : {}) });
    return base;
  }) };
}

export function patchOpening(plan: FloorPlan, id: string, p: Partial<Opening>): FloorPlan {
  const o = plan.openings.find((x) => x.id === id);
  const next = { ...plan, openings: plan.openings.map((x) => (x.id === id ? { ...x, ...p } : x)) };
  if (!o) return next;
  // csak ezt az egyet igazítjuk a falához
  const r = next.rooms.find((x) => x.id === o.roomId);
  return r ? { ...next, openings: next.openings.map((x) => (x.id === id ? clampOffset(x, roomEdge(r, x.edge).length) : x)) } : next;
}

// ---------------------------------------------------------------------------
// OSZLOPOK
// ---------------------------------------------------------------------------
/** Oszlop-illesztés: ha egy oldala ≤ SNAP-nyira van egy tengelyirányú faltól (a fal hosszában), a falhoz simul. */
export function snapColumn(plan: FloorPlan, c: Column): Column {
  let { x, y } = c;
  for (const r of plan.rooms) r.polygon.forEach((_, i) => {
    const e = roomEdge(r, i);
    if (e.axis === "y" && y >= Math.min(e.a[1], e.b[1]) - 0.3 && y <= Math.max(e.a[1], e.b[1]) + 0.3) for (const sd of [-1, 1]) if (Math.abs(x + (sd * c.w) / 2 - e.a[0]) < SNAP) x = e.a[0] - (sd * c.w) / 2;
    if (e.axis === "x" && x >= Math.min(e.a[0], e.b[0]) - 0.3 && x <= Math.max(e.a[0], e.b[0]) + 0.3) for (const sd of [-1, 1]) if (Math.abs(y + (sd * c.d) / 2 - e.a[1]) < SNAP) y = e.a[1] - (sd * c.d) / 2;
  });
  return { ...c, x: r3(x), y: r3(y) };
}
export function addColumn(plan: FloorPlan, at: Pt, size: { w: number; d: number } = { w: 0.3, d: 0.3 }): { plan: FloorPlan; id: string } {
  const c = snapColumn(plan, { id: newId("c"), x: at[0], y: at[1], ...size });
  return { plan: { ...plan, columns: [...(plan.columns ?? []), c] }, id: c.id };
}
export function patchColumn(plan: FloorPlan, id: string, p: Partial<Column>, snap = true): FloorPlan {
  return { ...plan, columns: (plan.columns ?? []).map((c) => (c.id === id ? (snap ? snapColumn(plan, { ...c, ...p }) : { ...c, ...p }) : c)) };
}
export function removeColumn(plan: FloorPlan, id: string): FloorPlan {
  return { ...plan, columns: (plan.columns ?? []).filter((c) => c.id !== id) };
}
