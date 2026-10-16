// IntroWalkthrough — a bemutató (oktató animáció) 5. jelenete: VALÓDI 3D bejárás a mintalakásban (demo.ts), a modul saját motorjával
// (buildApartment + bútorok + stílus), előre megírt kameraúttal. A partner pontosan azt látja, amit majd a saját lakásával kap.
//   • a kameraút előre ki van számolva (útkereséssel, a bútorokat kikerülve) → egyenletes, nem „ugrál", végtelenítve ismételhető;
//   • az ajtók becsukva indulnak, és odaérve kinyílnak; a végén a nappaliban lassú körbenézés;
//   • utána: „Elfogadom a tervet" → zöld + bemelegedő fény → a gomb megosztható linkké alakul.
// Nincs vezérlés (nem lehet beleavatkozni): ez bemutató, nem a valódi bejárás.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { FloorPlan, Pt } from "@/lib/floorplan3d/plan";
import { OUTDOOR_KINDS } from "@/lib/floorplan3d/plan";
import type { StyleSheet } from "@/lib/floorplan3d/stylesheet";
import { apartmentFurniture } from "@/lib/floorplan3d/furniture";
import { applyStyle, kelvinToColor } from "@/lib/floorplan3d/materials";
import { buildFurniture, furnitureMaterials } from "@/lib/floorplan3d/furniture3d";
import { buildApartment, railOutdoorWalls, type SceneOptions } from "@/lib/floorplan3d/scene";
import { planBounds, pointInPolygon } from "@/lib/floorplan3d/geometry";
import { colliders, findPath, EYE_HEIGHT } from "@/lib/floorplan3d/walk";
import { DEMO_PLAN, DEMO_SCRIPT, DEMO_START, type DemoStep } from "@/lib/floorplan3d/demo";

const SPEED = 0.95;        // m/s — lassú, nyugodt séta
const TURN = 1.8;          // a nézés ennyi /s ütemben fordul a haladás irányába (lágyan)
const LOOKAHEAD = 1.4;     // m — ennyivel előre néz az úton
const DOOR_NEAR = 1.6;     // ennyi méteren belül kinyílik az ajtó
const DOOR_SPEED = 1.5;    // rad/s
const DT = 1 / 60;
const ACCEPT_AFTER = 700, LINK_AFTER = 2300, LOOP_AFTER = 6500; // ms a séta vége után

type Sample = { x: number; y: number; yaw: number };
const ang = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const smooth = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

/** A teljes kameraút előre kiszámolva (60 minta / mp): determinisztikus, bármelyik időpontra lekérhető. */
function simulate(plan: FloorPlan, script: DemoStep[], rects: ReturnType<typeof colliders>): Sample[] {
  const b = planBounds(plan);
  const out: Sample[] = [];
  let pos: Pt = [...DEMO_START.pos], yaw = (DEMO_START.yaw * Math.PI) / 180;
  const rec = () => out.push({ x: pos[0], y: pos[1], yaw });
  const turnTo = (goal: number, ms: number) => {
    const from = yaw, to = from + ang(goal - from); // a rövidebb úton
    const n = Math.max(1, Math.round(ms / 1000 / DT));
    for (let i = 1; i <= n; i++) { yaw = from + (to - from) * smooth(i / n); rec(); }
  };
  const inside = (p: Pt) => p[0] > b.minX && p[0] < b.maxX && p[1] > b.minY && p[1] < b.maxY;
  for (const s of script) {
    if ("hold" in s) { for (let t = 0; t < s.hold / 1000; t += DT) rec(); continue; }
    if ("look" in s) { turnTo((s.look * Math.PI) / 180, s.ms); continue; }
    if ("lookAt" in s) { turnTo(Math.atan2(s.lookAt[1] - pos[1], s.lookAt[0] - pos[0]), s.ms); continue; }
    // go: a lakáson kívül (lépcsőház) egyenesen, bent útkereséssel; a nézés LOOKAHEAD méterrel előre tekint az úton
    // (a kanyar előtt már fordul, és nem a szemközti falat nézi), vagy a megadott pont felé
    const path: Pt[] = [pos, ...(inside(pos) ? (findPath(pos, s.go, rects, b) ?? [s.go]) : [s.go])];
    const lens = path.slice(1).map((q, i) => Math.hypot(q[0] - path[i][0], q[1] - path[i][1]));
    const total = lens.reduce((a, l) => a + l, 0);
    const at = (d: number): Pt => {
      d = Math.max(0, Math.min(total, d));
      for (let i = 0; i < lens.length; i++) {
        if (d <= lens[i] || i === lens.length - 1) { const k = lens[i] ? d / lens[i] : 1; return [path[i][0] + (path[i + 1][0] - path[i][0]) * k, path[i][1] + (path[i + 1][1] - path[i][1]) * k]; }
        d -= lens[i];
      }
      return path[path.length - 1];
    };
    const v = s.speed ?? SPEED;
    for (let d = 0; d < total; ) {
      d = Math.min(total, d + v * DT);
      pos = at(d);
      const ahead = at(d + LOOKAHEAD);
      const want = s.face ? Math.atan2(s.face[1] - pos[1], s.face[0] - pos[0])
        : Math.hypot(ahead[0] - pos[0], ahead[1] - pos[1]) > 0.05 ? Math.atan2(ahead[1] - pos[1], ahead[0] - pos[0]) : yaw;
      yaw += ang(want - yaw) * Math.min(1, DT * TURN);
      rec();
    }
  }
  return out;
}

/** playing = false: betölt és az első képkockán vár (a bemutató előre betölti, hogy a jelenetváltáskor azonnal induljon);
 *  loop = false: a végén egyszer meghívja az onEnd-et (a bemutató ekkor lép tovább); onProgress: 0..1 (a lépés-sávhoz). */
export default function IntroWalkthrough({ opts, style, credits, plan = DEMO_PLAN, script = DEMO_SCRIPT, link = "twinx.hu/3d/a8Fk…", playing = true, loop = true, onProgress, onEnd }: {
  opts: SceneOptions; style: StyleSheet | null; credits: number; plan?: FloorPlan; script?: DemoStep[]; link?: string;
  playing?: boolean; loop?: boolean; onProgress?: (f: number) => void; onEnd?: () => void;
}) {
  const playRef = useRef(playing), loopRef = useRef(loop), progRef = useRef(onProgress), endRef = useRef(onEnd);
  useEffect(() => { playRef.current = playing; loopRef.current = loop; progRef.current = onProgress; endRef.current = onEnd; }, [playing, loop, onProgress, onEnd]);
  const hostRef = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState("Lépcsőház");
  const [phase, setPhase] = useState<"walk" | "ask" | "ok" | "link">("walk");
  const [loading, setLoading] = useState(true);
  const furniture = useMemo(() => apartmentFurniture(plan, null), [plan]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe4edf3);
    const built = buildApartment(plan, opts);
    built.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (o.userData.kind === "ceiling") { m.castShadow = true; m.receiveShadow = true; }
      if (o.userData.kind === "window") m.castShadow = false;
      if (o.userData.kind === "door") o.traverse((x) => { (x as THREE.Mesh).castShadow = true; });
    });
    scene.add(built.group);
    railOutdoorWalls(plan, built);

    // lépcsőház a bejárat előtt (padló + két oldalfal), hogy a kezdőkép ne a semmiben lebegjen
    const b = planBounds(plan);
    const hall = new THREE.Group();
    const hallMat = new THREE.MeshStandardMaterial({ color: 0xb9b2a6, roughness: 0.95 });
    const hallFloor = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.6), new THREE.MeshStandardMaterial({ color: 0x8f877c, roughness: 1 }));
    hallFloor.rotation.x = -Math.PI / 2; hallFloor.position.set(DEMO_START.pos[0], 0.001, b.maxY + 0.3 + 1.3); hallFloor.receiveShadow = true;
    hall.add(hallFloor);
    for (const side of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.15, plan.ceilingHeight, 2.6), hallMat);
      w.position.set(DEMO_START.pos[0] + side * 1.6, plan.ceilingHeight / 2, b.maxY + 0.3 + 1.3); hall.add(w);
    }
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshStandardMaterial({ color: 0x5d4a3a, roughness: 1 }));
    mat.rotation.x = -Math.PI / 2; mat.position.set(DEMO_START.pos[0], 0.004, b.maxY + 0.62); hall.add(mat);
    scene.add(hall);

    // fények (mint a valódi bejárásban)
    const cx = (b.minX + b.maxX) / 2, cz = (b.minY + b.maxY) / 2, span = Math.max(b.maxX - b.minX, b.maxY - b.minY);
    const hemi = new THREE.HemisphereLight(kelvinToColor(5600), 0xb9ad9c, 1.15);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d8, 3.2);
    sun.position.set(cx - span * 0.9, span * 0.75, cz - span * 0.6);
    sun.target.position.set(cx, 0, cz);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
    const sc = sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 0.5; sc.far = span * 4;
    scene.add(sun, sun.target);
    const warm = kelvinToColor(style ? (style.light_kelvin[0] + style.light_kelvin[1]) / 2 : 3200, 0.55);
    for (const r of plan.rooms) {
      if (OUTDOOR_KINDS.includes(r.kind)) continue;
      const c = r.polygon.reduce((a, p) => [a[0] + p[0] / r.polygon.length, a[1] + p[1] / r.polygon.length], [0, 0]);
      const l = new THREE.PointLight(warm, 1.3, 6.5, 1.6);
      l.position.set(c[0], plan.ceilingHeight - 0.3, c[1]);
      scene.add(l);
    }

    void (async () => {
      if (style) await applyStyle(built, plan, style).catch(() => null);
      const mats = await furnitureMaterials().catch(() => null);
      const g = mats && !disposed ? await buildFurniture(furniture, mats, plan.ceilingHeight).catch(() => null) : null;
      if (g && !disposed) scene.add(g);
      if (!disposed) setLoading(false);
    })();

    // ajtók: mind becsukva indul, odaérve kinyílik (az erkélyajtó becsukva marad — szabály)
    type Door = { obj: THREE.Object3D; base: number; dir: number; center: Pt; keepClosed: boolean };
    const doors: Door[] = [];
    built.group.traverse((o) => {
      const d = o.userData.doorPivot as { base: number; dir: number; closed: boolean; center: Pt; openingId: string } | undefined;
      if (!d) return;
      const op = plan.openings.find((x) => x.id === d.openingId);
      doors.push({ obj: o, base: d.base, dir: d.dir, center: d.center, keepClosed: !!op?.glazed && d.closed });
    });

    const samples = simulate(plan, script, colliders(plan, opts, furniture));
    const walkMs = (samples.length * DT) * 1000;
    // az ajtószögek is előre: minden mintához (így bármelyik időpont visszajátszható, a ciklus elején minden becsukva)
    const doorAngles: Float32Array[] = doors.map(() => new Float32Array(samples.length));
    {
      const a = doors.map(() => 0);
      samples.forEach((s, i) => doors.forEach((d, k) => {
        if (!d.keepClosed && Math.hypot(s.x - d.center[0], s.y - d.center[1]) < DOOR_NEAR) a[k] = Math.min(Math.PI / 2, a[k] + DOOR_SPEED * DT);
        doorAngles[k][i] = a[k];
      }));
    }

    const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 100);
    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let raf = 0, t0 = performance.now(), lastRoom = "", lastPhase = "", ended = false, wasPlaying = false;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      // várakozás: egyszer kirajzoljuk a kezdőképet (előtöltés), leálláskor az utolsó kép marad (elhalványul) — nem ugrik vissza
      if (!playRef.current) { wasPlaying = false; if (lastPhase) return; }
      else if (!wasPlaying) { wasPlaying = true; t0 = performance.now(); ended = false; }
      let t = playRef.current ? performance.now() - t0 : 0;
      progRef.current?.(Math.min(1, t / (walkMs + LOOP_AFTER)));
      if (t > walkMs + LOOP_AFTER) {
        if (loopRef.current) { t0 = performance.now(); t = 0; }
        else { t = walkMs + LOOP_AFTER; if (!ended) { ended = true; endRef.current?.(); } }
      }
      const i = Math.min(samples.length - 1, Math.floor(t / 1000 / DT));
      const s = samples[i];
      camera.position.set(s.x, EYE_HEIGHT, s.y);
      camera.lookAt(s.x + Math.cos(s.yaw), EYE_HEIGHT - 0.07, s.y + Math.sin(s.yaw));
      doors.forEach((d, k) => { d.obj.rotation.y = d.base + d.dir * doorAngles[k][i]; });
      // elfogadás: lágyan bemelegedő, világosabb kép
      const ok = smooth((t - walkMs - ACCEPT_AFTER - 400) / 900);
      renderer.toneMappingExposure = 1.05 + 0.18 * ok;
      hemi.intensity = 1.15 + 0.35 * ok;
      renderer.render(scene, camera);

      const r = plan.rooms.find((x) => pointInPolygon([s.x, s.y], x.polygon));
      const n = r?.name ?? "Lépcsőház";
      if (n !== lastRoom) { lastRoom = n; setRoom(n); }
      const ph = t < walkMs ? "walk" : t < walkMs + ACCEPT_AFTER + 400 ? "ask" : t < walkMs + LINK_AFTER ? "ok" : "link";
      if (ph !== lastPhase) { lastPhase = ph; setPhase(ph); }
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mt = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach((x) => x.dispose());
      });
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [plan, script, opts, style, furniture]);

  const pill = { background: "rgba(18,16,14,0.62)", color: "#fff", backdropFilter: "blur(6px)" } as const;
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[22px] select-none" style={{ background: "#12100e" }} aria-label="Bemutató: bejárás szemmagasságból">
      <div ref={hostRef} className="absolute inset-0" />
      {/* zöld felvillanás az elfogadáskor */}
      <div className="pointer-events-none absolute inset-0 transition-opacity duration-700"
        style={{ opacity: phase === "ok" ? 1 : 0, background: "radial-gradient(60% 60% at 50% 50%, rgba(72,190,120,0.40), rgba(72,190,120,0) 70%)" }} />
      <span className="absolute left-3 top-3 flex h-8 min-w-[104px] items-center justify-center rounded-full px-3 text-[12px] font-semibold" style={pill}>{room}</span>
      {loading && (
        <span className="absolute inset-x-0 top-1/2 mx-auto w-fit -translate-y-1/2 rounded-full px-4 py-2 text-[12.5px] font-semibold" style={pill}>3D lakás betöltése…</span>
      )}
      {/* elfogadás → link: ugyanazon a helyen, fix méretű sávban (nem ugrál) */}
      <div className="absolute inset-x-0 bottom-4 flex h-[46px] justify-center">
        {phase === "link" ? (
          <div className="flex h-[46px] items-center gap-2.5 rounded-full bg-white pl-4 pr-1.5 text-[12.5px] text-[#1C1815] shadow-[0_12px_30px_rgba(0,0,0,0.4)]">
            <span aria-hidden>🔗</span><b className="font-[Manrope]">{link}</b>
            <span className="flex h-[34px] items-center rounded-full bg-[#12100e] px-3 text-[12px] font-bold text-white">Küldés a vevőnek →</span>
          </div>
        ) : (
          <span className="flex h-[46px] items-center rounded-full px-6 text-[14px] font-extrabold text-white transition-all duration-500"
            style={{
              opacity: phase === "walk" ? 0 : 1,
              background: phase === "ok" ? "linear-gradient(160deg,#4CC57E,#2F9E5F)" : "linear-gradient(160deg,#F49274,#E9693F)",
              boxShadow: phase === "ok" ? "0 12px 30px rgba(47,158,95,0.45)" : "0 12px 30px rgba(233,105,63,0.45)",
            }}>
            {phase === "ok" ? `Elfogadva ✓ · ${credits} kredit levonva` : "✓ Elfogadom a tervet"}
          </span>
        )}
      </div>
    </div>
  );
}
