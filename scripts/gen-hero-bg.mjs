// Hero háttérkép generálása Nano Banana-val (Gemini 2.5 Flash Image).
// Futtatás a projekt gyökeréből:
//   node --env-file=.env.local scripts/gen-hero-bg.mjs
// Eredmény: public/design/hero-bg.jpg  (a prompt lent szabadon átírható)

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
if (!apiKey) {
  console.error("❌ Hiányzó GOOGLE_AI_STUDIO_API_KEY a .env.local-ban.");
  process.exit(1);
}

const MODEL = process.env.GOOGLE_IMAGE_MODEL || "gemini-2.5-flash-image";

// --- A HERO HÁTTÉR PROMPTJA (nyugodtan írd át és futtasd újra variánsokért) ---
const PROMPT = `Cinematic abstract hero background. Elegant flowing translucent silk
fabric ribbons and thin strands sweeping and swirling across a deep near-black
background, dramatic side rim lighting. Warm coral and peach glow highlighting the
edges of the flowing material, mysterious, premium and refined, fine detail, subtle
film grain. Keep the LEFT side darker and calmer with negative space for large
headline text; the flowing fabric concentrated on the right. Wide 16:9 landscape,
high resolution. No text, no logos, no letters, no faces, no people.`;

const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    }),
  }
);

if (!res.ok) {
  console.error("❌ API hiba:", res.status, (await res.text()).slice(0, 400));
  process.exit(1);
}

const data = await res.json();
const parts = data?.candidates?.[0]?.content?.parts ?? [];
const imgPart = parts.find((p) => p.inline_data ?? p.inlineData);
const inline = imgPart?.inline_data ?? imgPart?.inlineData;

if (!inline?.data) {
  console.error("❌ A válasz nem tartalmaz képet.");
  process.exit(1);
}

const outDir = path.join(process.cwd(), "public", "design");
await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, "hero-bg.jpg");
await writeFile(outPath, Buffer.from(inline.data, "base64"));
console.log("✅ Mentve:", outPath);
console.log("   Frissítsd a http://localhost:3000-t, hogy lásd a heroban.");
