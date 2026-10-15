// ApartmentViewer — a jóváhagyott terv berendezetlen 3D-modellje a böngészőben (2. lépés, „babaház" nézet).
// Körbeforgatható, nagyítható; a mennyezet ebben a nézetben rejtve, hogy felülről belátni. Fény: égbolt + nap árnyékkal.
// A méretpontosság a KÉSZ modellen mérve (measureApartment) — a jobb oldali táblázat ezt mutatja.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { FloorPlan } from "@/lib/floorplan3d/plan";
import type { StyleSheet } from "@/lib/floorplan3d/stylesheet";
import { applyStyle, kelvinToColor } from "@/lib/floorplan3d/materials";
import type { FurnitureItem } from "@/lib/floorplan3d/furniture";
import { buildFurniture, furnitureMaterials } from "@/lib/floorplan3d/furniture3d";
import { OUTDOOR_KINDS } from "@/lib/floorplan3d/plan";
import type { RoomView } from "@/lib/floorplan3d/camera";
import { buildApartment, measureApartment, type RoomMeasure, type SceneOptions } from "@/lib/floorplan3d/scene";
import { planBounds } from "@/lib/floorplan3d/geometry";

export function useApartmentMeasure(plan: FloorPlan, opts: SceneOptions): RoomMeasure[] {
  return useMemo(() => measureApartment(plan, buildApartment(plan, opts)), [plan, opts]);
}

type ViewMode = "dollhouse" | "top";

/** A nézőből kérhető műveletek (a célképhez / kritikushoz): egy helyiség „fotója" adott nézőpontból. */
export type ViewerApi = {
  /** JPEG data URL, 16:9 (a Nano Banana is 16:9-et ad vissza — így a geometria összevethető); furniture=false: bútor nélkül
   *  (a célkép bemenete), true: berendezve (a kritikus bemenete). */
  capture: (view: RoomView, opts: { furniture: boolean; width?: number }) => Promise<string>;
};

/** style: ha van stíluslap, „Japandi" nézetben a stílus anyagai és meleg fénye (a geometria ugyanaz). */
export default function ApartmentViewer({ plan, opts, style = null, furniture = [], onApi }: {
  plan: FloorPlan; opts: SceneOptions; style?: StyleSheet | null; furniture?: FurnitureItem[];
  onApi?: (api: ViewerApi | null) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ViewMode>("dollhouse");
  const [styled, setStyled] = useState(!!style);
  const [styleBusy, setStyleBusy] = useState(false);
  const styleRef = useRef<((on: boolean) => Promise<void> | void) | null>(null);
  const styledRef = useRef(styled);
  useEffect(() => { styledRef.current = styled; styleRef.current?.(styled); }, [styled]);
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

    // stílus: anyagok (aszinkron textúra-betöltés) + meleg belső fény helyiségenként (stíluslap: light_kelvin)
    let restore: (() => void) | null = null;
    let disposed = false;
    const hemi = scene.children.find((o) => (o as THREE.HemisphereLight).isHemisphereLight) as THREE.HemisphereLight;
    const roomLights = new THREE.Group();
    if (style) {
      const warm = kelvinToColor((style.light_kelvin[0] + style.light_kelvin[1]) / 2, 0.55); // meleg, de fehéregyensúlyozva
      for (const r of plan.rooms) {
        if (OUTDOOR_KINDS.includes(r.kind)) continue;
        const c = r.polygon.reduce((a, p) => [a[0] + p[0] / r.polygon.length, a[1] + p[1] / r.polygon.length], [0, 0]);
        const l = new THREE.PointLight(warm, 1.6, 7, 1.6);
        l.position.set(c[0], plan.ceilingHeight - 0.35, c[1]);
        roomLights.add(l);
      }
    }
    let furnitureGroup: THREE.Group | null = null;
    styleRef.current = async (on: boolean) => {
      if (!style) return;
      if (on && !restore) {
        setStyleBusy(true);
        const r = await applyStyle(built, plan, style).catch(() => null);
        if (furniture.length && !furnitureGroup) {
          const mats = await furnitureMaterials().catch(() => null);
          if (mats) furnitureGroup = await buildFurniture(furniture, mats, plan.ceilingHeight);
        }
        setStyleBusy(false);
        if (disposed) return;
        restore = r;
      } else if (!on && restore) { restore(); restore = null; }
      if (furnitureGroup) { if (on) scene.add(furnitureGroup); else scene.remove(furnitureGroup); }
      if (on) { scene.add(roomLights); hemi.color.copy(kelvinToColor(5200)); hemi.intensity = 1.25; scene.background = new THREE.Color(0xefe9e1); }
      else { scene.remove(roomLights); hemi.color.set(0xfffaf2); hemi.intensity = 1.7; scene.background = new THREE.Color(0xf4f1ec); }
    };
    void styleRef.current(styled);

    // FOTÓ egy helyiségről (célkép / kritikus): külön, képernyőn kívüli rendererrel, hogy a látható nézet ne ugorjon;
    // a stílus anyagai és a meleg fény mindig bekapcsolva, a mennyezet látszik, a bútor kérés szerint.
    onApi?.({
      capture: async (view, o) => {
        const wasStyled = !!restore;
        await styleRef.current?.(true);
        const w = o.width ?? 1600, h = Math.round((w * 9) / 16);
        const off = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        off.setSize(w, h, false);
        off.shadowMap.enabled = true; off.shadowMap.type = THREE.PCFSoftShadowMap;
        off.outputColorSpace = THREE.SRGBColorSpace; off.toneMapping = THREE.ACESFilmicToneMapping; off.toneMappingExposure = 1.0;
        const cam = new THREE.PerspectiveCamera(view.fov, w / h, 0.05, 100);
        cam.position.set(view.pos[0], view.eye, view.pos[1]);
        cam.lookAt(view.target[0], view.eye * 0.82, view.target[1]); // enyhén lefelé: több padló látszik, mint mennyezet
        // a fotón a mennyezet látszik, az ajtólapok nem (a nyitott lap a kamera mellett eltakarná a teret; a nyílás szabad marad)
        const ceilings: THREE.Object3D[] = [], doors: THREE.Object3D[] = [];
        built.group.traverse((x) => {
          if (x.userData.kind === "ceiling") { ceilings.push(x); x.visible = true; }
          if (x.userData.kind === "door" || x.userData.kind === "window") { doors.push(x); x.visible = false; } // ablaküveg nélkül: az ablak egyértelmű nyílás
        });
        const fVisible = furnitureGroup?.parent === scene;
        if (furnitureGroup) { if (o.furniture) scene.add(furnitureGroup); else scene.remove(furnitureGroup); }
        const bg = scene.background;
        scene.background = new THREE.Color(0xf2f6f9); // az ablakon túl: világos, nappali égbolt (az ablak egyértelműen nyílás)
        off.render(scene, cam);
        const url = off.domElement.toDataURL("image/jpeg", 0.9);
        scene.background = bg;
        ceilings.forEach((x) => { x.visible = false; });
        doors.forEach((x) => { x.visible = true; });
        if (furnitureGroup) { if (fVisible) scene.add(furnitureGroup); else scene.remove(furnitureGroup); }
        off.dispose();
        if (!wasStyled && !styledRef.current) await styleRef.current?.(false);
        return url;
      },
    });

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
      styleRef.current = null;
      onApi?.(null);
      disposed = true;
    };
    // a stílus-kapcsolót külön hatás kezeli (styleRef) — itt csak a kezdőállapot kell
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, opts, style, furniture]);

  return (
    <div className="relative h-full w-full">
      <div ref={hostRef} className="h-full w-full" aria-label="A lakás 3D-modellje (egérrel forgatható, görgővel nagyítható)" />
      <div className="absolute left-3 top-3 flex flex-wrap gap-2">
        <div className="grid grid-cols-2 gap-1 rounded-full p-1" style={{ background: "rgba(255,255,255,0.85)", border: "1px solid var(--twx-line)" }}>
          {([["dollhouse", "Babaház"], ["top", "Felülről"]] as const).map(([v, t]) => (
            <button key={v} type="button" onClick={() => { setMode(v); viewRef.current?.(v); }} aria-pressed={mode === v}
              className="h-7 rounded-full px-3 text-[12px] font-semibold" style={mode === v ? { background: "#12100e", color: "#fff" } : undefined}>{t}</button>
          ))}
        </div>
        {style && (
          <div className="grid grid-cols-2 gap-1 rounded-full p-1" style={{ background: "rgba(255,255,255,0.85)", border: "1px solid var(--twx-line)" }}>
            {([[false, "Berendezetlen"], [true, "Japandi"]] as const).map(([v, t]) => (
              <button key={t} type="button" onClick={() => setStyled(v)} aria-pressed={styled === v}
                className="h-7 rounded-full px-3 text-[12px] font-semibold" style={styled === v ? { background: "#12100e", color: "#fff" } : undefined}>{t}</button>
            ))}
          </div>
        )}
        {styleBusy && <span className="self-center rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "rgba(255,255,255,0.85)" }}>Anyagok betöltése…</span>}
      </div>
    </div>
  );
}
