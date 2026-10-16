// IntroDollhouse — a bemutató 4. jelenete: VALÓDI 3D babaház-nézet a mintalakásról (demo.ts), a modul saját motorjával.
// Időrend (ms): felemelkedik → lassan körbefordul (egy „kéz" húzza) és ráközelít a fürdő külső falára → a fal felizzik →
// kattintás → nyílászáró-kártya: Ablak, 120 cm → az ablak belenő a falba → „Méretpontosság: 0 mm".
// A kurzor, a kártya és a feliratok HTML-rétegben; a kurzor a 3D-pontok képernyő-vetületét követi.
"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { StyleSheet } from "@/lib/floorplan3d/stylesheet";
import { apartmentFurniture } from "@/lib/floorplan3d/furniture";
import { applyStyle, kelvinToColor } from "@/lib/floorplan3d/materials";
import { buildFurniture, furnitureMaterials } from "@/lib/floorplan3d/furniture3d";
import { buildApartment, railOutdoorWalls, type SceneOptions } from "@/lib/floorplan3d/scene";
import { planBounds } from "@/lib/floorplan3d/geometry";
import { DEMO_NEW_WINDOW_ID, DEMO_PLAN, DEMO_PLAN_BEFORE } from "@/lib/floorplan3d/demo";

export const DOLLHOUSE_MS = 11600;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const smooth = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };
const WALL = { room: "furdo", edge: 2 };           // ide kerül az új ablak (a fürdő külső fala)
const WALL_PT = new THREE.Vector3(4.17, 1.4, 7.15); // a kattintás pontja a fal külső síkján

// kurzor-kulcskockák: p = képernyőpont (a jelenet 0..1 arányában) vagy egy DOM-elem / 3D-pont
type Key = { t: number; p: "wall" | "win" | "w120" | [number, number]; click?: boolean };
const CURSOR: Key[] = [
  { t: 2200, p: [0.22, 0.86], click: true }, { t: 5400, p: [0.72, 0.86] }, { t: 6100, p: "wall" }, { t: 6300, p: "wall", click: true },
  { t: 7300, p: "win" }, { t: 7600, p: "win", click: true }, { t: 8500, p: "w120" }, { t: 8800, p: "w120", click: true }, { t: 9800, p: [0.9, 0.12] },
];
const TAGS: { at: number; off?: number; text: string; pos: "bottom" | "top"; tone?: "coral" | "green" }[] = [
  { at: 2200, off: 5600, text: "⟲ Húzással forgatod · görgetve közelítesz", pos: "bottom" },
  { at: 5800, off: 6400, text: "Kattints a falra — ide jön az új nyílászáró", pos: "bottom", tone: "coral" },
  { at: 9200, text: "+ Ablak · 120 cm — belenő a falba, a 2D-ben is megjelenik", pos: "bottom", tone: "coral" },
  { at: 10300, text: "Méretpontosság: 0 mm eltérés", pos: "top", tone: "green" },
];

export default function IntroDollhouse({ opts, style, playing, onProgress, onEnd }: {
  opts: SceneOptions; style: StyleSheet | null; playing: boolean; onProgress?: (f: number) => void; onEnd?: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const playRef = useRef(playing), progRef = useRef(onProgress), endRef = useRef(onEnd);
  useEffect(() => { playRef.current = playing; progRef.current = onProgress; endRef.current = onEnd; }, [playing, onProgress, onEnd]);
  const furniture = useMemo(() => apartmentFurniture(DEMO_PLAN, null), []);

  useEffect(() => {
    const host = hostRef.current, box = boxRef.current;
    if (!host || !box) return;
    let disposed = false;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // a két állapot (ablak nélkül / ablakkal) előre felépítve; a váltáskor csak a láthatóság cserélődik
    const make = (plan: typeof DEMO_PLAN) => {
      const b = buildApartment(plan, opts);
      b.group.traverse((o) => { if (o.userData.kind === "ceiling") o.visible = false; });
      railOutdoorWalls(plan, b);
      return b;
    };
    const before = make(DEMO_PLAN_BEFORE), after = make(DEMO_PLAN);
    const root = new THREE.Group(); // ezt „emeljük fel" (y-skála)
    root.add(before.group, after.group);
    after.group.visible = false;
    scene.add(root);

    // a kattintható fal (felizzik): saját anyag-másolat, hogy csak ez világítson
    const glowMats: THREE.MeshStandardMaterial[] = [];
    before.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (o.userData.kind === "wall" && o.userData.roomId === WALL.room && o.userData.edge === WALL.edge) {
        const mat = (m.material as THREE.MeshStandardMaterial).clone(); m.material = mat; glowMats.push(mat);
      }
    });
    // az új ablak: kerete vízszintesen „belenő" a nyílásba, korall fénnyel, ami lassan elhalványul
    let newWin: THREE.Object3D | null = null;
    const winMats: THREE.MeshStandardMaterial[] = [];
    after.group.traverse((o) => {
      if (o.userData.kind === "window" && o.userData.openingId === DEMO_NEW_WINDOW_ID) newWin = o;
    });
    (newWin as THREE.Object3D | null)?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { const mat = (m.material as THREE.MeshStandardMaterial).clone(); m.material = mat; winMats.push(mat); }
    });

    // a beépülő ablak helyén korall fényfolt (a nyílásban), ami lassan elhalványul — kis méretben is látszódjon, hova került
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ color: 0xef7a5a, transparent: true, opacity: 0, depthWrite: false }));
    flash.position.set(4.18, 1.6, 7.32); flash.visible = false; root.add(flash);
    const b = planBounds(DEMO_PLAN);
    const cx = (b.minX + b.maxX) / 2, cz = (b.minY + b.maxY) / 2, span = Math.max(b.maxX - b.minX, b.maxY - b.minY);
    const hemi = new THREE.HemisphereLight(kelvinToColor(5200), 0xbdb3a4, 1.35);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
    sun.position.set(cx - span, span * 1.6, cz + span * 0.6);
    sun.target.position.set(cx, 0, cz);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 0.5; sc.far = span * 5;
    scene.add(sun, sun.target);
    const warm = kelvinToColor(style ? (style.light_kelvin[0] + style.light_kelvin[1]) / 2 : 3200, 0.55);
    for (const r of DEMO_PLAN.rooms) {
      if (r.kind === "terasz") continue;
      const c = r.polygon.reduce((a, p) => [a[0] + p[0] / r.polygon.length, a[1] + p[1] / r.polygon.length], [0, 0]);
      const l = new THREE.PointLight(warm, 1.4, 7, 1.6);
      l.position.set(c[0], DEMO_PLAN.ceilingHeight - 0.35, c[1]);
      root.add(l);
    }
    void (async () => {
      if (style) { await applyStyle(before, DEMO_PLAN_BEFORE, style).catch(() => null); await applyStyle(after, DEMO_PLAN, style).catch(() => null); }
      // az applyStyle új anyagokat ad: a kiemeléshez újra lemásoljuk őket
      glowMats.length = 0;
      before.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (o.userData.kind === "wall" && o.userData.roomId === WALL.room && o.userData.edge === WALL.edge) {
          const mat = (m.material as THREE.MeshStandardMaterial).clone(); m.material = mat; glowMats.push(mat);
        }
      });
      const mats = await furnitureMaterials().catch(() => null);
      const g = mats && !disposed ? await buildFurniture(furniture, mats, DEMO_PLAN.ceilingHeight).catch(() => null) : null;
      if (g && !disposed) root.add(g);
    })();

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const center = new THREE.Vector3(cx, 0.6, cz);
    const focus = new THREE.Vector3(4.17, 1.0, 5.6); // a fürdő fala felé közelítünk
    const EL = THREE.MathUtils.degToRad(50);
    const radius = Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 2 + 0.6;
    const place = (t: number) => {
      // a távolság a szűkebb látószöghöz igazodik (álló és fekvő dobozban is az egész lakás beférjen)
      const vf = THREE.MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
      const R0 = (radius / Math.sin(Math.min(vf, hf) / 2)) * 0.86;
      const p = smooth((t - 2200) / 3200), z = smooth((t - 3600) / 1800);
      const az = -0.95 + 0.95 * p;                      // kelet felől dél felé fordul (a fürdő külső fala szembe kerül)
      const r = R0 * (1 - 0.2 * z);
      const tgt = center.clone().lerp(focus, z * 0.55);
      camera.position.set(tgt.x + Math.sin(az) * Math.cos(EL) * r, Math.sin(EL) * r, tgt.z + Math.cos(az) * Math.cos(EL) * r);
      camera.lookAt(tgt);
    };

    const cursor = box.querySelector<HTMLElement>("[data-cur]")!;
    const ring = box.querySelector<HTMLElement>("[data-ring]")!;
    const point = (k: Key): [number, number] => {
      const bw = box.clientWidth, bh = box.clientHeight;
      if (Array.isArray(k.p)) return [k.p[0] * bw, k.p[1] * bh];
      if (k.p === "wall") { const v = WALL_PT.clone().project(camera); return [(v.x + 1) / 2 * bw, (1 - v.y) / 2 * bh]; }
      const el = box.querySelector<HTMLElement>(`[data-k="${k.p}"]`);
      if (!el) return [bw / 2, bh / 2];
      const r = el.getBoundingClientRect(), br = box.getBoundingClientRect();
      return [r.left + r.width / 2 - br.left, r.top + r.height / 2 - br.top];
    };

    let raf = 0, t0 = performance.now(), wasPlaying = false, ended = false, drawn = false;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      // várakozás: egyszer kirajzoljuk a kezdőképet (előtöltés), leálláskor az utolsó kép marad (elhalványul) — nem ugrik vissza
      if (!playRef.current) { wasPlaying = false; if (drawn) return; }
      else if (!wasPlaying) { wasPlaying = true; t0 = performance.now(); ended = false; }
      const t = playRef.current ? Math.min(DOLLHOUSE_MS, performance.now() - t0) : 0;
      progRef.current?.(t / DOLLHOUSE_MS);
      if (t >= DOLLHOUSE_MS && !ended) { ended = true; endRef.current?.(); }

      root.scale.y = 0.02 + 0.98 * easeOut((t - 300) / 1600);
      place(t);
      const pulse = t > 5800 && t < 6600 ? 0.5 + 0.5 * Math.sin(((t - 5800) / 800) * Math.PI * 2 - Math.PI / 2) : t >= 6600 && t < 9000 ? 0.35 : 0;
      for (const m of glowMats) { m.emissive.setRGB(0.94, 0.48, 0.35); m.emissiveIntensity = pulse * 0.9; }
      const grown = t >= 9000;
      before.group.visible = !grown; after.group.visible = grown;
      if (newWin) (newWin as THREE.Object3D).scale.x = grown ? Math.max(0.02, easeOut((t - 9000) / 1000)) : 1;
      const hl = grown ? Math.max(0, 1 - (t - 9000) / 2200) : 0;
      for (const m of winMats) { m.emissive.setRGB(0.94, 0.48, 0.35); m.emissiveIntensity = hl * 2.2; }
      flash.visible = grown && hl > 0; (flash.material as THREE.MeshBasicMaterial).opacity = 0.75 * hl;
      renderer.render(scene, camera);
      drawn = true;

      // HTML-réteg: feliratok, kártya, kártyán a kijelölés, kurzor
      box.querySelectorAll<HTMLElement>("[data-at]").forEach((e) => {
        const a = +e.dataset.at!, off = e.dataset.off ? +e.dataset.off : Infinity;
        e.style.opacity = t >= a && t < off ? "1" : "0";
      });
      box.querySelectorAll<HTMLElement>("[data-sel]").forEach((e) => e.classList.toggle("on", t >= +e.dataset.sel!));
      box.querySelectorAll<HTMLElement>("[data-unsel]").forEach((e) => e.classList.toggle("on", t < +e.dataset.unsel!));
      const first = CURSOR[0], last = CURSOR[CURSOR.length - 1];
      const vis = t >= first.t - 150 && t <= last.t + 500;
      cursor.style.opacity = vis ? "1" : "0";
      if (vis) {
        let a = first, nb = first;
        for (const k of CURSOR) { if (k.t <= t) a = k; else { nb = k; break; } nb = k; }
        const pa = point(a), pb = point(nb), k = nb.t > a.t ? smooth((t - a.t) / (nb.t - a.t)) : 1;
        cursor.style.transform = `translate(${pa[0] + (pb[0] - pa[0]) * k}px, ${pa[1] + (pb[1] - pa[1]) * k}px)`;
        const clicking = CURSOR.some((c) => c.click && t >= c.t && t < c.t + 400);
        ring.style.animation = clicking ? "twt-ring .4s ease-out" : "none";
      }
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
  }, [opts, style, furniture]);

  const tagStyle = (tone?: "coral" | "green") => ({ background: tone === "coral" ? "rgba(239,122,90,.95)" : tone === "green" ? "rgba(47,158,95,.9)" : "rgba(18,16,14,.85)" });
  return (
    <div ref={boxRef} className="twt-3d relative h-full w-full select-none" aria-label="Bemutató: a 3D modell forgatható, nyílászáró tehető bele">
      <div ref={hostRef} className="absolute inset-0" />
      {TAGS.map((g) => (
        <span key={g.text} data-at={g.at} data-off={g.off} className="twt-tag" style={{ ...tagStyle(g.tone), left: "50%", transform: "translateX(-50%)", ...(g.pos === "top" ? { top: 6 } : { bottom: 10 }) }}>{g.text}</span>
      ))}
      <div className="twt-ocard" data-at={6500} style={{ left: 6, top: 24 }}>
        <div className="twt-oh"><b>Új nyílászáró</b><span>Fürdő · külső fal</span></div>
        <div className="twt-tls">
          <span className="twt-tl"><svg><use href="#twt-icDoor" /></svg>Ajtó</span>
          <span className="twt-tl"><svg><use href="#twt-icGlass" /></svg>Üvegajtó</span>
          <span className="twt-tl" data-k="win" data-sel={7600}><svg><use href="#twt-icWin" /></svg>Ablak</span>
          <span className="twt-tl"><svg><use href="#twt-icPass" /></svg>Átjáró</span>
        </div>
        <div className="twt-row"><span>Szélesség</span><span className="twt-caps"><b>60</b><b className="on" data-unsel={8800}>90</b><b data-k="w120" data-sel={8800}>120</b><b>150</b></span></div>
        <div className="twt-row"><span>Parapet</span><b>90 cm</b></div>
        <div className="twt-sl"><i style={{ width: "40%" }} /></div>
      </div>
      <span data-cur className="twt-cur" style={{ left: 0, top: 0 }}>
        <svg width="18" height="22" viewBox="0 0 18 22"><path d="M2 1l14 10-6 1 4 7-3 1.5-4-7-5 4z" fill="#fff" stroke="#12100e" strokeWidth="1.4" strokeLinejoin="round" /></svg>
        <i data-ring />
      </span>
    </div>
  );
}
