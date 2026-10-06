/**
 * VIDEÓ-EFFEKTEK ELŐKÉSZÍTÉSE (egyszer kell futtatni, ha új forrás-effekt érkezik).
 *
 * A forrás (pl. 4K ProRes „filmburn" + hang) → méretenként (9:16, 1:1) kivágott,
 * 25 kép/mp-es H.264 + AAC klip az assets/video-fx/ mappába. A motor ezeket használja
 * „Screen" keveréssel (a fekete rész átlátszó, a világos „beég" a képbe).
 *
 * KIVÁGÁS: a filmkocka bal oldali kis téglalapjának (perforáció) KÖZEPE pont a kép bal
 * szélére kerül — így csak a fele látszik, ez adja a klasszikus filmburn hatást.
 *
 * Futtatás:  node scripts/video-fx-prepare.mjs   (ffmpeg: FFMPEG_PATH vagy ffmpeg-static)
 * A nagy forrásfájl (assets/video-fx/source/) NEM kerül a gitbe, csak a kész klipek.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
let ffmpeg = process.env.FFMPEG_PATH;
if (!ffmpeg) { try { ffmpeg = require("ffmpeg-static"); } catch { ffmpeg = "ffmpeg"; } }

// Effekt-leírás: forrásméret + a perforáció középpontja (forrás-pixelben, mérve).
const EFFECTS = [
  { id: "filmburn6", src: "assets/video-fx/source/filmburn6.mov", srcW: 4096, srcH: 2550, holeCx: 376 },
];
const SIZES = { "9x16": [1080, 1920], "1x1": [1080, 1080] };

for (const fx of EFFECTS) {
  const src = path.join(ROOT, fx.src);
  if (!fs.existsSync(src)) { console.error(`✗ Hiányzik a forrás: ${fx.src}`); continue; }
  for (const [name, [W, H]] of Object.entries(SIZES)) {
    // Magasságra illesztés, majd a perforáció közepétől jobbra W szélesség.
    const sw = Math.round((fx.srcW * H) / fx.srcH / 2) * 2;
    const cx = Math.round((fx.holeCx * H) / fx.srcH);
    const out = path.join(ROOT, "assets", "video-fx", `${fx.id}-${name}.mp4`);
    const r = spawnSync(ffmpeg, [
      "-y", "-v", "error", "-i", src, "-map", "0:v:0", "-map", "0:a:0",
      "-vf", `scale=${sw}:${H}:flags=lanczos,crop=${W}:${H}:${cx}:0,fps=25,format=yuv420p`,
      "-c:v", "libx264", "-preset", "slow", "-crf", "16",
      "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "48000",
      "-movflags", "+faststart", out,
    ], { stdio: "inherit" });
    console.log(r.status === 0 ? `✓ ${path.relative(ROOT, out)}` : `✗ ${name} hiba`);
  }
}
