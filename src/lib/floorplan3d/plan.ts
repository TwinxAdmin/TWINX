// A digitalizált lakásleírás (JSON) — az EGYETLEN igazságforrás: a 3D-modell, az alaprajz-ábra és a videó is ebből dolgozik.
// Mértékegység: méter. Koordináták alaprajz-nézetben: x jobbra, y lefelé. Az első fázis derékszögű (tengelyirányú) falakat kezel.
//
// Helyiség = a helyiség BELSŐ (tiszta) körvonala; a helyiségek közti rés a fal. A terület (m²) a körvonalból számolódik.
// Nyílászáró = egy helyiség egy élén (edge = a sokszög i. pontjából az i+1.-be menő él), az él elejétől mért távolsággal.
// A falhossz-javítás nem változtatja a pontok számát, így az él-indexek stabilak maradnak.

export type Pt = [number, number];

/** Helyiségtípus: a stílus-referenciák (látványtervező `ROOM_TYPES`) slugjai + a 3D-hez szükséges továbbiak. */
export const ROOM_KINDS = [
  { value: "nappali", label: "Nappali" },
  { value: "konyha", label: "Konyha" },
  { value: "etkezo", label: "Étkező" },
  { value: "haloszoba", label: "Szoba / hálószoba" },
  { value: "gyerekszoba", label: "Gyerekszoba" },
  { value: "dolgozoszoba", label: "Dolgozószoba" },
  { value: "furdo", label: "Fürdő" },
  { value: "wc", label: "WC" },
  { value: "eloszoba", label: "Előszoba / közlekedő" },
  { value: "gardrob", label: "Gardrób / kamra" },
  { value: "terasz", label: "Terasz / erkély" },
  { value: "egyeb", label: "Egyéb" },
] as const;
export type RoomKind = (typeof ROOM_KINDS)[number]["value"];

/** Kültéri helyiség: nincs mennyezete, a 3D-ben nyitott. */
export const OUTDOOR_KINDS: RoomKind[] = ["terasz"];

export type Room = {
  id: string;
  name: string;
  kind: RoomKind;
  polygon: Pt[];
  /** A felhasználó által megadott valós m² (kötelező a jóváhagyáshoz). */
  declaredArea: number | null;
  /** Tudatos jóváhagyás: a tűrésen túli eltérést a felhasználó elfogadta. */
  areaApproved?: boolean;
  /** Fal nélküli határok (él-indexek), pl. egyterű nappali–konyha: itt a 3D-ben nincs fal. */
  openEdges?: number[];
};

export type Opening = {
  id: string;
  kind: "door" | "window";
  roomId: string;
  /** A helyiség-sokszög élének indexe (polygon[edge] → polygon[edge+1]). */
  edge: number;
  /** A nyílás közepének távolsága az él elejétől (m). */
  offset: number;
  width: number;
  height: number;
  /** Ablak: parapetmagasság (m). Ajtónál 0. */
  sill: number;
  /** Ajtó: melyik végén a zsanér (az él irányában) és merre nyílik (a helyiség felé = "in"). */
  hinge?: "start" | "end";
  swing?: "in" | "out";
};

/**
 * Összevont ellenőrzés: amikor a forrás (pl. a fejlesztő táblázata) több helyiséget EGYÜTT ad meg
 * (pl. „Hálószoba 34,11 m²" három szobára, vagy egyterű nappali + étkező + konyha). Ilyenkor a tagok
 * számolt területének ÖSSZEGÉT vetjük össze a csoport m²-ével; a tagoknak nem kell saját m².
 */
export type AreaGroup = {
  id: string;
  label: string;
  declaredArea: number | null;
  roomIds: string[];
  approved?: boolean;
};

export type FloorPlan = {
  version: 1;
  ceilingHeight: number;
  rooms: Room[];
  openings: Opening[];
  areaGroups?: AreaGroup[];
  /** A digitalizálás megjegyzései (bizonytalan pontok) — tájékoztató, a felület kiírja. */
  notes?: string[];
};

export const DOOR_DEFAULT = { width: 0.9, height: 2.1 };
export const WINDOW_DEFAULT = { width: 1.2, height: 1.5, sill: 0.9 };

/** Szabványos nyílászáró-méretek a javítófelülethez (szélesség × magasság, m; ablaknál parapet). „Egyedi" is választható. */
export type OpeningPreset = { id: string; kind: Opening["kind"]; label: string; width: number; height: number; sill: number };
export const OPENING_PRESETS: OpeningPreset[] = [
  { id: "d75", kind: "door", label: "Beltéri ajtó 75×210", width: 0.75, height: 2.1, sill: 0 },
  { id: "d90", kind: "door", label: "Beltéri ajtó 90×210", width: 0.9, height: 2.1, sill: 0 },
  { id: "d100", kind: "door", label: "Bejárati ajtó 100×210", width: 1.0, height: 2.1, sill: 0 },
  { id: "t90", kind: "door", label: "Erkély-/teraszajtó 90×240", width: 0.9, height: 2.4, sill: 0 },
  { id: "t150", kind: "door", label: "Kétszárnyú teraszajtó 150×240", width: 1.5, height: 2.4, sill: 0 },
  { id: "w60", kind: "window", label: "Kis ablak 60×60 (parapet 150)", width: 0.6, height: 0.6, sill: 1.5 },
  { id: "w90", kind: "window", label: "Ablak 90×120 (parapet 90)", width: 0.9, height: 1.2, sill: 0.9 },
  { id: "w120", kind: "window", label: "Ablak 120×150 (parapet 90)", width: 1.2, height: 1.5, sill: 0.9 },
  { id: "w150", kind: "window", label: "Ablak 150×150 (parapet 90)", width: 1.5, height: 1.5, sill: 0.9 },
  { id: "w180", kind: "window", label: "Ablak 180×150 (parapet 90)", width: 1.8, height: 1.5, sill: 0.9 },
];

/** Melyik szabványos méret illik a nyílászáróra (ha egyik sem: egyedi). */
export function presetOf(o: Pick<Opening, "kind" | "width" | "height" | "sill">): OpeningPreset | null {
  const eq = (a: number, b: number) => Math.abs(a - b) < 0.005;
  return OPENING_PRESETS.find((p) => p.kind === o.kind && eq(p.width, o.width) && eq(p.height, o.height) && eq(p.sill, o.sill)) ?? null;
}

/** Új azonosító (rövid, ütközésmentes a tervben). */
export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

// ---------------------------------------------------------------------------
// SZERKEZETI ELLENŐRZÉS — a kliensről érkező (javított) terv mentés előtt. Hibás szerkezetnél null.
const LIMITS = { rooms: 40, points: 40, openings: 200, coord: 200 };
const num = (v: unknown, lo: number, hi: number): number | null => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
const KINDS = new Set<string>(ROOM_KINDS.map((k) => k.value));

export function sanitizePlan(raw: unknown): FloorPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const ceilingHeight = num(p.ceilingHeight, 2, 5);
  if (ceilingHeight === null || !Array.isArray(p.rooms) || !Array.isArray(p.openings)) return null;
  if (p.rooms.length > LIMITS.rooms || p.openings.length > LIMITS.openings) return null;

  const rooms: Room[] = [];
  for (const r of p.rooms as Record<string, unknown>[]) {
    if (!r || typeof r.id !== "string" || !Array.isArray(r.polygon) || r.polygon.length < 3 || r.polygon.length > LIMITS.points) return null;
    const polygon: Pt[] = [];
    for (const q of r.polygon as unknown[]) {
      if (!Array.isArray(q)) return null;
      const x = num(q[0], -LIMITS.coord, LIMITS.coord), y = num(q[1], -LIMITS.coord, LIMITS.coord);
      if (x === null || y === null) return null;
      polygon.push([x, y]);
    }
    const n = polygon.length;
    rooms.push({
      id: r.id.slice(0, 40),
      name: typeof r.name === "string" ? r.name.slice(0, 60) : "",
      kind: (KINDS.has(String(r.kind)) ? r.kind : "egyeb") as RoomKind,
      polygon,
      declaredArea: num(r.declaredArea, 0.1, 500),
      areaApproved: r.areaApproved === true,
      openEdges: Array.isArray(r.openEdges) ? [...new Set((r.openEdges as unknown[]).filter((i): i is number => Number.isInteger(i) && (i as number) >= 0 && (i as number) < n))] : [],
    });
  }
  const ids = new Set(rooms.map((r) => r.id));
  const openings: Opening[] = [];
  for (const o of p.openings as Record<string, unknown>[]) {
    if (!o || typeof o.id !== "string" || typeof o.roomId !== "string" || !ids.has(o.roomId)) return null;
    const room = rooms.find((r) => r.id === o.roomId)!;
    const edge = Number.isInteger(o.edge) && (o.edge as number) >= 0 && (o.edge as number) < room.polygon.length ? (o.edge as number) : null;
    const offset = num(o.offset, 0, LIMITS.coord), width = num(o.width, 0.2, 10), height = num(o.height, 0.3, 5), sill = num(o.sill, 0, 3);
    if (edge === null || offset === null || width === null || height === null || sill === null) return null;
    openings.push({
      id: o.id.slice(0, 40), kind: o.kind === "window" ? "window" : "door", roomId: room.id, edge, offset, width, height, sill,
      ...(o.kind === "window" ? {} : { hinge: o.hinge === "end" ? "end" as const : "start" as const, swing: o.swing === "out" ? "out" as const : "in" as const }),
    });
  }
  const notes = Array.isArray(p.notes) ? (p.notes as unknown[]).filter((s): s is string => typeof s === "string").map((s) => s.slice(0, 300)).slice(0, 12) : [];
  // csoportok: csak létező helyiségek, egy helyiség legfeljebb egy csoportban, legalább 2 tag
  const used = new Set<string>();
  const areaGroups: AreaGroup[] = [];
  for (const g of (Array.isArray(p.areaGroups) ? p.areaGroups : []).slice(0, 20) as Record<string, unknown>[]) {
    if (!g || typeof g.id !== "string" || !Array.isArray(g.roomIds)) return null;
    const roomIds = [...new Set((g.roomIds as unknown[]).filter((id): id is string => typeof id === "string" && ids.has(id) && !used.has(id)))];
    if (roomIds.length < 2) continue;
    roomIds.forEach((id) => used.add(id));
    areaGroups.push({ id: g.id.slice(0, 40), label: typeof g.label === "string" ? g.label.slice(0, 60) : "Összevont", declaredArea: num(g.declaredArea, 0.1, 1000), roomIds, approved: g.approved === true });
  }
  return { version: 1, ceilingHeight, rooms, openings, areaGroups, notes };
}
