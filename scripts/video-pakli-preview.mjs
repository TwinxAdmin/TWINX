// A Pakli szerkesztő-előnézetei (public/video-previews/pakli*-9x16.jpg) — a valódi motor rétegeiből,
// lakás-ábrával (mint a többi kártyán). Futtatás: node scripts/video-pakli-preview.mjs (előtte: FFMPEG_PATH=/bin/false node scripts/video-engine-try.mjs 9:16 pakli — ez fordítja le a motort).
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module"; import { execFileSync } from "node:child_process";
const ROOT = process.cwd(); const require = createRequire(ROOT + "/package.json");
const B = ROOT + "/.cache/video-engine-build/";
const { layersFrame } = require(B + "layers.cjs");
const { resolveEngineTemplate } = require(B + "templates/index.cjs");
const { filmLookChain } = require(B + "render-node.cjs");
const { ImageResponse } = require(require.resolve("next/dist/compiled/@vercel/og/index.node.js"));
const ill = "data:image/jpeg;base64," + fs.readFileSync(path.join(ROOT, "public/video-samples/aurora-hero.jpg")).toString("base64");
const data = { "photo.1": ill, "property.title": "Sas utca 22.", "property.city": "Budapest V. kerület", "property.type": "Új építésű lakás", "property.price": "60 M Ft" };
for (const id of ["pakli", "pakli-kek"]) {
  const tpl = resolveEngineTemplate(id);
  const fonts = tpl.fonts.map((x) => { const b = fs.readFileSync(path.join(ROOT, x.file)); return { name: x.family, weight: x.weight, style: "normal", data: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; });
  const W = 1080, H = 1920;
  const el = layersFrame(tpl.scenes[0].layers, { W, H, aspect: "9:16", palette: tpl.palette, data }, tpl.fonts[0].family);
  const img = new ImageResponse({ type: "div", props: { style: { width: W, height: H, display: "flex", background: tpl.palette.base }, children: el } }, { width: W, height: H, fonts });
  fs.writeFileSync("/tmp/pp.png", Buffer.from(await img.arrayBuffer()));
  // A „régi film” hatás az előnézeten is (vibrálás nélkül), ugyanazzal a szűrővel, mint a videóban.
  const look = filmLookChain(tpl.look, true);
  execFileSync(process.env.FFMPEG_PATH || "ffmpeg", ["-v", "error", "-y", "-i", "/tmp/pp.png", "-vf", `${look ? look + "," : ""}scale=432:768:flags=lanczos`, "-q:v", "3", path.join(ROOT, `public/video-previews/${id}-9x16.jpg`)]);
  console.log("ok", id);
}
