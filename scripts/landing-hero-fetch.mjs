/**
 * A FŐOLDAL hero loop-videójának beemelése a Higgsfieldből.
 *
 * Letölti a generált klipet és webre kódolja (1920×1080 H.264, CRF 23, hang
 * nélkül, faststart), majd a public/design/hero-loop.mp4 helyre teszi — pontosan
 * arra a névre, amit a src/components/HeroVideo.tsx keres.
 *
 * A klip a MODELL által loopolt (első képkocka = utolsó = a hero-bg.jpg állókép,
 * Cinema Studio v2 pro, start_image = end_image). Utólag NEM vágunk bele, nem
 * tükrözzük, nem keresztezzük — csak átkódoljuk.
 *
 * Futtatás:  npm run landing:hero
 * Kell hozzá: ffmpeg a PATH-ban VAGY az ffmpeg-static csomag (megvan).
 *
 * Új klipnél: a SOURCE URL cseréje + a HeroVideo.tsx-ben a VIDEO_VERSION növelése,
 * és: rm -f public/design/hero-loop.mp4 .cache/landing-hero/src.mp4
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "design", "hero-loop.mp4");
const TMP = path.join(ROOT, ".cache", "landing-hero");

// Higgsfield job: 6a200af4-0df7-4604-9862-cf101124300c (2026-09-11, VÁLASZTOTT: arc végig takarva, egy lágy szellő-hullám, 8 mp)
// Mért mozgás (átlagos képkocka-eltérés, 0–255 skálán): ez 0,55 · Kling-változatok 0,14–0,16 (állókép) ·
// az elvetett 7a837d80 1,48 (a szalagok felfedték az arcot). Tartalék: 369628bd (ugyanez a recept, két hullám).
const SOURCE = process.env.LANDING_HERO_URL || "https://d8j0ntlcm91z4.cloudfront.net/user_2wwbPOUq0dc6bdbEhMfJSavUm0D/hf_20260911_100215_6a200af4-0df7-4604-9862-cf101124300c.mp4";

async function resolveFfmpeg() {
  try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); return "ffmpeg"; } catch { /* nincs a PATH-ban */ }
  try { const m = await import("ffmpeg-static"); const p = typeof m.default === "string" ? m.default : m.default?.path; if (p && fs.existsSync(p)) return p; } catch { /* nincs */ }
  console.error("✗ Nincs ffmpeg. Telepítsd: npm i -D ffmpeg-static"); process.exit(1);
}

if (SOURCE.startsWith("__")) {
  console.error("✗ Add meg a forrás URL-t: LANDING_HERO_URL=https://… npm run landing:hero (vagy írd be a scriptbe).");
  process.exit(1);
}

fs.mkdirSync(TMP, { recursive: true });
const FFMPEG = await resolveFfmpeg();

const src = path.join(TMP, "src.mp4");
if (!fs.existsSync(src)) {
  process.stdout.write("• Letöltés… ");
  const res = await fetch(SOURCE);
  if (!res.ok) { console.error(`✗ Letöltés sikertelen (${res.status})`); process.exit(1); }
  fs.writeFileSync(src, Buffer.from(await res.arrayBuffer()));
  console.log("kész");
}

process.stdout.write("• Átkódolás 1920×1080, H.264 CRF23, hang nélkül… ");
execFileSync(FFMPEG, [
  "-y", "-i", src,
  "-an",
  "-vf", "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,format=yuv420p",
  "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-profile:v", "high", "-level", "4.1",
  // Kulcskocka az elején és sűrűn, hogy a loop-pont ne akadjon.
  "-g", "48", "-keyint_min", "48", "-sc_threshold", "0",
  "-movflags", "+faststart",
  OUT,
], { stdio: "ignore" });
const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(2);
console.log(`kész → public/design/hero-loop.mp4 (${mb} MB)`);
console.log("→ HeroVideo.tsx: VIDEO_VERSION növelése, ha ugyanezt a nevet cserélted.");
