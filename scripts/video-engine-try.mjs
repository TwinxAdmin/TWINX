/**
 * TWINX VIDEÓMOTOR — PRÓBAVIDEÓ a fejlesztéshez (nem éles kód).
 *
 * Lefordítja a src/lib/video-engine TypeScript-fájljait, és a mintafotókból
 * legyártja az Aurora (vagy egy színváltozata) próbavideóját.
 *
 * Futtatás (projekt gyökeréből):
 *   node scripts/video-engine-try.mjs [aspect=9:16|1:1] [változat=aurora|nocturne]
 *
 * Kimenet: .cache/video-engine/twinx-<sablon>-<méret>.mp4  (+ áttűnés-gyorsítótár)
 * ffmpeg: a FFMPEG_PATH környezeti változó, különben az ffmpeg-static csomag.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src", "lib", "video-engine");
const BUILD = path.join(ROOT, ".cache", "video-engine-build");
const WORK = path.join(ROOT, ".cache", "video-engine");
const require = createRequire(import.meta.url);

// --- 1) Fordítás CommonJS-re, az importok átírásával ---
fs.mkdirSync(BUILD, { recursive: true });
const files = ["template-schema.ts", "transitions.ts", "layers.ts", "render-node.ts", "templates/aurora.ts"];
const OG = require.resolve("next/dist/compiled/@vercel/og/index.node.js");
for (const f of files) {
  let js = ts.transpileModule(fs.readFileSync(path.join(SRC, f), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  js = js
    .replace(/require\("next\/og"\)/g, `require(${JSON.stringify(OG)})`)
    .replace(/require\("@\/lib\/video-engine\/([^"]+)"\)/g, (_, p) => `require(${JSON.stringify(path.join(BUILD, p + ".cjs"))})`)
    .replace(/require\("\.\/([^"]+)"\)/g, (_, p) => `require(${JSON.stringify(path.join(BUILD, path.dirname(f), p + ".cjs"))})`);
  const out = path.join(BUILD, f.replace(/\.ts$/, ".cjs"));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, js);
}

const { renderVideo } = require(path.join(BUILD, "render-node.cjs"));
const { validateTemplate, applyVariant } = require(path.join(BUILD, "template-schema.cjs"));
const { AURORA, AURORA_VARIANTS } = require(path.join(BUILD, "templates", "aurora.cjs"));

// --- 2) Paraméterek ---
const aspect = process.argv[2] === "1:1" ? "1:1" : "9:16";
const variantId = process.argv[3] || "aurora";
const variant = AURORA_VARIANTS.find((v) => v.id === variantId) ?? null;
const tpl = applyVariant(AURORA, variant);
const errors = validateTemplate(tpl);
if (errors.length) { console.error("✗ Sablonhiba:\n  " + errors.join("\n  ")); process.exit(1); }

// Saját próbafotók: TWINX_PHOTOS="a.jpg,b.jpg,..." (különben a bemutató képei).
const photos = (process.env.TWINX_PHOTOS
  ? process.env.TWINX_PHOTOS.split(",").map((f) => path.resolve(ROOT, f.trim()))
  : ["enhance-after.jpg", "visual-after.jpg", "video-demo-1.jpg", "video-demo-2.jpg", "video-demo-3.jpg"]
      .map((f) => path.join(ROOT, "public", "showcase", f)))
  .filter((f) => fs.existsSync(f));

let ffmpegPath = process.env.FFMPEG_PATH;
if (!ffmpegPath) { try { ffmpegPath = require("ffmpeg-static"); } catch { ffmpegPath = "ffmpeg"; } }

// Mintaadatok (a partner ezeket adja meg a varázslóban).
const data = {
  "property.title": "Visegrádi utca 212.",
  "property.city": "Székesfehérvár",
  "property.type": "Új építésű lakás",
  "property.specs": "1 szoba\n1 fürdőszoba + külön WC\n40 m²",
  "property.price": "70 M Ft",
  "agent.name": "Kovács Márk",
  "agent.phone": "+36 30 123 4567",
  "agent.email": "info@twinx.hu",
};
// Próbához: ügynökfotó és irodalogó adat-URL-ként (élesben az arculati profilból jön).
const asDataUrl = (f, mime) => `data:${mime};base64,${fs.readFileSync(f).toString("base64")}`;
const agentPhoto = path.join(ROOT, "public", "marketing", "character.png");
const agencyLogo = path.join(ROOT, "public", "design", "logo-2-tile.svg");
if (fs.existsSync(agentPhoto)) data["agent.photo"] = asDataUrl(agentPhoto, "image/png");
if (fs.existsSync(agencyLogo)) data["agent.logo"] = asDataUrl(agencyLogo, "image/svg+xml");

// Betűk: a sablon Manrope-ot kér. Próbához, ha nincs Manrope-fájl, a projekt
// arculati betűi (Poppins + Lato) állnak be „Manrope" néven — élesben a valódi jön.
const BRAND = path.join(ROOT, "assets", "fonts", "brand");
const VIDEO_FONTS = path.join(ROOT, "assets", "fonts", "video");
const fontFile = (w) => {
  const own = { 800: "Manrope-ExtraBold.ttf", 700: "Manrope-Bold.ttf", 400: "Manrope-Regular.ttf", 300: "Manrope-Light.ttf" }[w];
  if (fs.existsSync(path.join(VIDEO_FONTS, own))) return path.join(VIDEO_FONTS, own);
  return path.join(BRAND, w >= 700 ? (w === 800 ? "Poppins-Bold.ttf" : "Poppins-Medium.ttf") : "Lato-Regular.ttf");
};
const fonts = [800, 700, 400, 300].map((weight) => {
  const b = fs.readFileSync(fontFile(weight));
  return { name: "Manrope", weight, style: "normal", data: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
});

console.log(`• ${tpl.name} · ${aspect} · ${photos.length} fotó · ffmpeg: ${ffmpegPath}`);
const res = await renderVideo({
  template: tpl, aspect, photos, data, fonts, workDir: WORK, ffmpegPath,
  outName: `twinx-${variantId}-${aspect.replace(":", "x")}.mp4`,
  log: (m) => console.log("  " + m),
});
console.log(`✓ ${path.relative(ROOT, res.file)} — ${res.seconds} mp videó, ${res.timings.total.toFixed(1)} mp alatt`, res.timings);
