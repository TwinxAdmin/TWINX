// A bemutató (oktató animáció) saját mintalakása — 10,60 × 7,00 m, ugyanaz, mint a látványtervben (design/3d-bemutato-latvanyterv.html).
// Kitalált lakás (nem harmadik fél rajza), ezért bárhol megjeleníthető: a modul első képernyőjén és a főoldalon is.
// Koordináták méterben, a helyiség-sokszögek óramutató szerint (bal felső → jobb felső → jobb alsó → bal alsó), a belső
// falsíkoknál; a helyiségek közti 10 cm-es rés a belső fal, az erkély előtti 30 cm a külső fal (scene.ts: wallSlabs).
import type { FloorPlan, Opening, Room } from "@/lib/floorplan3d/plan";
import { polygonArea, round2 } from "@/lib/floorplan3d/geometry";

const rect = (id: string, name: string, kind: Room["kind"], x0: number, y0: number, x1: number, y1: number): Room => {
  const polygon: Room["polygon"] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  return { id, name, kind, polygon, declaredArea: round2(polygonArea(polygon)), areaApproved: true };
};

const ROOMS: Room[] = [
  rect("nappali", "Nappali", "nappali", 0, 0, 6.42, 3.55),
  rect("halo", "Hálószoba", "haloszoba", 6.52, 0, 10.6, 3.55),
  rect("szoba", "Szoba", "haloszoba", 0, 3.65, 3.12, 7.0),
  rect("furdo", "Fürdő", "furdo", 3.22, 3.65, 5.12, 7.0),
  rect("eloszoba", "Előszoba", "eloszoba", 5.22, 3.65, 8.06, 7.0),
  rect("konyha", "Konyha", "konyha", 8.16, 3.65, 10.6, 7.0),
  rect("erkely", "Erkély", "terasz", 1.18, -1.3, 5.74, -0.3),
];

// élek: 0 = felső (balról jobbra), 1 = jobb (lefelé), 2 = alsó (jobbról balra), 3 = bal (felfelé); offset az él elejétől
const door = (id: string, roomId: string, edge: number, offset: number, width: number, extra: Partial<Opening> = {}): Opening =>
  ({ id, kind: "door", roomId, edge, offset, width, height: 2.1, sill: 0, ...extra });
const win = (id: string, roomId: string, edge: number, offset: number, width: number, sill = 0.9, height = 1.5): Opening =>
  ({ id, kind: "window", roomId, edge, offset, width, height, sill });

const OPENINGS: Opening[] = [
  door("d-bejarat", "eloszoba", 2, 1.2, 0.9),
  door("d-nappali", "eloszoba", 0, 0.53, 0.8),
  door("d-halo", "eloszoba", 0, 2.28, 0.8),
  door("d-furdo", "eloszoba", 3, 1.02, 0.75),
  door("d-konyha", "eloszoba", 1, 0.97, 0.8),
  door("d-szoba", "szoba", 0, 1.6, 0.8),
  door("d-erkely", "nappali", 0, 3.1, 1.4, { glazed: true, leaves: 2, closed: true }), // erkélyajtó: üvegajtó, becsukva (szabály)
  win("w-nappali-1", "nappali", 0, 5.03, 1.2),
  win("w-nappali-2", "nappali", 3, 1.77, 1.4),
  win("w-halo-1", "halo", 0, 1.75, 1.8),
  win("w-halo-2", "halo", 1, 1.8, 1.4),
  win("w-szoba-1", "szoba", 3, 1.73, 1.4),
  win("w-szoba-2", "szoba", 2, 1.5, 1.4),
  win("w-furdo", "furdo", 2, 0.94, 1.2, 1.0, 1.2), // a bemutató 4. jelenetében „kerül be" (120 cm, mint a kártyán)
  win("w-konyha-1", "konyha", 1, 1.62, 1.4),
  win("w-konyha-2", "konyha", 2, 1.18, 1.2),
];

export const DEMO_PLAN: FloorPlan = { version: 1, ceilingHeight: 2.7, rooms: ROOMS, openings: OPENINGS };

/** A bemutató bejárásának forgatókönyve (méter, fok; −90° = „észak", a rajzon felfelé).
 *  go: odasétál (útkereséssel, a bútorokat kikerülve; a nézés az úton előre tekint, vagy `face` pont felé; `speed` m/s)
 *  · look / lookAt: helyben lassan odafordul (abszolút irány vagy pont) · hold: megáll.
 *  A nézőpontok a mintalakás alap-berendezéséhez igazodnak (apartmentFurniture: a nappali ülőgarnitúrája a keleti falnál). */
export type DemoStep =
  | { go: [number, number]; face?: [number, number]; speed?: number }
  | { look: number; ms: number }
  | { lookAt: [number, number]; ms: number }
  | { hold: number };
export const DEMO_START = { pos: [6.86, 8.7] as [number, number], yaw: -90 }; // a lépcsőházban, a bejárati ajtó előtt
export const DEMO_SCRIPT: DemoStep[] = [
  { hold: 900 },
  { go: [6.86, 5.9] },                                     // be az előszobába (a bejárati ajtó odaérve kinyílik)
  { go: [7.5, 4.3] },                                      // a háló ajtaja elé (kinyílik)
  { go: [7.5, 3.05] },                                     // benézünk a hálóba
  { lookAt: [8.9, 0.3], ms: 1700 },                        // az ablak és a komód felé
  { lookAt: [6.9, 0.9], ms: 1500 },                        // a fotel felé
  { go: [5.75, 4.25] },                                    // vissza, a nappali ajtaja elé (kinyílik)
  { go: [5.75, 3.0] },
  { go: [1.7, 2.45] },                                     // át a nappalin a nyugati ablak felé
  { lookAt: [5.9, 1.25], ms: 3400 },                       // lassan visszafordulunk: a teljes, tágas tér a kanapéval
  { go: [2.25, 2.25], face: [5.9, 1.25], speed: 0.4 },    // lassú közelítés — itt ér véget a bejárás
  { hold: 500 },
];

/** A bemutató 4. jelenete: a fürdő ablaka a 3D-ben „kerül be" — előtte a terv nélküle. */
export const DEMO_NEW_WINDOW_ID = "w-furdo";
export const DEMO_PLAN_BEFORE: FloorPlan = { ...DEMO_PLAN, openings: DEMO_PLAN.openings.filter((o) => o.id !== DEMO_NEW_WINDOW_ID) };
