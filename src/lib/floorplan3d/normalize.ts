// Digitalizálás 2. fele (tiszta függvény, tesztelhető): a képelemző nyers válaszából méterpontos, derékszögű terv.
//   1) lépték: a kiírt méretvonalakból (m / képpont, medián); ha nincs elég, a kiírt m²-ekből — ezt a terv jelzi;
//   2) derékszögesítés: a közel vízszintes / függőleges élek pontosan tengelyirányúak lesznek;
//   2b) méretvonal-igazítás: a helyiségbe írt méret (pl. „2,30") a helyiség belső mérete — a túl vastagra rajzolt
//       falakból elvéve, mindkét oldalon egyformán igazítunk rá (a szomszédok nem mozdulnak);
//   3) egyterű helyiségek (openTo): a szembenéző éleik a középvonalra kerülnek, és „nyitott határ" jelölést kapnak;
//   4) összeigazítás: az egymáshoz nagyon közeli koordináták (pl. két szomszéd helyiség fala) közös értéket kapnak;
//   5) nyílászárók: a legközelebbi, vele párhuzamos helyiség-élre kerülnek (él + távolság).
// A kiírt m² a „megadott m²" mezőbe kerül előtöltésként — a felhasználó a javítófelületen ellenőrzi.
import type { FloorPlan, Opening, Pt, Room, RoomKind } from "@/lib/floorplan3d/plan";
import { DOOR_DEFAULT, ROOM_KINDS, WINDOW_DEFAULT, newId } from "@/lib/floorplan3d/plan";
import { polygonArea, roomEdge } from "@/lib/floorplan3d/geometry";

/** A képelemző nyers válasza — koordináták 0–1000-es normált rácson (x a szélesség, y a magasság mentén). */
export type RawDigitized = {
  ceilingHeight?: number | null;
  rooms?: { name?: string; kind?: string; areaLabel?: number | null; polygon?: number[][]; openTo?: number[] }[];
  openings?: { kind?: string; room?: number; x1?: number; y1?: number; x2?: number; y2?: number; swingInto?: number | null }[];
  dimensions?: { meters?: number; x1?: number; y1?: number; x2?: number; y2?: number }[];
  notes?: string[];
};

export type NormalizeStats = {
  scaleSource: "dimensions" | "areas" | "none";
  metersPerPixel: number;
  dimensionCount: number;
  /** A kiírt méretvonalakból és a kiírt m²-ekből számolt lépték eltérése (%), ha mindkettő van. */
  scaleAgreementPct: number | null;
  roomCount: number;
  openingCount: number;
  /** Ennyi helyiségméretet igazítottunk a kiírt méretvonalhoz. */
  dimensionFits: number;
  /** A forráskép elhelyezése a terv alá (ellenőrzéshez): képpont × metersPerPixel − offset = méter. */
  imageSize: [number, number];
  imageOffset: [number, number];
};

const ALIGN_TOL = 0.06;   // 6 cm-en belüli koordináták közös értéket kapnak (a 10 cm-es válaszfal két oldala külön marad)
const AXIS_TOL_DEG = 8;   // ennél kisebb dőlésű él tengelyirányúnak számít

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN;
};
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const KIND_SET = new Set<string>(ROOM_KINDS.map((k) => k.value));

export function normalizeDigitized(raw: RawDigitized, imageW: number, imageH: number, defaultCeiling: number): { plan: FloorPlan; stats: NormalizeStats } {
  const px = (x: number, y: number): Pt => [(x / 1000) * imageW, (y / 1000) * imageH];
  const notes = (raw.notes ?? []).filter((n) => typeof n === "string" && n.trim()).slice(0, 12);

  // --- helyiségek képpontban ---
  const rawRooms = (raw.rooms ?? []).map((r) => ({
    name: (r.name ?? "").toString().trim().slice(0, 60),
    kind: (KIND_SET.has(String(r.kind)) ? r.kind : "egyeb") as RoomKind,
    areaLabel: finite(r.areaLabel) && r.areaLabel > 0 && r.areaLabel < 500 ? r.areaLabel : null,
    poly: (r.polygon ?? []).filter((p) => Array.isArray(p) && finite(p[0]) && finite(p[1])).map((p) => px(p[0], p[1])),
    openTo: (r.openTo ?? []).filter(finite),
    src: 0,
  })).map((r, i) => ({ ...r, src: i })).filter((r) => r.poly.length >= 3);

  // --- lépték ---
  const dimScales = (raw.dimensions ?? [])
    .filter((d) => finite(d.meters) && d.meters > 0.3 && [d.x1, d.y1, d.x2, d.y2].every(finite))
    .map((d) => {
      const [ax, ay] = px(d.x1!, d.y1!), [bx, by] = px(d.x2!, d.y2!);
      const len = Math.hypot(bx - ax, by - ay);
      return len > 5 ? d.meters! / len : NaN;
    }).filter(Number.isFinite);
  const areaScales = rawRooms.filter((r) => r.areaLabel).map((r) => Math.sqrt(r.areaLabel! / polygonArea(r.poly))).filter(Number.isFinite);
  const dimScale = dimScales.length >= 2 ? median(dimScales) : NaN;
  const areaScale = areaScales.length ? median(areaScales) : NaN;
  const scale = Number.isFinite(dimScale) ? dimScale : Number.isFinite(areaScale) ? areaScale : 0.01;
  const stats: NormalizeStats = {
    scaleSource: Number.isFinite(dimScale) ? "dimensions" : Number.isFinite(areaScale) ? "areas" : "none",
    metersPerPixel: scale,
    dimensionCount: dimScales.length,
    scaleAgreementPct: Number.isFinite(dimScale) && Number.isFinite(areaScale) ? Math.round(((dimScale - areaScale) / areaScale) * 1000) / 10 : null,
    roomCount: rawRooms.length,
    openingCount: 0,
    dimensionFits: 0,
    imageSize: [imageW, imageH],
    imageOffset: [0, 0],
  };
  if (stats.scaleSource === "areas") notes.push("A léptéket a kiírt m²-ekből számoltam (kevés olvasható méretvonal) — a falhosszakat érdemes ellenőrizni.");
  if (stats.scaleSource === "none") notes.push("Nem találtam léptéket (sem méretvonal, sem m²) — a méretek becsültek, minden falhosszt ellenőrizni kell.");

  // --- méterre váltás + derékszögesítés ---
  let rooms: Room[] = rawRooms.map((r) => ({
    id: newId("r"), name: r.name || "Helyiség", kind: r.kind, declaredArea: r.areaLabel,
    polygon: orthogonalize(dedupe(r.poly.map(([x, y]) => [x * scale, y * scale] as Pt))),
  }));
  // egyterű párok (a nyers indexek szerint) → közös határ, fal nélkül
  const bySrc = new Map(rawRooms.map((r, i) => [r.src, i]));
  for (const [i, r] of rawRooms.entries()) {
    for (const t of r.openTo) {
      const j = bySrc.get(t);
      if (j !== undefined && j > i) joinOpen(rooms[i], rooms[j]);
      else if (j !== undefined && j < i && !rawRooms[j].openTo.includes(r.src)) joinOpen(rooms[j], rooms[i]);
    }
  }
  rooms = rooms.filter((r) => r.polygon.length >= 3);

  // méretvonal-igazítás (a méretvonalak méterben, a helyiségekkel azonos rendszerben)
  const dimsM = (raw.dimensions ?? [])
    .filter((d) => finite(d.meters) && d.meters > 0.3 && [d.x1, d.y1, d.x2, d.y2].every(finite))
    .map((d) => {
      const [ax, ay] = px(d.x1!, d.y1!), [bx, by] = px(d.x2!, d.y2!);
      return { meters: d.meters!, a: [ax * scale, ay * scale] as Pt, b: [bx * scale, by * scale] as Pt };
    });
  stats.dimensionFits = fitDimensions(rooms, dimsM);

  // --- összeigazítás (x és y külön), majd eltolás a (0,0)-ba ---
  const xs = cluster(rooms.flatMap((r) => r.polygon.map((p) => p[0])));
  const ys = cluster(rooms.flatMap((r) => r.polygon.map((p) => p[1])));
  // (az összeigazítás a pontok számát nem változtatja → a nyitott él-indexek érvényesek maradnak)
  rooms = rooms.map((r) => ({ ...r, polygon: r.polygon.map(([x, y]) => [xs(x), ys(y)] as Pt) })).filter((r) => polygonArea(r.polygon) > 0.2);
  const minX = Math.min(...rooms.flatMap((r) => r.polygon.map((p) => p[0])));
  const minY = Math.min(...rooms.flatMap((r) => r.polygon.map((p) => p[1])));
  stats.imageOffset = [r3(minX), r3(minY)];
  rooms = rooms.map((r) => clockwise({ ...r, polygon: r.polygon.map(([x, y]) => [r3(x - minX), r3(y - minY)] as Pt) }));

  // --- nyílászárók: a legközelebbi párhuzamos élre ---
  const openings: Opening[] = [];
  for (const o of raw.openings ?? []) {
    if (![o.x1, o.y1, o.x2, o.y2].every(finite)) continue;
    const kind = o.kind === "window" ? "window" : "door";
    const [ax, ay] = px(o.x1!, o.y1!), [bx, by] = px(o.x2!, o.y2!);
    const a: Pt = [ax * scale - minX, ay * scale - minY], b: Pt = [bx * scale - minX, by * scale - minY];
    const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (width < 0.3) continue;
    const c: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const horizontal = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]);
    const hit = nearestEdge(rooms, c, horizontal ? "x" : "y", finite(o.room) ? rooms[o.room]?.id : undefined);
    if (!hit) continue;
    const d = kind === "door" ? DOOR_DEFAULT : WINDOW_DEFAULT;
    const w = Math.min(Math.max(width, 0.5), hit.length);
    openings.push({
      id: newId(kind === "door" ? "d" : "w"), kind, roomId: hit.roomId, edge: hit.edge,
      offset: r3(Math.min(Math.max(hit.along, w / 2), hit.length - w / 2)), width: r3(w), height: d.height,
      sill: kind === "window" ? WINDOW_DEFAULT.sill : 0,
      ...(kind === "door" ? { hinge: "start" as const, swing: "in" as const } : {}),
    });
  }
  stats.openingCount = openings.length;

  const ceiling = finite(raw.ceilingHeight) && raw.ceilingHeight > 2 && raw.ceilingHeight < 5 ? raw.ceilingHeight : defaultCeiling;
  return { plan: { version: 1, ceilingHeight: ceiling, rooms, openings, notes }, stats };
}

// ---------------------------------------------------------------------------
function dedupe(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.02) out.push(p);
  }
  if (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= 0.02) out.pop();
  // egy egyenesbe eső köztes pontok elhagyása
  return out.filter((p, i) => {
    const a = out[(i - 1 + out.length) % out.length], b = out[(i + 1) % out.length];
    return Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) > 0.0005;
  });
}

/** A közel tengelyirányú élek végpontjait közös koordinátára húzza (több körben, mert egy pont két élhez tartozik). */
function orthogonalize(pts: Pt[]): Pt[] {
  const p = pts.map((q) => [...q] as Pt);
  const tol = Math.tan((AXIS_TOL_DEG * Math.PI) / 180);
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      if (Math.abs(dy) <= Math.abs(dx) * tol) { const y = (a[1] + b[1]) / 2; a[1] = y; b[1] = y; }
      else if (Math.abs(dx) <= Math.abs(dy) * tol) { const x = (a[0] + b[0]) / 2; a[0] = x; b[0] = x; }
    }
  }
  return p;
}

/** Egydimenziós csoportosítás: az ALIGN_TOL-on belüli értékek a csoport átlagát kapják. */
function cluster(values: number[]): (v: number) => number {
  const s = [...values].sort((a, b) => a - b);
  const groups: number[][] = [];
  for (const v of s) {
    const g = groups[groups.length - 1];
    if (g && v - g[0] <= ALIGN_TOL) g.push(v); else groups.push([v]);
  }
  const means = groups.map((g) => ({ lo: g[0], hi: g[g.length - 1], m: g.reduce((x, y) => x + y, 0) / g.length }));
  return (v: number) => means.find((g) => v >= g.lo - 1e-9 && v <= g.hi + 1e-9)?.m ?? v;
}

/** Óramutató járása szerinti sorrend (képernyő-koordinátában, y lefelé) — egységes él-irányok.
 *  Megfordításnál a nyitott élek indexe is átszámolódik (az i. él a fordított sorban az n-2-i. lesz). */
function clockwise(room: Room): Room {
  const pts = room.polygon;
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  if (s >= 0) return room;
  const n = pts.length;
  return { ...room, polygon: [...pts].reverse(), openEdges: room.openEdges?.map((i) => (((n - 2 - i) % n) + n) % n) };
}

const FIT_MAX_ABS = 0.35;  // legfeljebb ennyit (m) és…
const FIT_MAX_REL = 0.12;  // …ennyi arányt igazítunk egy méretvonalhoz
const MIN_GAP = 0.06;      // igazítás után a szomszédos helyiségtől legalább ekkora fal maradjon

/**
 * Téglalap alakú helyiségeknél: ha egy kiírt méretvonal a helyiséget szeli át (a helyiség teljes szélességét /
 * mélységét méri), a helyiség ezt a méretet kapja — mindkét oldalon a falból elvéve vagy hozzáadva, a szomszédok
 * nem mozdulnak. Ha a fal ettől túl vékony lenne, kihagyjuk. Visszaadja az igazítások számát.
 */
function fitDimensions(rooms: Room[], dims: { meters: number; a: Pt; b: Pt }[]): number {
  let fits = 0;
  for (const d of dims) {
    const k = Math.abs(d.b[0] - d.a[0]) >= Math.abs(d.b[1] - d.a[1]) ? 0 : 1, o = 1 - k;
    const mid: Pt = [(d.a[0] + d.b[0]) / 2, (d.a[1] + d.b[1]) / 2];
    const span = Math.abs(d.b[k] - d.a[k]);
    const room = rooms.find((r) => {
      if (r.polygon.length !== 4) return false;
      const lo = Math.min(...r.polygon.map((p) => p[k])), hi = Math.max(...r.polygon.map((p) => p[k]));
      const olo = Math.min(...r.polygon.map((p) => p[o])), ohi = Math.max(...r.polygon.map((p) => p[o]));
      return mid[o] > olo && mid[o] < ohi && mid[k] > lo && mid[k] < hi && Math.abs(span - (hi - lo)) <= FIT_MAX_ABS;
    });
    if (!room) continue;
    const lo = Math.min(...room.polygon.map((p) => p[k])), hi = Math.max(...room.polygon.map((p) => p[k]));
    const e = d.meters - (hi - lo);
    if (Math.abs(e) < 0.005 || Math.abs(e) > FIT_MAX_ABS || Math.abs(e) / d.meters > FIT_MAX_REL) continue;
    const nlo = lo - e / 2, nhi = hi + e / 2;
    // a szomszédoknak elég fal maradjon (a helyiséggel átfedő, szemközti oldali élek)
    const olo = Math.min(...room.polygon.map((p) => p[o])), ohi = Math.max(...room.polygon.map((p) => p[o]));
    const tooClose = rooms.some((r) => r !== room && r.polygon.some((p, i) => {
      const q = r.polygon[(i + 1) % r.polygon.length];
      if (Math.abs(p[k] - q[k]) > 0.001) return false; // csak a k-ra merőleges élek (állandó k-koordináta)
      const elo = Math.min(p[o], q[o]), ehi = Math.max(p[o], q[o]);
      if (Math.min(ehi, ohi) - Math.max(elo, olo) <= 0.05) return false;
      return (p[k] <= lo + 0.001 && p[k] > nlo - MIN_GAP) || (p[k] >= hi - 0.001 && p[k] < nhi + MIN_GAP);
    }));
    if (tooClose) continue;
    room.polygon = room.polygon.map((p) => {
      const q: Pt = [p[0], p[1]];
      if (Math.abs(p[k] - lo) < 0.001) q[k] = nlo; else if (Math.abs(p[k] - hi) < 0.001) q[k] = nhi;
      return q;
    });
    fits++;
  }
  return fits;
}

/** Két egyterű helyiség szembenéző, párhuzamos éleit (≤ 50 cm rés) a középvonalra húzza, és mindkettőt nyitottnak jelöli. */
function joinOpen(a: Room, b: Room) {
  for (let i = 0; i < a.polygon.length; i++) {
    const ea = roomEdge(a, i);
    if (!ea.axis) continue;
    const k = ea.axis === "x" ? 0 : 1, o = 1 - k;
    for (let j = 0; j < b.polygon.length; j++) {
      const eb = roomEdge(b, j);
      if (eb.axis !== ea.axis) continue;
      const gap = Math.abs(ea.a[o] - eb.a[o]);
      const overlap = Math.min(Math.max(ea.a[k], ea.b[k]), Math.max(eb.a[k], eb.b[k])) - Math.max(Math.min(ea.a[k], ea.b[k]), Math.min(eb.a[k], eb.b[k]));
      if (gap > 0.5 || overlap < 0.5) continue;
      const mid = (ea.a[o] + eb.a[o]) / 2;
      for (const [room, idx] of [[a, i], [b, j]] as const) {
        const n = room.polygon.length;
        room.polygon[idx][o] = mid;
        room.polygon[(idx + 1) % n][o] = mid;
        room.openEdges = [...new Set([...(room.openEdges ?? []), idx])];
      }
      return;
    }
  }
}

function nearestEdge(rooms: Room[], c: Pt, axis: "x" | "y", preferRoomId?: string) {
  let best: { roomId: string; edge: number; along: number; length: number; dist: number } | null = null;
  for (const r of rooms) {
    for (let i = 0; i < r.polygon.length; i++) {
      const e = roomEdge(r, i);
      if (e.axis !== axis) continue;
      const k = axis === "x" ? 0 : 1, o = 1 - k;
      const lo = Math.min(e.a[k], e.b[k]), hi = Math.max(e.a[k], e.b[k]);
      if (c[k] < lo - 0.1 || c[k] > hi + 0.1) continue;
      let dist = Math.abs(c[o] - e.a[o]);
      if (preferRoomId && r.id === preferRoomId) dist -= 0.05; // döntetlennél a megnevezett helyiség nyer
      if (dist > 0.45) continue;
      const along = Math.abs(c[k] - e.a[k]);
      if (!best || dist < best.dist) best = { roomId: r.id, edge: i, along, length: e.length, dist };
    }
  }
  return best;
}
