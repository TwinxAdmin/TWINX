// A bemutató (IntroDollhouse) saját, programból rajzolt padlóburkolatai — helyiségenként eltérő, a helyiséghez illő anyag.
// CSAK a bemutatóhoz: a modul valódi anyaglistáját (materials.ts, stíluslap) nem érinti. Képfájl nincs, minden vásznon készül.
// A padló UV-ja méterben van (ShapeGeometry: a sokszög x, y koordinátái), ezért a textúra ismétlése = 1 / (a vászon mérete méterben).
import * as THREE from "three";

type Draw = (ctx: CanvasRenderingContext2D, px: number) => void;
const rnd = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16), f = (c: number) => Math.max(0, Math.min(255, Math.round(c * k)));
  return `rgb(${f(n >> 16 & 255)},${f(n >> 8 & 255)},${f(n & 255)})`;
};

/** Faerezet egy deszkán (finom hosszanti vonalak + egy-két göcs). */
function grain(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, base: string, r: () => number, vertical = false) {
  ctx.fillStyle = shade(base, 0.9 + r() * 0.2); ctx.fillRect(x, y, w, h);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const lines = 7 + Math.floor(r() * 6);
  for (let i = 0; i < lines; i++) {
    ctx.strokeStyle = `rgba(80,50,25,${0.05 + r() * 0.08})`; ctx.lineWidth = 0.6 + r() * 1.2; ctx.beginPath();
    if (vertical) { const gx = x + r() * w; ctx.moveTo(gx, y); ctx.bezierCurveTo(gx + (r() - 0.5) * 6, y + h / 3, gx + (r() - 0.5) * 6, y + (2 * h) / 3, gx + (r() - 0.5) * 4, y + h); }
    else { const gy = y + r() * h; ctx.moveTo(x, gy); ctx.bezierCurveTo(x + w / 3, gy + (r() - 0.5) * 6, x + (2 * w) / 3, gy + (r() - 0.5) * 6, x + w, gy + (r() - 0.5) * 4); }
    ctx.stroke();
  }
  if (r() < 0.35) { ctx.fillStyle = "rgba(90,55,30,.18)"; ctx.beginPath(); ctx.ellipse(x + r() * w, y + r() * h, 3 + r() * 4, 1.5 + r() * 2, vertical ? Math.PI / 2 : 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

// Nappali: KOSÁRFONATOS tölgy parketta (3 léc négyzetenként, váltakozó irányban). Vászon = 1,2 m.
const basketweave: Draw = (ctx, px) => {
  const r = rnd(11), n = 4, cell = px / n, strip = cell / 3;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = i * cell, y = j * cell, vert = (i + j) % 2 === 0;
    for (let k = 0; k < 3; k++) {
      if (vert) grain(ctx, x + k * strip, y, strip, cell, "#C49A6C", r, true);
      else grain(ctx, x, y + k * strip, cell, strip, "#C49A6C", r);
    }
  }
  ctx.strokeStyle = "rgba(70,45,25,.35)"; ctx.lineWidth = 1;
  for (let i = 0; i <= n * 3; i++) { ctx.beginPath(); ctx.moveTo(0, i * strip); ctx.lineTo(px, i * strip); ctx.globalAlpha = 0.25; ctx.stroke(); ctx.globalAlpha = 1; }
};

/** Széles hajópadló (eltolt toldásokkal). Vászon = 2,4 m. */
const planks = (base: string, seed: number): Draw => (ctx, px) => {
  const r = rnd(seed), rows = 12, h = px / rows;
  for (let j = 0; j < rows; j++) {
    let x = -r() * px * 0.4;
    while (x < px) { const w = px * (0.35 + r() * 0.35); grain(ctx, x, j * h, w, h, base, r); ctx.fillStyle = "rgba(60,40,25,.3)"; ctx.fillRect(x + w - 1, j * h, 1.2, h); x += w; }
    ctx.fillStyle = "rgba(60,40,25,.35)"; ctx.fillRect(0, j * h, px, 1.2);
  }
};

/** Kerámia / kő lapok fugával. */
const tiles = (base: string, n: number, grout: string, seed: number, marble = false): Draw => (ctx, px) => {
  const r = rnd(seed), s = px / n;
  ctx.fillStyle = grout; ctx.fillRect(0, 0, px, px);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    ctx.fillStyle = shade(base, 0.95 + r() * 0.08); ctx.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3);
    if (marble) for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = `rgba(120,120,125,${0.08 + r() * 0.1})`; ctx.lineWidth = 0.8 + r(); ctx.beginPath();
      const x0 = i * s + r() * s, y0 = j * s; ctx.moveTo(x0, y0); ctx.bezierCurveTo(x0 + (r() - 0.5) * s, y0 + s / 3, x0 + (r() - 0.5) * s, y0 + (2 * s) / 3, x0 + (r() - 0.5) * s * 0.6, y0 + s); ctx.stroke();
    }
  }
};

// Konyha: MINTÁS cementlap (negyedkörös motívum, krém–grafit). Vászon = 0,8 m (4×4 lap, 20 cm).
const cement: Draw = (ctx, px) => {
  const n = 4, s = px / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = i * s, y = j * s;
    ctx.fillStyle = "#EDE6DA"; ctx.fillRect(x, y, s, s);
    ctx.fillStyle = "#5E6268";
    const c = [[x, y], [x + s, y], [x + s, y + s], [x, y + s]][(i + j * 2) % 4];
    ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.arc(c[0], c[1], s * 0.72, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#EDE6DA"; ctx.beginPath(); ctx.arc(c[0], c[1], s * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#C9A979"; ctx.beginPath(); ctx.arc(c[0], c[1], s * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.18)"; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, s, s);
  }
};

// Előszoba: TERRAZZO (meleg szürke alap, színes kőszemcsékkel), nagy lapokban. Vászon = 1,2 m.
const terrazzo: Draw = (ctx, px) => {
  const r = rnd(29);
  ctx.fillStyle = "#D9D3C9"; ctx.fillRect(0, 0, px, px);
  const chips = ["#A79E92", "#8C857C", "#C2896A", "#E8E3DA", "#6F6A64", "#B9AE9E"];
  for (let k = 0; k < 900; k++) {
    ctx.fillStyle = chips[Math.floor(r() * chips.length)];
    const x = r() * px, y = r() * px, s = 1.5 + r() * 5;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s, y + r() * s); ctx.lineTo(x + r() * s, y + s); ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 2; ctx.strokeRect(1, 1, px / 2 - 2, px / 2 - 2); ctx.strokeRect(px / 2 + 1, 1, px / 2 - 2, px / 2 - 2);
  ctx.strokeRect(1, px / 2 + 1, px / 2 - 2, px / 2 - 2); ctx.strokeRect(px / 2 + 1, px / 2 + 1, px / 2 - 2, px / 2 - 2);
};

// Erkély: TERASZDESZKA (szürkés teak, résekkel). Vászon = 1,2 m.
const deck: Draw = (ctx, px) => {
  const r = rnd(41), rows = 8, h = px / rows;
  ctx.fillStyle = "#3D3833"; ctx.fillRect(0, 0, px, px);
  for (let j = 0; j < rows; j++) grain(ctx, 0, j * h + 2, px, h - 4, "#9C8B76", r);
};

const RECIPES: Record<string, { draw: Draw; meters: number; rough: number }> = {
  nappali: { draw: basketweave, meters: 1.2, rough: 0.55 },
  haloszoba: { draw: planks("#B98F63", 7), meters: 2.4, rough: 0.6 },
  szoba: { draw: planks("#A89A86", 19), meters: 2.4, rough: 0.6 },
  furdo: { draw: tiles("#D8D6D2", 2, "#B9B5AE", 23, true), meters: 1.2, rough: 0.35 },
  konyha: { draw: cement, meters: 0.8, rough: 0.5 },
  eloszoba: { draw: terrazzo, meters: 1.2, rough: 0.45 },
  terasz: { draw: deck, meters: 1.2, rough: 0.8 },
};

/** A helyiséghez illő padlóanyag (helyiség-azonosító előnyben, utána a helyiségtípus). Böngészőben hívd (vászon kell). */
export function demoFloorMaterial(roomId: string, kind: string, renderer: THREE.WebGLRenderer): THREE.MeshStandardMaterial | null {
  const rec = RECIPES[roomId === "szoba" ? "szoba" : kind];
  if (!rec || typeof document === "undefined") return null;
  const px = 1024, cv = document.createElement("canvas");
  cv.width = cv.height = px;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  rec.draw(ctx, px);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / rec.meters, 1 / rec.meters);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return new THREE.MeshStandardMaterial({ map: tex, roughness: rec.rough, metalness: 0 });
}
