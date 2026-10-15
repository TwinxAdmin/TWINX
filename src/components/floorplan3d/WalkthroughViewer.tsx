// WalkthroughViewer — bejárás szemmagasságból (4. lépés, F4a). Teljes képernyős réteg a 3D-modell fölött.
//   • nézés: húzással (egér és ujj is — „megfogod a képet", mint a Street View-ban);
//   • mozgás: kattintás / koppintás a padlóra → odasétál (útkereséssel, ajtókon át; walk.ts), vagy W/A/S/D, nyilak (←/→ fordul);
//   • ütközés: falon, bútoron nem lehet átmenni, ajtón igen, ablakon nem; a fal mentén csúszik;
//   • alaprajz a sarokban (helyzet + nézési irány), rákoppintva oda is el lehet sétálni; elrejthető;
//   • fény: nap az ablakokon át (árnyékkal, a mennyezet is árnyékol), égbolt-derengés, meleg belső fény helyiségenként.
"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { FloorPlan, Pt } from "@/lib/floorplan3d/plan";
import { OUTDOOR_KINDS } from "@/lib/floorplan3d/plan";
import type { StyleSheet } from "@/lib/floorplan3d/stylesheet";
import type { FurnitureItem } from "@/lib/floorplan3d/furniture";
import { applyStyle, kelvinToColor } from "@/lib/floorplan3d/materials";
import { buildFurniture, furnitureMaterials } from "@/lib/floorplan3d/furniture3d";
import { buildApartment, type SceneOptions } from "@/lib/floorplan3d/scene";
import { planBounds } from "@/lib/floorplan3d/geometry";
import { colliders, findPath, moveWithCollision, startPose, EYE_HEIGHT } from "@/lib/floorplan3d/walk";

const WALK_SPEED = 1.3;   // m/s — nyugodt séta
const RUN_SPEED = 2.4;    // Shift-tel
const TURN_SPEED = 1.6;   // rad/s (←/→)
const LOOK_SENS = 0.0042; // rad / képpont húzásnál

function inside(p: Pt, poly: Pt[]): boolean {
  let r = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) r = !r;
  }
  return r;
}

export default function WalkthroughViewer({ plan, opts, style, furniture, onClose }: {
  plan: FloorPlan; opts: SceneOptions; style: StyleSheet | null; furniture: FurnitureItem[]; onClose: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [showMap, setShowMap] = useState(true);
  const [roomName, setRoomName] = useState("");
  const [hint, setHint] = useState(true);
  const [portrait, setPortrait] = useState(false);
  const [portraitOk, setPortraitOk] = useState(false);
  // a minitérkép mérete: telefonon kisebb (a komponens csak kattintás után jelenik meg → a window itt elérhető)
  const [MAP_SIZE] = useState(() => (typeof window !== "undefined" && Math.min(window.innerWidth, window.innerHeight) < 500 ? 124 : 168));
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  // álló telefon: javasoljuk a fekvő tartást (nem kötelező)
  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait) and (pointer: coarse)");
    const f = () => setPortrait(mq.matches);
    f(); mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);

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
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "grab";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe4edf3); // az ablakokon túl: nappali égbolt
    const built = buildApartment(plan, opts);
    built.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (o.userData.kind === "ceiling") { m.castShadow = true; m.receiveShadow = true; } // a mennyezet árnyékol: a nap csak az ablakon süt be
      if (o.userData.kind === "window") m.castShadow = false;
      if (o.userData.kind === "door") o.traverse((x) => { (x as THREE.Mesh).castShadow = true; });
    });
    scene.add(built.group);
    // terasz / erkély: a KÜLSŐ falak (amelyek túloldalán nincs beltéri helyiség) 1 m-es mellvédként — ne legyen „doboz"; az ütközés marad
    const RAIL = 1.0;
    const outdoorIds = new Set(plan.rooms.filter((r) => OUTDOOR_KINDS.includes(r.kind)).map((r) => r.id));
    const indoorAt = (p: Pt) => plan.rooms.some((r) => !OUTDOOR_KINDS.includes(r.kind) && inside(p, r.polygon));
    for (const w of built.walls) {
      if (!outdoorIds.has(w.userData.roomId)) continue;
      const bb = new THREE.Box3().setFromObject(w), c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
      const thinX = sz.x < sz.z, t = (thinX ? sz.x : sz.z) / 2 + 0.3;
      if (indoorAt(thinX ? [c.x - t, c.z] : [c.x, c.z - t]) || indoorAt(thinX ? [c.x + t, c.z] : [c.x, c.z + t])) continue; // homlokzat a lakás felé
      if (bb.min.y >= RAIL - 0.01) { w.visible = false; continue; }
      if (bb.max.y > RAIL) { w.scale.y = (RAIL - bb.min.y) / sz.y; w.position.y = bb.min.y + (RAIL - bb.min.y) / 2; }
    }

    // fények
    const b = planBounds(plan);
    const cx = (b.minX + b.maxX) / 2, cz = (b.minY + b.maxY) / 2, span = Math.max(b.maxX - b.minX, b.maxY - b.minY);
    scene.add(new THREE.HemisphereLight(kelvinToColor(5600), 0xb9ad9c, 1.15));
    const sun = new THREE.DirectionalLight(0xfff0d8, 3.2);
    sun.position.set(cx - span * 0.9, span * 0.75, cz - span * 0.6); // alacsony nap (~35°): az ablakokon át a padlóra süt
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

    // anyagok + bútorok (aszinkron)
    let furnitureGroup: THREE.Group | null = null;
    void (async () => {
      if (style) await applyStyle(built, plan, style).catch(() => null);
      if (furniture.length) {
        const mats = await furnitureMaterials().catch(() => null);
        if (mats && !disposed) furnitureGroup = await buildFurniture(furniture, mats, plan.ceilingHeight).catch(() => null);
        if (furnitureGroup && !disposed) scene.add(furnitureGroup);
      }
      if (!disposed) setLoading(false);
    })();

    // mozgás állapota
    const rects = colliders(plan, opts, furniture);
    const st = startPose(plan, rects);
    let pos: Pt = st.pos, yaw = st.yaw, pitch = -0.08;
    let path: Pt[] = [];
    let stuck = 0;
    const keys = new Set<string>();

    const camera = new THREE.PerspectiveCamera(66, 1, 0.05, 100);
    const lookDir = new THREE.Vector3();
    const placeCamera = () => {
      camera.position.set(pos[0], EYE_HEIGHT, pos[1]);
      lookDir.set(Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch));
      camera.lookAt(camera.position.clone().add(lookDir));
    };

    // célgyűrű a padlón (hová sétál / hová lehet kattintani)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.22, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.visible = false; ring.renderOrder = 2;
    scene.add(ring);

    const walkTo = (target: Pt) => {
      const p = findPath(pos, target, rects, b);
      if (!p?.length) return false;
      path = p; stuck = 0;
      const end = p[p.length - 1];
      ring.position.set(end[0], 0.01, end[1]); ring.visible = true;
      setHint(false);
      return true;
    };

    // kattintás → a padló pontja (az első eltalált felület: fal, padló vagy bútor; a mennyezet nem)
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pickFloor = (clientX: number, clientY: number): Pt | null => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const targets: THREE.Object3D[] = [...built.walls, ...built.floors.values()];
      if (furnitureGroup) targets.push(furnitureGroup);
      const hit = ray.intersectObjects(targets, true)[0];
      return hit ? [hit.point.x, hit.point.z] : null;
    };

    // mutató: húzás = nézés, rövid kattintás = odasétálás
    let drag: { x: number; y: number; sx: number; sy: number; t: number; id: number } | null = null;
    const el = renderer.domElement;
    const onDown = (e: PointerEvent) => {
      if (drag) return; // második ujj: figyelmen kívül
      drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), id: e.pointerId };
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      if (drag && e.pointerId === drag.id) {
        yaw -= (e.clientX - drag.x) * LOOK_SENS;
        pitch = Math.max(-1.25, Math.min(1.25, pitch + (e.clientY - drag.y) * LOOK_SENS));
        drag.x = e.clientX; drag.y = e.clientY;
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) setHint(false);
      } else if (e.pointerType === "mouse" && !path.length) {
        const p = pickFloor(e.clientX, e.clientY);
        ring.visible = !!p;
        if (p) ring.position.set(p[0], 0.01, p[1]);
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const moved = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy), dt = performance.now() - drag.t;
      drag = null;
      el.style.cursor = "grab";
      if (moved < 8 && dt < 500) {
        const p = pickFloor(e.clientX, e.clientY);
        if (p) walkTo(p);
      }
    };
    const onLeave = () => { if (!path.length) ring.visible = false; };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("pointerleave", onLeave);

    const MOVE_KEYS = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight", "KeyQ", "KeyE"];
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape" && e.type === "keydown") { closeRef.current(); return; }
      if (!MOVE_KEYS.includes(e.code)) return;
      e.preventDefault();
      if (e.type === "keydown") { keys.add(e.code); path = []; ring.visible = false; setHint(false); } else keys.delete(e.code);
    };
    const onBlur = () => keys.clear();
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", onBlur);

    // alaprajz (minitérkép): a helyiségek egyszer előre rajzolva, a helyzet képkockánként
    const mapCanvas = mapRef.current;
    const pad = 10, mScale = (MAP_SIZE - 2 * pad) / Math.max(b.maxX - b.minX, b.maxY - b.minY, 1);
    const offX = pad + (MAP_SIZE - 2 * pad - (b.maxX - b.minX) * mScale) / 2, offY = pad + (MAP_SIZE - 2 * pad - (b.maxY - b.minY) * mScale) / 2;
    const toMap = (p: Pt): Pt => [offX + (p[0] - b.minX) * mScale, offY + (p[1] - b.minY) * mScale];
    const fromMap = (q: Pt): Pt => [(q[0] - offX) / mScale + b.minX, (q[1] - offY) / mScale + b.minY];
    const base = document.createElement("canvas");
    const dpr = Math.min(window.devicePixelRatio, 2);
    base.width = MAP_SIZE * dpr; base.height = MAP_SIZE * dpr;
    {
      const g = base.getContext("2d")!;
      g.scale(dpr, dpr);
      for (const r of plan.rooms) {
        g.beginPath();
        r.polygon.forEach((p, i) => { const q = toMap(p); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
        g.closePath();
        g.fillStyle = OUTDOOR_KINDS.includes(r.kind) ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.22)";
        g.fill();
        g.strokeStyle = "rgba(255,255,255,0.75)"; g.lineWidth = 1.4; g.stroke();
      }
    }
    if (mapCanvas) { mapCanvas.width = MAP_SIZE * dpr; mapCanvas.height = MAP_SIZE * dpr; }
    const onMapTap = (e: PointerEvent) => {
      const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
      walkTo(fromMap([((e.clientX - r.left) / r.width) * MAP_SIZE, ((e.clientY - r.top) / r.height) * MAP_SIZE]));
    };
    mapCanvas?.addEventListener("pointerdown", onMapTap);
    let lastMap = "";
    const drawMap = () => {
      if (!mapCanvas || !mapCanvas.offsetParent) return;
      const key = `${pos[0].toFixed(2)},${pos[1].toFixed(2)},${yaw.toFixed(2)},${path.length}`;
      if (key === lastMap) return;
      lastMap = key;
      const g = mapCanvas.getContext("2d")!;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
      g.drawImage(base, 0, 0);
      g.scale(dpr, dpr);
      const q = toMap(pos);
      if (path.length) {
        g.setLineDash([3, 3]); g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(q[0], q[1]); path.forEach((p) => { const m = toMap(p); g.lineTo(m[0], m[1]); }); g.stroke(); g.setLineDash([]);
      }
      // látókúp (a kamera vízszintes látószöge)
      const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
      g.beginPath(); g.moveTo(q[0], q[1]);
      g.arc(q[0], q[1], 26, yaw - half, yaw + half); g.closePath();
      g.fillStyle = "rgba(239,122,90,0.38)"; g.fill();
      g.beginPath(); g.arc(q[0], q[1], 4.5, 0, Math.PI * 2);
      g.fillStyle = "#ef7a5a"; g.fill(); g.strokeStyle = "#fff"; g.lineWidth = 1.5; g.stroke();
    };

    let lastRoom = "";
    const updateRoom = () => {
      const r = plan.rooms.find((x) => inside(pos, x.polygon));
      const n = r?.name ?? "";
      if (n !== lastRoom) { lastRoom = n; setRoomName(n); }
    };

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(h, 1);
      camera.fov = camera.aspect < 1 ? 80 : 66; // álló képernyőn szélesebb függőleges látószög, hogy oldalra is lásson
      camera.updateProjectionMatrix();
      lastMap = "";
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let raf = 0, last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // billentyűk
      const run = keys.has("ShiftLeft") || keys.has("ShiftRight");
      const sp = (run ? RUN_SPEED : WALK_SPEED) * dt;
      let f = 0, s = 0;
      if (keys.has("KeyW") || keys.has("ArrowUp")) f += 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) f -= 1;
      if (keys.has("KeyD")) s += 1;
      if (keys.has("KeyA")) s -= 1;
      if (keys.has("ArrowLeft") || keys.has("KeyQ")) yaw -= TURN_SPEED * dt;
      if (keys.has("ArrowRight") || keys.has("KeyE")) yaw += TURN_SPEED * dt;
      if (f || s) {
        const n = Math.hypot(f, s);
        // előre: (cos, sin); jobbra: (−sin, cos) — a three.js-ben a +z az alaprajz +y-ja
        const d: Pt = [((Math.cos(yaw) * f - Math.sin(yaw) * s) / n) * sp, ((Math.sin(yaw) * f + Math.cos(yaw) * s) / n) * sp];
        pos = moveWithCollision(pos, d, rects);
      }
      // útvonal követése (kattintás után)
      if (path.length) {
        const t = path[0];
        const dx = t[0] - pos[0], dy = t[1] - pos[1], dist = Math.hypot(dx, dy);
        if (dist < 0.04) { path.shift(); if (!path.length) ring.visible = false; }
        else {
          const step = Math.min(dist, WALK_SPEED * dt * (path.length > 1 || dist > 0.6 ? 1 : Math.max(0.35, dist / 0.6))); // a cél előtt lassít
          const next = moveWithCollision(pos, [(dx / dist) * step, (dy / dist) * step], rects);
          const moved = Math.hypot(next[0] - pos[0], next[1] - pos[1]);
          pos = next;
          stuck = moved < step * 0.2 ? stuck + 1 : 0;
          if (stuck > 20) { path = []; ring.visible = false; }
          // a nézés lassan a haladás irányába fordul (nem rántja el)
          const want = Math.atan2(dy, dx);
          let diff = want - yaw;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          if (!drag) yaw += diff * Math.min(1, dt * 2.2);
        }
      }
      placeCamera();
      renderer.render(scene, camera);
      drawMap();
      updateRoom();
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", onBlur);
      mapCanvas?.removeEventListener("pointerdown", onMapTap);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
      });
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [plan, opts, style, furniture, MAP_SIZE]);

  // a háttér-oldal ne görgessen a bejárás alatt
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const pill = { background: "rgba(18,16,14,0.62)", color: "#fff", backdropFilter: "blur(6px)" } as const;
  return (
    <div className="fixed inset-0 z-[80] select-none" style={{ background: "#12100e" }} role="dialog" aria-label="Bejárás szemmagasságból">
      <div ref={hostRef} className="absolute inset-0" />

      {/* felső sáv: helyiség + bezárás */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-2 p-3">
        <span className="pointer-events-auto flex h-9 min-w-[120px] items-center justify-center rounded-full px-4 text-[13px] font-semibold" style={pill}>
          {roomName || "—"}
        </span>
        <span className="ml-auto" />
        <button type="button" onClick={() => setShowMap((v) => !v)} aria-pressed={showMap}
          className="pointer-events-auto h-9 w-[92px] rounded-full text-[12.5px] font-semibold" style={showMap ? { ...pill, boxShadow: "inset 0 0 0 1.5px #ef7a5a" } : pill}
          title={showMap ? "Alaprajz elrejtése" : "Alaprajz megjelenítése"}>Alaprajz</button>
        <button type="button" onClick={onClose} className="pointer-events-auto h-9 rounded-full px-4 text-[12.5px] font-semibold"
          style={{ background: "#fff", color: "#12100e" }} title="Kilépés (Esc)">Kilépés</button>
      </div>

      {/* alaprajz (minitérkép) — rákoppintva oda sétál */}
      <div className="absolute bottom-3 left-3 rounded-2xl p-1.5" style={{ ...pill, display: showMap ? "block" : "none" }}>
        <canvas ref={mapRef} style={{ width: MAP_SIZE, height: MAP_SIZE, cursor: "pointer", display: "block" }} aria-label="Alaprajz: koppints, hová sétáljon" />
      </div>

      {/* súgó (az első mozdulatig) */}
      {hint && !loading && !(portrait && !portraitOk) && (
        <div className="pointer-events-none absolute inset-x-0 top-14 flex justify-center px-3">
          <p className="max-w-[560px] rounded-2xl px-4 py-2.5 text-center text-[12.5px] leading-relaxed" style={pill}>
            Húzással nézz körül · kattints (koppints) a padlóra, és odasétálsz
            <span className="hidden sm:inline"> · W/A/S/D vagy nyilak, Shift: gyorsabban · Esc: kilépés</span>
          </p>
        </div>
      )}

      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full px-4 py-2 text-[13px] font-semibold" style={pill}>Anyagok és bútorok betöltése…</span>
        </div>
      )}

      {portrait && !portraitOk && (
        <div className="absolute inset-x-3 top-16 flex items-center gap-3 rounded-2xl px-4 py-3 text-[12.5px]" style={pill}>
          <span className="flex-1">Fordítsd fekvőbe a telefont — így többet látsz a térből.</span>
          <button type="button" onClick={() => setPortraitOk(true)} className="h-8 rounded-full px-3 text-[12px] font-semibold" style={{ background: "#fff", color: "#12100e" }}>Rendben</button>
        </div>
      )}
    </div>
  );
}
