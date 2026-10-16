// SABLON (a run.mjs másolja .ts-ként). Szerkesztő-műveletek gépi tesztje (edit.ts) a megadott projekteken: falhúzás szomszéddal +
// mágnes, sarokpont beszúrás/törlés oda-vissza (a nyílászárók abszolút helye és a nyitott határok nem változhatnak), pont-illesztés,
// típusváltás, lerakás, és hogy a mentés (sanitizePlan) megtartja-e az új mezőket.
import { readFileSync } from "fs";
import { moveEdgeTo, insertVertex, deleteVertex, moveVertex, convertOpening, placeOpening, addColumn } from "./src/edit";
import { openingSegment, roomEdge, polygonArea } from "./src/geometry";
import { OPENING_PRESETS, sanitizePlan } from "./src/plan";
const all = JSON.parse(readFileSync(process.argv[2], "utf8"));
let total = 0, bad = 0;
const check = (name: string, cond: boolean, info = "") => { total++; if (!cond) { bad++; if (bad < 15) console.log("  HIBA:", name, info); } };
const near = (a: string | undefined, b: string | undefined) => { if (!a || !b) return false; const p = a.split(",").map(Number), q = b.split(",").map(Number); return Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.003; };
for (const d of all) {
  const plan0 = sanitizePlan(d.plan)!;
  const centers = (p: any) => new Map<string, string>(p.openings.map((o: any) => [o.id, openingSegment(p.rooms.find((r: any) => r.id === o.roomId), o).center.map((v: number) => v.toFixed(4)).join(",")]));
  const c0 = centers(plan0);
  for (const r of plan0.rooms) {
    for (let e = 0; e < r.polygon.length; e++) {
      const ed = roomEdge(r, e);
      if (ed.axis) { // falhúzás 10 cm-rel kifelé, szomszéddal; a helyiség területe nő
        const m = moveEdgeTo(plan0, r.id, e, ed.a[ed.axis === "x" ? 1 : 0] + 0.1 * (polygonArea(r.polygon) > 0 ? 1 : 1), { withNeighbors: true, wall: 0.1 });
        if (m) check(`falhúzás ${r.name}/${e}`, m.plan.rooms.length === plan0.rooms.length);
      }
      if (ed.length < 0.4) continue;
      const p1 = insertVertex(plan0, r.id, e, ed.length / 2); check(`beszúrás ${r.name}/${e}`, !!p1); if (!p1) continue;
      const c1 = centers(p1); for (const [id, c] of c0) check(`nyílászáró helye beszúrás után ${r.name}/${e}`, near(c1.get(id), c), `${c} → ${c1.get(id)}`);
      const R1 = p1.rooms.find((x) => x.id === r.id)!;
      check(`nyitott határ beszúrás után ${r.name}/${e}`, (R1.openEdges ?? []).length === (r.openEdges ?? []).length + ((r.openEdges ?? []).includes(e) ? 1 : 0));
      const p2 = deleteVertex(p1, r.id, e + 1); check(`törlés ${r.name}/${e}`, !!p2); if (!p2) continue;
      const R2 = p2.rooms.find((x) => x.id === r.id)!;
      check(`pontok vissza ${r.name}/${e}`, JSON.stringify(R2.polygon) === JSON.stringify(r.polygon));
      const c2 = centers(p2); for (const [id, c] of c0) check(`nyílászáró helye törlés után ${r.name}/${e}`, near(c2.get(id), c), `${c} → ${c2.get(id)}`);
      check(`nyitott határok vissza ${r.name}/${e}`, JSON.stringify([...(R2.openEdges ?? [])].sort()) === JSON.stringify([...(r.openEdges ?? [])].sort()));
    }
    if (r.polygon.every((_, i) => roomEdge(r, i).length > 0.1)) { // (rövid, ferde falat közelítő szakaszoknál a 2 cm-es mozgatás érvénytelen lehet)
      const mv = moveVertex(plan0, r.id, 0, [r.polygon[0][0] + 0.02, r.polygon[0][1] - 0.02]);
      // illesztés akkor várható, ha van más pont 4 cm-en belül az új x / y-hoz
      const tx = r.polygon[0][0] + 0.02, ty = r.polygon[0][1] - 0.02;
      const others = plan0.rooms.flatMap((x) => x.polygon.filter((_, i) => !(x.id === r.id && i === 0)));
      const wantX = others.some((q) => Math.abs(q[0] - tx) < 0.04), wantY = others.some((q) => Math.abs(q[1] - ty) < 0.04);
      check(`pont-illesztés ${r.name}`, !!mv && (mv.snapX !== null) === wantX && (mv.snapY !== null) === wantY, JSON.stringify([mv?.snapX, mv?.snapY, wantX, wantY]));
    }
  }
  for (const o of plan0.openings) {
    for (const t of ["door", "glassdoor", "window", "passage"] as const) {
      const n = convertOpening(plan0, o.id, t).openings.find((x) => x.id === o.id)!;
      check(`típusváltás ${o.kind}→${t}`, (t === "glassdoor" ? n.kind === "door" && n.glazed === true : n.kind === t) && (t !== "window" || n.sill > 0) && (t !== "passage" || n.height === plan0.ceilingHeight));
    }
  }
  const r0 = plan0.rooms[0];
  const np = placeOpening(plan0, r0.id, 0, roomEdge(r0, 0).length / 2, OPENING_PRESETS.find((p) => p.glazed)!);
  const col = addColumn(np, [r0.polygon[0][0] + 0.5, r0.polygon[0][1] + 0.5]);
  const san = sanitizePlan(JSON.parse(JSON.stringify(col.plan)))!;
  check("mentés: üvegajtó", san.openings.filter((o) => o.glazed).length > plan0.openings.filter((o) => o.glazed).length);
  check("mentés: oszlop", (san.columns ?? []).length === (plan0.columns ?? []).length + 1);
  console.log(`${d.id.slice(0, 8)} · szerkesztő-műveletek: ${total} ellenőrzés, ${bad} hiba`);
}
process.exit(bad ? 1 : 0);
