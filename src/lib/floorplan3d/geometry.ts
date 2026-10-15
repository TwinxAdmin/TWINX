// Lakásleírás-geometria (tiszta függvények, kliens és szerver is használja):
//   • terület, élek, nyílászárók helyzete;
//   • FALHOSSZ-JAVÍTÁS „nyújtással": a fal túlsó vége mögötti MINDEN pont (az összes helyiségben) ugyanannyival
//     elmozdul a fal irányában → a szomszédos helyiségek együtt mozognak, a terv nem esik szét, a területek újraszámolódnak;
//   • méret-ellenőrzés: számolt vs. megadott m², tűréshatárral, tudatos jóváhagyással.
import type { AreaGroup, FloorPlan, Opening, Pt, Room } from "@/lib/floorplan3d/plan";
import { DOOR_DEFAULT, WINDOW_DEFAULT, newId } from "@/lib/floorplan3d/plan";

const EPS = 0.005; // 5 mm — ennyin belül két koordináta azonosnak számít

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Sokszög területe (m²), cipőfűző-képlettel. */
export function polygonArea(pts: Pt[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

export type Edge = { a: Pt; b: Pt; length: number; axis: "x" | "y" | null };

/** A helyiség i. éle (axis: "x" = vízszintes, "y" = függőleges, null = ferde). */
export function roomEdge(room: Room, i: number): Edge {
  const a = room.polygon[i], b = room.polygon[(i + 1) % room.polygon.length];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const axis = Math.abs(dy) <= EPS ? "x" : Math.abs(dx) <= EPS ? "y" : null;
  return { a, b, length: Math.hypot(dx, dy), axis };
}

/** Nyílászáró közepe és két vége a helyiség élén. */
export function openingSegment(room: Room, o: Opening): { center: Pt; a: Pt; b: Pt; axis: Edge["axis"] } {
  const e = roomEdge(room, o.edge);
  const len = e.length || 1;
  const ux = (e.b[0] - e.a[0]) / len, uy = (e.b[1] - e.a[1]) / len;
  const at = (d: number): Pt => [e.a[0] + ux * d, e.a[1] + uy * d];
  return { center: at(o.offset), a: at(o.offset - o.width / 2), b: at(o.offset + o.width / 2), axis: e.axis };
}

/** A terv befoglaló téglalapja (az ábrához). */
export function planBounds(plan: FloorPlan): { minX: number; minY: number; maxX: number; maxY: number } {
  const pts = plan.rooms.flatMap((r) => r.polygon);
  if (!pts.length) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return {
    minX: Math.min(...pts.map((p) => p[0])), minY: Math.min(...pts.map((p) => p[1])),
    maxX: Math.max(...pts.map((p) => p[0])), maxY: Math.max(...pts.map((p) => p[1])),
  };
}

// ---------------------------------------------------------------------------
// FALHOSSZ-JAVÍTÁS
// ---------------------------------------------------------------------------
export type EditResult = { ok: true; plan: FloorPlan } | { ok: false; error: string };

export const MIN_WALL = 0.3; // ennél rövidebb fal nem adható meg

/**
 * A helyiség egy falának új hossza (m). A fal túlsó (jobb / alsó) vége mozdul: a mögötte lévő minden pont
 * és nyílászáró ugyanannyival tolódik. Ferde falon nem működik (első fázis: derékszögű alaprajz).
 */
export function setWallLength(plan: FloorPlan, roomId: string, edge: number, newLength: number): EditResult {
  const room = plan.rooms.find((r) => r.id === roomId);
  if (!room) return { ok: false, error: "A helyiség nem található." };
  if (!Number.isFinite(newLength) || newLength < MIN_WALL) return { ok: false, error: `A falhossz legalább ${MIN_WALL} m legyen.` };
  const e = roomEdge(room, edge);
  if (!e.axis) return { ok: false, error: "Ferde fal hossza az első fázisban nem javítható." };

  const k = e.axis === "x" ? 0 : 1;                       // melyik koordináta mentén nyújtunk
  const threshold = Math.max(e.a[k], e.b[k]) - EPS;      // a fal túlsó vége
  const delta = newLength - e.length;
  if (Math.abs(delta) < 0.001) return { ok: true, plan };

  const shift = (p: Pt): Pt => {
    if (p[k] < threshold) return p;
    const q: Pt = [p[0], p[1]];
    q[k] = round3(p[k] + delta);
    return q;
  };

  // a nyílászárók abszolút középpontja nyújtás ELŐTT (hogy a falukon a helyük következetesen mozogjon)
  const centers = new Map(plan.openings.map((o) => {
    const r = plan.rooms.find((x) => x.id === o.roomId);
    return [o.id, r ? openingSegment(r, o).center : null] as const;
  }));

  const rooms = plan.rooms.map((r) => ({ ...r, polygon: r.polygon.map(shift) }));
  // Zsugorításnál egy helyiség sem lapulhat össze (a mozgó rész nem csúszhat át más falakon).
  const collapsed = rooms.find((r, i) => polygonArea(r.polygon) < 0.1 || r.polygon.some((_, j) => roomEdge(r, j).length < 0.05 && roomEdge(plan.rooms[i], j).length >= 0.05));
  if (collapsed) return { ok: false, error: `Ilyen rövidre nem javítható: „${collapsed.name || "egy helyiség"}” összelapulna.` };
  const openings = plan.openings.map((o) => {
    const r = rooms.find((x) => x.id === o.roomId);
    const c = centers.get(o.id);
    if (!r || !c) return o;
    const ne = roomEdge(r, o.edge);
    const nc = shift(c);
    const along = Math.hypot(nc[0] - ne.a[0], nc[1] - ne.a[1]);
    return { ...o, offset: round3(clampOffset(along, o.width, ne.length)), width: Math.min(o.width, ne.length) };
  });
  return { ok: true, plan: { ...plan, rooms, openings } };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const clampOffset = (offset: number, width: number, len: number) =>
  Math.min(Math.max(offset, width / 2), Math.max(width / 2, len - width / 2));

// ---------------------------------------------------------------------------
// NYÍLÁSZÁRÓK
// ---------------------------------------------------------------------------
export function addOpening(plan: FloorPlan, roomId: string, edge: number, kind: Opening["kind"]): FloorPlan {
  const room = plan.rooms.find((r) => r.id === roomId);
  if (!room) return plan;
  const len = roomEdge(room, edge).length;
  const d = kind === "door" ? DOOR_DEFAULT : WINDOW_DEFAULT;
  const width = Math.min(d.width, Math.max(0.4, len - 0.1));
  const o: Opening = {
    id: newId(kind === "door" ? "d" : "w"), kind, roomId, edge, offset: round3(len / 2), width, height: d.height,
    sill: kind === "window" ? WINDOW_DEFAULT.sill : 0,
    ...(kind === "door" ? { hinge: "start" as const, swing: "in" as const } : {}),
  };
  return { ...plan, openings: [...plan.openings, o] };
}

export function removeOpening(plan: FloorPlan, openingId: string): FloorPlan {
  return { ...plan, openings: plan.openings.filter((o) => o.id !== openingId) };
}

// ---------------------------------------------------------------------------
// MÉRET-ELLENŐRZÉS
// ---------------------------------------------------------------------------
export type RoomCheckStatus = "ok" | "missing" | "deviation" | "approved";
export type RoomCheck = { roomId: string; area: number; declared: number | null; diffPct: number | null; status: RoomCheckStatus; groupId?: string };
export type GroupCheck = { groupId: string; area: number; declared: number | null; diffPct: number | null; status: RoomCheckStatus };
export type PlanCheck = { rooms: RoomCheck[]; groups: GroupCheck[]; issues: string[]; canBuild: boolean };

function judge(area: number, declared: number | null, approved: boolean | undefined, tolerancePct: number) {
  if (declared === null) return { diffPct: null, status: "missing" as const };
  const diffPct = Math.round(((area - declared) / declared) * 1000) / 10;
  if (Math.abs(diffPct) <= tolerancePct) return { diffPct, status: "ok" as const };
  return { diffPct, status: approved ? ("approved" as const) : ("deviation" as const) };
}

export function checkRoom(room: Room, tolerancePct: number): RoomCheck {
  const area = round2(polygonArea(room.polygon));
  const declared = room.declaredArea && room.declaredArea > 0 ? room.declaredArea : null;
  return { roomId: room.id, area, declared, ...judge(area, declared, room.areaApproved, tolerancePct) };
}

/**
 * Az egész terv ellenőrzése. A 3D-építés csak akkor indulhat, ha minden helyiségnek van neve és megadott m²-e,
 * és minden eltérés a tűrésen belül van vagy tudatosan jóvá lett hagyva.
 * (A kézi rajz felelősség-vállalását a hívó kezeli — az a projekt adata, nem a terv része.)
 */
export function checkPlan(plan: FloorPlan, tolerancePct: number): PlanCheck {
  const issues: string[] = [];
  if (!plan.rooms.length) issues.push("A tervben nincs helyiség.");
  for (const r of plan.rooms) {
    if (!r.name.trim()) issues.push("Van név nélküli helyiség.");
    if (r.polygon.length < 3) issues.push(`„${r.name || "Névtelen"}”: hiányos körvonal.`);
  }
  const rooms = plan.rooms.map((r) => checkRoom(r, tolerancePct));
  // összevont csoportok: a tagok összterülete a csoport m²-éhez; a tag állapota a csoporté
  const groups: GroupCheck[] = (plan.areaGroups ?? []).map((g) => {
    const area = round2(rooms.filter((c) => g.roomIds.includes(c.roomId)).reduce((s, c) => s + c.area, 0));
    const declared = g.declaredArea && g.declaredArea > 0 ? g.declaredArea : null;
    return { groupId: g.id, area, declared, ...judge(area, declared, g.approved, tolerancePct) };
  });
  for (const g of plan.areaGroups ?? []) {
    const gc = groups.find((x) => x.groupId === g.id)!;
    for (const c of rooms) if (g.roomIds.includes(c.roomId)) Object.assign(c, { declared: null, diffPct: gc.diffPct, status: gc.status, groupId: g.id });
  }
  const canBuild = issues.length === 0 && rooms.every((c) => c.status === "ok" || c.status === "approved");
  return { rooms, groups, issues: [...new Set(issues)], canBuild };
}

// ---------------------------------------------------------------------------
// ÖSSZEVONT ELLENŐRZÉS — csoportműveletek (egy helyiség legfeljebb egy csoportban; 2-nél kevesebb tagú csoport megszűnik)
// ---------------------------------------------------------------------------
export function groupOf(plan: FloorPlan, roomId: string): AreaGroup | null {
  return (plan.areaGroups ?? []).find((g) => g.roomIds.includes(roomId)) ?? null;
}

const tidy = (groups: AreaGroup[]) => groups.filter((g) => g.roomIds.length >= 2);

/** A `roomId` csoportjába felveszi / onnan kiveszi az `otherId` helyiséget (ha `roomId` még nincs csoportban, újat nyit). */
export function toggleGroupMember(plan: FloorPlan, roomId: string, otherId: string): FloorPlan {
  if (roomId === otherId) return plan;
  let groups = [...(plan.areaGroups ?? [])];
  const mine = groups.find((g) => g.roomIds.includes(roomId));
  if (mine?.roomIds.includes(otherId)) {
    groups = groups.map((g) => (g === mine ? { ...g, roomIds: g.roomIds.filter((id) => id !== otherId), approved: false } : g));
  } else {
    groups = groups.map((g) => ({ ...g, roomIds: g.roomIds.filter((id) => id !== otherId) })); // máshonnan ki
    if (mine) groups = groups.map((g) => (g.id === mine.id ? { ...g, roomIds: [...g.roomIds, otherId], approved: false } : g));
    else {
      const name = plan.rooms.find((r) => r.id === roomId)?.name ?? "Összevont";
      groups.push({ id: newId("g"), label: name.replace(/\s*\d+$/, ""), declaredArea: null, roomIds: [roomId, otherId] });
    }
  }
  return { ...plan, areaGroups: tidy(groups) };
}

export function leaveGroup(plan: FloorPlan, roomId: string): FloorPlan {
  return { ...plan, areaGroups: tidy((plan.areaGroups ?? []).map((g) => ({ ...g, roomIds: g.roomIds.filter((id) => id !== roomId) }))) };
}

export function patchGroup(plan: FloorPlan, groupId: string, p: Partial<Pick<AreaGroup, "label" | "declaredArea" | "approved">>): FloorPlan {
  return { ...plan, areaGroups: (plan.areaGroups ?? []).map((g) => (g.id === groupId ? { ...g, ...p } : g)) };
}
