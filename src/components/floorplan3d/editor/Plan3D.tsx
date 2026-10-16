// Plan3D — a javító szerkesztő 3D-nézete (2026-10-16). Ugyanabból a tervből épül, mint a kész modell (buildApartment), stílus
// nélkül — minden módosítás után újraépül (ezredmásodpercek). Kijelölés kattintással (helyiség / fal / nyílászáró / oszlop),
// a kijelölt elem korall; a kamera lágyan odafordul. Ajtó / ablak lerakása a falra kattintva (szellemképpel), nyílászáró húzása a
// fal mentén. Babaház-nézet: mennyezet nélkül, a terasz mellvéddel.
"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { FloorPlan, Pt } from "@/lib/floorplan3d/plan";
import { buildApartment, railOutdoorWalls, type SceneOptions } from "@/lib/floorplan3d/scene";
import { planBounds, roomEdge } from "@/lib/floorplan3d/geometry";
import { patchOpening, placeOpening } from "@/lib/floorplan3d/edit";
import type { Ghost, History, Pending, Selection, Tool } from "@/components/floorplan3d/editor/state";
import { ghostCheck } from "@/components/floorplan3d/editor/Plan2D";

export type View3DApi = { screenOf: (p: Pt, height?: number) => { x: number; y: number } | null };

const SEL = new THREE.Color("#EF7A5A");

export default function Plan3D({ plan, opts, sel, onSelect, tool, pending, onPlaced, history, apiRef, ghost, onGhost }: {
  plan: FloorPlan; opts: SceneOptions; sel: Selection; onSelect: (s: Selection) => void;
  tool: Tool; pending: Pending; onPlaced: (s: Selection) => void; history: History;
  apiRef: MutableRefObject<View3DApi | null>; ghost: Ghost; onGhost: (g: Ghost) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const ctx = useRef<{
    renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls;
    group: THREE.Group | null; goal: THREE.Vector3 | null; fitted: boolean;
  } | null>(null);
  // a legfrissebb props a (csak egyszer felkötött) eseménykezelőknek
  const live = useRef({ plan, sel, tool, pending, ghost, onSelect, onPlaced, history, onGhost });
  live.current = { plan, sel, tool, pending, ghost, onSelect, onPlaced, history, onGhost };

  // ---------- jelenet (egyszer) ----------
  useEffect(() => {
    const host = hostRef.current; if (!host) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4f0ea);
    scene.add(new THREE.HemisphereLight(0xfffaf2, 0xbdb3a4, 1.9));
    const sun = new THREE.DirectionalLight(0xfff1dc, 1.7);
    sun.position.set(-6, 14, -8); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 });
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.47;
    ctx.current = { renderer, scene, camera, controls, group: null, goal: null, fitted: false };

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
      if (!ctx.current!.fitted) { fitCamera(); ctx.current!.fitted = true; }
    };
    const ro = new ResizeObserver(resize); ro.observe(host); resize();

    // kattintás / húzás
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    const pick = (ev: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const g = ctx.current?.group; if (!g) return null;
      for (const hit of ray.intersectObjects(g.children, true)) {
        // a rejtett elemek (mennyezet) nem számítanak — a Raycaster a láthatatlant is eltalálja
        let vis = true; for (let q: THREE.Object3D | null = hit.object; q; q = q.parent) if (!q.visible) { vis = false; break; }
        if (!vis) continue;
        let o: THREE.Object3D | null = hit.object;
        while (o && o !== g) {
          const u = o.userData;
          if (u.openingId) return { sel: { type: "opening", id: u.openingId } as Selection, hit };
          if (u.columnId) return { sel: { type: "column", id: u.columnId } as Selection, hit };
          if (u.kind === "wall" && typeof u.edge === "number") return { sel: { type: "edge", roomId: u.roomId, edge: u.edge } as Selection, hit };
          if (u.kind === "floor") return { sel: { type: "room", roomId: u.roomId } as Selection, hit };
          o = o.parent;
        }
      }
      return null;
    };
    let down: { x: number; y: number } | null = null;
    let drag: { id: string; plane: THREE.Plane } | null = null;
    const el = renderer.domElement;
    const onDown = (ev: PointerEvent) => {
      down = { x: ev.clientX, y: ev.clientY };
      const L = live.current;
      if (L.tool !== "select") return;
      const p = pick(ev);
      if (p?.sel?.type === "opening") {
        const o = L.plan.openings.find((x) => x.id === (p.sel as { id: string }).id); if (!o) return;
        const room = L.plan.rooms.find((r) => r.id === o.roomId)!, e = roomEdge(room, o.edge), len = e.length || 1;
        const n: Pt = [-(e.b[1] - e.a[1]) / len, (e.b[0] - e.a[0]) / len];
        drag = { id: o.id, plane: new THREE.Plane(new THREE.Vector3(n[0], 0, n[1]), -(n[0] * e.a[0] + n[1] * e.a[1])) };
        controls.enabled = false; el.setPointerCapture(ev.pointerId);
        L.history.begin(); L.onSelect(p.sel);
      }
    };
    const onMove = (ev: PointerEvent) => {
      const L = live.current;
      if (drag) {
        const r = el.getBoundingClientRect();
        ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        const pt = new THREE.Vector3(); if (!ray.ray.intersectPlane(drag.plane, pt)) return;
        const o = L.plan.openings.find((x) => x.id === drag!.id); if (!o) return;
        const room = L.plan.rooms.find((x) => x.id === o.roomId)!, e = roomEdge(room, o.edge), len = e.length || 1;
        const t = ((pt.x - e.a[0]) * (e.b[0] - e.a[0]) + (pt.z - e.a[1]) * (e.b[1] - e.a[1])) / len;
        L.history.live(patchOpening(L.plan, o.id, { offset: Math.round(Math.max(o.width / 2, Math.min(e.length - o.width / 2, t)) * 100) / 100 }));
        return;
      }
      if ((L.tool === "door" || L.tool === "window") && L.pending) {
        const p = pick(ev);
        if (p?.sel?.type === "edge") {
          const s = p.sel as { roomId: string; edge: number };
          const room = L.plan.rooms.find((x) => x.id === s.roomId)!;
          if ((room.openEdges ?? []).includes(s.edge)) { L.onGhost(null); return; }
          const e = roomEdge(room, s.edge), len = e.length || 1;
          const t = ((p.hit.point.x - e.a[0]) * (e.b[0] - e.a[0]) + (p.hit.point.z - e.a[1]) * (e.b[1] - e.a[1])) / len;
          const off = Math.round(Math.max(L.pending.width / 2, Math.min(e.length - L.pending.width / 2, t)) * 100) / 100;
          L.onGhost({ roomId: s.roomId, edge: s.edge, offset: off, ...ghostCheck(L.plan, s.roomId, s.edge, off, L.pending.width) });
        } else L.onGhost(null);
      }
    };
    const onUp = (ev: PointerEvent) => {
      const L = live.current;
      if (drag) { drag = null; controls.enabled = true; L.history.end(); return; }
      if (!down || Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 5) return; // forgatás volt
      if ((L.tool === "door" || L.tool === "window") && L.pending && L.ghost?.valid) {
        const next = placeOpening(L.plan, L.ghost.roomId, L.ghost.edge, L.ghost.offset, L.pending);
        L.history.commit(next); L.onPlaced({ type: "opening", id: next.openings[next.openings.length - 1].id }); L.onGhost(null);
        return;
      }
      if (L.tool === "select") L.onSelect(pick(ev)?.sel ?? null);
    };
    el.addEventListener("pointerdown", onDown); el.addEventListener("pointermove", onMove); el.addEventListener("pointerup", onUp);

    let raf = 0;
    const tick = () => {
      const c = ctx.current!;
      if (c.goal) { controls.target.lerp(c.goal, 0.1); if (controls.target.distanceTo(c.goal) < 0.01) c.goal = null; }
      controls.update(); renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();
    apiRef.current = {
      screenOf: (p, height = 1.1) => {
        if (host.offsetWidth < 40) return null;
        const v = new THREE.Vector3(p[0], height, p[1]).project(camera), r = el.getBoundingClientRect();
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
      },
    };
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointermove", onMove); el.removeEventListener("pointerup", onUp);
      controls.dispose();
      scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose()); });
      renderer.dispose(); host.removeChild(el); apiRef.current = null; ctx.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fitCamera() {
    const c = ctx.current; if (!c) return;
    const b = planBounds(live.current.plan), cx = (b.minX + b.maxX) / 2, cz = (b.minY + b.maxY) / 2;
    const r = Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 2 + 0.5;
    const vf = THREE.MathUtils.degToRad(c.camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * c.camera.aspect);
    const dist = (r / Math.sin(Math.min(vf, hf) / 2)) * 0.95, dir = new THREE.Vector3(0.38, 0.78, 0.5).normalize();
    c.controls.target.set(cx, 0, cz);
    c.camera.position.set(cx + dir.x * dist, dir.y * dist, cz + dir.z * dist);
    c.controls.update();
  }

  // ---------- újraépítés a terv / kijelölés / szellemkép változásakor ----------
  useEffect(() => {
    const c = ctx.current; if (!c) return;
    if (c.group) {
      c.scene.remove(c.group);
      c.group.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose()); });
    }
    const built = buildApartment(plan, opts);
    built.group.traverse((o) => { if (o.userData.kind === "ceiling") o.visible = false; });
    railOutdoorWalls(plan, built);
    const hi = (o: THREE.Object3D) => o.traverse((x) => {
      const m = x as THREE.Mesh; if (!m.isMesh) return;
      const mat = (m.material as THREE.MeshStandardMaterial).clone(); mat.color = SEL.clone(); if (mat.transparent) mat.opacity = Math.max(0.6, mat.opacity); m.material = mat;
    });
    built.group.traverse((o) => {
      const u = o.userData;
      if (sel?.type === "room" && u.kind === "floor" && u.roomId === sel.roomId) hi(o);
      if (sel?.type === "edge" && u.kind === "wall" && u.roomId === sel.roomId && u.edge === sel.edge) hi(o);
      if (sel?.type === "opening" && u.openingId === sel.id) hi(o);
      if (sel?.type === "column" && u.columnId === sel.id) hi(o);
    });
    // szellemkép: a lerakandó nyílászáró áttetsző korall tömbként a falon
    if (ghost && pending) {
      const room = plan.rooms.find((r) => r.id === ghost.roomId);
      if (room) {
        const e = roomEdge(room, ghost.edge), len = e.length || 1, u: Pt = [(e.b[0] - e.a[0]) / len, (e.b[1] - e.a[1]) / len];
        const h = pending.kind === "passage" ? plan.ceilingHeight : pending.height, y0 = pending.sill;
        const m = new THREE.Mesh(new THREE.BoxGeometry(pending.width, h, 0.16), new THREE.MeshStandardMaterial({ color: ghost.valid ? 0xef7a5a : 0xb3261e, transparent: true, opacity: 0.55 }));
        m.position.set(e.a[0] + u[0] * ghost.offset, y0 + h / 2, e.a[1] + u[1] * ghost.offset);
        m.rotation.y = -Math.atan2(u[1], u[0]);
        built.group.add(m);
      }
    }
    c.scene.add(built.group);
    c.group = built.group;
  }, [plan, opts, sel, ghost, pending]);

  // ---------- a kamera a kijelölés felé fordul ----------
  useEffect(() => {
    const c = ctx.current; if (!c || !sel) return;
    let p: Pt | null = null;
    if (sel.type === "room" || sel.type === "edge" || sel.type === "vertex") {
      const r = plan.rooms.find((x) => x.id === sel.roomId);
      if (r && sel.type === "edge") { const e = roomEdge(r, sel.edge); p = [(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2]; }
      else if (r && sel.type === "vertex") p = r.polygon[sel.index] ?? null;
      else if (r) p = [r.polygon.reduce((s, q) => s + q[0], 0) / r.polygon.length, r.polygon.reduce((s, q) => s + q[1], 0) / r.polygon.length];
    }
    if (sel.type === "opening") {
      const o = plan.openings.find((x) => x.id === sel.id), r = o && plan.rooms.find((x) => x.id === o.roomId);
      if (o && r) { const e = roomEdge(r, o.edge), len = e.length || 1; p = [e.a[0] + ((e.b[0] - e.a[0]) * o.offset) / len, e.a[1] + ((e.b[1] - e.a[1]) * o.offset) / len]; }
    }
    if (sel.type === "column") { const col = (plan.columns ?? []).find((x) => x.id === sel.id); if (col) p = [col.x, col.y]; }
    if (p) c.goal = new THREE.Vector3(p[0], 0, p[1]);
    // csak a kijelölés változására fordul (húzás közben ne kövesse folyamatosan)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(sel)]);

  return <div ref={hostRef} className="h-full w-full" style={{ cursor: pending ? "copy" : undefined }} aria-label="A terv 3D-nézete (húzással forgatható)" />;
}
