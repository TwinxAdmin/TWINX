/**
 * A Modern Sárga sablon ÁTMENET-GRAFIKÁINAK átszínezése (egyszeri előkészítés).
 *
 * Miért kell: a sablon képváltó ékei és a záró kártya grafikája nem hex-szín a
 * JSON-ban, hanem kész, átlátszó .webm animáció a Shotstack szerverén. A
 * szín-variánsokhoz ezeket a fájlokat színezzük át, töltjük fel a saját
 * tárhelyünkre, és a render ezekre mutat. A sablon elrendezése, időzítése és
 * áttűnései VÁLTOZATLANOK.
 *
 * Futtatás a projekt gyökeréből:
 *   node --env-file=.env.local scripts/video-overlays.mjs
 *   (vagy: npm run video:overlays)
 *
 * Kell hozzá ffmpeg + ffprobe. Ha nincs a gépen, elég egyszer:
 *   npm i -D ffmpeg-static ffprobe-static
 * (a script magától megtalálja; a rendszerszintű ffmpeg is jó, ha van).
 *
 * Kimenet:
 *   .cache/video-overlays/…            letöltött + átszínezett fájlok, előnézeti PNG-k
 *   src/lib/video-json/overlay-colors.json   a render által használt URL-térkép
 *
 * A script előbb MEGVIZSGÁLJA a grafikát: ha lényegében egyszínű (sárga), a
 * színcsere pontos (a márkaszín pixelre pontosan bekerül). Ha nem, árnyalattartó
 * módra vált és szól. Minden kész grafikáról előnézeti PNG készül.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const CACHE = path.join(ROOT, ".cache", "video-overlays");
const MAP_FILE = path.join(ROOT, "src", "lib", "video-json", "overlay-colors.json");
const BUCKET = "video-assets";

/** A sablon eredeti kiemelő színe (ezt cseréljük). */
const TEMPLATE_ACCENT = [240, 194, 12]; // #f0c20c

// --- Segédek ----------------------------------------------------------------
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 28 });
const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/**
 * ffmpeg/ffprobe keresése: előbb a rendszerben, aztán az npm-es (ffmpeg-static,
 * ffprobe-static) binárisok között. Így nem kell brew/telepítés a géphez.
 */
async function resolveBin(name, pkg) {
  try { execFileSync(name, ["-version"], { stdio: "ignore" }); return name; } catch { /* nincs a PATH-ban */ }
  try {
    const mod = await import(pkg);
    const p = typeof mod.default === "string" ? mod.default : (mod.default?.path ?? mod.path);
    if (p && fs.existsSync(p)) return p;
  } catch { /* nincs telepítve */ }
  console.error(`✗ Nincs ${name} a gépen. Telepítsd egyszer:\n\n    npm i -D ffmpeg-static ffprobe-static\n\n` +
    "  (vagy rendszerszinten: brew install ffmpeg), majd futtasd újra ezt a parancsot.");
  process.exit(1);
}

const FFMPEG = await resolveBin("ffmpeg", "ffmpeg-static");
const FFPROBE = await resolveBin("ffprobe", "ffprobe-static");

/** A variánsok (id + accent + deepTint) a video-color.ts-ből — hogy ne csússzon szét a két hely. */
function readVariants() {
  const src = fs.readFileSync(path.join(ROOT, "src", "lib", "video-color.ts"), "utf8");
  const out = [];
  for (const m of src.matchAll(/id:\s*"([a-z]+)"[\s\S]{0,400}?accent:\s*"(#[0-9a-fA-F]{6})"/g)) {
    if (m[1] === "sarga") continue; // az eredeti sablon — hozzá NEM nyúlunk
    const block = src.slice(m.index, m.index + 900);
    const tint = block.match(/deepTint:\s*"(#[0-9a-fA-F]{6})"/);
    out.push({ id: m[1], accent: m[2], deepTint: tint ? tint[1] : null });
  }
  if (!out.length) { console.error("✗ Nem találtam szín-variánst a video-color.ts-ben."); process.exit(1); }
  return out;
}

/** A sablonokban használt overlay-videók URL-jei. */
function overlayUrls() {
  const files = ["modern-sarga-9x16.json", "modern-sarga-1x1.json"];
  const urls = new Set();
  for (const f of files) {
    const tpl = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "lib", "video-json", f), "utf8"));
    for (const track of tpl.timeline.tracks) {
      for (const clip of track.clips) {
        const a = clip?.asset;
        if (a?.type === "video" && typeof a.src === "string" && /^https?:/.test(a.src)) urls.add(a.src);
      }
    }
  }
  return [...urls];
}

async function download(url, dest) {
  if (fs.existsSync(dest)) return dest;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Letöltés sikertelen (${res.status}): ${url}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

/**
 * FONTOS: a WebM átlátszósága NEM a fő videósávban van, hanem külön alfa-rétegben.
 * Ezért az ffprobe „yuv420p"-t mond, és a beépített dekóder eldobja az alfát —
 * a grafika feketének látszana. Csak a libvpx dekóderrel jön elő az alfa, ezért
 * MINDEN olvasásnál kényszerítjük (a .mov-ot a sima dekóder is jól kezeli).
 */
const decoderArgs = (file) => (file.endsWith(".webm") ? ["-c:v", "libvpx-vp9"] : []);

function probe(file) {
  const out = sh(FFPROBE, ["-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height,pix_fmt,duration", "-of", "json", file]);
  const s = JSON.parse(out).streams[0];
  return { width: s.width, height: s.height, pixFmt: s.pix_fmt, duration: Number(s.duration) || 3 };
}

/** Egy képkocka nyers RGBA-ban (alfával együtt), az adott másodpercnél. */
function frameRgba(file, atSec, scaleW = 160) {
  return execFileSync(FFMPEG, ["-v", "error", ...decoderArgs(file), "-ss", String(atSec), "-i", file,
    "-vf", `format=rgba,scale=${scaleW}:-1`, "-frames:v", "1",
    "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 1 << 26 });
}

/** Van-e valódi átlátszóság? (dekódolt képkockából, nem a konténer címkéjéből) */
function hasAlpha(file) {
  const { duration } = probe(file);
  for (const t of [duration * 0.5, duration * 0.25, duration * 0.75]) {
    const raw = frameRgba(file, t);
    for (let i = 3; i < raw.length; i += 4) if (raw[i] < 250) return true;
  }
  return false;
}

/** Milyen színekből áll a grafika? Több képkockából, mert az elején még üres lehet. */
function analyze(file) {
  const { duration } = probe(file);
  let opaque = 0, yellowish = 0, lumaSum = 0;
  for (const t of [duration * 0.3, duration * 0.5, duration * 0.7]) {
    const raw = frameRgba(file, t);
    for (let i = 0; i < raw.length; i += 4) {
      const [r, g, b, a] = [raw[i], raw[i + 1], raw[i + 2], raw[i + 3]];
      if (a < 200) continue;
      opaque++;
      lumaSum += 0.299 * r + 0.587 * g + 0.114 * b;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      // Sárgás: piros+zöld magas, kék alacsony.
      if (sat > 0.35 && r > 120 && g > 90 && b < g * 0.7) yellowish++;
    }
  }
  return {
    opaque,
    yellowShare: opaque ? yellowish / opaque : 0,
    avgLuma: opaque ? lumaSum / opaque : 0,
  };
}

/**
 * Színcsere-szűrő.
 *   TINT   — a grafika SÖTÉT (átlós törlőelem, nincs benne márkaszín): a feketét
 *            emeljük a variáns mély tónusára. A fehér marad fehér, az alfa és az
 *            animáció érintetlen — csak a „fekete" lesz meleg vagy hideg.
 *   FLAT   — egyszínű (sárga) grafika: pontos márkaszín, alfa marad.
 *   SHADED — vegyes grafika: árnyalattartó hue-forgatás.
 */
function recolorFilter(mode, accentHex, deepTintHex) {
  if (mode === "tint") {
    // TÖMÖR csere: a grafika saját (sötétkék-lila) színe teljesen eltűnik, és a
    // variáns mély tónusa lép a helyére. A fekete „emelése" nem volt elég — a
    // régi szín átütött rajta. Az alfa (forma, élsimítás, animáció) marad.
    const [tr, tg, tb] = hexToRgb(deepTintHex || accentHex);
    return "[0:v]format=rgba,split[a][b];[b]alphaextract[al];" +
      `[a]lutrgb=r=${tr}:g=${tg}:b=${tb}[c];[c][al]alphamerge`;
  }
  const [r, g, b] = hexToRgb(accentHex);
  if (mode === "flat") {
    // Az alfa (tehát a forma és az élsimítás) marad, az RGB pontosan a márkaszín.
    return `[0:v]format=rgba,split[a][b];[b]alphaextract[al];[a]lutrgb=r=${r}:g=${g}:b=${b}[c];[c][al]alphamerge`;
  }
  // Árnyalattartó: a sárga hue-ját forgatjuk a célszínre, a fehér/fekete marad.
  const hue = (hex) => {
    const [R, G, B] = hexToRgb(hex).map((v) => v / 255);
    const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
    if (!d) return 0;
    const h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
    return (h * 60 + 360) % 360;
  };
  const srcHue = hue("#f0c20c");
  let delta = hue(accentHex) - srcHue;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  const [R, G, B] = hexToRgb(accentHex);
  const sat = (Math.max(R, G, B) - Math.min(R, G, B)) / Math.max(R, G, B) /
              ((Math.max(...TEMPLATE_ACCENT) - Math.min(...TEMPLATE_ACCENT)) / Math.max(...TEMPLATE_ACCENT));
  return `[0:v]format=rgba,split[a][b];[b]alphaextract[al];[a]hue=h=${delta.toFixed(1)}:s=${sat.toFixed(2)}[c];[c][al]alphamerge`;
}

/** Kódolás alfával: VP9 → VP8 → ProRes 4444 (.mov). A Shotstack mindhármat eszi. */
function encode(input, filter, outBase) {
  const attempts = [
    { ext: ".webm", args: ["-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0", "-b:v", "3M"] },
    { ext: ".webm", args: ["-c:v", "libvpx", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0", "-b:v", "3M"] },
    { ext: ".mov", args: ["-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le"] },
  ];
  for (const a of attempts) {
    const out = outBase + a.ext;
    try {
      sh(FFMPEG, ["-v", "error", ...decoderArgs(input), "-i", input, "-filter_complex", filter, ...a.args, out, "-y"]);
      // Az ellenőrzés dekódolt képkockából megy — a konténer címkéje félrevezet.
      if (hasAlpha(out)) return out;
      fs.rmSync(out, { force: true });
    } catch { fs.rmSync(out, { force: true }); }
  }
  throw new Error("Nem sikerült átlátszóságot megőrző videót kódolni.");
}

// --- Fő menet ---------------------------------------------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("✗ Hiányzó env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\n" +
    "  Indítsd így:  node --env-file=.env.local scripts/video-overlays.mjs");
  process.exit(1);
}
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

fs.mkdirSync(path.join(CACHE, "orig"), { recursive: true });
fs.mkdirSync(path.join(CACHE, "preview"), { recursive: true });

const variants = readVariants();
const urls = overlayUrls();
console.log(`• ${urls.length} átmenet-grafika, ${variants.length} új szín\n`);

// A bucket létrehozása (ha még nincs) — publikus, mint a zene.
const { data: buckets } = await admin.storage.listBuckets();
if (!buckets?.some((b) => b.name === BUCKET)) {
  const { error } = await admin.storage.createBucket(BUCKET, { public: true });
  if (error) { console.error("✗ Bucket létrehozás:", error.message); process.exit(1); }
  console.log(`• Létrehozva a "${BUCKET}" bucket`);
}

const map = {};
for (const v of variants) map[v.id] = {};

for (const url of urls) {
  const name = url.split("/").pop().replace(/\.[a-z0-9]+$/i, "");
  const orig = path.join(CACHE, "orig", `${name}.webm`);
  process.stdout.write(`• ${name}: letöltés… `);
  await download(url, orig);

  const info = probe(orig);
  const alpha = hasAlpha(orig);
  const look = analyze(orig);
  // A sablon átmenet-grafikái sötét törlőelemek → tónusozás. Sárga grafikánál
  // pontos színcsere, vegyesnél árnyalattartó forgatás.
  const mode = look.avgLuma < 60 ? "tint" : look.yellowShare >= 0.9 ? "flat" : "shaded";
  const modeLabel = { tint: "tónusozás (sötét grafika)", flat: "pontos színcsere", shaded: "árnyalattartó" };
  console.log(`${info.width}×${info.height} · ${alpha ? "átlátszó" : "⚠ NEM átlátszó"}` +
    ` · átlagfény: ${look.avgLuma.toFixed(0)} · sárga: ${(look.yellowShare * 100).toFixed(0)}%` +
    ` → ${modeLabel[mode]}`);
  if (!alpha) {
    console.log("  ⚠ Ebben a fájlban nincs alfa-csatorna — átszínezve is takarná a fotót.");
    console.log("    Állj meg és szólj: ezt a grafikát másképp kell kezelni.");
  }

  for (const v of variants) {
    const outBase = path.join(CACHE, `${name}-${v.id}`);
    const out = encode(orig, recolorFilter(mode, v.accent, v.deepTint), outBase);
    // Előnézeti képkocka szürke háttéren, hogy látszódjon az átlátszóság is.
    // A grafika közepéről vágunk képet, mert az elején még üres lehet.
    const at = (probe(out).duration || 3) * 0.5;
    sh(FFMPEG, ["-v", "error", "-f", "lavfi", "-i", `color=c=0x333333:s=${info.width}x${info.height}`,
      ...decoderArgs(out), "-ss", String(at), "-i", out,
      "-filter_complex", "[0:v][1:v]overlay=shortest=1,format=rgb24",
      "-frames:v", "1", path.join(CACHE, "preview", `${name}-${v.id}.png`), "-y"]);

    const key = `overlays/${v.id}/${path.basename(out)}`;
    const body = fs.readFileSync(out);
    const type = out.endsWith(".mov") ? "video/quicktime" : "video/webm";
    const { error } = await admin.storage.from(BUCKET).upload(key, body, { contentType: type, upsert: true });
    if (error) { console.error(`  ✗ Feltöltés (${v.id}):`, error.message); process.exit(1); }
    map[v.id][url] = admin.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
    console.log(`  ✓ ${v.id} → ${path.basename(out)}`);
  }
}

fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 2) + "\n");
console.log(`\n✓ Kész. URL-térkép: ${path.relative(ROOT, MAP_FILE)}`);
console.log("  Előnézetek:", path.relative(ROOT, path.join(CACHE, "preview")));
console.log("  Ezután a varázslóban megjelennek az új színek.");
