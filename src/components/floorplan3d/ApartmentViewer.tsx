// ApartmentViewer — a jóváhagyott terv berendezetlen 3D-modellje a böngészőben (2. lépés, „babaház" nézet).
// Körbeforgatható, nagyítható; a mennyezet ebben a nézetben rejtve, hogy felülről belátni. Fény: égbolt + nap árnyékkal.
// A méretpontosság a KÉSZ modellen mérve (measureApartment) — a jobb oldali táblázat ezt mutatja.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { FloorPlan } from "@/lib/floorplan3d/plan";
import { buildApartment, measureApartment, type RoomMeasure, type SceneOptions } from "@/lib/floorplan3d/scene";
import { planBounds } from "@/lib/floorplan3d/geometry";

export function useApartmentMeasure(plan: FloorPlan, opts: SceneOptions): RoomMeasure[] {
  return useMemo(() => measureApartment(plan, buildApartment(plan, opts)), [plan, opts]);
}

type ViewMode = "dollhouse" | "top";

export default function ApartmentViewer({ plan, opts }: { plan: FloorPlan; opts: SceneOptions }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ViewMode>("dollhouse");
  const viewRef = useRef<((m: ViewMode) => void) | null>(null);
  useEffect(() => { viewRef.current?.(mode); }, [mode]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4f1ec);
    const built = buildApartment(plan, opts);
    built.group.traverse((o) => { if (o.userData.kind === "ceiling") o.visible = false; });
    scene.add(built.group);

    // fények: égbolt-derengés + nap (árnyékkal)
    scene.add(new THREE.HemisphereLight(0xfffaf2, 0xbdb3a4, 1.7));
    const b = planBounds(plan);
    const cx = (b.minX + b.maxX) / 2, cz = (b.minY + b.maxY) / 2, span = Math.max(b.maxX - b.minX, b.maxY - b.minY);
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
    sun.position.set(cx - span, span * 1.6, cz - span * 0.8);
    sun.target.position.set(cx, 0, cz);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 0.5; sc.far = span * 5;
    scene.add(sun, sun.target);

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    camera.position.set(cx + span * 0.55, span * 1.15, cz + span * 1.05);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(cx, 0, cz);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI * 0.47; // ne lehessen a padló alá fordulni
    controls.minDistance = 2; controls.maxDistance = span * 4;

    // nézetek: „babaház" (ferdén felülről) és „felülről" (alaprajz-szerű, a nyílászárók ellenőrzéséhez)
    viewRef.current = (m: ViewMode) => {
      if (m === "top") camera.position.set(cx, span * 1.9, cz + 0.001);
      else camera.position.set(cx + span * 0.55, span * 1.15, cz + span * 1.05);
      controls.target.set(cx, 0, cz);
      controls.update();
    };

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let raf = 0;
    const tick = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(tick); };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
      });
      renderer.dispose();
      host.removeChild(renderer.domElement);
      viewRef.current = null;
    };
  }, [plan, opts]);

  return (
    <div className="relative h-full w-full">
      <div ref={hostRef} className="h-full w-full" aria-label="A lakás 3D-modellje (egérrel forgatható, görgővel nagyítható)" />
      <div className="absolute left-3 top-3 grid grid-cols-2 gap-1 rounded-full p-1" style={{ background: "rgba(255,255,255,0.85)", border: "1px solid var(--twx-line)" }}>
        {([["dollhouse", "Babaház"], ["top", "Felülről"]] as const).map(([v, t]) => (
          <button key={v} type="button" onClick={() => { setMode(v); viewRef.current?.(v); }} aria-pressed={mode === v}
            className="h-7 rounded-full px-3 text-[12px] font-semibold" style={mode === v ? { background: "#12100e", color: "#fff" } : undefined}>{t}</button>
        ))}
      </div>
    </div>
  );
}
