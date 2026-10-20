// IntroDollhouse — a bemutató 4. (utolsó) jelenete: VALÓDI 3D babaház-nézet a mintalakásról (demo.ts), a modul saját motorjával.
// 2026-10-20 (Márk kérése): POV bejárás, nyílászáró-beillesztés és BÚTOROK nélkül —
//   1. a szobák EGYMÁS UTÁN épülnek fel (az előszobától): a padló megjelenik, a falak rugalmasan felnőnek;
//   2. helyiségenként eltérő, a helyiséghez illő padló (demoFloors.ts — csak a bemutatóé);
//   3. a modell közben lassan körbefordul; minden szoba fölött név + m² (a terv saját, ellenőrzött területe);
//   4. zárás: „Elfogadom" → „Elfogadva" → a kártya linkké alakul → egy boríték e-mailben „elrepül" az érdeklődő telefonjára,
//      ahol megjelenik az értesítés: a bejárható 3D lakás linkje megérkezett.
// A feliratok, a m²-címkék és a záró kártya HTML-rétegben; a címkék a szobák 3D-középpontjának képernyő-vetületét követik.
"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { StyleSheet } from "@/lib/floorplan3d/stylesheet";
import { applyStyle, kelvinToColor } from "@/lib/floorplan3d/materials";
import { buildApartment, railOutdoorWalls, type SceneOptions } from "@/lib/floorplan3d/scene";
import { planBounds } from "@/lib/floorplan3d/geometry";
import { DEMO_PLAN } from "@/lib/floorplan3d/demo";
import { demoFloorMaterial } from "@/components/floorplan3d/intro/demoFloors";

export const DOLLHOUSE_MS = 15500;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const easeBack = (t: number) => { t = clamp(t); const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const smooth = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };

// felépülési sorrend (a bejárattól befelé) és időzítés (ms)
const ORDER = ["eloszoba", "nappali", "halo", "konyha", "furdo", "szoba", "erkely"];
const BUILD_START = 500, BUILD_STEP = 560, BUILD_DUR = 900;
const roomStart = (id: string) => BUILD_START + Math.max(0, ORDER.indexOf(id)) * BUILD_STEP;
const BUILD_END = BUILD_START + (ORDER.length - 1) * BUILD_STEP + BUILD_DUR;
// zárás: elfogadás → link → e-mail az érdeklődőnek
const T = {
  tag: BUILD_END + 400,          // „Méretpontos 3D modell"
  accept: BUILD_END + 1500,      // megjelenik az elfogadó kártya
  click: BUILD_END + 3000,       // kattintás az „Elfogadom"-ra
  link: BUILD_END + 3900,        // a kártya linkké alakul
  send: BUILD_END + 4900,        // a boríték elindul
  sendDur: 1500,
  deliver: BUILD_END + 6500,     // megérkezik a telefonra
  done: BUILD_END + 7000,        // „Elküldve — már bejárhatja"
};

const fmtArea = (a: number) => `${a.toLocaleString("hu-HU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²`;
const centroid = (poly: [number, number][]) => poly.reduce((a, p) => [a[0] + p[0] / poly.length, a[1] + p[1] / poly.length], [0, 0]);

export default function IntroDollhouse({ opts, style, playing, restart = 0, onProgress, onEnd }: {
  opts: SceneOptions; style: StyleSheet | null; playing: boolean;
  /** Minden új értéknél elölről indul (pl. a 4. lépésre kattintva, miközben már ez fut). */
  restart?: number;
  onProgress?: (f: number) => void; onEnd?: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const playRef = useRef(playing), progRef = useRef(onProgress), endRef = useRef(onEnd), restartRef = useRef(restart);
  useEffect(() => { playRef.current = playing; progRef.current = onProgress; endRef.current = onEnd; restartRef.current = restart; }, [playing, onProgress, onEnd, restart]);
  const labels = useMemo(() => DEMO_PLAN.rooms.map((r) => ({ id: r.id, name: r.name, area: r.declaredArea ?? 0, c: centroid(r.polygon) })), []);

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
    const built = buildApartment(DEMO_PLAN, opts);
    built.group.traverse((o) => { if (o.userData.kind === "ceiling") o.visible = false; });
    railOutdoorWalls(DEMO_PLAN, built);
    const root = new THREE.Group();
    scene.add(root);

    // SZOBÁNKÉNTI CSOPORTOK: a falak, a padló és a nyílászárók a saját szobájuk csoportjába kerülnek (a csoport origója a padlón
    // van → a y-skála a falakat a padlótól „növeszti"). Ami nem köthető szobához, az a legelső szobával együtt jelenik meg.
    const roomOfOpening = new Map(DEMO_PLAN.openings.map((o) => [o.id, o.roomId]));
    const groups = new Map<string, THREE.Group>();
    for (const r of DEMO_PLAN.rooms) { const g = new THREE.Group(); g.userData.roomId = r.id; groups.set(r.id, g); root.add(g); }
    const first = groups.get(ORDER[0])!;
    for (const child of [...built.group.children]) {
      const rid = (child.userData.roomId as string | undefined) ?? roomOfOpening.get(child.userData.openingId as string);
      (groups.get(rid ?? "") ?? first).add(child);
    }

    // a helyiséghez illő, változatos padlók (a stílus vakolt falai maradnak, a padlót felülírjuk)
    const ownMats: THREE.Material[] = [];
    const paintFloors = () => {
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || o.userData.kind !== "floor") return;
        const room = DEMO_PLAN.rooms.find((r) => r.id === o.userData.roomId);
        const mat = room ? demoFloorMaterial(room.id, room.kind, renderer) : null;
        if (mat) { m.material = mat; ownMats.push(mat); }
      });
    };
    paintFloors();

    const b = planBounds(DEMO_PLAN);
    const cx = (b.minX + b.maxX) / 2, cz = (b.minY + b.maxY) / 2, span = Math.max(b.maxX - b.minX, b.maxY - b.minY);
    scene.add(new THREE.HemisphereLight(kelvinToColor(5200), 0xbdb3a4, 1.35));
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
      const c = centroid(r.polygon);
      const l = new THREE.PointLight(warm, 1.4, 7, 1.6);
      l.position.set(c[0], DEMO_PLAN.ceilingHeight - 0.35, c[1]);
      groups.get(r.id)!.add(l); // a szoba fénye a szobával együtt „gyullad fel"
    }
    void (async () => {
      // a stílus (vakolt falak) a csoporton járja be a hálókat — az elemek már a szobánkénti csoportokban vannak (root alatt)
      if (style) await applyStyle({ ...built, group: root }, DEMO_PLAN, style).catch(() => null);
      if (!disposed) paintFloors(); // a stílus felülírta a padlót → újra a bemutató saját padlói
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
    const radius = Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 2 + 0.6;
    const place = (t: number) => {
      // a távolság a szűkebb látószöghöz igazodik (álló és fekvő dobozban is az egész lakás beférjen)
      const vf = THREE.MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
      const R0 = (radius / Math.sin(Math.min(vf, hf) / 2)) * 0.9;
      const az = -0.75 + (t / DOLLHOUSE_MS) * Math.PI * 1.15;               // lassú, egyenletes körbefordulás
      const el = THREE.MathUtils.degToRad(58 - 10 * smooth(t / BUILD_END));  // felülnézetből indul, majd kicsit lejjebb ereszkedik
      // a záró kártya megjelenésekor a kamera hátrébb lép és lejjebb néz → a modell kisebb lesz és feljebb csúszik
      const lift = smooth((t - T.accept + 400) / 1200), R = R0 * (1 + 0.28 * lift);
      camera.position.set(center.x + Math.sin(az) * Math.cos(el) * R, Math.sin(el) * R, center.z + Math.cos(az) * Math.cos(el) * R);
      camera.lookAt(center.x, center.y - 1.5 * lift, center.z);
    };

    const labelEls = new Map<string, HTMLElement>();
    box.querySelectorAll<HTMLElement>("[data-room]").forEach((e) => labelEls.set(e.dataset.room!, e));
    const btn = box.querySelector<HTMLElement>("[data-accept]")!;
    const cursor = box.querySelector<HTMLElement>("[data-cur]")!;
    const ring = box.querySelector<HTMLElement>("[data-ring]")!;
    const env = box.querySelector<HTMLElement>("[data-env]")!;
    const path = box.querySelector<HTMLElement>("[data-path]")!;
    const tmp = new THREE.Vector3();

    let raf = 0, t0 = performance.now(), wasPlaying = false, ended = false, drawn = false, seenRestart = restartRef.current;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      // várakozás: egyszer kirajzoljuk a kezdőképet (előtöltés), leálláskor az utolsó kép marad (elhalványul) — nem ugrik vissza
      if (!playRef.current) { wasPlaying = false; if (drawn) return; }
      else if (!wasPlaying || seenRestart !== restartRef.current) { wasPlaying = true; seenRestart = restartRef.current; t0 = performance.now(); ended = false; }
      const t = playRef.current ? Math.min(DOLLHOUSE_MS, performance.now() - t0) : 0;
      progRef.current?.(t / DOLLHOUSE_MS);
      if (t >= DOLLHOUSE_MS && !ended) { ended = true; endRef.current?.(); }

      // szobák felépülése: a padló azonnal, a falak rugalmasan felnőnek, a csoport közben finoman a helyére ereszkedik
      for (const [id, g] of groups) {
        const k = (t - roomStart(id)) / BUILD_DUR;
        g.visible = k > 0;
        g.scale.y = Math.max(0.001, easeBack(k));
        g.position.y = 0.35 * (1 - easeOut(k * 1.4));
      }
      place(t);
      renderer.render(scene, camera);
      drawn = true;

      // HTML-réteg: m²-címkék (a szoba felépülése után, a 3D-középpont fölött)
      const bw = box.clientWidth, bh = box.clientHeight;
      for (const l of labels) {
        const el = labelEls.get(l.id);
        if (!el) continue;
        const shown = t >= roomStart(l.id) + BUILD_DUR * 0.85;
        tmp.set(l.c[0], DEMO_PLAN.ceilingHeight + 0.15, l.c[1]).project(camera);
        el.style.opacity = shown ? "1" : "0";
        el.style.transform = `translate(-50%, -100%) translate(${((tmp.x + 1) / 2) * bw}px, ${((1 - tmp.y) / 2) * bh}px)${shown ? "" : " translateY(6px)"}`;
      }
      // időzített elemek (data-at / data-off) és állapot-osztályok (data-on = ettől „on")
      box.querySelectorAll<HTMLElement>("[data-at]").forEach((e) => {
        const a = +e.dataset.at!, off = e.dataset.off ? +e.dataset.off : Infinity;
        e.style.opacity = t >= a && t < off ? "1" : "0";
      });
      box.querySelectorAll<HTMLElement>("[data-on]").forEach((e) => e.classList.toggle("on", t >= +e.dataset.on!));
      btn.classList.toggle("press", t >= T.click && t < T.click + 220);

      // kurzor: a kártya alól az „Elfogadom" gombra, kattintás, majd eltűnik
      const br = btn.getBoundingClientRect(), bx = box.getBoundingClientRect();
      const tx = br.left + br.width * 0.55 - bx.left, ty = br.top + br.height * 0.6 - bx.top;
      const sx = bw * 0.62, sy = bh * 0.98;
      const kc = smooth((t - (T.click - 1100)) / 950);
      const curVis = t >= T.click - 1150 && t < T.click + 600;
      cursor.style.opacity = curVis ? "1" : "0";
      cursor.style.transform = `translate(${sx + (tx - sx) * kc}px, ${sy + (ty - sy) * kc}px)`;
      ring.style.animation = t >= T.click && t < T.click + 400 ? "twt-ring .4s ease-out" : "none";

      // boríték: a linktől a telefonig, enyhe íven
      const pr = path.getBoundingClientRect();
      const kp = easeOut((t - T.send) / T.sendDur);
      const flying = t >= T.send && t < T.send + T.sendDur + 120;
      env.style.opacity = flying ? "1" : "0";
      env.style.transform = `translate(${kp * Math.max(0, pr.width - 22)}px, ${-Math.sin(kp * Math.PI) * 16}px) rotate(${(1 - kp) * -10}deg)`;
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
        (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach((x) => { (x as THREE.MeshStandardMaterial).map?.dispose(); x.dispose(); });
      });
      ownMats.forEach((x) => { (x as THREE.MeshStandardMaterial).map?.dispose(); x.dispose(); });
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [opts, style, labels]);

  return (
    <div ref={boxRef} className="twt-3d relative h-full w-full select-none" aria-label="Bemutató: méretpontos 3D modell, elfogadás után e-mailben megy a link az érdeklődőnek">
      <style>{CSS}</style>
      <div ref={hostRef} className="absolute inset-0" />
      {labels.map((l) => (
        <span key={l.id} data-room={l.id} className="twt-room" style={{ opacity: 0 }}>
          <b>{l.name}</b><span>{fmtArea(l.area)}</span>
        </span>
      ))}
      <span data-at={T.tag} className="twt-tag" style={{ background: "rgba(47,158,95,.9)", left: "50%", transform: "translateX(-50%)", top: 6 }}>
        ✓ Méretpontos 3D modell<span className="twt-tag-x"> — szobánként ellenőrzött m²</span>
      </span>

      {/* ===== ZÁRÓ KÁRTYA: elfogadás → link → e-mail az érdeklődőnek (fix méret, a rétegek egymásba úsznak) ===== */}
      <div className="twt-fin" data-at={T.accept}>
        <span className="twt-soon2">HAMAROSAN</span>
        {/* 1. réteg: elfogadás */}
        <div className="twt-fl" data-at={T.accept} data-off={T.link}>
          <div className="twt-fl-txt">
            <b>Minden rendben a modellen?</b>
            <small>Helyiségek, méretek, nyílászárók — ellenőrizve</small>
          </div>
          <span className="twt-acc" data-accept data-on={T.click + 120}>
            <em className="a">Elfogadom</em><em className="b">✓ Elfogadva</em>
          </span>
        </div>
        {/* 2. réteg: link → boríték → telefon */}
        <div className="twt-fl twt-fl2" data-at={T.link}>
          <div className="twt-chip">
            <i aria-hidden><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" /></svg></i>
            <span><b>Link elkészült</b><small>twinx.hu/3d/mintalakas</small></span>
          </div>
          <div className="twt-path" data-path>
            <span className="twt-env" data-env aria-hidden>
              <svg width="22" height="16" viewBox="0 0 22 16"><rect x="0.8" y="0.8" width="20.4" height="14.4" rx="2.5" fill="#FDFBF6" stroke="#E9693F" strokeWidth="1.6" /><path d="M1.5 2l9.5 7 9.5-7" fill="none" stroke="#E9693F" strokeWidth="1.6" strokeLinejoin="round" /></svg>
            </span>
          </div>
          <div className="twt-phone" data-on={T.deliver}>
            <div className="twt-scr">
              <span className="twt-notif">
                <b>TWINX · e-mail</b>
                <small>Bejárható 3D lakás · Megnyitás →</small>
              </span>
            </div>
            <span className="twt-who">Érdeklődő</span>
          </div>
        </div>
        <p className="twt-fcap" data-at={T.accept} data-off={T.done}>Egy kattintás a jóváhagyáshoz — a link azonnal elkészül.</p>
        <p className="twt-fcap ok" data-at={T.done}>✓ E-mailben elküldve — az érdeklődő már bejárhatja a lakást</p>
      </div>

      <span data-cur className="twt-cur" style={{ left: 0, top: 0 }}>
        <svg width="18" height="22" viewBox="0 0 18 22"><path d="M2 1l14 10-6 1 4 7-3 1.5-4-7-5 4z" fill="#fff" stroke="#12100e" strokeWidth="1.4" strokeLinejoin="round" /></svg>
        <i data-ring />
      </span>
    </div>
  );
}

const CSS = `.twt-room{position:absolute;left:0;top:0;padding:4px 9px 5px;border-radius:10px;background:rgba(18,16,14,.82);color:#F4EFE7;
  box-shadow:0 6px 16px rgba(0,0,0,.35),inset 0 0 0 1px rgba(255,255,255,.12);white-space:nowrap;text-align:center;pointer-events:none;
  transition:opacity .45s ease;will-change:transform;z-index:3}
.twt-room b{display:block;font-size:11px;line-height:13px;font-weight:800}
.twt-room span{display:block;font-size:10.5px;line-height:13px;font-weight:700;color:#9FE0BC}
.twt-room::after{content:"";position:absolute;left:50%;bottom:-4px;width:8px;height:8px;margin-left:-4px;background:rgba(18,16,14,.82);transform:rotate(45deg)}
.twt-fin{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);width:min(94%,440px);height:122px;padding:12px 14px 10px;border-radius:18px;
  background:rgba(26,22,19,.93);backdrop-filter:blur(8px);color:#F4EFE7;box-shadow:0 16px 40px rgba(0,0,0,.5),inset 0 0 0 1px rgba(255,255,255,.12);
  transition:opacity .5s ease;z-index:4;text-align:left;overflow:hidden}
.twt-soon2{position:absolute;right:12px;bottom:10px;padding:0 7px;border-radius:99px;font-size:8.5px;line-height:14px;font-weight:800;letter-spacing:.08em;color:#1C1815;background:#F08A68;z-index:2}
.twt-fl{position:absolute;left:14px;right:14px;top:12px;height:70px;display:flex;align-items:center;gap:10px;transition:opacity .45s ease}
.twt-fl-txt{flex:1;min-width:0}
.twt-fl-txt b{display:block;font-size:13px;line-height:17px}
.twt-fl-txt small{display:block;font-size:11px;line-height:15px;color:#BDB3A7;margin-top:1px}
.twt-acc{position:relative;flex:none;width:118px;height:38px;margin-right:4px;border-radius:99px;background:linear-gradient(160deg,#F49274,#E9693F);
  box-shadow:0 8px 20px rgba(233,105,63,.4);transition:transform .15s ease,background .35s ease,box-shadow .35s ease}
.twt-acc em{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:13px;font-weight:800;color:#fff;transition:opacity .3s ease}
.twt-acc .b{opacity:0}
.twt-acc.on{background:linear-gradient(160deg,#4FBF83,#2f9e5f);box-shadow:0 8px 20px rgba(47,158,95,.4)}
.twt-acc.on .a{opacity:0}.twt-acc.on .b{opacity:1}
.twt-acc.press{transform:scale(.92)}
.twt-fl2{gap:8px}
@media (max-width:480px){.twt-tag-x{display:none}}
.twt-chip{flex:none;display:flex;align-items:center;gap:8px;padding:6px 10px 6px 6px;border-radius:12px;background:rgba(255,255,255,.07);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}
.twt-chip i{width:28px;height:28px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#F49274,#E9693F)}
.twt-chip b{display:block;font-size:11.5px;line-height:14px}
.twt-chip small{display:block;font-size:10px;line-height:13px;color:#F3D9A4}
.twt-path{position:relative;flex:1;height:2px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.28) 0 5px,transparent 5px 10px)}
.twt-env{position:absolute;left:0;top:-8px;filter:drop-shadow(0 3px 6px rgba(0,0,0,.45));transition:opacity .2s}
.twt-phone{position:relative;flex:none;width:62px;height:70px;margin-right:2px;border-radius:9px;background:#0F0E0D;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.28);display:flex;justify-content:center}
.twt-scr{position:absolute;left:3px;right:3px;top:3px;bottom:13px;border-radius:6px;background:linear-gradient(170deg,#2A2621,#1B1714);overflow:hidden}
.twt-notif{position:absolute;left:2px;right:2px;top:3px;padding:2px 3px;border-radius:4px;background:#FDFBF6;color:#1C1815;transform:translateY(-130%);transition:transform .45s cubic-bezier(.2,.9,.3,1.3)}
.twt-notif b{display:block;font-size:7px;line-height:9px;font-weight:800;color:#C2512F}
.twt-notif small{display:block;font-size:6.5px;line-height:8px;font-weight:700}
.twt-phone.on .twt-notif{transform:none}
.twt-phone.on{box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.28),0 0 0 3px rgba(239,122,90,.35)}
.twt-who{position:absolute;bottom:1px;left:0;right:0;text-align:center;font-size:8px;line-height:11px;font-weight:700;color:#BDB3A7}
.twt-fcap{position:absolute;left:14px;right:96px;bottom:9px;margin:0;font-size:11px;line-height:15px;color:#CFC6BB;transition:opacity .45s ease}
.twt-fcap.ok{color:#9FE0BC;font-weight:700}`;
