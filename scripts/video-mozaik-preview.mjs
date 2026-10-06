// A Mozaik szerkesztő-előnézetei (public/video-previews/mozaik*-9x16.jpg) — a valódi motor nyitóképe,
// lakás-ábrával (mint a többi kártyán). Futtatás: előbb FFMPEG_PATH=/bin/false node scripts/video-engine-try.mjs 9:16 mozaik
// (ez fordítja le a motort), majd node scripts/video-mozaik-preview.mjs
import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module"; import { execFileSync } from "node:child_process";
const ROOT = process.cwd(); const require = createRequire(ROOT + "/package.json");
const B = ROOT + "/.cache/video-engine-build/";
const { layersFrame } = require(B + "layers.cjs");
const { resolveEngineTemplate } = require(B + "templates/index.cjs");
const { ImageResponse } = require(require.resolve("next/dist/compiled/@vercel/og/index.node.js"));
const ill = "data:image/jpeg;base64," + fs.readFileSync(path.join(ROOT, "public/video-samples/aurora-hero.jpg")).toString("base64");
const data = { "photo.1": ill, "photo.2": ill, "photo.3": ill, "photo.4": ill,
  "property.title": "Sas utca 22.", "property.city": "Budapest V. kerület", "property.type": "Új építésű lakás",
  "property.price": "60 M Ft", "agent.name": "Minta Anna", "agent.phone": "+36 30 123 4567", "agent.email": "info@twinx.hu" };
// A sablon betűi (Outfit) Google-ről jönnek; ha nem elérhető, a projekt saját betűi (Poppins/Lato) helyettesítik.
const f = (n) => { const b = fs.readFileSync(path.join(ROOT, "assets/fonts/brand", n)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
for (const id of ["mozaik", "mozaik-smaragd"]) {
  const tpl = resolveEngineTemplate(id);
  const fonts = tpl.fonts.map((x) => ({ name: x.family, weight: x.weight, style: "normal", data: f(x.weight >= 600 ? "Poppins-Bold.ttf" : x.weight >= 500 ? "Poppins-Medium.ttf" : "Lato-Regular.ttf") }));
  const W = 1080, H = 1920;
  const el = layersFrame(tpl.scenes[0].layers, { W, H, aspect: "9:16", palette: tpl.palette, data }, tpl.fonts[0].family);
  const img = new ImageResponse({ type: "div", props: { style: { width: W, height: H, display: "flex", background: tpl.palette.base }, children: el } }, { width: W, height: H, fonts });
  fs.writeFileSync("/tmp/mp.png", Buffer.from(await img.arrayBuffer()));
  execFileSync(process.env.FFMPEG_PATH || "ffmpeg", ["-v", "error", "-y", "-i", "/tmp/mp.png", "-vf", "scale=432:768:flags=lanczos", "-q:v", "3", path.join(ROOT, `public/video-previews/${id}-9x16.jpg`)]);
  console.log("ok", id);
}
