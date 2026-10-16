// Lakásleírás-geometria (tiszta függvények, kliens és szerver is használja):
//   • terület, élek, nyílászárók helyzete;
//   • FALHOSSZ-JAVÍTÁS „nyújtással": a fal túlsó vége mögötti MINDEN pont (az összes helyiségben) ugyanannyival
//     elmozdul a fal irányában → a szomszédos helyiségek együtt mozognak, a terv nem esik szét, a területek újraszámolódnak;
//   • méret-ellenőrzés: számolt vs. megadott m², tűréshatárral, tudatos jóváhagyással.
import type { AreaGroup, Column, FloorPlan, Opening, Pt, Room } from "@/lib/floorplan3d/plan";
import { DOOR_DEFAULT, OUTDOOR_KINDS, WINDOW_DEFAULT, newId } from "@/lib/floorplan3d/plan";

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

/** A nyílás túloldalán (a falon át, 45 cm-re) nincs beltéri helyiség → a lakásból KIFELÉ vezet (bejárati ajtó, erkély-/loggiaajtó). */
export function leadsOutside(plan: FloorPlan, o: Opening): boolean {
  const room = plan.rooms.find((r) => r.id === o.roomId);
  if (!room) return false;
  if (OUTDOOR_KINDS.includes(room.kind)) return true;
  const s = openingSegment(room, o), e = roomEdge(room, o.edge), len = e.length || 1;
  const nin: Pt = [-(e.b[1] - e.a[1]) / len, (e.b[0] - e.a[0]) / len];
  const p: Pt = [s.center[0] - nin[0] * 0.45, s.center[1] - nin[1] * 0.45];
  return !plan.rooms.some((r) => r.id !== room.id && !OUTDOOR_KINDS.includes(r.kind) && pointInPolygon(p, r.polygon));
}
/** A nyílás túloldalán kültéri helyiség (terasz / erkély / loggia) van-e (vagy a nyílás maga a kültéri helyiségé)? */
export function leadsToOutdoorRoom(plan: FloorPlan, o: Opening): boolean {
  const room = plan.rooms.find((r) => r.id === o.roomId);
  if (!room) return false;
  if (OUTDOOR_KINDS.includes(room.kind)) return true;
  const s = openingSegment(room, o), e = roomEdge(room, o.edge), len = e.length || 1;
  const nin: Pt = [-(e.b[1] - e.a[1]) / len, (e.b[0] - e.a[0]) / len];
  const p: Pt = [s.center[0] - nin[0] * 0.45, s.center[1] - nin[1] * 0.45];
  return plan.rooms.some((r) => OUTDOOR_KINDS.includes(r.kind) && pointInPolygon(p, r.polygon));
}
/** Becsukva jelenik-e meg az ajtó a 3D-ben: a beállított érték; különben a kifelé vezető ajtó (bejárati, erkély), és az az ajtó,
 *  amelynek a 90°-ra nyitott lapja elzárná a helyiséget (kis WC / kamra: a lap mögött nem marad 45 cm) — ezek a bejárásban
 *  odasétálva nyílnak ki. */
export const doorClosed = (plan: FloorPlan, o: Opening): boolean => o.kind === "door" && (o.closed ?? (leadsOutside(plan, o) || leafBlocksRoom(plan, o)));

/** A nyitás oldalán lévő helyiség mélysége (a nyílás közepétől merőlegesen a szemközti falig) kisebb-e, mint a lap + 45 cm? */
export function leafBlocksRoom(plan: FloorPlan, o: Opening): boolean {
  const room = plan.rooms.find((r) => r.id === o.roomId);
  if (!room) return false;
  const s = openingSegment(room, o), e = roomEdge(room, o.edge), len = e.length || 1;
  let n: Pt = [-(e.b[1] - e.a[1]) / len, (e.b[0] - e.a[0]) / len];
  if (o.swing === "out") n = [-n[0], -n[1]];
  const leaf = o.width >= 1.2 && o.leaves !== 1 ? o.width / 2 : o.width;
  // a nyitás oldalán melyik helyiségben vagyunk (kifelé nyíló ajtónál a szomszédban), és milyen mélyen tart ki
  const probe = (d: number): Pt => [s.center[0] + n[0] * d, s.center[1] + n[1] * d];
  const host = plan.rooms.find((r) => pointInPolygon(probe(0.15), r.polygon));
  if (!host) return false;
  let d = 0.15;
  while (d < leaf + 0.5 && pointInPolygon(probe(d), host.polygon)) d += 0.05;
  if (d < leaf + 0.45) return true;
  // a 90°-os lap ne álljon egy MÁSIK ajtó / átjáró elé (keskeny közlekedő): ott a lap a zsanértól a nyitás irányába fut
  const hinges: Pt[] = o.width >= 1.2 && o.leaves !== 1 ? [s.a, s.b] : [o.hinge === "end" ? s.b : s.a];
  const segDist = (p: Pt, a: Pt, b: Pt) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  };
  for (const other of plan.openings) {
    if (other.id === o.id || other.kind === "window") continue;
    const r2 = plan.rooms.find((r) => r.id === other.roomId);
    if (!r2) continue;
    const s2 = openingSegment(r2, other), e2 = roomEdge(r2, other.edge), l2 = e2.length || 1;
    const n2: Pt = [-(e2.b[1] - e2.a[1]) / l2, (e2.b[0] - e2.a[0]) / l2];
    const approach: Pt[] = [0.45, -0.45].map((k) => [s2.center[0] + n2[0] * k, s2.center[1] + n2[1] * k] as Pt);
    for (const h of hinges) {
      const tip: Pt = [h[0] + n[0] * leaf, h[1] + n[1] * leaf];
      if (approach.some((p) => segDist(p, h, tip) < 0.3)) return true;
    }
  }
  return false;
}
/** Digitalizálás utáni alapértékek (Márk, 2026-10-16): az erkélyre / loggiára / teraszra nyíló ajtó ÜVEGAJTÓ és becsukva
 *  jelenik meg; a többi kifelé vezető (bejárati) ajtó becsukva. A partner mindkettőt átállíthatja. */
export function applyDoorDefaults(plan: FloorPlan): FloorPlan {
  return { ...plan, openings: plan.openings.map((o) => {
    if (o.kind !== "door") return o;
    if (leadsToOutdoorRoom(plan, o)) return { ...o, glazed: o.glazed ?? true, closed: o.closed ?? true };
    if (leadsOutside(plan, o)) return { ...o, closed: o.closed ?? true };
    return o;
  }) };
}
export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let r = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) r = !r;
  }
  return r;
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

// ---------------------------------------------------------------------------
// NYÍLÁSZÁRÓK JAVÍTÁSA — mozgatás a falon + figyelmeztetések (JELZÉS, nem tiltás)
// ---------------------------------------------------------------------------
/** A nyílászáró közepe a fal elejétől (m) — húzáskor / pontos távolságnál. Nem korlátozzuk: a kilógást a figyelmeztetés jelzi. */
export function moveOpening(plan: FloorPlan, openingId: string, offset: number): FloorPlan {
  if (!Number.isFinite(offset)) return plan;
  return { ...plan, openings: plan.openings.map((o) => (o.id === openingId ? { ...o, offset: round3(offset) } : o)) };
}

/** A nyílászáró két szélének távolsága a fal két sarkától (m; negatív = kilóg). */
export function openingGaps(room: Room, o: Opening): { start: number; end: number; wall: number } {
  const len = roomEdge(room, o.edge).length;
  // (a „|| 0" a −0-t nullára cseréli, hogy a felületen ne „−0,00" látsszon)
  return { start: round3(o.offset - o.width / 2) || 0, end: round3(len - (o.offset + o.width / 2)) || 0, wall: round3(len) };
}

export type OpeningWarning = { openingId: string; kind: "overhang" | "overlap" | "corner" | "tall"; text: string };

/**
 * Figyelmeztetések nyílászárónként: kilóg a falból · ütközik egy másikkal (a fal túloldaláról felvettel is) ·
 * túl közel a sarokhoz (cornerMin) · magasabb, mint a belmagasság. Egyik sem tiltja a mentést / jóváhagyást.
 */
export function openingWarnings(plan: FloorPlan, cornerMin: number): OpeningWarning[] {
  const out: OpeningWarning[] = [];
  const segs = plan.openings.map((o) => {
    const room = plan.rooms.find((r) => r.id === o.roomId);
    return room ? { o, room, s: openingSegment(room, o) } : null;
  }).filter((x): x is NonNullable<typeof x> => !!x);
  const cm = (v: number) => `${Math.round(v * 100)} cm`;

  for (const { o, room, s } of segs) {
    const g = openingGaps(room, o);
    if (g.start < -0.005 || g.end < -0.005) out.push({ openingId: o.id, kind: "overhang", text: `Kilóg a falból (${cm(-Math.min(g.start, g.end))}).` });
    else if (Math.min(g.start, g.end) < cornerMin) out.push({ openingId: o.id, kind: "corner", text: `Nagyon közel a sarokhoz (${cm(Math.min(g.start, g.end))}).` });
    if (o.sill + o.height > plan.ceilingHeight + 0.005) out.push({ openingId: o.id, kind: "tall", text: "Magasabb, mint a belmagasság." });
    // ütközés: ugyanazon a (fizikai) falon — párhuzamos, ≤ 50 cm-re egymástól — átfedő szakasz
    for (const t of segs) {
      if (t.o.id === o.id || !s.axis || s.axis !== t.s.axis) continue;
      const k = s.axis === "x" ? 0 : 1, q = 1 - k;
      if (Math.abs(s.center[q] - t.s.center[q]) > 0.5) continue;
      const overlap = Math.min(Math.max(s.a[k], s.b[k]), Math.max(t.s.a[k], t.s.b[k])) - Math.max(Math.min(s.a[k], s.b[k]), Math.min(t.s.a[k], t.s.b[k]));
      if (overlap > 0.02) {
        const other = t.o.kind === "door" ? "ajtóval" : "ablakkal";
        const where = t.room.id === room.id ? "" : ` (${t.room.name || "szomszéd"} felől)`;
        out.push({ openingId: o.id, kind: "overlap", text: `Ütközik egy másik ${other}${where} — ha ugyanaz, töröld az egyiket.` });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// UTÓLAGOS JAVÍTÁS — mely helyiségek épüljenek újra (a korábban jóváhagyott tervhez képest)
// ---------------------------------------------------------------------------
/** Két helyiség falszomszéd-e: van-e párhuzamos, ≤ 50 cm-re lévő, átfedő élpárjuk (a közös fal mindkettőjüket érinti). */
function wallNeighbors(a: Room, b: Room): boolean {
  for (let i = 0; i < a.polygon.length; i++) {
    const e = roomEdge(a, i);
    if (!e.axis) continue;
    const k = e.axis === "x" ? 0 : 1, q = 1 - k;
    for (let j = 0; j < b.polygon.length; j++) {
      const f = roomEdge(b, j);
      if (f.axis !== e.axis || Math.abs(e.a[q] - f.a[q]) > 0.5) continue;
      const ov = Math.min(Math.max(e.a[k], e.b[k]), Math.max(f.a[k], f.b[k])) - Math.max(Math.min(e.a[k], e.b[k]), Math.min(f.a[k], f.b[k]));
      if (ov > 0.05) return true;
    }
  }
  return false;
}

/**
 * Az új terv mely helyiségeit kell újraépíteni a korábban jóváhagyotthoz képest: amelyiknek a körvonala / típusa /
 * nyitott határa változott, amelyik új, amelyiknek a nyílászárója változott — és ezek falszomszédjai (a közös fal
 * mindkét oldalon látszik). Belmagasság-változásnál: mind. Előző terv nélkül: mind.
 */
export function affectedRooms(prev: FloorPlan | null, next: FloorPlan): string[] {
  if (!prev || prev.ceilingHeight !== next.ceilingHeight) return next.rooms.map((r) => r.id);
  const key = (r: Room) => JSON.stringify([r.polygon, r.kind, [...(r.openEdges ?? [])].sort()]);
  // (2026-10-16) az üvegezés, a szárnyszám és a becsukott állapot is a 3D-t változtatja
  const okey = (o: Opening) => JSON.stringify([o.kind, o.roomId, o.edge, o.offset, o.width, o.height, o.sill, o.hinge ?? null, o.swing ?? null, !!o.glazed, o.leaves ?? null, o.closed ?? null]);
  const prevRooms = new Map(prev.rooms.map((r) => [r.id, key(r)]));
  const changed = new Set(next.rooms.filter((r) => prevRooms.get(r.id) !== key(r)).map((r) => r.id));
  // falváltozás: a helyiség összes falszomszédja is érintett (a közös fal mindkét oldalon látszik)
  const out = new Set(changed);
  for (const id of changed) {
    const r = next.rooms.find((x) => x.id === id);
    if (!r) continue;
    for (const other of next.rooms) if (other.id !== id && wallNeighbors(r, other)) out.add(other.id);
  }
  // nyílászáró-változás: a saját helyisége + csak a fal TÚLOLDALÁN lévő helyiség (ahol a nyílás ugyanúgy kivágódik)
  const prevOpen = new Map(prev.openings.map((o) => [o.id, o]));
  const nextOpen = new Map(next.openings.map((o) => [o.id, o]));
  const touched: { o: Opening; plan: FloorPlan }[] = [];
  for (const o of next.openings) if (!prevOpen.has(o.id) || okey(prevOpen.get(o.id)!) !== okey(o)) touched.push({ o, plan: next });
  for (const o of prev.openings) if (!nextOpen.has(o.id) || okey(nextOpen.get(o.id)!) !== okey(o)) touched.push({ o, plan: prev });
  for (const { o, plan } of touched) {
    out.add(o.roomId);
    const room = plan.rooms.find((r) => r.id === o.roomId);
    if (!room) continue;
    const s = openingSegment(room, o);
    if (!s.axis) continue;
    const k = s.axis === "x" ? 0 : 1, q = 1 - k;
    const own = roomEdge(room, o.edge);
    const ownIn = [-(own.b[1] - own.a[1]), own.b[0] - own.a[0]]; // a saját helyiség felé mutató normális
    for (const other of next.rooms) {
      if (other.id === o.roomId) continue;
      const across = other.polygon.some((_, j) => {
        const f = roomEdge(other, j);
        if (f.axis !== s.axis || Math.abs(f.a[q] - s.center[q]) > 0.5) return false;
        // csak a fal TÚLOLDALA: a szomszéd éle ellentétes irányba néz (az egy vonalban futó, mellette lévő helyiség nem)
        const fIn = [-(f.b[1] - f.a[1]), f.b[0] - f.a[0]];
        if (ownIn[0] * fIn[0] + ownIn[1] * fIn[1] >= 0) return false;
        return Math.min(Math.max(f.a[k], f.b[k]), Math.max(s.a[k], s.b[k])) - Math.max(Math.min(f.a[k], f.b[k]), Math.min(s.a[k], s.b[k])) > 0.02;
      });
      if (across) out.add(other.id);
    }
  }
  // oszlop-változás (új / törölt / mozgatott / átméretezett): az a helyiség, amelyben (vagy amelynek a falánál) áll
  const ckey = (c: Column) => JSON.stringify([c.x, c.y, c.w, c.d]);
  const prevCols = new Map((prev.columns ?? []).map((c) => [c.id, ckey(c)]));
  const nextCols = new Map((next.columns ?? []).map((c) => [c.id, ckey(c)]));
  const movedCols = [...(next.columns ?? []).filter((c) => prevCols.get(c.id) !== ckey(c)), ...(prev.columns ?? []).filter((c) => nextCols.get(c.id) !== ckey(c))];
  for (const c of movedCols) {
    const pts: Pt[] = [[c.x, c.y], [c.x - c.w / 2, c.y - c.d / 2], [c.x + c.w / 2, c.y - c.d / 2], [c.x + c.w / 2, c.y + c.d / 2], [c.x - c.w / 2, c.y + c.d / 2]];
    for (const r of next.rooms) if (pts.some((q) => pointInPolygon(q, r.polygon))) out.add(r.id);
  }
  return next.rooms.map((r) => r.id).filter((id) => out.has(id));
}
