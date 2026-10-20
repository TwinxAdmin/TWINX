// Videósablon-pillanatkép: kiírja MINDEN sablon és színváltozat teljes, feloldott beállítását
// (paletta, betűk, rétegek, időzítés…) egy JSON-fájlba. Átalakítás előtt és után lefuttatva a két
// fájlnak bájtra egyeznie kell — így bizonyítható, hogy a videók kinézete nem változott.
//
//   node scripts/video-template-snapshot.mjs .cache/sablon-elotte.json
//   node scripts/video-template-snapshot.mjs .cache/sablon-utana.json
//   cmp .cache/sablon-elotte.json .cache/sablon-utana.json
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const BUILD = path.join(ROOT, ".cache", "template-snapshot-build");
const require = createRequire(import.meta.url);
const out = path.resolve(ROOT, process.argv[2] || ".cache/sablon-pillanatkep.json");

// A sablonregiszter és minden, amit (közvetve) importál — az "@/..." importokat követve fordítjuk.
fs.rmSync(BUILD, { recursive: true, force: true });
const done = new Set();
function compile(rel) {
  if (done.has(rel)) return;
  done.add(rel);
  const file = [".ts", ".tsx"].map((e) => path.join(SRC, rel + e)).find((f) => fs.existsSync(f));
  if (!file) throw new Error("Nem található: src/" + rel);
  let js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  js = js.replace(/require\("@\/([^"]+)"\)/g, (_, p) => { compile(p); return `require(${JSON.stringify(path.join(BUILD, p + ".cjs"))})`; });
  js = js.replace(/require\("(\.{1,2}\/[^"]+)"\)/g, (_, p) => {
    const r = path.join(path.dirname(rel), p);
    compile(r);
    return `require(${JSON.stringify(path.join(BUILD, r + ".cjs"))})`;
  });
  const dest = path.join(BUILD, rel + ".cjs");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, js);
}
compile("lib/video-engine/templates/index");

const reg = require(path.join(BUILD, "lib/video-engine/templates/index.cjs"));
// Fejlesztés alatti sablonok is kellenek (devOnly) — a regiszter localhoston (nem production) mindent ad.
const ids = reg.engineChoices().map((c) => c.id);
// A függvények (pl. fotószám szerinti építők) forrásszövegét is rögzítjük.
const ser = (v) => JSON.stringify(v, (_k, x) => (typeof x === "function" ? "ƒ " + x.toString() : x), 2);
const snap = {
  ids,
  families: reg.engineFamilies(),
  templates: Object.fromEntries(ids.map((id) => [id, reg.resolveEngineTemplate(id)])),
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, ser(snap));
console.log(`✓ ${ids.length} sablon/színváltozat → ${path.relative(ROOT, out)}`);
