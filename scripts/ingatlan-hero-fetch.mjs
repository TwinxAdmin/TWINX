/**
 * Az /ingatlan filmes hero anyagainak beemelése a Higgsfieldből.
 *
 * Letölti a generált videót és képeket, webre optimalizálja őket
 * (JPEG 1920×1080 / 1080×1350, H.264 mp4 ≤ ~4 MB, hang nélkül), és a
 * public/ingatlan/ mappába teszi — pontosan azokkal a nevekkel, amiket a
 * src/components/IngatlanHero.tsx keres.
 *
 * Futtatás:  npm run ingatlan:hero
 * Kell hozzá: sharp (megvan) + ffmpeg (ffmpeg-static, megvan).
 *
 * Ha később új anyagot generálsz, csak a SOURCES URL-jeit cseréld.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "ingatlan");
const TMP = path.join(ROOT, ".cache", "ingatlan-hero");

// A Higgsfield által generált anyagok (2026-09-08, „2. változat" nappali).
// A videó: 10 mp-es, a modell által LOOPOLT klip (első = utolsó képkocka,
// Cinema Studio v2 pro, start_image = end_image = a poszter, inga-szerű dolly). Utólag NEM módosítunk rajta,
// csak webre kódoljuk.
const SOURCES = {
  poster: "https://d8j0ntlcm91z4.cloudfront.net/user_2wwbPOUq0dc6bdbEhMfJSavUm0D/hf_20260908_174306_c0aecea1-7b09-41e9-84f2-618af7cee601.png",
  mobile: "https://d8j0ntlcm91z4.cloudfront.net/user_2wwbPOUq0dc6bdbEhMfJSavUm0D/hf_20260908_174545_cb48fd55-64d1-4a8a-9d7e-d1ad9e376b80.png",
  video:  "https://d8j0ntlcm91z4.cloudfront.net/user_2wwbPOUq0dc6bdbEhMfJSavUm0D/hf_20260908_182255_3e369fa4-dc92-48ef-b3e3-f786085050d1.mp4",
};

async function resolveFfmpeg() {
  try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); return "ffmpeg"; } catch { /* nincs a PATH-ban */ }
  try { const m = await import("ffmpeg-static"); const p = typeof m.default === "string" ? m.default : m.default?.path; if (p && fs.existsSync(p)) return p; } catch { /* nincs */ }
  console.error("✗ Nincs ffmpeg. Telepítsd: npm i -D ffmpeg-static"); process.exit(1);
}

async function download(url, dest) {
  if (fs.existsSync(dest)) return dest;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Letöltés sikertelen (${res.status}): ${url}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });
const FFMPEG = await resolveFfmpeg();

// 1) Poszter — 1920×1080 JPEG
process.stdout.write("• Poszterkép… ");
const posterSrc = await download(SOURCES.poster, path.join(TMP, "poster.png"));
await sharp(posterSrc).resize(1920, 1080, { fit: "cover", position: "entropy" })
  .jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(OUT, "hero-poster.jpg"));
console.log("kész → public/ingatlan/hero-poster.jpg");

// 2) Mobil álló — 1080×1350 JPEG
process.stdout.write("• Mobil kép… ");
const mobileSrc = await download(SOURCES.mobile, path.join(TMP, "mobile.png"));
await sharp(mobileSrc).resize(1080, 1350, { fit: "cover", position: "attention" })
  .jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(OUT, "hero-mobile.jpg"));
console.log("kész → public/ingatlan/hero-mobile.jpg");

// 3) Videó — H.264, 1920×1080, hang nélkül, faststart. Csak átkódolás:
//    a loop a modellből jön (első és utolsó képkocka azonos).
process.stdout.write("• Loop-videó (átkódolás)… ");
const videoSrc = await download(SOURCES.video, path.join(TMP, "hero-src.mp4"));
const videoOut = path.join(OUT, "hero.mp4");
execFileSync(FFMPEG, [
  "-v", "error", "-i", videoSrc, "-an",
  "-vf", "scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080,format=yuv420p",
  "-c:v", "libx264", "-preset", "slow", "-crf", "23",
  "-movflags", "+faststart", videoOut, "-y",
]);
const mb = (fs.statSync(videoOut).size / 1048576).toFixed(1);
console.log(`kész → public/ingatlan/hero.mp4 (${mb} MB)`);

console.log("\n✓ Minden a helyén. Frissítsd a /ingatlan oldalt — asztalon a videó, mobilon az állókép fut.");
