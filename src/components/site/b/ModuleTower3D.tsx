// „Modul-tárgy" a főoldal sötét „Mi az egyedi modul?" sávjában (Márk döntése 2026-11-25; 3d-feature-objects skill
// módszere egyetlen, nagyobb tárgyra). Moduláris kockatorony: négy, egymásba illeszkedő, lekerekített élű blokk: zárva szatén bronz, nyitáskor matt fekete kerámiává válik (beleégetett TWINX felirattal).
//
// Két állapot, folyamatos átmenettel (Márk kérése):
//   • ZÁRVA = „nagy munka megy benne": a fugákból és a magból láva-izzás tör elő; minél jobban zár, annál erősebb.
//     (Folyamatosan, lágyan pulzál, amíg látszik. Az áram-hatás Márk kérésére kikerült.)
//   • NYITVA (egér rajta / koppintás): a blokkok szétnyílnak, az izzás kialszik, és a téglák között FEKVŐ lapok
//     kicsúsznak és felbillennek (Ingyenes felmérés, Egyedi modul, Cégre szabva…) — 3D-ben, a toronnyal együtt mozogva és forogva.
// Fordulás a skill szerint: ±0,7 rad az egér vízszintes helyzetéből + lassú forgás (0,58 rad/s), simítás 1−e^(−10·dt),
// elengedve a legrövidebb szögúton (atan2) vissza. Érintésre / Enter-re nyit-zár. „Mozgás csökkentése": nincs forgás és
// pulzálás, a váltás azonnali. Csak akkor rajzol, ha látszik. A lapok felirata vászon-textúra (a teljes szöveg az aria-labelben).
"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const BASE_YAW = -0.62;
const HOVER_YAW = 0.7;
const SPIN = 0.58;
const OPEN = 0.42; // a blokkok szétnyílása teljesen nyitva

const BLOCKS: [number, number, number, number, "deep" | "satin" | "light"][] = [
  [1.7, 0.56, 1.7, 0.0, "deep"],
  [1.42, 0.5, 1.42, 0.14, "satin"],
  [1.58, 0.46, 1.58, -0.06, "satin"],
  [1.16, 0.52, 1.16, 0.1, "light"],
];
const SEAM = 0.05;

// A lapok — fugánként kettő: a TWINX szolgáltatásaira utaló rövid feliratok (Márk kérése 2026-11-25).
const CARDS = ["Ingyenes felmérés", "Egyedi modul", "Cégre szabva", "AI-automatizálás", "Irodai fiók", "Saját arculat"];
// a lapok kifutási iránya a torony körül (radián, a toronyhoz képest) — fugánként eltolva, legyezőszerűen
const CARD_ANGLES = [0.35, 2.55, -0.85, 1.45, 0.95, -2.1];

/** Egy lap képe vászonból: sötét-bronz üveglap, bronz keret, korall pont, krém felirat. */
function cardTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 200;
  const t = new THREE.CanvasTexture(c);
  const draw = () => {
    const g = c.getContext("2d")!;
    g.clearRect(0, 0, 512, 200);
    const rr = (x: number, y: number, w: number, h: number, r: number) => {
      g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    };
    const grd = g.createLinearGradient(0, 0, 512, 200);
    grd.addColorStop(0, "#4a3324"); grd.addColorStop(1, "#211913");
    rr(6, 6, 500, 188, 34); g.fillStyle = grd; g.fill();
    g.lineWidth = 4; g.strokeStyle = "rgba(201,155,112,0.75)"; g.stroke();
    g.fillStyle = "#ff9a7e"; g.beginPath(); g.arc(62, 100, 13, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#f6f1ea"; g.textBaseline = "middle";
    // a betűméret a szöveghez igazodik (hosszabb felirat kisebb, de nem nyomódik össze)
    let size = 62;
    do { g.font = `700 ${size}px Manrope, 'Segoe UI', system-ui, sans-serif`; size -= 2; } while (g.measureText(text).width > 384 && size > 34);
    g.fillText(text, 96, 104);
    t.needsUpdate = true;
  };
  draw();
  // ha a webes betű később töltődik be, újrarajzoljuk
  if (typeof document !== "undefined" && document.fonts?.ready) document.fonts.ready.then(draw).catch(() => {});
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Durva, pórusos, matt fekete kerámia / beton felület (Márk mintaképe: TOS fekete kerámia fali lámpa).
 *  Szín: szénfekete alap foltos, szürkés kéreggel és apró pórusokkal; ugyanebből készül a dombor-térkép. */
function ceramicTextures(seed0: number): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const N = 512;
  const a = document.createElement("canvas"), b = document.createElement("canvas");
  a.width = a.height = b.width = b.height = N;
  const ga = a.getContext("2d")!, gb = b.getContext("2d")!;
  let seed = seed0;
  const r = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  ga.fillStyle = "#1b1a19"; ga.fillRect(0, 0, N, N);
  gb.fillStyle = "#808080"; gb.fillRect(0, 0, N, N);
  const blot = (g: CanvasRenderingContext2D, x: number, y: number, rad: number, col: string) => {
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, col); grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { g.beginPath(); g.arc(x + dx, y + dy, rad, 0, Math.PI * 2); g.fill(); }
  };
  // szürkés, kérges foltok (kopott, nyers felület)
  for (let i = 0; i < 46; i++) {
    const x = r() * N, y = r() * N, rad = 18 + r() * 70;
    blot(ga, x, y, rad, `rgba(${70 + r() * 30},${68 + r() * 28},${64 + r() * 26},${0.18 + r() * 0.22})`);
    blot(gb, x, y, rad, `rgba(200,200,200,${0.25 + r() * 0.25})`);
  }
  // apró pórusok és kráterek (sötét pöttyök, a dombor-térképen mélyedés)
  for (let i = 0; i < 2600; i++) {
    const x = r() * N, y = r() * N, rad = 0.6 + r() * r() * 4.5;
    ga.fillStyle = `rgba(8,8,8,${0.35 + r() * 0.5})`; ga.beginPath(); ga.arc(x, y, rad, 0, Math.PI * 2); ga.fill();
    gb.fillStyle = `rgba(20,20,20,${0.5 + r() * 0.4})`; gb.beginPath(); gb.arc(x, y, rad, 0, Math.PI * 2); gb.fill();
  }
  // finom szemcsézet
  for (let i = 0; i < 9000; i++) {
    const x = r() * N, y = r() * N, v = Math.floor(r() * 90);
    ga.fillStyle = `rgba(${v},${v},${v},0.18)`; ga.fillRect(x, y, 1, 1);
    gb.fillStyle = `rgba(${v + 90},${v + 90},${v + 90},0.4)`; gb.fillRect(x, y, 1, 1);
  }
  const map = new THREE.CanvasTexture(a), bump = new THREE.CanvasTexture(b);
  for (const t of [map, bump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.4, 1.4); t.anisotropy = 4; }
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, bump };
}

/** Beleégetett „TWINX": sötét, megpörkölt betűk (szín + átlátszóság), és külön a parázsló szélek (fény-térkép). */
function burnTextures(): { map: THREE.CanvasTexture; ember: THREE.CanvasTexture } {
  const mk = () => { const c = document.createElement("canvas"); c.width = 640; c.height = 200; return c; };
  const a = mk(), b = mk();
  const draw = () => {
    const font = "800 132px Manrope, 'Segoe UI', system-ui, sans-serif";
    const ga = a.getContext("2d")!, gb = b.getContext("2d")!;
    for (const g of [ga, gb]) { g.clearRect(0, 0, 640, 200); g.font = font; g.textAlign = "center"; g.textBaseline = "middle"; }
    // égésnyom: elmosott sötét udvar + mélyebb, szinte fekete betűtest
    ga.filter = "blur(7px)"; ga.fillStyle = "rgba(90,40,22,0.45)"; ga.fillText("TWINX", 320, 104);
    ga.filter = "none"; ga.fillStyle = "rgba(58,34,24,0.95)"; ga.fillText("TWINX", 320, 104); // pörkölt, hamus barna a fekete kerámián
    // parázs: izzó belső szél
    gb.fillStyle = "#000"; gb.fillRect(0, 0, 640, 200);
    gb.lineWidth = 5; gb.strokeStyle = "#ff7a2e"; gb.shadowColor = "#ff5a14"; gb.shadowBlur = 18; gb.strokeText("TWINX", 320, 104);
    gb.shadowBlur = 0; gb.lineWidth = 1.5; gb.strokeStyle = "#ffd29a"; gb.strokeText("TWINX", 320, 104);
    map.needsUpdate = true; ember.needsUpdate = true;
  };
  const map = new THREE.CanvasTexture(a), ember = new THREE.CanvasTexture(b);
  map.colorSpace = THREE.SRGBColorSpace; ember.colorSpace = THREE.SRGBColorSpace;
  draw();
  if (document.fonts?.ready) document.fonts.ready.then(draw).catch(() => {});
  return { map, ember };
}

/** Láva-textúra (vászonból): narancs–vörös–sárga foltok, ismételhető. */
function lavaTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#7a1606"; g.fillRect(0, 0, 128, 128);
  let seed = 7;
  const r = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < 70; i++) {
    const x = r() * 128, y = r() * 128, rad = 6 + r() * 22;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    const hot = r() > 0.55;
    grd.addColorStop(0, hot ? "rgba(255,226,140,0.95)" : "rgba(255,120,40,0.85)");
    grd.addColorStop(1, "rgba(255,60,10,0)");
    g.fillStyle = grd;
    for (const dx of [-128, 0, 128]) for (const dy of [-128, 0, 128]) { g.beginPath(); g.arc(x + dx, y + dy, rad, 0, Math.PI * 2); g.fill(); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function ModuleTower3D({ className = "" }: { className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current, box = boxRef.current, glowEl = glowRef.current;
    if (!host || !box || !glowEl) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.55;

    const HEAT = new THREE.Color(0xff4a12);
    // FELÜLET (Márk döntése 2026-11-25): ZÁRVA az eredeti szatén bronz (láva-izzással); NYITÁSKOR fokozatosan matt,
    // pórusos fekete kerámiává válik (a fekete lámpa mintájára) — szín, fémesség, érdesség és dombor-térkép együtt úszik át.
    const ceramics = [ceramicTextures(11), ceramicTextures(29), ceramicTextures(53)];
    const BLACK = new THREE.Color(0x1f1d1b);
    const mk = (color: number, rough: number, c: { map: THREE.CanvasTexture; bump: THREE.CanvasTexture }) => {
      const m = new THREE.MeshPhysicalMaterial({
        color, metalness: 0.85, roughness: rough, clearcoat: 0.3, clearcoatRoughness: 0.55, emissive: HEAT, emissiveIntensity: 0,
        bumpMap: c.bump, bumpScale: 0,
      });
      m.userData = { base: new THREE.Color(color), rough };
      return m;
    };
    const mats = { deep: mk(0x7e5537, 0.46, ceramics[0]), satin: mk(0xa8754c, 0.4, ceramics[1]), light: mk(0xc99b70, 0.36, ceramics[2]) };

    // láva + áram: a fugákban és a magban; a szín a láva narancs és az áram kékesfehér között villan
    const lavaTex = lavaTexture();
    const LAVA = new THREE.Color(0xff6a24), VOLT = new THREE.Color(0xbfe4ff);
    const lavaMat = new THREE.MeshStandardMaterial({ color: 0x220806, emissive: 0xffffff, emissiveMap: lavaTex, emissiveIntensity: 0, roughness: 0.6 });
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x2a0d06, emissive: LAVA.clone(), emissiveIntensity: 0, roughness: 0.4 });

    const turntable = new THREE.Group();
    const pose = new THREE.Group();
    pose.rotation.y = BASE_YAW;
    turntable.add(pose);
    scene.add(turntable);

    const geos: THREE.BufferGeometry[] = [];
    const blocks: { mesh: THREE.Mesh; y0: number; dir: number }[] = [];
    const total = BLOCKS.reduce((a, b) => a + b[1], 0) + SEAM * (BLOCKS.length - 1);
    let y = -total / 2;
    BLOCKS.forEach(([w, h, d, rot, mat], i) => {
      const g = new RoundedBoxGeometry(w, h, d, 5, 0.09);
      geos.push(g);
      const m = new THREE.Mesh(g, mats[mat]);
      const cy = y + h / 2;
      m.position.y = cy;
      m.rotation.y = rot;
      pose.add(m);
      blocks.push({ mesh: m, y0: cy, dir: i < 2 ? -(2 - i) : i - 1 });
      y += h + SEAM;
    });
    // BELEÉGETETT „TWINX" a 3. blokk jobb oldalán: sötét égésnyom + zárva parázsló szélek (a hővel együtt izzik)
    const burn = burnTextures();
    const burnMat = new THREE.MeshStandardMaterial({ map: burn.map, transparent: true, roughness: 0.9, metalness: 0.2,
      emissive: 0xffffff, emissiveMap: burn.ember, emissiveIntensity: 0.15, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
    {
      const [w, , d] = BLOCKS[2];
      const pg = new THREE.PlaneGeometry(d * 0.6, d * 0.6 / 3.2); // a vászon 640×200 arányában
      geos.push(pg);
      const plate = new THREE.Mesh(pg, burnMat);
      plate.position.set(w / 2 + 0.006, 0.03, 0);
      plate.rotation.y = Math.PI / 2;
      blocks[2].mesh.add(plate);
    }

    // fuga-lapok (láva) két-két blokk között; a fugák a nyitással együtt mozognak
    const seams: { mesh: THREE.Mesh; a: number; b: number }[] = [];
    for (let i = 0; i < BLOCKS.length - 1; i++) {
      const w = Math.min(BLOCKS[i][0], BLOCKS[i + 1][0]) - 0.1;
      const g = new RoundedBoxGeometry(w, SEAM + 0.05, w, 3, 0.03);
      geos.push(g);
      const m = new THREE.Mesh(g, lavaMat);
      pose.add(m);
      seams.push({ mesh: m, a: i, b: i + 1 });
    }

    const coreGeo = new RoundedBoxGeometry(0.62, 0.22, 0.62, 4, 0.08);
    geos.push(coreGeo);
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.rotation.y = Math.PI / 4;
    pose.add(core);
    const heatLight = new THREE.PointLight(0xff6a2a, 0, 4, 1.4);
    pose.add(heatLight);

    // A „lapok": vékony kártyák, amelyek a fugákban FEKSZENEK (zárva a toronyban rejtve), nyitáskor kicsúsznak a téglák
    // közül, és felbillennek a néző felé. A toronnyal együtt mozognak és forognak (a póz csoportjában vannak).
    const cardGeo = new THREE.PlaneGeometry(1.0, 0.39);
    geos.push(cardGeo);
    const cardBackMat = new THREE.MeshStandardMaterial({ color: 0x2a1f18, roughness: 0.5, metalness: 0.4, side: THREE.BackSide, transparent: true, opacity: 0 });
    const cardTexes: THREE.Texture[] = [];
    const cards = CARDS.map((text, i) => {
      const tex = cardTexture(text);
      cardTexes.push(tex);
      const front = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.55, metalness: 0.1, transparent: true, opacity: 0 });
      const pivot = new THREE.Group();
      pivot.rotation.y = CARD_ANGLES[i];
      const holder = new THREE.Group();
      const m = new THREE.Mesh(cardGeo, front);
      const back = new THREE.Mesh(cardGeo, cardBackMat);
      holder.add(m, back);
      pivot.add(holder);
      pose.add(pivot);
      return { pivot, holder, front, seam: Math.floor(i / 2), delay: (i % 2) * 0.12 };
    });

    // IZZÓ KÖTELEK (Márk kérése, minta: az ügynökségi plakát „kezek feletti" fényszálai): minden lapot 4 vékony, izzó
    // szál köt a téglák belsejéhez; a szálakon apró fénycseppek futnak a torony felől a lap felé. A szálak végpontjait
    // minden képkockán a lap aktuális helyzetéből számoljuk, így a lapokkal együtt mozognak és feszülnek.
    const STRANDS = [-0.36, -0.12, 0.12, 0.36], SEG = 24;
    const strandMat = new THREE.LineBasicMaterial({ color: 0xffd2a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const dotCanvas = document.createElement("canvas");
    dotCanvas.width = dotCanvas.height = 32;
    { const g = dotCanvas.getContext("2d")!; const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      grd.addColorStop(0, "rgba(255,240,215,1)"); grd.addColorStop(0.35, "rgba(255,170,110,0.75)"); grd.addColorStop(1, "rgba(255,120,60,0)");
      g.fillStyle = grd; g.fillRect(0, 0, 32, 32); }
    const dotTex = new THREE.CanvasTexture(dotCanvas);
    const dotMat = new THREE.PointsMaterial({ map: dotTex, size: 0.1, sizeAttenuation: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    // GLOW (Márk kérése: „toljuk feljebb"): a szálak mentén sűrűn ülő, nagy, lágy fényfoltok → vastag, izzó dereng
    const HALO = 14;
    const haloMat = new THREE.PointsMaterial({ map: dotTex, size: 0.16, sizeAttenuation: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xff9a5a });
    const ropes = cards.map((c) => {
      const lines = STRANDS.map(() => {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((SEG + 1) * 3), 3));
        geos.push(g);
        const l = new THREE.Line(g, strandMat);
        l.frustumCulled = false;
        c.pivot.add(l);
        return l;
      });
      const dg = new THREE.BufferGeometry();
      dg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(STRANDS.length * 2 * 3), 3));
      geos.push(dg);
      const dots = new THREE.Points(dg, dotMat);
      dots.frustumCulled = false;
      c.pivot.add(dots);
      const hg = new THREE.BufferGeometry();
      hg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(STRANDS.length * HALO * 3), 3));
      geos.push(hg);
      const halo = new THREE.Points(hg, haloMat);
      halo.frustumCulled = false;
      c.pivot.add(halo);
      return { lines, dots, halo };
    });
    const pA = new THREE.Vector3(), pB = new THREE.Vector3(), pC = new THREE.Vector3(), pV = new THREE.Vector3();
    /** másodfokú Bézier: a toronybeli rögzítéstől (a) a lap belső széléig (b), enyhén ívelő szál */
    const bez = (a: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3) => {
      pC.set((a.x + b.x) / 2, Math.max(a.y, b.y) + 0.06, (a.z + b.z) / 2);
      const u = 1 - t;
      return out.set(u * u * a.x + 2 * u * t * pC.x + t * t * b.x, u * u * a.y + 2 * u * t * pC.y + t * t * b.y, u * u * a.z + 2 * u * t * pC.z + t * t * b.z);
    };

    const key = new THREE.DirectionalLight(0xffe2c6, 2.2); key.position.set(-3, 4, 4);
    const rim = new THREE.DirectionalLight(0xc9d8ff, 1.1); rim.position.set(4, 2.5, -3.5);
    const fill = new THREE.HemisphereLight(0xffe9d6, 0x2a1d16, 0.55);
    scene.add(key, rim, fill);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    let dirty = true;
    const fit = () => {
      const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / h;
      const r = 1.95, hh = total / 2 + OPEN * 1.6 + 0.25; // a kicsúszó lapokkal együtt férjen ki
      const vf = THREE.MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
      const dist = Math.max(r / Math.tan(hf / 2), hh / Math.tan(vf / 2)) * 0.96;
      const el = 0.42;
      camera.position.set(0, Math.sin(el) * dist, Math.cos(el) * dist);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      dirty = true;
    };

    let hovered = false, pointerX = 0, spin = 0, yaw = 0, open = 0, tapOpen = false;
    // reveal: mennyire „húzta ki” az egér a lapokat — a megtett vízszintes úttal nő (kb. a doboz 0,6-szorosnyi mozgás
    // kell a teljes előbújáshoz), megálláskor ott marad, elengedve 0. Így nem ugranak elő egy kis mozdulatra.
    let reveal = 0, lastPX: number | null = null;
    let raf = 0, last = performance.now(), visible = true;
    const t0 = performance.now();
    const shortest = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const time = (now - t0) / 1000;
      if (hovered && !reduce) spin += SPIN * dt;
      const targetYaw = hovered ? pointerX * HOVER_YAW + spin : tapOpen ? 0.9 : 0;
      const k = reduce ? 1 : 1 - Math.exp(-10 * dt);
      const delta = hovered ? targetYaw - yaw : shortest(targetYaw - yaw);
      yaw += delta * k;
      const targetOpen = hovered ? (reduce ? 1 : reveal) : tapOpen ? 1 : 0;
      // lassú, lágy követés (előbújás), záráskor kicsit gyorsabb
      open += (targetOpen - open) * (reduce ? 1 : 1 - Math.exp(-(targetOpen > open ? 2.6 : 3.6) * dt));
      if (!hovered && Math.abs(delta) < 0.0005) { yaw = targetYaw; spin = shortest(spin); }

      // pozíciók
      turntable.rotation.y = yaw;
      const e = open * open * (3 - 2 * open); // lágy nyílás
      for (const b of blocks) b.mesh.position.y = b.y0 + b.dir * e * OPEN * 0.5;
      for (const s of seams) {
        const A = blocks[s.a], B = blocks[s.b];
        s.mesh.position.y = (A.mesh.position.y + BLOCKS[s.a][1] / 2 + B.mesh.position.y - BLOCKS[s.b][1] / 2) / 2;
      }
      core.position.y = seams[1].mesh.position.y;
      heatLight.position.y = core.position.y;

      // izzás: zárva a legerősebb (láva + áram), nyitva kialszik
      const heat = Math.pow(1 - e, 1.6);
      const pulse = reduce ? 1 : 0.82 + 0.18 * Math.sin(time * 2.1) + 0.08 * Math.sin(time * 5.3);
      const voltMix = 0; // az áram-hatás Márk kérésére kikerült (2026-11-25) — tiszta láva-izzás
      lavaTex.offset.set((time * 0.04) % 1, (time * 0.025) % 1);
      lavaMat.emissive.copy(LAVA).lerp(VOLT, voltMix * 0.55);
      lavaMat.emissiveIntensity = heat * 2.2 * pulse;
      coreMat.emissive.copy(LAVA).lerp(VOLT, voltMix * 0.5);
      coreMat.emissiveIntensity = heat * 2.6 * pulse;
      for (const m of Object.values(mats)) {
        m.emissiveIntensity = heat * (0.05 + 0.05 * pulse);
        // bronz → fekete kerámia a nyitással (e = 0 zárva, 1 nyitva)
        m.color.copy(m.userData.base as THREE.Color).lerp(BLACK, e);
        m.metalness = 0.85 * (1 - e) + 0.04 * e;
        m.roughness = (m.userData.rough as number) * (1 - e) + 0.92 * e;
        m.clearcoat = 0.3 * (1 - e);
        m.bumpScale = 2.2 * e;
      }
      burnMat.emissiveIntensity = 0.25 + heat * (1.5 * pulse);       // zárva parázslik a beleégetett felirat
      heatLight.intensity = heat * 3 * pulse;
      heatLight.color.copy(LAVA).lerp(VOLT, voltMix * 0.4);
      glowEl.style.opacity = String(Math.min(1, heat * (0.75 + 0.2 * pulse)));

      renderer.render(scene, camera);

      // lapok: a fugából kicsúsznak (sugárirányban), közben felbillennek a néző felé; zárva a toronyban rejtve fekszenek
      for (const c of cards) {
        const k2 = Math.max(0, Math.min(1, (e - c.delay) / (1 - c.delay)));
        const slide = k2 * k2 * (3 - 2 * k2);
        c.pivot.position.y = seams[c.seam].mesh.position.y;
        c.holder.position.z = 0.15 + slide * 1.2;
        c.holder.rotation.x = -Math.PI / 2 + slide * 1.12; // fekvő → ~64°-ban felbillent
        const op = Math.max(0, Math.min(1, (slide - 0.2) / 0.5));
        c.front.opacity = op;
        c.holder.visible = op > 0.001;
      }
      cardBackMat.opacity = Math.max(0, Math.min(1, (e - 0.3) / 0.5));

      // izzó kötelek: a lap belső széle (fekvő helyzetben a torony felé eső él) ↔ a téglák belseje
      const ropeOp = Math.max(0, Math.min(1, (e - 0.12) / 0.45));
      strandMat.opacity = ropeOp * (0.75 + 0.2 * (reduce ? 1 : Math.sin(time * 3.2) * 0.5 + 0.5));
      dotMat.opacity = ropeOp;
      haloMat.opacity = ropeOp * (0.32 + 0.1 * (reduce ? 1 : Math.sin(time * 2.4) * 0.5 + 0.5));
      cards.forEach((c, ci) => {
        const rp = ropes[ci];
        const show = ropeOp > 0.01;
        rp.dots.visible = show;
        rp.halo.visible = show;
        const harr = rp.halo.geometry.getAttribute("position") as THREE.BufferAttribute;
        c.holder.updateMatrix();
        STRANDS.forEach((sx, si) => {
          const line = rp.lines[si];
          line.visible = show;
          if (!show) return;
          pB.set(sx, 0.195, 0).applyMatrix4(c.holder.matrix);       // a lap belső éle
          pA.set(sx * 0.35, 0, 0.1);                                 // rögzítés a fuga belsejében
          const arr = line.geometry.getAttribute("position") as THREE.BufferAttribute;
          for (let k = 0; k <= SEG; k++) { bez(pA, pB, k / SEG, pV); arr.setXYZ(k, pV.x, pV.y, pV.z); }
          arr.needsUpdate = true;
          for (let h = 0; h < HALO; h++) { bez(pA, pB, (h + 0.5) / HALO, pV); harr.setXYZ(si * HALO + h, pV.x, pV.y, pV.z); }
          harr.needsUpdate = true;
          // két fénycsepp szálanként, a torony felől a lap felé futva
          const darr = rp.dots.geometry.getAttribute("position") as THREE.BufferAttribute;
          for (let d = 0; d < 2; d++) {
            const t = reduce ? 0.35 + d * 0.3 : (time * 0.55 + si * 0.23 + d * 0.5 + ci * 0.11) % 1;
            bez(pA, pB, t, pV);
            darr.setXYZ(si * 2 + d, pV.x, pV.y, pV.z);
          }
          darr.needsUpdate = true;
        });
      });

      const settled = !hovered && Math.abs(targetYaw - yaw) < 0.0005 && Math.abs(targetOpen - open) < 0.002;
      // zárva folyamatosan pulzál (izzik), ezért ilyenkor is rajzolunk — de csak ha látszik és nincs csökkentett mozgás
      const keepGlowing = !reduce && heat > 0.02;
      if (visible && (!settled || dirty || keepGlowing)) request();
      dirty = false;
    };
    function request() { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } }

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerType === "touch") return;
      const r = box.getBoundingClientRect();
      pointerX = Math.max(-1, Math.min(1, ((ev.clientX - r.left) / r.width) * 2 - 1));
      if (!hovered) { hovered = true; spin = 0; lastPX = ev.clientX; }
      if (lastPX !== null) reveal = Math.min(1, reveal + Math.abs(ev.clientX - lastPX) / (r.width * 0.6));
      lastPX = ev.clientX;
      request();
    };
    const onLeave = () => { hovered = false; reveal = 0; lastPX = null; request(); };
    const onTap = (ev: PointerEvent) => { if (ev.pointerType === "touch") { tapOpen = !tapOpen; request(); } };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); tapOpen = !tapOpen; request(); } };
    box.addEventListener("pointermove", onMove);
    box.addEventListener("pointerleave", onLeave);
    box.addEventListener("pointercancel", onLeave);
    box.addEventListener("pointerup", onTap);
    box.addEventListener("keydown", onKey);

    const ro = new ResizeObserver(() => { fit(); request(); });
    ro.observe(host);
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) { dirty = true; request(); } });
    io.observe(host);
    fit();
    request();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      box.removeEventListener("pointermove", onMove);
      box.removeEventListener("pointerleave", onLeave);
      box.removeEventListener("pointercancel", onLeave);
      box.removeEventListener("pointerup", onTap);
      box.removeEventListener("keydown", onKey);
      geos.forEach((g) => g.dispose());
      Object.values(mats).forEach((m) => m.dispose());
      ceramics.forEach((c) => { c.map.dispose(); c.bump.dispose(); });
      burnMat.dispose(); burn.map.dispose(); burn.ember.dispose();
      cards.forEach((c) => c.front.dispose()); cardBackMat.dispose(); cardTexes.forEach((t) => t.dispose());
      strandMat.dispose(); dotMat.dispose(); haloMat.dispose(); dotTex.dispose();
      lavaMat.dispose(); coreMat.dispose(); lavaTex.dispose(); envTex.dispose(); pmrem.dispose(); renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div ref={boxRef} tabIndex={0} role="img"
      aria-label="Egyedi modul: egymásba illeszkedő modulblokkok. Zárva izzik, mert dolgozik; rámutatva vagy koppintva kinyílik, és a téglák közül kicsúsznak a TWINX szolgáltatásai: ingyenes felmérés, egyedi modul, cégre szabva, AI-automatizálás, irodai fiók, saját arculat."
      className={`relative cursor-grab touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-b-accent-on-dark/60 ${className}`}>
      {/* izzás-fény a tárgy mögött (az erőssége a 3D izzással együtt változik) */}
      <div ref={glowRef} aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,106,42,0.45),rgba(255,74,18,0.12)_55%,transparent)] blur-xl" style={{ opacity: 0 }} />
      <div ref={hostRef} className="absolute inset-0" />
    </div>
  );
}
