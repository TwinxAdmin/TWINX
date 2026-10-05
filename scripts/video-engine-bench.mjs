/**
 * TWINX videómotor — TELJESÍTMÉNYMÉRÉS (0. fázis, 3. lépés).
 *
 * Kérdés: elfér-e egy saját, képkockánként rajzolt videó a Vercel függvény
 * futásidő- és memóriakorlátjában? Ez a script a leendő motor legdrágább részét
 * modellezi, külső szolgáltatás nélkül:
 *   - 2 fotó lassú ráközelítéssel (Ken Burns),
 *   - kódból rajzolt, színparaméteres áttűnés (átlós „nyíl" törlőelem + izzás),
 *   - felirat-sáv szöveggel,
 *   - képkockák nyers RGBA-ban az ffmpeg-be csövezve → H.264 MP4.
 *
 * Futtatás (projekt gyökeréből):
 *   node scripts/video-engine-bench.mjs [másodperc=10] [szélesség=1080] [magasság=1920]
 *
 * Kimenet: .cache/video-bench/bench.mp4 + mért idő, képkocka/mp, memóriacsúcs.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, ".cache", "video-bench");
fs.mkdirSync(OUT_DIR, { recursive: true });

const SECONDS = Number(process.argv[2] || 10);
const W = Number(process.argv[3] || 1080);
const H = Number(process.argv[4] || 1920);
const FPS = 25;
const FRAMES = Math.round(SECONDS * FPS);

// Paletta — a saját áttűnés színe paraméter (itt: Nocturne).
const PAL = { base: "#08142c", glow: "#c99a5e", text: "#ffffff" };

const PHOTOS = ["public/showcase/enhance-after.jpg", "public/showcase/visual-after.jpg"]
  .map((p) => path.join(ROOT, p));

/** Fotó előkészítése: a vászonnál 15%-kal nagyobbra, hogy legyen hova közelíteni. */
async function prepPhoto(file) {
  const scale = 1.15;
  const { data, info } = await sharp(file)
    .resize(Math.round(W * scale), Math.round(H * scale), { fit: "cover" })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/** Ken Burns: t ∈ [0,1] → kivágás a nagyított fotóból, vissza vászonméretre. */
async function kenBurns(photo, t) {
  const ease = t * t * (3 - 2 * t); // lágy indulás és megállás
  const zoom = 1 + 0.12 * ease;
  const cropW = Math.min(photo.w, Math.round((W * 1.15) / zoom));
  const cropH = Math.min(photo.h, Math.round((H * 1.15) / zoom));
  const left = Math.round((photo.w - cropW) / 2);
  const top = Math.round((photo.h - cropH) / 2);
  return sharp(photo.data, { raw: { width: photo.w, height: photo.h, channels: 3 } })
    .extract({ left, top, width: cropW, height: cropH })
    .resize(W, H, { kernel: "linear" })
    .raw().toBuffer();
}

/** Kódból rajzolt áttűnés (SVG): átlós nyíl-törlő a paletta színeivel. p ∈ [0,1]. */
function wipeSvg(p) {
  const x = -W * 0.6 + p * W * 2.2; // a nyíl csúcsának vízszintes helye
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><radialGradient id="g" cx="0" cy="1" r="1.1">
      <stop offset="0" stop-color="${PAL.glow}" stop-opacity="0.95"/>
      <stop offset="0.55" stop-color="${PAL.base}" stop-opacity="0"/></radialGradient></defs>
    <polygon points="${x - W},0 ${x},0 ${x + W * 0.35},${H / 2} ${x},${H} ${x - W},${H}" fill="${PAL.base}"/>
    <polygon points="${x - W},0 ${x},0 ${x + W * 0.35},${H / 2} ${x},${H} ${x - W},${H}" fill="url(#g)"/>
  </svg>`);
}

function captionSvg(text) {
  const barH = Math.round(H * 0.09);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect x="0" y="${H - barH - 120}" width="${W}" height="${barH}" fill="${PAL.base}" fill-opacity="0.82"/>
    <rect x="60" y="${H - barH - 120 + 24}" width="6" height="${barH - 48}" fill="${PAL.glow}"/>
    <text x="90" y="${H - 120 - barH / 2 + 16}" font-family="sans-serif" font-size="${Math.round(W * 0.045)}"
      font-weight="700" fill="${PAL.text}">${text}</text></svg>`);
}

const t0 = performance.now();
const photos = await Promise.all(PHOTOS.map(prepPhoto));
const caption = captionSvg("Budapest XIII. · 74,9 M Ft");
const tPrep = performance.now() - t0;

const out = path.join(OUT_DIR, "bench.mp4");
const ff = spawn(ffmpegPath, [
  "-v", "error", "-y",
  "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-r", String(FPS), "-i", "-",
  "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
  "-movflags", "+faststart", out,
], { stdio: ["pipe", "inherit", "inherit"] });
const ffDone = new Promise((res, rej) => ff.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}`)))));

let peakRss = 0;
const half = Math.floor(FRAMES / 2);
const wipeLen = FPS; // 1 mp-es áttűnés a két fotó között
for (let f = 0; f < FRAMES; f++) {
  const second = f >= half;
  const photo = photos[second ? 1 : 0];
  const local = second ? (f - half) / (FRAMES - half) : f / half;
  const base = await kenBurns(photo, local);

  const layers = [{ input: caption }];
  const wf = f - (half - wipeLen / 2);
  if (wf >= 0 && wf < wipeLen) layers.unshift({ input: wipeSvg(wf / wipeLen) });

  const frame = await sharp(base, { raw: { width: W, height: H, channels: 3 } })
    .composite(layers).ensureAlpha().raw().toBuffer();
  if (!ff.stdin.write(frame)) await new Promise((r) => ff.stdin.once("drain", r));
  peakRss = Math.max(peakRss, process.memoryUsage().rss);
}
ff.stdin.end();
await ffDone;

const total = (performance.now() - t0) / 1000;
const mb = (n) => Math.round(n / 1024 / 1024);
console.log(JSON.stringify({
  seconds: SECONDS, size: `${W}x${H}`, frames: FRAMES,
  totalSec: +total.toFixed(1), prepSec: +(tPrep / 1000).toFixed(1),
  framesPerSec: +(FRAMES / total).toFixed(1),
  realtimeFactor: +(SECONDS / total).toFixed(2),
  peakRssMB: mb(peakRss),
  outputMB: +(fs.statSync(out).size / 1024 / 1024).toFixed(1),
  est36sSec: Math.round(total / SECONDS * 36),
}, null, 1));
