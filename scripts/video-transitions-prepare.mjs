/**
 * ÁTTŰNÉSEK ELŐRE GYÁRTÁSA (élesítés előtt, ha sablon/szín/áttűnés változott).
 *
 * Miért: a kódból rajzolt áttűnések (pl. az Aurora nyíl-törlője, elmosással) megrajzolása
 * egy processzormagon ~20 mp/áttűnés. Élesben a szerver gyorsítótára nem marad meg, így
 * minden videónál újra kellene rajzolni → időtúllépés. Ezért a beépített sablonok MINDEN
 * áttűnését (sablon × színvilág × méret) előre legyártjuk, veszteségmentes animált
 * PNG-be (APNG): assets/video-transitions/<kulcs>.apng. A motor ezt használja, ha van.
 *
 * Futtatás:  node scripts/video-transitions-prepare.mjs [--only=aurora,nocturne] [--aspect=9:16]
 * (FFMPEG_PATH vagy ffmpeg-static). Ami már megvan, azt kihagyja.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src", "lib", "video-engine");
const BUILD = path.join(ROOT, ".cache", "video-transitions-build");
const WORK = path.join(ROOT, ".cache", "video-transitions-work");
const OUT = path.join(ROOT, "assets", "video-transitions");
const require = createRequire(import.meta.url);

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const only = arg("only")?.split(",").filter(Boolean);
const aspects = arg("aspect") ? [arg("aspect")] : ["9:16", "1:1"];
let ffmpeg = process.env.FFMPEG_PATH;
if (!ffmpeg) { try { ffmpeg = require("ffmpeg-static"); } catch { ffmpeg = "ffmpeg"; } }

// --- A motor fordítása CommonJS-re (mint a próba-scriptben) ---
fs.mkdirSync(BUILD, { recursive: true });
const files = ["template-schema.ts", "transitions.ts", "layers.ts", "png-bbox.ts", "render-node.ts",
  "templates/aurora.ts", "templates/skandi.ts", "templates/prestige.ts", "templates/mozaik.ts", "templates/polaroid.ts", "templates/index.ts"];
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
const { drawTransitionsFor } = require(path.join(BUILD, "render-node.cjs"));
const { engineChoices, resolveEngineTemplate } = require(path.join(BUILD, "templates", "index.cjs"));

fs.mkdirSync(OUT, { recursive: true });
const choices = engineChoices().filter((c) => !only || only.includes(c.id));
let made = 0, skipped = 0;
for (const c of choices) {
  const tpl = resolveEngineTemplate(c.id);
  for (const aspect of aspects) {
    if (!tpl.aspects.includes(aspect)) continue;
    const t0 = Date.now();
    // Ami már előre le van gyártva, azt a motor kihagyja (prebuilt) — csak a hiányzót rajzolja.
    const list = await drawTransitionsFor(tpl, aspect, WORK);
    for (const it of list) {
      const dest = path.join(OUT, `${it.key}.apng`);
      if (fs.existsSync(dest)) { skipped++; continue; }
      const r = spawnSync(ffmpeg, ["-y", "-v", "error", "-framerate", "25", "-i", path.join(it.dir, "f%04d.png"), "-f", "apng", "-plays", "0", dest], { stdio: "inherit" });
      if (r.status !== 0) { console.error(`✗ ${it.key}`); continue; }
      made++;
    }
    console.log(`✓ ${c.id} ${aspect} — ${list.length} áttűnés, ${((Date.now() - t0) / 1000).toFixed(1)} mp`);
  }
}
console.log(`Kész: ${made} új, ${skipped} már megvolt → ${path.relative(ROOT, OUT)}`);
