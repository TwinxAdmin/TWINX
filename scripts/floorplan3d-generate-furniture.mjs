// Saját 3D-bútor generálása a katalógushoz (3D-modul) — EGYSZERI költség tárgyanként, utána ingyen újrahasznosítható.
//   1) termékfotó: Gemini képmodell (szövegből), egyetlen bútor, semleges fehér háttér, a kért méretekkel/formával;
//   2) 3D-modell: fal.ai TRELLIS (kép → GLB; Microsoft TRELLIS, MIT-licenc), ~0,02 $;
//   3) mérés: a GLB befoglaló méretéből a modell arányai vs. a kért arányok; fájlméret, idő, költség.
// Az eredmény a .floorplan3d-generalt/<id>/ mappába kerül (gitignore) — a katalógusba (public/floorplan3d/models + catalog.ts)
// CSAK jóváhagyás után másoljuk.
//
// Futtatás: node --env-file=.env.local scripts/floorplan3d-generate-furniture.mjs <id> <szélesség_m> <mélység_m> <magasság_m> "<leírás angolul>"
// Példa:    node --env-file=.env.local scripts/floorplan3d-generate-furniture.mjs gen_sofa_01 2.2 0.9 0.75 "modern 3-seater sofa, light warm grey linen upholstery, low straight lines, slim light oak legs"
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const [id, W, D, H, ...desc] = process.argv.slice(2);
if (!id || !W || !D || !H || !desc.length) { console.error("Használat: <id> <w> <d> <h> \"<leírás>\""); process.exit(1); }
const want = { w: +W, d: +D, h: +H };
const description = desc.join(" ");
const OUT = resolve(import.meta.dirname, "..", ".floorplan3d-generalt", id);
mkdirSync(OUT, { recursive: true });
const t0 = Date.now();
const secs = () => Math.round((Date.now() - t0) / 100) / 10;

// 1) termékfotó (Gemini képmodell, csak szövegből)
const imgModel = process.env.GOOGLE_IMAGE_MODEL || "gemini-2.5-flash-image";
const prompt = `Studio product photograph of a single piece of furniture: ${description}.
Real dimensions: ${Math.round(want.w * 100)} cm wide, ${Math.round(want.d * 100)} cm deep, ${Math.round(want.h * 100)} cm high — draw it with exactly these proportions.
Three-quarter view from the front-left, camera slightly above, the ENTIRE object visible with margin around it.
Plain pure white seamless background, soft even studio light, no cast shadow on the background, no other objects, no text, no people.`;
const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${imgModel}:generateContent?key=${process.env.GOOGLE_AI_STUDIO_API_KEY}`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "1:1" } } }),
});
if (!gRes.ok) { console.error("Képhiba:", gRes.status, (await gRes.text()).slice(0, 300)); process.exit(1); }
const gData = await gRes.json();
const part = (gData?.candidates?.[0]?.content?.parts ?? []).find((p) => p.inline_data || p.inlineData);
const inline = part?.inline_data ?? part?.inlineData;
if (!inline?.data) { console.error("A képmodell nem adott képet."); process.exit(1); }
const mime = inline.mime_type ?? inline.mimeType ?? "image/png";
writeFileSync(join(OUT, "termekfoto.png"), Buffer.from(inline.data, "base64"));
const tImage = secs();
console.log(`✓ termékfotó (${tImage} mp)`);

// 2) kép → 3D (fal.ai TRELLIS, szinkron hívás)
const fRes = await fetch("https://fal.run/fal-ai/trellis", {
  method: "POST",
  headers: { Authorization: `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ image_url: `data:${mime};base64,${inline.data}`, texture_size: 1024, mesh_simplify: 0.95 }),
});
if (!fRes.ok) { console.error("3D-hiba:", fRes.status, (await fRes.text()).slice(0, 300)); process.exit(1); }
const fData = await fRes.json();
const meshUrl = fData?.model_mesh?.url;
if (!meshUrl) { console.error("A TRELLIS nem adott modellt:", JSON.stringify(fData).slice(0, 300)); process.exit(1); }
const glb = Buffer.from(await (await fetch(meshUrl)).arrayBuffer());
writeFileSync(join(OUT, `${id}.glb`), glb);
const t3d = secs();
console.log(`✓ 3D-modell (${Math.round((t3d - tImage) * 10) / 10} mp, ${(glb.length / 1048576).toFixed(2)} MB)`);

// 3) mérés: a GLB JSON-darabjából a POSITION-accessorok min/max értéke (Y felfelé, glTF)
const jsonLen = glb.readUInt32LE(12);
const gltf = JSON.parse(glb.subarray(20, 20 + jsonLen).toString("utf8"));
const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (const mesh of gltf.meshes ?? []) for (const prim of mesh.primitives ?? []) {
  const acc = gltf.accessors?.[prim.attributes?.POSITION];
  if (!acc?.min || !acc?.max) continue;
  for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], acc.min[i]); max[i] = Math.max(max[i], acc.max[i]); }
}
const size = { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] };
// arányok (a modell egysége tetszőleges — az ARÁNY számít): szélesség = a nagyobbik vízszintes tengely
const horiz = [size.x, size.z].sort((a, b) => b - a);
const ratio = { got_w_per_h: horiz[0] / size.y, got_d_per_h: horiz[1] / size.y, want_w_per_h: want.w / want.h, want_d_per_h: want.d / want.h };
const errW = Math.round((ratio.got_w_per_h / ratio.want_w_per_h - 1) * 1000) / 10;
const errD = Math.round((ratio.got_d_per_h / ratio.want_d_per_h - 1) * 1000) / 10;
const meta = {
  id, description, want, prompt, imageModel: imgModel, threeD: "fal-ai/trellis (MIT)",
  seconds: { image: tImage, threeD: Math.round((t3d - tImage) * 10) / 10, total: secs() },
  costUsd: { image: 0.04, threeD: 0.02, total: 0.06 },
  glbMB: Math.round((glb.length / 1048576) * 100) / 100,
  bbox: size, widthAxis: size.x >= size.z ? "x" : "z",
  proportionErrorPct: { width: errW, depth: errD },
  materials: (gltf.materials ?? []).length, textures: (gltf.images ?? []).length,
};
writeFileSync(join(OUT, "meta.json"), JSON.stringify(meta, null, 2));
console.log(JSON.stringify({ seconds: meta.seconds, glbMB: meta.glbMB, widthAxis: meta.widthAxis, proportionErrorPct: meta.proportionErrorPct, costUsd: meta.costUsd.total }));
console.log(`Kész: ${OUT}`);
