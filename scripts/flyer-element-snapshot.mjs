// Hirdetéskép-pillanatkép: a 3 elrendezés × 3 méret × 2 mintaprofil teljes elemfáját (minden szín, betű,
// méret, pozíció) kiírja egy JSON-fájlba. Átalakítás előtt és után lefuttatva a „Saját szín" (régi
// megjelenés) fájloknak bájtra egyezniük kell — így bizonyítható, hogy a meglévő arculatok kinézete nem változott.
//
//   node scripts/flyer-element-snapshot.mjs .cache/hirdetes-elotte.json
//   node scripts/flyer-element-snapshot.mjs .cache/hirdetes-utana.json [szinvilag-id]
//   cmp .cache/hirdetes-elotte.json .cache/hirdetes-utana.json
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const BUILD = path.join(ROOT, ".cache", "flyer-snapshot-build");
const require = createRequire(import.meta.url);
const out = path.resolve(ROOT, process.argv[2] || ".cache/hirdetes-pillanatkep.json");
const world = process.argv[3]; // nincs megadva → a régi (Saját szín) megjelenés

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
  const dest = path.join(BUILD, rel + ".cjs");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, js);
}
compile("lib/flyer-satori");
const { buildFlyerElement } = require(path.join(BUILD, "lib/flyer-satori.cjs"));

const IMG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const full = {
  display_name: "Kovács Márk", title: "Ingatlanértékesítő", phone: "+36 30 123 4567", email: "info@iroda.hu",
  company: "Prémium Ingatlanok", website: "premiumingatlan.hu", slogan: "", logo_url: null, agent_photo_url: null,
  accent_color: "#1e3a5f", font: "inter", theme: "light",
};
const partial = { ...full, title: "", email: "", website: "", accent_color: "#ef7a5a", agent_photo_url: IMG };
const text = {
  title: "Újépítésű családi ház", subtitle: "Csendes utca, nagy kert", price: "89900000", chips: ["128 m²", "4 szoba"],
  badge: "ELADÓ", details: { size: "128", rooms: "4 szoba", bathrooms: "2 fürdőszoba", floor: "földszint", structure: "Tégla", condition: "Új építésű" },
  highlights: ["Nagy kert", "Garázs"], blurb: "Világos, tágas otthon a város csendes részén.",
};
const SIZES = { "1:1": [1080, 1080], "9:16": [1080, 1920], "4:3": [1440, 1080] };
const snap = {};
for (const template of ["premium", "openhouse", "unit"]) {
  for (const [size, [w, h]] of Object.entries(SIZES)) {
    for (const [pname, profile] of Object.entries({ full, partial })) {
      const opts = {
        images: [IMG, IMG, IMG, IMG], width: w * 2, height: h * 2, profile, text, mood: "luxus", watermark: true, template,
        thumbLabels: ["NAPPALI", "KONYHA", "FÜRDŐSZOBA"], heroPos: { x: 50, y: 50 }, heroDim: { w: 1600, h: 1000 }, thumbSlots: ["row", "row", "row"],
        ...(world ? { world } : {}),
      };
      snap[`${template} ${size} ${pname}`] = buildFlyerElement(opts, "Inter");
    }
  }
}
// Az elemfa: típus + props (a React belső mezői nélkül).
const ser = JSON.stringify(snap, (k, v) => (k === "_owner" || k === "_store" || k === "$$typeof" ? undefined : typeof v === "function" ? "ƒ" : v), 1);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, ser);
console.log(`✓ ${Object.keys(snap).length} hirdetés-elemfa${world ? ` (${world})` : ""} → ${path.relative(ROOT, out)}`);
