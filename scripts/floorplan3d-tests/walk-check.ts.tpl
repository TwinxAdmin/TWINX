// SABLON (a run.mjs másolja .ts-ként egy ideiglenes mappába). Gépi bejárás-teszt (3D-modul): minden helyiség elérhető-e a kezdőpontból, minden ajtón/átjárón át lehet-e menni, ablakon nem,
// és a kész modell méretpontossága. Futtatás: node scripts/floorplan3d-tests/run.mjs <projekt-id> [...]
import { readFileSync } from "fs";
import { apartmentFurniture } from "./src/furniture";
import { colliders, findPath, startPose, moveWithCollision, blocked } from "./src/walk";
import { planBounds, openingSegment } from "./src/geometry";
import { buildApartment, measureApartment } from "./src/scene";
const all = JSON.parse(readFileSync(process.argv[2], "utf8"));
let fail = 0;
for (const d of all) {
  const plan = d.plan, opts = { interiorWall: 0.1, exteriorWall: 0.3 };
  const rects = colliders(plan, opts, apartmentFurniture(plan, d.furnishing));
  const st = startPose(plan, rects), b = planBounds(plan);
  const unreach = plan.rooms.filter((r: any) => { const c = r.polygon.reduce((a: number[], p: number[]) => [a[0] + p[0] / r.polygon.length, a[1] + p[1] / r.polygon.length], [0, 0]); return !findPath(st.pos, c, rects, b); }).map((r: any) => r.name);
  let ok = 0; const bad: string[] = [];
  for (const o of plan.openings) {
    const room = plan.rooms.find((r: any) => r.id === o.roomId); const s = openingSegment(room, o);
    // 35 cm-re a nyílástól mindkét oldalon (a 53 cm mély francia erkélyen is a helyiségben marad)
    // (nagyon kicsi helyiségnél — pl. 53 cm-es francia erkély — a középpontjához közelebb is próbálunk)
    const n = s.axis === "x" ? [0, 1] : [1, 0];
    let a: [number, number] = [s.center[0] - n[0] * 0.35, s.center[1] - n[1] * 0.35], pass = false;
    for (const k of [0.35, 0.27]) {
      a = [s.center[0] - n[0] * k, s.center[1] - n[1] * k];
      const e = moveWithCollision(a, [n[0] * 2 * k, n[1] * 2 * k], rects);
      if (Math.hypot(e[0] - a[0], e[1] - a[1]) > 2 * k - 0.05) { pass = true; break; }
    }
    if (pass === (o.kind !== "window")) ok++; else bad.push(`${room.name} ${o.kind}${blocked(a, rects) ? " (a kezdőpont foglalt)" : ""}`);
  }
  const m = measureApartment(plan, buildApartment(plan, opts));
  const worst = Math.max(...m.map((x) => x.maxErrorMm));
  if (unreach.length || bad.length || blocked(st.pos, rects)) fail++;
  console.log(`${d.id.slice(0, 8)} · ${plan.rooms.length} helyiség · kezdés ${blocked(st.pos, rects) ? "FOGLALT" : "szabad"} · elérhetetlen: ${unreach.join(", ") || "nincs"} · nyílászárók ${ok}/${plan.openings.length} ${bad.join("; ")} · max. mérési eltérés ${worst} mm`);
}
process.exit(fail ? 1 : 0);
