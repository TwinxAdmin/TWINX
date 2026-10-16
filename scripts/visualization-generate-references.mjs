// Látványtervező: a stíluskártyák hiányzó referenciaképeinek legenerálása (2026-10-16).
// A `references` tárhelyen stílusonként <helyiség-slug>.png képek vannak; ahol hiányzik, a felület a legközelebbi
// helyiség képét mutatja („minta: X"). Ez a szkript a hiányzókat a Gemini képmodellel legenerálja, az adott stílus
// MEGLÉVŐ képeit stílusmintaként csatolva (egységes anyagok, színek, fény). Az eredmény a gitből kizárt
// .visualization-referenciak/ mappába kerül — feltölteni CSAK a jóváhagyott képeket kell (feltolt parancs).
//
// Parancsok (mindegyik: node --env-file=.env.local scripts/visualization-generate-references.mjs <parancs> …):
//   lista                         — ingyenes: meglévő / hiányzó képek, a meglévők letöltése a _meglevo/ mappába
//   general [--csak a/b,c/d] [--ujra] — FIZETŐS (~0,04 $ / kép): a hiányzók (vagy a --csak listában megadottak) generálása;
//                                   a már legenerált helyi képet csak --ujra esetén írja felül (az előzőt _elozo/-be menti)
//   attekinto                     — ingyenes: design/visualization-referenciak-attekinto.html jóváhagyó rács
//   feltolt --csak a/b,c/d        — a megadott helyi képek feltöltése (upsert NÉLKÜL: meglévő tárhelyképet nem ír felül)
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, ".visualization-referenciak");
const BUCKET = "references";
const EXTS = ["png", "jpg", "jpeg", "webp"];
const COST_PER_IMAGE = 0.04;

// A src/lib/visualization.ts STYLE_OPTIONS / ROOM_TYPES másolata (a szkript sima Node, nem tudja a TS-t importálni)
const STYLES = [
  ["scandinavian", "Skandináv", "Scandinavian"],
  ["industrial", "Indusztriális", "industrial"],
  ["antik", "Antik", "antique / vintage"],
  ["minimal", "Minimál", "minimalist"],
  ["art_deco", "Art deco", "art deco"],
  ["mediterranean", "Mediterrán", "Mediterranean"],
  ["country", "Vidéki", "country / rustic"],
  ["japandi", "Japandi", "japandi"],
  ["mid_century_modern", "Mid-century modern", "mid-century modern"],
].map(([value, label, en]) => ({ value, label, en }));
const ROOMS = [
  ["nappali", "Nappali", "living room"],
  ["konyha", "Konyha", "kitchen"],
  ["haloszoba", "Hálószoba", "bedroom"],
  ["furdo", "Fürdő", "bathroom"],
  ["etkezo", "Étkező", "dining room"],
  ["eloszoba", "Előszoba", "entrance hall with a front door, coat storage and a bench"],
  ["gardrob", "Gardrób", "walk-in wardrobe with open shelving and hanging rails"],
  ["dolgozoszoba", "Dolgozószoba", "home office with a desk, chair and bookshelves"],
  ["gyerekszoba", "Gyerekszoba", "children's room with a single bed, a small desk and toy storage"],
  ["egyeb", "Egyéb", "multipurpose room (reading corner / guest room)"],
].map(([slug, label, en]) => ({ slug, label, en }));

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name) => rest.includes(name);
const csakArg = (() => { const i = rest.indexOf("--csak"); return i >= 0 ? (rest[i + 1] ?? "").split(",").map((s) => s.trim()).filter(Boolean) : null; })();

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
if (!url || !key) { console.error("Hiányzik a NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (futtasd: node --env-file=.env.local …)"); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

/** A tárhely állapota: stílusonként a meglévő helyiség-képek ({slug: fájlnév}). */
async function storageState() {
  const state = {};
  for (const s of STYLES) {
    const { data, error } = await sb.storage.from(BUCKET).list(s.value, { limit: 100 });
    if (error) throw new Error(`${s.value}: ${error.message}`);
    state[s.value] = {};
    for (const f of data ?? []) {
      const [base, ext] = [f.name.replace(/\.[^.]+$/, ""), f.name.split(".").pop()?.toLowerCase()];
      if (EXTS.includes(ext) && ROOMS.some((r) => r.slug === base)) state[s.value][base] = f.name;
    }
  }
  return state;
}

/** A meglévő tárhelyképek letöltése a _meglevo/ mappába (mintának és az áttekintőhöz). */
async function downloadExisting(state) {
  for (const [style, files] of Object.entries(state)) {
    mkdirSync(join(OUT, "_meglevo", style), { recursive: true });
    for (const name of Object.values(files)) {
      const p = join(OUT, "_meglevo", style, name);
      if (existsSync(p)) continue;
      const { data, error } = await sb.storage.from(BUCKET).download(`${style}/${name}`);
      if (error || !data) { console.warn(`! nem tölthető le: ${style}/${name}`); continue; }
      writeFileSync(p, Buffer.from(await data.arrayBuffer()));
    }
  }
}

function missingPairs(state) {
  const out = [];
  for (const s of STYLES) for (const r of ROOMS) if (!state[s.value][r.slug]) out.push(`${s.value}/${r.slug}`);
  return out;
}

async function lista() {
  const state = await storageState();
  await downloadExisting(state);
  const miss = missingPairs(state);
  for (const s of STYLES) {
    const have = ROOMS.filter((r) => state[s.value][r.slug]).map((r) => r.slug);
    const gen = ROOMS.filter((r) => existsSync(join(OUT, s.value, `${r.slug}.png`))).map((r) => r.slug);
    console.log(`${s.value.padEnd(20)} megvan: ${have.join(", ") || "—"}${gen.length ? `   | helyben generált: ${gen.join(", ")}` : ""}`);
  }
  console.log(`\nÖsszesen ${STYLES.length * ROOMS.length} kombináció, ebből hiányzik ${miss.length} → becsült költség: ${(miss.length * COST_PER_IMAGE).toFixed(2)} $`);
}

/** Egy kép generálása: szöveges utasítás + a stílus meglévő képei mintaként. */
async function generateOne(style, room, refs) {
  const model = process.env.GOOGLE_IMAGE_MODEL || "gemini-2.5-flash-image";
  const prompt = `The attached ${refs.length} photo(s) are reference interiors of ONE consistent ${style.en} interior design style (a style card set for a real-estate visualization tool).
Create a NEW photograph of a ${room.en} in exactly the same style, as if it were the next room of the same home: reuse the same color palette, materials, wood tones, wall finish, flooring type, textile textures, lighting mood and photographic look.
Requirements:
- photorealistic professional real-estate listing photo, wide-angle interior shot from eye level, straight verticals;
- use the references ONLY for style: choose your own camera angle and room layout that suit a ${room.en} — do NOT repeat their composition, window placement or decor arrangement (e.g. no large potted plant in the left corner);
- the room is tidy, styled but uncluttered, with natural daylight;
- clearly recognizable as a ${room.en};
- landscape 16:9 framing, like the reference photos;
- NO people, NO pets, NO text, NO logos, NO watermarks, NO captions, NOT a collage — one single photo.`;
  const parts = [{ text: prompt }, ...refs.map((r) => ({ inline_data: { mime_type: r.mime, data: r.b64 } }))];
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_AI_STUDIO_API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "16:9" } } }),
  });
  if (!res.ok) throw new Error(`képmodell ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const part = (data?.candidates?.[0]?.content?.parts ?? []).find((p) => p.inline_data || p.inlineData);
  const inline = part?.inline_data ?? part?.inlineData;
  if (!inline?.data) throw new Error(`nem jött kép (${data?.candidates?.[0]?.finishReason ?? "?"})`);
  return { bytes: Buffer.from(inline.data, "base64"), model, prompt };
}

async function general() {
  if (!process.env.GOOGLE_AI_STUDIO_API_KEY) { console.error("Hiányzik a GOOGLE_AI_STUDIO_API_KEY"); process.exit(1); }
  const state = await storageState();
  await downloadExisting(state);
  const todo = (csakArg ?? missingPairs(state)).filter((pair) => {
    const [style, slug] = pair.split("/");
    if (!STYLES.some((s) => s.value === style) || !ROOMS.some((r) => r.slug === slug)) { console.warn(`! ismeretlen: ${pair}`); return false; }
    if (state[style][slug]) { console.warn(`! a tárhelyen már van saját kép, kihagyva: ${pair}`); return false; }
    if (existsSync(join(OUT, style, `${slug}.png`)) && !flag("--ujra")) { console.log(`= már legenerálva (újra: --ujra): ${pair}`); return false; }
    return true;
  });
  console.log(`Generálás: ${todo.length} kép, becsült költség ${(todo.length * COST_PER_IMAGE).toFixed(2)} $`);
  let ok = 0;
  for (const pair of todo) {
    const [styleV, slug] = pair.split("/");
    const style = STYLES.find((s) => s.value === styleV), room = ROOMS.find((r) => r.slug === slug);
    // minta: a stílus összes meglévő tárhelyképe (legfeljebb 4), a nappali elöl
    const names = Object.entries(state[styleV]).sort(([a], [b]) => (a === "nappali" ? -1 : b === "nappali" ? 1 : 0)).slice(0, 4).map(([, n]) => n);
    // a tárhelyképek ~9 MB-osak (2752×1536) — kicsinyítve küldjük, különben túllépnénk a kérés méretkorlátját
    const refs = await Promise.all(names.map(async (n) => ({
      mime: "image/jpeg",
      b64: (await sharp(readFileSync(join(OUT, "_meglevo", styleV, n))).resize({ width: 1280 }).jpeg({ quality: 85 }).toBuffer()).toString("base64"),
    })));
    const t0 = Date.now();
    try {
      const { bytes, model, prompt } = await generateOne(style, room, refs);
      const dir = join(OUT, styleV);
      mkdirSync(dir, { recursive: true });
      const target = join(dir, `${slug}.png`);
      if (existsSync(target)) { mkdirSync(join(OUT, "_elozo", styleV), { recursive: true }); renameSync(target, join(OUT, "_elozo", styleV, `${slug}-${Date.now()}.png`)); }
      writeFileSync(target, bytes);
      writeFileSync(join(dir, `${slug}.json`), JSON.stringify({ model, refs: names, prompt, seconds: (Date.now() - t0) / 1000, costUsd: COST_PER_IMAGE, at: new Date().toISOString() }, null, 2));
      ok++;
      console.log(`✓ ${pair} (${((Date.now() - t0) / 1000).toFixed(1)} mp, minta: ${names.join(", ")})`);
    } catch (e) {
      console.error(`✗ ${pair}: ${e.message}`);
    }
  }
  console.log(`Kész: ${ok}/${todo.length} kép, ~${(ok * COST_PER_IMAGE).toFixed(2)} $`);
}

async function attekinto() {
  const state = await storageState();
  await downloadExisting(state);
  // beágyazott, kicsinyített képek: önálló fájl, bárhol megnyitható (az eredetik ~9 MB-osak)
  const thumb = async (p) => `data:image/jpeg;base64,${(await sharp(readFileSync(join(OUT, p))).resize({ width: 960 }).jpeg({ quality: 78 }).toBuffer()).toString("base64")}`;
  const sections = [];
  for (const s of STYLES) {
    const row = [];
    for (const r of ROOMS) {
      const pair = `${s.value}/${r.slug}`;
      if (state[s.value][r.slug]) { row.push(`<figure class="c have"><img loading="lazy" src="${await thumb(`_meglevo/${s.value}/${state[s.value][r.slug]}`)}"><figcaption><b>${r.label}</b><span class="tag t-have">tárhelyen</span></figcaption></figure>`); continue; }
      if (existsSync(join(OUT, s.value, `${r.slug}.png`))) { row.push(`<figure class="c new" data-pair="${pair}"><img loading="lazy" src="${await thumb(`${s.value}/${r.slug}.png`)}"><figcaption><b>${r.label}</b><span class="choice"><button data-v="ok">Marad</button><button data-v="ujra">Újra</button><button data-v="kihagy">Kihagy</button></span></figcaption></figure>`); continue; }
      row.push(`<figure class="c miss"><div class="ph">még nincs</div><figcaption><b>${r.label}</b><span class="tag t-miss">hiányzik</span></figcaption></figure>`);
    }
    sections.push(`<section><h2>${s.label} <small>${s.value}</small></h2><div class="row">${row.join("")}</div></section>`);
  }
  const cells = sections.join("");
  const html = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Referenciaképek jóváhagyása</title>
<style>
:root{--bg:#1d1611;--card:#2a211a;--cream:#f3eadb;--muted:#b5a690;--coral:#e8735a;--ok:#7fb48a;--warn:#d9a441}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--cream);font:14px/1.4 system-ui,sans-serif;padding:16px 16px 120px}
h1{font:700 22px Manrope,system-ui;margin:0 0 4px}p.lead{color:var(--muted);margin:0 0 16px}
h2{font:600 16px Manrope,system-ui;margin:20px 0 8px}h2 small{color:var(--muted);font-weight:400}
.row{display:grid;grid-template-columns:repeat(10,minmax(150px,1fr));gap:8px;overflow-x:auto}
.c{margin:0;background:var(--card);border-radius:10px;overflow:hidden;border:2px solid transparent;cursor:default}
.c img,.c .ph{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#120e0b}
.c .ph{display:grid;place-items:center;color:var(--muted)}
.c.new img{cursor:zoom-in}
figcaption{display:flex;flex-direction:column;gap:6px;padding:6px 8px}
.tag{font-size:11px;align-self:flex-start;padding:1px 6px;border-radius:99px}.t-have{background:#3b3226;color:var(--muted)}.t-miss{background:#4a2a22;color:var(--coral)}
.choice{display:flex;gap:4px}.choice button{flex:1;font-size:11px;padding:3px 0;border-radius:6px;border:1px solid #4a3d30;background:transparent;color:var(--cream);cursor:pointer}
.c[data-v=ok]{border-color:var(--ok)}.c[data-v=ok] button[data-v=ok]{background:var(--ok);color:#111}
.c[data-v=ujra]{border-color:var(--warn)}.c[data-v=ujra] button[data-v=ujra]{background:var(--warn);color:#111}
.c[data-v=kihagy]{border-color:#666;opacity:.55}.c[data-v=kihagy] button[data-v=kihagy]{background:#666}
#bar{position:fixed;left:0;right:0;bottom:0;background:#120e0b;border-top:1px solid #3b3226;padding:10px 16px;display:flex;flex-direction:column;gap:6px}
#bar textarea{width:100%;height:56px;background:var(--card);color:var(--cream);border:1px solid #3b3226;border-radius:6px;font:12px ui-monospace,monospace}
#zoom{position:fixed;inset:0;background:rgba(0,0,0,.88);display:none;place-items:center;cursor:zoom-out}#zoom img{max-width:94vw;max-height:90vh}
</style></head><body>
<h1>Látványtervező — referenciaképek</h1>
<p class="lead">Minden új (generált) képnél válassz: <b>Marad</b> (feltöltjük), <b>Újra</b> (új generálás), <b>Kihagy</b> (tudatosan nincs saját kép, marad a „minta: X"). A választás a böngészőben megmarad. A lenti szöveget másold vissza a beszélgetésbe.</p>
${cells}
<div id="bar"><span id="sum"></span><textarea id="out" readonly></textarea></div>
<div id="zoom"><img alt=""></div>
<script>
const KEY="twinx-ref-jovahagyas";let st={};try{st=JSON.parse(localStorage.getItem(KEY)||"{}")}catch{}
const figs=[...document.querySelectorAll(".c.new")];
function render(){figs.forEach(f=>{const v=st[f.dataset.pair];if(v)f.dataset.v=v;else delete f.dataset.v});
const by=v=>figs.filter(f=>st[f.dataset.pair]===v).map(f=>f.dataset.pair);
const open=figs.length-by("ok").length-by("ujra").length-by("kihagy").length;
document.getElementById("sum").textContent=\`Marad: \${by("ok").length} · Újra: \${by("ujra").length} · Kihagy: \${by("kihagy").length} · Döntésre vár: \${open}\`;
document.getElementById("out").value=\`MARAD: \${by("ok").join(",")}\\nUJRA: \${by("ujra").join(",")}\\nKIHAGY: \${by("kihagy").join(",")}\`;}
document.addEventListener("click",e=>{const b=e.target.closest(".choice button");if(b){const p=b.closest(".c").dataset.pair;st[p]=st[p]===b.dataset.v?undefined:b.dataset.v;try{localStorage.setItem(KEY,JSON.stringify(st))}catch{}render();return}
const im=e.target.closest(".c img");const z=document.getElementById("zoom");if(im){z.querySelector("img").src=im.src;z.style.display="grid"}else if(e.target.closest("#zoom"))z.style.display="none"});
document.getElementById("out").addEventListener("focus",e=>e.target.select());render();
</script></body></html>`;
  const target = join(ROOT, "design", "visualization-referenciak-attekinto.html");
  writeFileSync(target, html);
  console.log(`Áttekintő: ${target}`);
}

async function feltolt() {
  if (!csakArg?.length) { console.error("Add meg, mit töltsünk fel: feltolt --csak stilus/helyiseg,…"); process.exit(1); }
  const state = await storageState();
  for (const pair of csakArg) {
    const [style, slug] = pair.split("/");
    const p = join(OUT, style, `${slug}.png`);
    if (!existsSync(p)) { console.warn(`! nincs helyi kép: ${pair}`); continue; }
    if (state[style]?.[slug]) { console.warn(`! a tárhelyen már van (${state[style][slug]}), nem írjuk felül: ${pair}`); continue; }
    const { error } = await sb.storage.from(BUCKET).upload(`${style}/${slug}.png`, readFileSync(p), { contentType: "image/png", upsert: false });
    console.log(error ? `✗ ${pair}: ${error.message}` : `↑ ${pair}`);
  }
}

const cmds = { lista, general, attekinto, feltolt };
if (!cmds[cmd]) { console.error(`Parancsok: ${Object.keys(cmds).join(", ")}`); process.exit(1); }
await cmds[cmd]();
