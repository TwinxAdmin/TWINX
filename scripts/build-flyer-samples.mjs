/**
 * Minta-hirdetések generálása a VALÓDI render-motorral.
 *
 * Miért: a sablonválasztóban a partner előre látni akarja, mit kap. Ezek a
 * képek ugyanazzal a Satori-buildel készülnek, mint az éles hirdetés, ezért
 * garantáltan hűek — csak a fotók és az adatok mintaértékűek.
 *
 * Futtatás:  npm run flyer:samples
 * Kimenet:   public/flyer-samples/<sablon>-<méret>.png
 *
 * FONTOS: sablon-módosítás (flyer-satori-*.tsx) után futtasd újra, különben a
 * választóban régi elrendezés látszik.
 */
import { createRequire } from "module";
import Module from "module";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const BUILD = path.join(ROOT, ".samples-build");
const OUT = path.join(ROOT, "public", "flyer-samples");
const PHOTOS = path.join(HERE, "flyer-sample-photos");

// 1) A sablon-builderek lefordítása CommonJS-re (a Next nem kell hozzá).
console.log("• Sablonok fordítása…");
try {
  execFileSync("npx", ["tsc", "-p", path.join(HERE, "tsconfig.samples.json")], {
    cwd: ROOT, stdio: ["ignore", "pipe", "pipe"],
  });
} catch {
  // A tsc a `process` típushiánya miatt nem-nulla kóddal léphet ki, de a JS
  // kimenet ettől még elkészül — csak akkor állunk le, ha tényleg nincs fájl.
}
const entry = path.join(BUILD, "src", "lib", "flyer-satori.js");
if (!fs.existsSync(entry)) {
  console.error("Nem készült el a fordított sablon:", entry);
  process.exit(1);
}

// 2) A "@/..." hivatkozások átirányítása a lefordított fájlokra.
const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
  if (req.startsWith("@/")) return orig.call(this, path.join(BUILD, "src", req.slice(2)), ...rest);
  return orig.call(this, req, ...rest);
};

const require = createRequire(import.meta.url);
const { buildFlyerElement } = require(entry);
const { FLYER_SIZES, FLYER_TEMPLATES } = require(path.join(BUILD, "src", "lib", "flyer-poster.js"));
const { ImageResponse } = await import("next/dist/compiled/@vercel/og/index.node.js");

// 3) Betűk: a mintákhoz a Montserrat-hoz hasonló, beépített betűt használunk.
const { loadGoogleFont } = await import(`file://${path.join(BUILD, "src", "lib", "google-font.js")}`)
  .catch(() => ({}));
const FAMILY = "Montserrat";
const charset = Array.from(new Set([
  "AÁBCDEÉFGHIÍJKLMNOÓÖŐPQRSTUÚÜŰVWXYZ",
  "aábcdeéfghiíjklmnoóöőpqrstuúüűvwxyz",
  "0123456789.,:;·-–—/()%²+&@ ",
  "MINTA ELADÓ IRÁNYÁR KAPCSOLAT ÁTTEKINTÉS TÍPUS MÉRET ÁLLAPOT NAPPALI KONYHA HÁLÓSZOBA",
].join("").split(""))).join("");

let fonts;
try {
  const loaded = await require(path.join(BUILD, "src", "lib", "google-font.js"))
    .loadGoogleFont(FAMILY, charset);
  fonts = loaded.map((f) => ({
    name: FAMILY, data: f.data, style: "normal",
    weight: f.weight >= 700 ? 700 : 400,
  }));
} catch {
  // Hálózat nélkül: a rendszer/lerakott TTF-ek.
  const candidates = [
    ["/usr/share/fonts/truetype/crosextra/Carlito-Regular.ttf", 400],
    ["/usr/share/fonts/truetype/crosextra/Carlito-Bold.ttf", 700],
    [path.join(ROOT, "assets", "fonts", "NotoSans-Regular.ttf"), 400],
  ].filter(([p]) => fs.existsSync(p));
  if (!candidates.length) { console.error("Nincs elérhető betűkészlet."); process.exit(1); }
  fonts = candidates.map(([p, w]) => ({ name: FAMILY, data: fs.readFileSync(p), style: "normal", weight: w }));
}

// 3b) A MAGAZIN sablon fix címbetűje (Playfair Display). Hálózat nélkül helyi
//     seriffel helyettesítjük, hogy az elrendezés akkor is ellenőrizhető legyen —
//     ilyenkor a minta nem a végleges betűt mutatja, ezért figyelmeztetünk.
const DISPLAY_FAMILY = "Playfair Display";
let displayFamily = null;
try {
  const gf = require(path.join(BUILD, "src", "lib", "google-font.js"));
  const disp = await gf.loadGoogleFont(DISPLAY_FAMILY, charset);
  if (gf.supportsHungarian(disp)) {
    displayFamily = DISPLAY_FAMILY;
    fonts.push(...disp.map((f) => ({
      name: DISPLAY_FAMILY, data: f.data, style: "normal",
      weight: f.weight >= 700 ? 700 : 400,
    })));
    console.log(`• Címbetű: ${DISPLAY_FAMILY} (magyar ékezetek rendben)`);
  } else {
    console.warn(`• FIGYELEM: a(z) ${DISPLAY_FAMILY} hiányos magyar ékezetkészletű — kihagyva.`);
  }
} catch {
  const localSerif = [
    ["/usr/share/fonts/truetype/crosextra/Caladea-Regular.ttf", 400],
    ["/usr/share/fonts/truetype/crosextra/Caladea-Bold.ttf", 700],
  ].filter(([p]) => fs.existsSync(p));
  if (localSerif.length) {
    displayFamily = "SampleSerif";
    fonts.push(...localSerif.map(([p, w]) => ({
      name: "SampleSerif", data: fs.readFileSync(p), style: "normal", weight: w,
    })));
    console.warn("• FIGYELEM: nincs hálózat — a címbetű HELYI seriffel készül (nem a végleges).");
    console.warn("  Futtasd újra hálózattal, hogy a minta a Playfair Display-jel készüljön!");
  }
}

// 4) Minta-tartalom: valósághű magyar hirdetés-adatok.
const b64 = (f) => `data:image/jpeg;base64,${fs.readFileSync(path.join(PHOTOS, f)).toString("base64")}`;
const images = ["1-nappali.jpg", "2-konyha.jpg", "3-haloszoba.jpg", "4-etkezo.jpg"].map(b64);

const profile = {
  display_name: "Kovács Anna", title: "Ingatlanértékesítő", phone: "+36 30 123 4567",
  email: "anna.kovacs@twinx.hu", company: "TWINX Ingatlan", website: "www.twinx.hu",
  slogan: "", logo_url: null, agent_photo_url: null,
  accent_color: "#1e3a5f", font: "montserrat", theme: "light",
};

const text = {
  title: "Eladó tégla lakás Budapesten",
  subtitle: "Budapest, XIII. kerület, Váci út 12.",
  price: "89,9",
  chips: ["3 szoba", "Tégla építésű társasházi lakás"],
  badge: "MINTA",
  details: {
    size: "82", rooms: "3 szoba", bathrooms: "1 fürdőszoba + külön WC",
    floor: "2. emelet", structure: "Tégla (pl. Porotherm)", condition: "Újszerű",
  },
  highlights: ["Panorámás erkély", "Mélygarázs beállóval", "Csendes belső udvar"],
  blurb: "Világos, jól elrendezett otthon a Duna közelében, csendes belső udvarra néző erkéllyel.",
};

// 5) Render: minden sablon × minden méret.
fs.mkdirSync(OUT, { recursive: true });
const SCALE = 0.6; // webes megjelenítéshez elég; kisebb fájl
for (const tpl of FLYER_TEMPLATES) {
  for (const s of FLYER_SIZES) {
    const W = Math.round(s.w * SCALE);
    const H = Math.round(s.h * SCALE);
    const el = buildFlyerElement(
      {
        images, width: W, height: H, profile, text, mood: "luxus", watermark: false,
        template: tpl.value, thumbLabels: ["Nappali", "Konyha", "Hálószoba"],
        // A fix magazin-címbetű CSAK a magazin sablonnál.
        ...(tpl.value === "openhouse" && displayFamily ? { displayFamily } : {}),
        heroPos: { x: 50, y: 50 }, heroDim: { w: 1200, h: 900 }, thumbSlots: [],
      },
      FAMILY
    );
    const res = new ImageResponse(el, { width: W, height: H, fonts });
    const buf = Buffer.from(await res.arrayBuffer());
    const file = path.join(OUT, `${tpl.value}-${s.value.replace(":", "x")}.png`);
    fs.writeFileSync(file, buf);
    console.log("  ✓", path.relative(ROOT, file), `${(buf.length / 1024) | 0} kB`);
  }
}
fs.rmSync(BUILD, { recursive: true, force: true });
console.log("Kész: " + path.relative(ROOT, OUT));
