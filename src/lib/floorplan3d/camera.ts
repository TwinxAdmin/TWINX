// Helyiség-nézőpont a célképhez és a kritikushoz (3. lépés, F3d) — tiszta függvény, three.js nélkül.
// Szemmagasság (1,6 m), a helyiség „belépési" pontjából (ajtó / átjáró, ~90 cm-rel befelé — a nyitott ajtólap ne takarjon), vagy ha nincs, a súlyponttól
// legtávolabbi sarokból (45 cm-rel befelé), átlósan a helyiség belseje felé. Ugyanez a nézőpont kell a célképhez ÉS a kritikushoz,
// hogy a két kép összevethető legyen.
import type { FloorPlan, Pt, Room } from "@/lib/floorplan3d/plan";
import { roomEdge } from "@/lib/floorplan3d/geometry";
import { entrances } from "@/lib/floorplan3d/furniture";

export type RoomView = { pos: Pt; target: Pt; eye: number; fov: number };

export const VIEW_EYE_HEIGHT = 1.6;
export const VIEW_FOV = 55; // függőleges látószög (fok) — 4:3 képen ~70° vízszintes: ingatlanfotó-szerű, még nem torzít (68° túl széles volt)

function centroid(room: Room): Pt {
  // területtel súlyozott súlypont (L alakú helyiségnél is a „tömeg" közepe)
  let a = 0, cx = 0, cy = 0;
  const p = room.polygon;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length];
    const f = x1 * y2 - x2 * y1;
    a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f;
  }
  return a ? [cx / (3 * a), cy / (3 * a)] : p[0];
}

function inside(p: Pt, poly: Pt[]): boolean {
  let r = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) r = !r;
  }
  return r;
}

export function roomViewpoint(plan: FloorPlan, room: Room): RoomView {
  const c = centroid(room);
  const cands: Pt[] = [];
  // 1) bejáratok (a fal belső síkjától ~90 cm-re befelé — a belépő ember szeme, az ajtólapon túl)
  for (const e of entrances(plan, room)) {
    const d = Math.hypot(c[0] - e.p[0], c[1] - e.p[1]) || 1;
    cands.push([e.p[0] + ((c[0] - e.p[0]) / d) * 0.45, e.p[1] + ((c[1] - e.p[1]) / d) * 0.45]);
  }
  // 2) ha nincs bejárat: sarkok, a szögfelező mentén 45 cm-rel befelé
  if (!cands.length) {
    room.polygon.forEach((_, i) => {
      const prev = roomEdge(room, (i - 1 + room.polygon.length) % room.polygon.length), next = roomEdge(room, i);
      const n1 = [-(prev.b[1] - prev.a[1]) / (prev.length || 1), (prev.b[0] - prev.a[0]) / (prev.length || 1)];
      const n2 = [-(next.b[1] - next.a[1]) / (next.length || 1), (next.b[0] - next.a[0]) / (next.length || 1)];
      const p: Pt = [room.polygon[i][0] + (n1[0] + n2[0]) * 0.45, room.polygon[i][1] + (n1[1] + n2[1]) * 0.45];
      if (inside(p, room.polygon)) cands.push(p);
    });
  }
  // a súlyponttól legtávolabbi jelölt látja be legjobban a teret
  const pos = cands.sort((a, b) => Math.hypot(b[0] - c[0], b[1] - c[1]) - Math.hypot(a[0] - c[0], a[1] - c[1]))[0] ?? c;
  return { pos, target: c, eye: VIEW_EYE_HEIGHT, fov: VIEW_FOV };
}
