// FALKIOSZTÁS a nézőpontból (3. lépés, F3e) — tiszta függvény. A kritikus a KÉP szerint gondolkodik („hátsó fal", „jobb oldal"),
// az építő ALAPRAJZI koordinátákban — ez a fordítótábla köti össze a kettőt: melyik fal (index) látszik a képen balra / szemben /
// jobbra / a kamera mögött. Mindkettő ugyanazt a táblát kapja, így az utasítás („a kanapé a 2. falhoz") egyértelmű.
import type { Room } from "@/lib/floorplan3d/plan";
import { roomEdge } from "@/lib/floorplan3d/geometry";
import type { RoomView } from "@/lib/floorplan3d/camera";

export type WallSide = "left" | "back" | "right" | "behind";
const HU: Record<WallSide, string> = { left: "bal oldali fal", back: "szemközti (hátsó) fal", right: "jobb oldali fal", behind: "a kamera mögötti fal (nem látszik)" };

/** Falanként: melyik oldalon látszik a képen (a fal középpontjának iránya a nézési irányhoz képest). */
export function wallSides(room: Room, view: RoomView): { index: number; side: WallSide; label: string; length: number }[] {
  const fx = view.target[0] - view.pos[0], fy = view.target[1] - view.pos[1];
  const fl = Math.hypot(fx, fy) || 1;
  const f = [fx / fl, fy / fl];
  return room.polygon.map((_, i) => {
    const e = roomEdge(room, i);
    const mx = (e.a[0] + e.b[0]) / 2 - view.pos[0], my = (e.a[1] + e.b[1]) / 2 - view.pos[1];
    // szög a nézési iránytól; alaprajzon y lefelé nő, ezért a „jobbra" a (−f.y, f.x) irány
    const fwd = mx * f[0] + my * f[1], right = mx * -f[1] + my * f[0];
    const ang = (Math.atan2(right, fwd) * 180) / Math.PI;
    const side: WallSide = Math.abs(ang) <= 35 ? "back" : Math.abs(ang) >= 125 ? "behind" : ang > 0 ? "right" : "left";
    return { index: i, side, label: HU[side], length: Math.round(e.length * 100) / 100 };
  });
}

/** Szöveges tábla a promptokba. */
export function wallMapText(room: Room, view: RoomView): string {
  const open = new Set(room.openEdges ?? []);
  return wallSides(room, view).map((w) => `wall ${w.index} (${w.length} m) = ${w.side.toUpperCase()} in the image (${w.label})`
    + (open.has(w.index) ? " — OPEN BOUNDARY, NO WALL: the neighbouring room is visible through it; keep it passable" : "")).join("\n");
}
