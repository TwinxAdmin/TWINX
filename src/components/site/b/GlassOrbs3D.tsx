// Gömbös 3D ábra (terv 30, D72) — a „Mi az egyedi modul?" szekció jobb oldali ábrája. A minta
// (docs/terv/design/gombos-abra-minta.html) pontos átültetése a projekt Three.js-ére (0.180, ES modul):
//   • 7 üveggömb (fresnel réz perem, csúcsfény, alsó narancs izzás), közepükön a szó (vászon-sprite, Inter);
//   • réz ívek a középső gömbtől és a szomszédok között + két megdöntött pálya;
//   • ~3000 apró pont (ívek, pályák, héj a középső gömb körül, ritka por) + 14 kis rézgömb;
//   • egér / érintés: a kurzor körül (RAD 150 px, erősség 2,9) az apró elemek szétrebbennek és halványulnak, 0,06-os
//     csillapítással állnak vissza; a nagy gömbök RAD + sugaruk 60%-a körben térnek ki (0,75 / középen 0,35),
//     a vezetékek minden képkockán követik őket;
//   • nyugalomban a gömbök véletlenszerűen, egymástól függetlenül felizzanak (sin², 1,4–2,3 mp, szünet 1,8–6,3 mp).
// Eltérés a mintától (r149 → r180): a színkezelés miatt a saját shaderek végén `colorspace_fragment` van, a pontfény
// fizikai lecsengése miatt az erőssége nagyobb (a kis rézgömbök fényessége így egyezik a mintáéval).
// Rajzolás: folyamatos, amíg látszik (izzás), de a pontokat csak mozgás után számolja; elrejtve / háttérfülön áll.
"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { ORB_WORDS } from "@/lib/site-copy";

type Props = { onFail?: () => void };

const POS: [number, number, number][] = [
  [0, 0, 0], [-3.15, 2.35, -0.6], [3.2, 2.15, 0.3], [-3.45, -1.75, 0.5], [3.35, -1.95, -0.4], [0.15, 3.75, -1.1], [0.35, -3.85, 0.3],
];
const RADII = [1.95, 1.08, 1.12, 1.18, 1.02, 0.98, 1.08];
const RAD = 150, STR = 2.9;
// LEVÁGÁS ELLEN (Márk kérése 2026-11-27): a vászon minden oldalon 18%-kal nagyobb a doboznál (EXP = 1,36), a kamera
// ugyanennyivel hátrébb áll, így az ábra mérete nem változik, de a kitérő gömbök és szétrebbenő pontok nem ütköznek a
// vászon szélébe; a széleken lágy, kör alakú elhalványulás (mask) van, ezért sehol nem látszik éles vágás.
const EXP = 1.36;

export default function GlassOrbs3D({ onFail }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const fig = boxRef.current, cv = cvRef.current;
    if (!fig || !cv) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); }
    catch { onFail?.(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const disposables: { dispose: () => void }[] = [];
    const keep = <T extends { dispose: () => void }>(x: T) => { disposables.push(x); return x; };

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0, 17.5 * EXP);
    scene.add(new THREE.AmbientLight(0xffe2cc, 0.35));
    const key = new THREE.DirectionalLight(0xffd9b8, 1.1); key.position.set(-4, 6, 8); scene.add(key);
    const glow = new THREE.PointLight(0xff6a3d, 9, 22, 1); glow.position.set(2, -3, 4); scene.add(glow);

    const COPPER = new THREE.Color("#c8703a"), CREAM = new THREE.Color("#f6e6d2"), EMBER = new THREE.Color("#ff6a3d");
    const NODES = ORB_WORDS.map((w, i) => ({ w, p: POS[i], r: RADII[i] }));

    // üveg: fresnel perem + csúcsfény + alsó izzás (uPulse: a véletlen felizzás)
    const glassMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uRim: { value: new THREE.Color("#e9a374") }, uIn: { value: new THREE.Color("#3a2116") }, uEmber: { value: EMBER }, uCream: { value: CREAM }, uPulse: { value: 0 } },
      vertexShader: "varying vec3 vN;varying vec3 vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}",
      fragmentShader: "uniform vec3 uRim;uniform vec3 uIn;uniform vec3 uEmber;uniform vec3 uCream;uniform float uPulse;varying vec3 vN;varying vec3 vV;void main(){vec3 n=normalize(vN);vec3 v=normalize(vV);float f=pow(1.-max(dot(n,v),0.),2.4);vec3 L=normalize(vec3(-.45,.7,.6));float s=pow(max(dot(reflect(-L,n),v),0.),48.);float g=pow(max(-n.y,0.),2.)*.55;vec3 col=mix(uIn,uRim,f)+uEmber*g*f+uCream*s+uEmber*uPulse*(f*.9+.12);float a=.07+f*.78+s*.9+g*.12+uPulse*(f*.2+.08);gl_FragColor=vec4(col,clamp(a,0.,1.));\n#include <colorspace_fragment>\n}",
    });
    keep(glassMat);
    const sphereGeo = keep(new THREE.SphereGeometry(1, 64, 48));

    // a szavak: vászon-sprite, a weboldal Inter betűjével (next/font), a betöltés után újrarajzolva
    const fontFamily = getComputedStyle(document.body).fontFamily || "Inter, system-ui, sans-serif";
    const labelCanvases: { c: HTMLCanvasElement; t: THREE.CanvasTexture; text: string }[] = [];
    const drawLabel = (c: HTMLCanvasElement, text: string) => {
      const x = c.getContext("2d")!;
      x.clearRect(0, 0, c.width, c.height);
      let fs = 150;
      x.font = `600 ${fs}px ${fontFamily}`;
      while (x.measureText(text).width > 950 && fs > 40) { fs -= 6; x.font = `600 ${fs}px ${fontFamily}`; }
      x.textAlign = "center"; x.textBaseline = "middle"; x.shadowColor = "rgba(255,106,61,.55)"; x.shadowBlur = 24; x.fillStyle = "#f8ecdd";
      x.fillText(text, 512, 262);
    };
    const label = (text: string, r: number) => {
      const c = document.createElement("canvas"); c.width = 1024; c.height = 512;
      drawLabel(c, text);
      const t = keep(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      labelCanvases.push({ c, t, text });
      const sp = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })));
      const w = r * (r > 1.5 ? 1.62 : 1.95); sp.scale.set(w, w / 2, 1);
      return sp;
    };
    document.fonts?.ready.then(() => { labelCanvases.forEach((l) => { drawLabel(l.c, l.text); l.t.needsUpdate = true; }); draw(); }).catch(() => {});

    const haloTex = (() => {
      const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d")!;
      const g = x.createRadialGradient(128, 128, 40, 128, 128, 128);
      g.addColorStop(0, "rgba(255,122,61,0)"); g.addColorStop(0.42, "rgba(255,122,61,.55)"); g.addColorStop(0.55, "rgba(255,140,80,.28)"); g.addColorStop(1, "rgba(255,122,61,0)");
      x.fillStyle = g; x.fillRect(0, 0, 256, 256);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return keep(t);
    })();

    type Orb = { m: THREE.Mesh; s: THREE.Sprite; h: THREE.Sprite; mat: THREE.ShaderMaterial; r: number; home: THREE.Vector3; cur: THREE.Vector3;
      pt: number; next: number; dur: number; amp: number; ndc: [number, number]; px: number };
    const orbs: Orb[] = NODES.map((n) => {
      const mat = keep(glassMat.clone());
      const m = new THREE.Mesh(sphereGeo, mat); m.position.fromArray(n.p); m.scale.setScalar(n.r); m.renderOrder = 1; scene.add(m);
      const s = label(n.w, n.r); s.position.fromArray(n.p); s.renderOrder = 2; scene.add(s);
      const hm = keep(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      const h = new THREE.Sprite(hm); h.scale.setScalar(n.r * 3.1); h.position.fromArray(n.p); h.renderOrder = 0; scene.add(h);
      return { m, s, h, mat, r: n.r, home: new THREE.Vector3(...n.p), cur: new THREE.Vector3(...n.p), pt: -1,
        next: 0.4 + Math.random() * 3.5, dur: 1.5 + Math.random() * 0.8, amp: 0.55 + Math.random() * 0.35, ndc: [0, 0], px: 0 };
    });

    // vezetékek: ívek a középső gömbtől + a szomszédok között + két nagy pálya
    const wireMat = keep(new THREE.LineBasicMaterial({ color: 0xb8673a, transparent: true, opacity: 0.5 }));
    const curves: THREE.Curve<THREE.Vector3>[] = [];
    const links: { a: number; b: number; mul: number; off: THREE.Vector3 }[] = [];
    NODES.slice(1).forEach((n, i) => {
      const A = new THREE.Vector3(...NODES[0].p), B = new THREE.Vector3(...n.p);
      const off = new THREE.Vector3((i % 3 - 1) * 0.6, 0, i % 2 ? 1.4 : -1.4);
      links.push({ a: 0, b: i + 1, mul: 1, off });
      curves.push(new THREE.QuadraticBezierCurve3(A, A.clone().add(B).multiplyScalar(0.5).add(off), B));
    });
    for (let i = 1; i < NODES.length; i++) {
      const a = i, b = (i % 6) + 1;
      const A = new THREE.Vector3(...NODES[a].p), B = new THREE.Vector3(...NODES[b].p);
      links.push({ a, b, mul: 1.25, off: new THREE.Vector3() });
      curves.push(new THREE.QuadraticBezierCurve3(A, A.clone().add(B).multiplyScalar(0.5).multiplyScalar(1.25), B));
    }
    const orbit = (rx: number, ry: number, tx: number, tz: number) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 200; i++) { const t = (i / 200) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(t) * rx, Math.sin(t) * ry, 0)); }
      return { cu: new THREE.CatmullRomCurve3(pts, true), rot: new THREE.Euler(tx, 0, tz) };
    };
    const orbits = [orbit(5.6, 2.3, 1.15, 0.35), orbit(5.2, 2.0, -1.0, -0.55)];
    const linkLines = curves.map((cu) => {
      const g = keep(new THREE.BufferGeometry().setFromPoints(cu.getPoints(60)));
      const l = new THREE.Line(g, wireMat); scene.add(l); return l;
    });
    orbits.forEach(({ cu, rot }) => {
      const g = keep(new THREE.BufferGeometry().setFromPoints(cu.getPoints(120)));
      const l = new THREE.Line(g, wireMat); l.rotation.copy(rot); scene.add(l);
    });
    const qc = new THREE.QuadraticBezierCurve3(), tv = new THREE.Vector3();
    const updateWires = () => {
      links.forEach((k, i) => {
        const A = orbs[k.a].cur, B = orbs[k.b].cur;
        qc.v0.copy(A); qc.v2.copy(B); qc.v1.copy(A).add(B).multiplyScalar(0.5 * k.mul).add(k.off);
        const p = linkLines[i].geometry.attributes.position as THREE.BufferAttribute;
        for (let j = 0; j <= 60; j++) { qc.getPoint(j / 60, tv); p.setXYZ(j, tv.x, tv.y, tv.z); }
        p.needsUpdate = true;
      });
    };

    // apró elemek: pontok (ezek rebbennek szét)
    const home: number[] = [], size: number[] = [], tone: number[] = [];
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    const push = (v: THREE.Vector3, s: number, t: number) => { home.push(v.x, v.y, v.z); size.push(s); tone.push(t); };
    curves.forEach((cu) => { for (let i = 0; i < 46; i++) { const v = cu.getPoint(i / 45); v.x += rnd(-0.05, 0.05); v.y += rnd(-0.05, 0.05); push(v, rnd(1.2, 2.4), Math.random()); } });
    orbits.forEach(({ cu, rot }) => {
      const m = new THREE.Matrix4().makeRotationFromEuler(rot);
      for (let i = 0; i < 300; i++) { const v = cu.getPoint(i / 300).applyMatrix4(m); v.x += rnd(-0.08, 0.08); v.y += rnd(-0.08, 0.08); v.z += rnd(-0.08, 0.08); push(v, rnd(1.3, 2.8), Math.random()); }
    });
    const N0 = 900;
    for (let i = 0; i < N0; i++) { const y = 1 - (i / (N0 - 1)) * 2, rr = Math.sqrt(1 - y * y), th = i * 2.39996; const R = 2.4 + rnd(-0.06, 0.06); push(new THREE.Vector3(Math.cos(th) * rr * R, y * R, Math.sin(th) * rr * R), rnd(1, 2.2), Math.random() * 0.7); }
    for (let i = 0; i < 520; i++) { const v = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(2.8, 6.2)); push(v, rnd(0.8, 1.8), Math.random()); }
    const N = size.length;
    const pos = new Float32Array(home), alpha = new Float32Array(N).fill(1);
    const pg = keep(new THREE.BufferGeometry());
    pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    pg.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(size), 1));
    pg.setAttribute("aTone", new THREE.BufferAttribute(new Float32Array(tone), 1));
    pg.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));
    const pMat = keep(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uPx: { value: 1 }, uA: { value: COPPER }, uB: { value: CREAM } },
      vertexShader: "attribute float aSize;attribute float aTone;attribute float aAlpha;uniform float uPx;varying float vT;varying float vA;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vT=aTone;vA=aAlpha;gl_PointSize=aSize*uPx*(26./-mv.z);gl_Position=projectionMatrix*mv;}",
      fragmentShader: "uniform vec3 uA;uniform vec3 uB;varying float vT;varying float vA;void main(){vec2 d=gl_PointCoord-.5;float r=length(d);if(r>.5)discard;float s=smoothstep(.5,.1,r);gl_FragColor=vec4(mix(uA,uB,vT*.6),s*.85*vA);\n#include <colorspace_fragment>\n}",
    }));
    const points = new THREE.Points(pg, pMat); points.renderOrder = 0; scene.add(points);

    // kis rézgömbök a vezetékeken és a pályákon
    const ballMat = keep(new THREE.MeshStandardMaterial({ color: 0xc27a48, metalness: 0.85, roughness: 0.28, emissive: 0x2a1208 }));
    const ballGeo = keep(new THREE.SphereGeometry(1, 24, 18));
    const balls: { b: THREE.Mesh; home: THREE.Vector3; ndc: [number, number] }[] = [];
    [
      ...curves.slice(0, 6).map((c, i) => c.getPoint(0.62 + (i % 2) * 0.1)),
      ...orbits.flatMap(({ cu, rot }) => { const m = new THREE.Matrix4().makeRotationFromEuler(rot); return [0.08, 0.31, 0.57, 0.83].map((t) => cu.getPoint(t).applyMatrix4(m)); }),
    ].forEach((v) => {
      const b = new THREE.Mesh(ballGeo, ballMat); b.scale.setScalar(rnd(0.12, 0.26)); b.position.copy(v); scene.add(b);
      balls.push({ b, home: v.clone(), ndc: [0, 0] });
    });

    // interakció
    let W = 1, H = 1;
    const ndc = new Float32Array(N * 2);
    const tmp = new THREE.Vector3();
    const project = () => {
      for (let i = 0; i < N; i++) { tmp.set(home[i * 3], home[i * 3 + 1], home[i * 3 + 2]).project(camera); ndc[i * 2] = tmp.x; ndc[i * 2 + 1] = tmp.y; }
      balls.forEach((bb) => { tmp.copy(bb.home).project(camera); bb.ndc = [tmp.x, tmp.y]; });
      orbs.forEach((o) => { tmp.copy(o.home).project(camera); o.ndc = [tmp.x, tmp.y]; tmp.copy(o.home).add(new THREE.Vector3(o.r, 0, 0)).project(camera); o.px = (Math.abs(tmp.x - o.ndc[0]) * W) / 2; });
    };
    const draw = () => renderer.render(scene, camera);
    const resize = () => {
      const r = cv.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
      renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
      pMat.uniforms.uPx.value = renderer.getPixelRatio() * (W / EXP / 560);
      project(); draw();
    };
    const mouse = { x: 0, y: 0, on: false };
    // AUTOMATIKUS MŰKÖDÉS (Márk kérése 2026-11-27): ha a szekció látszik és a látogató nem mozgatja az egeret, egy
    // láthatatlan „kurzor" lassan végigsöpör az ábrán (balról jobbra, enyhe hullámmal), így a szétrebbenés és a gömbök
    // kitérése magától is lejátszódik; a beérkezés után kb. 0,6 mp-cel indul, majd ~7 mp-enként ismétlődik.
    // Valódi egér / érintés esetén az automatika azonnal átadja a vezérlést, és csak 2,5 mp tétlenség után folytatja.
    const AUTO_DUR = 4.2, AUTO_GAP = 7;
    const auto = { run: false, t: 0, next: 0.6 };
    let lastUser = -1e9;
    let releaseT = 0;
    const setPointer = (e: PointerEvent) => {
      lastUser = performance.now(); auto.run = false;
      const r = cv.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1; mouse.y = -(((e.clientY - r.top) / r.height) * 2 - 1); mouse.on = true; wake();
    };
    const onDown = (e: PointerEvent) => { setPointer(e); window.clearTimeout(releaseT); };
    const onLeave = () => { mouse.on = false; lastUser = performance.now(); auto.next = Math.max(auto.next, 2.5); wake(); };
    const onUp = (e: PointerEvent) => { if (e.pointerType !== "mouse") releaseT = window.setTimeout(() => { mouse.on = false; wake(); }, 700); };
    if (!reduce) {
      fig.addEventListener("pointermove", setPointer); fig.addEventListener("pointerdown", onDown);
      fig.addEventListener("pointerleave", onLeave); fig.addEventListener("pointerup", onUp);
    }
    const influence = (nx: number, ny: number, extra = 0) => {
      const R = RAD + extra; if (!mouse.on) return null;
      const dx = ((nx - mouse.x) * W) / 2, dy = ((ny - mouse.y) * H) / 2, d = Math.hypot(dx, dy);
      if (d > R) return null;
      const k = 1 - d / R; return { k: k * k, ux: d ? dx / d : 0, uy: d ? dy / d : 1 };
    };
    let running = false, visible = false, active = false, last = 0, raf = 0;
    const step = () => {
      let moving = false;
      for (let i = 0; i < N; i++) {
        const j = i * 3; let tx = home[j], ty = home[j + 1], tz = home[j + 2], ta = 1;
        const f = influence(ndc[i * 2], ndc[i * 2 + 1]);
        if (f) { const s = STR * f.k * (0.7 + ((i * 7919) % 13) / 26); tx += f.ux * s; ty += f.uy * s; tz += (i % 2 ? 1 : -1) * s * 0.6; ta = 1 - 0.8 * f.k; }
        const e = f ? 0.2 : 0.06;
        const dx = tx - pos[j], dy = ty - pos[j + 1], dz = tz - pos[j + 2], da = ta - alpha[i];
        pos[j] += dx * e; pos[j + 1] += dy * e; pos[j + 2] += dz * e; alpha[i] += da * e;
        if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) + Math.abs(da) > 0.002) moving = true;
      }
      balls.forEach((bb, i) => {
        const f = influence(bb.ndc[0], bb.ndc[1]); tmp.copy(bb.home);
        if (f) { const s = STR * 1.2 * f.k; tmp.x += f.ux * s; tmp.y += f.uy * s; tmp.z += (i % 2 ? 1 : -1) * s * 0.5; }
        const e = f ? 0.18 : 0.05; const d = tmp.sub(bb.b.position); bb.b.position.addScaledVector(d, e); if (d.length() > 0.002) moving = true;
      });
      let orbMoved = false;
      orbs.forEach((o, i) => {
        const f = influence(o.ndc[0], o.ndc[1], o.px * 0.6); tmp.copy(o.home);
        if (f) { const s = (i ? 0.75 : 0.35) * f.k; tmp.x += f.ux * s; tmp.y += f.uy * s; tmp.z += s * 0.4; }
        const e = f ? 0.12 : 0.05; const d = tmp.sub(o.cur);
        if (d.length() > 0.001) { o.cur.addScaledVector(d, e); o.m.position.copy(o.cur); o.s.position.copy(o.cur); o.h.position.copy(o.cur); orbMoved = true; moving = true; }
      });
      if (orbMoved) updateWires();
      pg.attributes.position.needsUpdate = true; (pg.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
      return moving || mouse.on;
    };
    const stepGlow = (dt: number) => {
      orbs.forEach((o) => {
        if (o.pt < 0) { o.next -= dt; if (o.next <= 0) { o.pt = 0; o.dur = 1.4 + Math.random() * 0.9; o.amp = 0.5 + Math.random() * 0.4; } }
        else { o.pt += dt; if (o.pt >= o.dur) { o.pt = -1; o.next = 1.8 + Math.random() * 4.5; } }
        const v = o.pt < 0 ? 0 : Math.pow(Math.sin((Math.PI * o.pt) / o.dur), 2) * o.amp;
        o.mat.uniforms.uPulse.value = v; (o.h.material as THREE.SpriteMaterial).opacity = v * 0.6;
      });
    };
    const loop = (now: number) => {
      if (!visible || reduce || document.hidden) { running = false; return; }
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
      // automatikus söprés (csak ha a látogató épp nem irányít)
      if (now - lastUser > 2500) {
        if (auto.run) {
          auto.t += dt / AUTO_DUR;
          if (auto.t >= 1) { auto.run = false; mouse.on = false; auto.next = AUTO_GAP; }
          else {
            const k = auto.t < 0.5 ? 2 * auto.t * auto.t : 1 - Math.pow(-2 * auto.t + 2, 2) / 2; // lágy ki-be
            mouse.x = -1.15 + 2.3 * k; mouse.y = 0.08 + 0.32 * Math.sin(auto.t * Math.PI * 2); mouse.on = true; active = true;
          }
        } else { auto.next -= dt; if (auto.next <= 0) { auto.run = true; auto.t = 0; } }
      }
      if (active) active = step();
      stepGlow(dt); draw();
      raf = requestAnimationFrame(loop);
    };
    const start = () => { if (!running && visible && !reduce && !document.hidden) { running = true; last = 0; raf = requestAnimationFrame(loop); } };
    function wake() { if (reduce) return; active = true; start(); }
    const io = new IntersectionObserver((es) => {
      const was = visible; visible = es[0].isIntersecting;
      if (visible && !was) { auto.run = false; auto.next = 0.6; } // beérkezéskor rövid szünet után indul a söprés
      start();
    });
    io.observe(fig);
    const onVis = () => start();
    document.addEventListener("visibilitychange", onVis);
    const ro = new ResizeObserver(resize); ro.observe(fig);
    resize();

    return () => {
      cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      fig.removeEventListener("pointermove", setPointer); fig.removeEventListener("pointerdown", onDown);
      fig.removeEventListener("pointerleave", onLeave); fig.removeEventListener("pointerup", onUp);
      window.clearTimeout(releaseT);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    };
  }, [onFail]);

  return (
    <div ref={boxRef} className="absolute inset-0 cursor-crosshair touch-pan-y">
      {/* a vászon túllóg a dobozon (−18% minden oldalon), nem fog egeret (azt a doboz figyeli), a széle lágyan elhalványul */}
      <canvas ref={cvRef} className="pointer-events-none absolute -inset-[18%] block h-[136%] w-[136%] [filter:drop-shadow(0_16px_26px_rgba(0,0,0,0.6))_drop-shadow(0_2px_6px_rgba(0,0,0,0.45))] [mask-image:radial-gradient(closest-side,#000_74%,transparent_100%)]" />
    </div>
  );
}
