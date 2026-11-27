// „Alaprajzból 3D" bemutató a főoldali GDN-referencia blokkban (Márk kérése 2026-11-24) — a modul SAJÁT 3D-motorjával
// (three.js; lib/floorplan3d/scene.ts → buildApartment), a modul mintalakásán (lib/floorplan3d/demo.ts, 10,60 × 7,00 m).
// Így a falak valódi vastagságúak, a sarkok és csatlakozások pontosan illeszkednek, az ablakok (keret + üveg) és ajtók
// (tok + lap) a valódi helyükön vannak — ugyanaz a geometria, amit a modul az ügyfélnek is épít.
//
// Ütemek (egy kör ~14,5 mp; minden átmenet folyamatos, nincs ugrás):
//   alaprajz felülnézetből (sötét falvonalak, helyiségnevek) → a kamera lágyan megdől → a falak egyszerre, egyenletesen
//   kinőnek (közben a falvonal színe vakolatszínre úszik) → áttűnéssel megjelennek a nyílászárók → áttűnéssel lerakódik a
//   burkolat (parketta, csempe, járólap — demoFloors.ts) → helyiségcímkék m²-rel, a modell lágyan forogni kezd, és gyorsan
//   érkeznek az érdeklődő üzenetek. A kör végén áttűnéssel indul újra. FALSZÍNEZÉS NINCS (Márk döntése).
// Csak akkor rajzol, ha látszik (IntersectionObserver). „Mozgás csökkentése": a kész, álló kép.
"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { buildApartment, railOutdoorWalls } from "@/lib/floorplan3d/scene";
import { planBounds } from "@/lib/floorplan3d/geometry";
import { kelvinToColor } from "@/lib/floorplan3d/materials";
import { DEMO_PLAN } from "@/lib/floorplan3d/demo";
import { demoFloorMaterial } from "@/components/floorplan3d/intro/demoFloors";
import { FLOORPLAN_DEMO_MS } from "@/components/site/b/floorplanDemoTiming";

// Falvastagság: a modul alapbeállítása (config.ts: FLOORPLAN3D_WALL_INTERIOR / _EXTERIOR).
const OPTS = { interiorWall: 0.1, exteriorWall: 0.3 };

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };
const smoother = (t: number) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
const span = (t: number, a: number, b: number) => (t - a) / (b - a);

// időzítés (ms)
const T = {
  tilt: [1300, 3300], grow: [2300, 4600], open: [4300, 5400], floor: [5000, 6300],
  labels: 6200, rot: 5900, rotRamp: 1800, msg: 6700, msgStep: 650, fadeOut: [14000, 14500],
};
const PLAN_WALL = 0.05; // a falak „alaprajz-magassága" (a teljes magasság aránya)

const ROOM_LABELS = DEMO_PLAN.rooms.map((r) => {
  const c = r.polygon.reduce((a, p) => [a[0] + p[0] / r.polygon.length, a[1] + p[1] / r.polygon.length], [0, 0]);
  return { id: r.id, name: r.name, area: (r.declaredArea ?? 0).toLocaleString("hu-HU", { minimumFractionDigits: 1, maximumFractionDigits: 1 }), c };
});

const MESSAGES = [
  "Mikor lehet megnézni?",
  "Nagyon tetszik az elrendezés!",
  "Elérhető még a lakás?",
  "Hétvégén ráérnék megnézni.",
  "Az erkély szuper, mehetünk holnap?",
  "Továbbküldtem a páromnak is.",
];
const CAPTIONS = ["Alaprajz feltöltve", "Felismert falak, ajtók, ablakok", "Felépül 3D-ben", "Burkolat lerakva", "Bejárható, továbbküldhető"];
const captionAt = (t: number) => (t < T.tilt[0] ? 0 : t < T.grow[0] + 600 ? 1 : t < T.floor[0] ? 2 : t < T.labels ? 3 : 4);
const msgsAt = (t: number) => (t < T.msg ? 0 : Math.min(MESSAGES.length, 1 + Math.floor((t - T.msg) / T.msgStep)));

export default function Floorplan3DDemo({ reduce }: { reduce: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [caption, setCaption] = useState(reduce ? 4 : 0);
  const [msgs, setMsgs] = useState(reduce ? MESSAGES.length : 0);

  useEffect(() => {
    const host = hostRef.current, box = boxRef.current;
    if (!host || !box) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const built = buildApartment(DEMO_PLAN, OPTS);
    built.group.traverse((o) => { if (o.userData.kind === "ceiling") o.visible = false; });
    railOutdoorWalls(DEMO_PLAN, built);
    built.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = o.userData.kind !== "floor"; m.receiveShadow = true; } });
    const root = new THREE.Group();
    root.add(built.group);
    scene.add(root);

    // Falak: közös anyag; alaprajzban sötét „tus" vonal, a kinövés alatt folyamatosan vakolatszínre úszik.
    const wallMat = built.walls[0]?.material as THREE.MeshStandardMaterial | undefined;
    const PLASTER = wallMat ? wallMat.color.clone() : new THREE.Color(0xeeeae3);
    const INK = new THREE.Color(0x3b3346);

    // Nyílászárók: saját (átlátszó) anyagpéldány, hogy lágyan, áttűnéssel jelenjenek meg.
    const openMats: { m: THREE.Material; base: number }[] = [];
    built.group.traverse((o) => {
      let p: THREE.Object3D | null = o, isOpen = false;
      while (p) { if (p.userData.kind === "window" || p.userData.kind === "door") { isOpen = true; break; } p = p.parent; }
      const mesh = o as THREE.Mesh;
      if (!isOpen || !mesh.isMesh) return;
      const src = mesh.material as THREE.Material;
      const m = src.clone();
      m.transparent = true;
      openMats.push({ m, base: src.transparent ? src.opacity : 1 });
      mesh.material = m;
    });

    // Burkolat: a helyiséghez illő padló (demoFloors), fölötte egy „papír" réteg, ami áttűnéssel eltűnik.
    const ownMats: THREE.Material[] = [];
    // polygonOffset + kis emelés: a papír és a burkolat nem „vibrál" egymáson (z-fighting).
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xf6f1ea, roughness: 1, transparent: true, opacity: 1, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    ownMats.push(paperMat);
    for (const room of DEMO_PLAN.rooms) {
      const floor = built.floors.get(room.id);
      if (!floor) continue;
      const mat = demoFloorMaterial(room.id, room.kind, renderer);
      if (mat) { floor.material = mat; ownMats.push(mat); }
      const paper = new THREE.Mesh(floor.geometry, paperMat);
      paper.rotation.copy(floor.rotation);
      paper.position.copy(floor.position);
      paper.position.y += 0.012;
      paper.renderOrder = 1;
      built.group.add(paper);
    }

    const b = planBounds(DEMO_PLAN);
    const cx = (b.minX + b.maxX) / 2, cz = (b.minY + b.maxY) / 2, sp = Math.max(b.maxX - b.minX, b.maxY - b.minY);
    scene.add(new THREE.HemisphereLight(kelvinToColor(5200), 0xbdb3a4, 1.5));
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.1);
    sun.position.set(cx - sp, sp * 1.6, cz + sp * 0.6);
    sun.target.position.set(cx, 0, cz);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -sp; sc.right = sp; sc.top = sp; sc.bottom = -sp; sc.near = 0.5; sc.far = sp * 5;
    scene.add(sun, sun.target);

    const camera = new THREE.PerspectiveCamera(34, 1, 1, 120); // szűkebb mélységtartomány → pontosabb mélység, nincs villódzás
    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const center = new THREE.Vector3(cx, 0.4, cz);
    const radius = Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 2 + 0.4;
    const AZ0 = -0.6, W = 0.42 / 1000; // forgás: rad / ms (lágyan felgyorsul)
    const place = (t: number) => {
      const vf = THREE.MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
      const R = (radius / Math.sin(Math.min(vf, hf) / 2)) * (camera.aspect < 1.3 ? 1.12 : 0.92); // keskeny (mobil) dobozban hátrébb lép
      const k = smoother(span(t, T.tilt[0], T.tilt[1]));
      const el = THREE.MathUtils.degToRad(86 - 38 * k);
      const r = Math.max(0, t - T.rot);
      const turn = r < T.rotRamp ? (r * r) / (2 * T.rotRamp) : r - T.rotRamp / 2; // folytonos sebesség
      const az = AZ0 * k + W * turn; // alaprajzban egyenesen áll, a megdőlés közben fordul rá a 3D nézőszögre
      camera.position.set(center.x + Math.sin(az) * Math.cos(el) * R, Math.sin(el) * R, center.z + Math.cos(az) * Math.cos(el) * R);
      camera.lookAt(center);
    };

    const labelEls = new Map<string, HTMLElement>();
    box.querySelectorAll<HTMLElement>("[data-room]").forEach((e) => labelEls.set(e.dataset.room!, e));
    const tmp = new THREE.Vector3();
    let lastCap = -1, lastMsg = -1;

    const draw = (t: number) => {
      const g = smoother(span(t, T.grow[0], T.grow[1]));
      root.scale.y = PLAN_WALL + (1 - PLAN_WALL) * g;
      if (wallMat) wallMat.color.copy(INK).lerp(PLASTER, smooth(span(t, T.grow[0], T.grow[0] + 1200)));
      const o = smooth(span(t, T.open[0], T.open[1]));
      for (const x of openMats) x.m.opacity = x.base * o;
      paperMat.opacity = 1 - smooth(span(t, T.floor[0], T.floor[1]));
      place(t);
      renderer.render(scene, camera);
      host.style.opacity = String(1 - smooth(span(t, T.fadeOut[0], T.fadeOut[1])));

      // helyiségcímkék: alaprajzban (felül) és a végén (m²-rel) látszanak, a felépülés alatt elhalványulnak
      const planShow = t < T.grow[0] + 300, endShow = t >= T.labels && t < T.fadeOut[0];
      const hw = host.clientWidth, hh = host.clientHeight;
      for (const l of ROOM_LABELS) {
        const el = labelEls.get(l.id);
        if (!el) continue;
        tmp.set(l.c[0], DEMO_PLAN.ceilingHeight * root.scale.y + 0.15, l.c[1]).project(camera);
        el.style.opacity = planShow || endShow ? "1" : "0";
        el.dataset.mode = planShow ? "plan" : "data";
        el.style.transform = `translate(-50%, ${planShow ? "-50%" : "-100%"}) translate(${((tmp.x + 1) / 2) * hw}px, ${((1 - tmp.y) / 2) * hh}px)`;
      }
      const c = captionAt(t), m = msgsAt(t);
      if (c !== lastCap) { lastCap = c; setCaption(c); }
      if (m !== lastMsg) { lastMsg = m; setMsgs(m); }
    };

    const dispose = () => {
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mt = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach((x) => { (x as THREE.MeshStandardMaterial).map?.dispose(); x.dispose(); });
      });
      ownMats.forEach((x) => { (x as THREE.MeshStandardMaterial).map?.dispose(); x.dispose(); });
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };

    if (reduce) {
      draw(T.fadeOut[0] - 1); // kész, álló állapot
      return () => { ro.disconnect(); dispose(); };
    }

    let raf = 0, t0 = performance.now(), visible = true, pausedAt = 0;
    const tick = () => {
      let t = performance.now() - t0;
      if (t >= FLOORPLAN_DEMO_MS) { t0 = performance.now(); t = 0; }
      draw(t);
      if (visible) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      const v = e.isIntersecting;
      if (v === visible) return;
      visible = v;
      if (!v) { pausedAt = performance.now(); cancelAnimationFrame(raf); }
      else { t0 += performance.now() - pausedAt; raf = requestAnimationFrame(tick); }
    });
    io.observe(host);
    raf = requestAnimationFrame(tick);

    return () => { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); dispose(); };
  }, [reduce]);

  return (
    <div ref={boxRef} className="absolute inset-0 overflow-hidden bg-[radial-gradient(120%_100%_at_70%_0%,#3a2a20,#1d1712_65%)]">
      <style>{CSS}</style>
      {/* 3D vászon — asztalin a jobb oldali üzenetsáv mellett; a címkék ugyanebben a dobozban */}
      <div className="absolute inset-y-0 left-0 right-0 sm:right-[210px]">
        <div ref={hostRef} className="absolute inset-0" />
        {ROOM_LABELS.map((l) => (
          <span key={l.id} data-room={l.id} className="fp-room" style={{ opacity: 0 }}>
            <b>{l.name}</b><span>{l.area} m²</span>
          </span>
        ))}
      </div>

      <span className="absolute left-3 top-3 z-20 rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.8px] text-b-on-dark-2">
        Szemléltető animáció
      </span>
      <span className="absolute bottom-3 left-3 z-20 inline-block rounded-full bg-b-accent px-2.5 py-1 text-[11px] font-semibold text-white">
        {CAPTIONS[caption]}
      </span>

      {/* Érdeklődő üzenetek — gyorsan érkeznek; asztalin 3, mobilon 1 látszik (a legújabb), hogy ne takarja a modellt */}
      <div className="absolute right-2 top-3 z-10 flex w-[150px] flex-col gap-1.5 max-sm:[&>*:nth-child(n+2)]:hidden sm:right-3 sm:top-4 sm:w-[190px]">
        {MESSAGES.slice(0, msgs).slice(-3).reverse().map((m) => (
          <div key={m} className="fp-msg flex items-start gap-1.5 rounded-xl bg-white px-2 py-1.5 shadow-b">
            <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-b-accent text-[8px] font-bold text-white">É</span>
            <span className="min-w-0">
              <span className="block text-[9px] font-semibold uppercase tracking-[0.5px] text-b-ink-3">Új érdeklődő · most</span>
              <span className="block text-[11px] leading-tight text-b-ink">{m}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const CSS = `.fp-room{position:absolute;left:0;top:0;z-index:3;padding:3px 8px 4px;border-radius:9px;white-space:nowrap;text-align:center;
  pointer-events:none;transition:opacity .5s ease,background .5s ease,color .5s ease;will-change:transform}
.fp-room b{display:block;font-size:10.5px;line-height:12px;font-weight:800}
.fp-room span{display:block;font-size:10px;line-height:12px;font-weight:700}
.fp-room[data-mode=plan]{background:transparent;color:#8a3a22}
.fp-room[data-mode=data]{background:rgba(18,16,14,.84);color:#F4EFE7;box-shadow:0 6px 16px rgba(0,0,0,.35),inset 0 0 0 1px rgba(255,255,255,.12)}
.fp-room[data-mode=data] span{color:#9FE0BC}
.fp-msg{animation:fp-in .3s cubic-bezier(.22,1,.36,1)}
@keyframes fp-in{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.fp-msg{animation:none}}`;
