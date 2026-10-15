// Alaprajz-mérőpad (3D-modul prototípus): a tesztalaprajzokon lefuttatja a digitalizálást ÉS a 3D-mérést,
// átfedő képet készít (a digitalizált terv az eredeti rajzon), és táblázatot ír a tanulságnapló számára.
//
// Futtatás (a projekt gyökeréből, a .env.local Google-kulcsával — FIZETŐS hívás, képenként ~0,03–0,17 $):
//   node --env-file=.env.local scripts/floorplan3d-meropad.mjs                 → a docs/floorplan3d-teszt/*.png képek
//   node --env-file=.env.local scripts/floorplan3d-meropad.mjs a.png b.jpg     → a megadott képek
// Kimenet: .floorplan3d-meropad/<időbélyeg>/ (gitignore) — eredmeny.md, digit-<név>.json, atfedes-<név>.png
//
// A lib a Next „@/" aliasával íródott: a szkript egy ideiglenes mappába másolja (alias → relatív), tsc-vel lefordítja, és onnan futtat.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { createRequire } from "node:module";

const ROOT = resolve(import.meta.dirname, "..");
const LIB = ["plan", "geometry", "normalize", "digitize", "config", "scene"];
const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
const OUT = join(ROOT, ".floorplan3d-meropad", stamp);
const BUILD = join(ROOT, ".floorplan3d-meropad", "_build");

// 1) a lib lefordítása (alias → relatív)
rmSync(BUILD, { recursive: true, force: true });
mkdirSync(join(BUILD, "src"), { recursive: true });
for (const f of LIB) {
  const src = readFileSync(join(ROOT, "src/lib/floorplan3d", `${f}.ts`), "utf8").replaceAll("@/lib/floorplan3d/", "./");
  writeFileSync(join(BUILD, "src", `${f}.ts`), src);
}
writeFileSync(join(BUILD, "src", "entry.ts"), `export * from "./digitize"; export * from "./geometry"; export * from "./scene";\n`);
execFileSync(join(ROOT, "node_modules/.bin/tsc"), [join(BUILD, "src/entry.ts"), "--outDir", join(BUILD, "out"), "--module", "commonjs",
  "--target", "es2020", "--esModuleInterop", "--skipLibCheck"], { stdio: "inherit" });
const require = createRequire(join(ROOT, "package.json"));
const lib = require(join(BUILD, "out/entry.js"));
const sharp = require("sharp");

// 2) a tesztképek
const args = process.argv.slice(2);
const dir = join(ROOT, "docs/floorplan3d-teszt");
const files = args.length ? args.map((a) => resolve(a)) : readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).map((f) => join(dir, f));
if (!files.length) { console.error("Nincs tesztkép."); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const mime = (f) => (/\.png$/i.test(f) ? "image/png" : /\.webp$/i.test(f) ? "image/webp" : "image/jpeg");
const rows = [];
for (const file of files) {
  const name = basename(file).replace(/\.[a-z]+$/i, "");
  process.stdout.write(`▶ ${name} … `);
  try {
    const src = readFileSync(file);
    const r = await lib.digitizeFloorplan({ bytes: src, mime: mime(file) }, false);
    writeFileSync(join(OUT, `digit-${name}.json`), JSON.stringify(r, null, 2));
    const check = lib.checkPlan(r.plan, 5);
    const ok = check.rooms.filter((c) => c.status === "ok").length;
    const built = lib.buildApartment(r.plan, { interiorWall: 0.1, exteriorWall: 0.3 });
    const meas = lib.measureApartment(r.plan, built);
    const worst = Math.max(0, ...meas.map((m) => m.maxErrorMm));
    const warns = lib.openingWarnings(r.plan, 0.1).length;

    // átfedő kép: a digitalizált terv az eredeti rajzon
    const m = await sharp(src).metadata();
    const k = m.width / r.stats.imageSize[0] / r.stats.metersPerPixel;
    const [ox, oy] = r.stats.imageOffset;
    const P = ([x, y]) => `${((x + ox) * k).toFixed(1)},${((y + oy) * k).toFixed(1)}`;
    let g = r.plan.rooms.map((rm) => `<polygon points="${rm.polygon.map(P).join(" ")}" fill="rgba(240,138,104,0.25)" stroke="#E3683F" stroke-width="3"/>`).join("");
    for (const o of r.plan.openings) {
      const rm = r.plan.rooms.find((x) => x.id === o.roomId);
      const s = lib.openingSegment(rm, o);
      const [a1, a2] = P(s.a).split(","), [b1, b2] = P(s.b).split(",");
      g += `<line x1="${a1}" y1="${a2}" x2="${b1}" y2="${b2}" stroke="${o.kind === "door" ? "#2F7F86" : "#1d4ed8"}" stroke-width="7"/>`;
    }
    const png = (await sharp(src).png().toBuffer()).toString("base64");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${m.width}" height="${m.height}"><image href="data:image/png;base64,${png}" width="${m.width}" height="${m.height}" opacity="0.6"/>${g}</svg>`;
    await sharp(Buffer.from(svg)).png().toFile(join(OUT, `atfedes-${name}.png`));

    rows.push({ name, rooms: r.plan.rooms.length, ok, openings: r.plan.openings.length, warns, scale: r.stats.scaleSource,
      sec: r.stats.seconds, usd: r.stats.costUsd, worst,
      detail: check.rooms.map((c) => { const rm = r.plan.rooms.find((x) => x.id === c.roomId); return `${rm.name} ${c.area}/${c.declared ?? "–"} (${c.diffPct ?? "–"}%)`; }) });
    console.log(`${ok}/${r.plan.rooms.length} rendben · ${r.stats.seconds} mp · ${r.stats.costUsd.toFixed(3)} $ · 3D max ${worst} mm`);
  } catch (e) {
    rows.push({ name, error: e.message });
    console.log(`HIBA: ${e.message}`);
  }
}

// 3) eredmény a tanulságnaplóhoz
const md = [
  `# Mérőpad — ${new Date().toLocaleString("hu-HU")}`,
  "",
  "| Alaprajz | Helyiség rendben (±5%) | Nyílászáró | Figyelmeztetés | Lépték | Idő | Költség | 3D max eltérés |",
  "|---|---|---|---|---|---|---|---|",
  ...rows.map((r) => (r.error ? `| ${r.name} | HIBA: ${r.error} | | | | | | |`
    : `| ${r.name} | ${r.ok}/${r.rooms} | ${r.openings} | ${r.warns} | ${r.scale} | ${r.sec} mp | ${r.usd.toFixed(3)} $ | ${r.worst} mm |`)),
  "",
  ...rows.filter((r) => !r.error).flatMap((r) => [`**${r.name}:** ${r.detail.join(" · ")}`, ""]),
].join("\n");
writeFileSync(join(OUT, "eredmeny.md"), md);
rmSync(BUILD, { recursive: true, force: true });
console.log(`\nKész: ${OUT}/eredmeny.md (+ átfedő képek). A tanulságnaplóba a táblázat kerüljön, dátummal.`);
if (!existsSync(join(ROOT, ".gitignore")) || !readFileSync(join(ROOT, ".gitignore"), "utf8").includes(".floorplan3d-meropad")) {
  console.log("Figyelem: a .floorplan3d-meropad/ mappa legyen a .gitignore-ban.");
}
