// BETŰK A SAJÁT VIDEÓMOTORHOZ.
//
// A sablon megadja a betűcsaládot és a súlyokat (Aurora: Manrope 300/400/700/800).
// Sorrend: 1) helyi fájl az assets/fonts/video/ mappából (ha valaki letette),
//          2) Google Fonts (TTF, a ténylegesen használt karakterekre szűkítve).
// A Manrope szabad licencű (SIL OFL) — beágyazható a videóba.
//
// CSAK SZERVEROLDALON fut.
import fs from "node:fs";
import path from "node:path";
import type { TwinxTemplate } from "./template-schema";
import type { EngineFont } from "./render-node";

type Weight = EngineFont["weight"];

/** Mindig benne lévő karakterek (magyar ékezetek, számok, írásjelek). */
const BASE_CHARS =
  "AÁBCDEÉFGHIÍJKLMNOÓÖŐPQRSTUÚÜŰVWXYZaábcdeéfghiíjklmnoóöőpqrstuúüűvwxyz0123456789.,:;·-–—/()%²+&@!?'\" ";

const cache = new Map<string, Promise<EngineFont[]>>();

async function fromGoogle(family: string, weights: number[], text: string): Promise<EngineFont[]> {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weights.join(";")}` +
    `&text=${encodeURIComponent(text)}`;
  // Böngésző User-Agent NÉLKÜL a Google TTF-et ad (a Satori woff2-t nem olvas).
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Betű-CSS hiba (${res.status}): ${family}`);
  const css = await res.text();
  const out: EngineFont[] = [];
  for (const block of css.match(/@font-face\s*{[^}]*}/g) ?? []) {
    const w = Number(block.match(/font-weight:\s*(\d+)/)?.[1] ?? 400) as Weight;
    const src = block.match(/src:\s*url\((https:[^)]+)\)\s*format\('(?:truetype|opentype)'\)/)?.[1];
    if (!src) continue;
    const f = await fetch(src, { signal: AbortSignal.timeout(8000) });
    if (f.ok) out.push({ name: family, weight: w, style: "normal", data: await f.arrayBuffer() });
  }
  if (!out.length) throw new Error(`Nem találtam betűfájlt: ${family}`);
  return out;
}

/** Tartalék: a projekt saját betűi (assets/fonts/brand), a sablon családnevén regisztrálva. */
function brandFallback(family: string, weight: number): EngineFont | null {
  const file = weight >= 600 ? "Poppins-Bold.ttf" : weight >= 500 ? "Poppins-Medium.ttf" : "Lato-Regular.ttf";
  const p = path.join(process.cwd(), "assets", "fonts", "brand", file);
  if (!fs.existsSync(p)) return null;
  const b = fs.readFileSync(p);
  return { name: family, weight: weight as Weight, style: "normal", data: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer };
}

/**
 * A sablon betűi. `texts` = a videóban megjelenő szövegek (a karakterkészlethez).
 * Sorrend családonként: helyi fájl → Google Fonts (8 mp időkorláttal) → a projekt
 * saját betűi tartalékként. Így a videó MINDIG elkészül, egy lassú/hibás betűszolgáltatás
 * miatt sem akad el.
 */
export async function loadEngineFonts(tpl: TwinxTemplate, texts: string[]): Promise<{ fonts: EngineFont[]; source: "local" | "google" | "none" }> {
  const local: EngineFont[] = [];
  const missing: typeof tpl.fonts = [];
  for (const f of tpl.fonts) {
    const p = path.join(process.cwd(), f.file);
    if (fs.existsSync(p)) {
      const b = fs.readFileSync(p);
      local.push({ name: f.family, weight: f.weight as Weight, style: "normal", data: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer });
    } else missing.push(f);
  }
  if (!missing.length) return { fonts: local, source: "local" };

  const chars = Array.from(new Set((BASE_CHARS + texts.join(" ") + texts.join(" ").toUpperCase()).split(""))).join("");
  const byFamily = new Map<string, number[]>();
  for (const f of missing) byFamily.set(f.family, [...(byFamily.get(f.family) ?? []), f.weight]);
  const all: EngineFont[] = [...local];
  let fromGoogleOk = false, usedFallback = false;
  // Családonként külön (párhuzamosan): ha az egyik nem jön le, a többi attól még a valódi.
  await Promise.all([...byFamily].map(async ([family, weights]) => {
    const ws = [...new Set(weights)].sort((a, b) => a - b);
    const key = `${family}|${ws.join(",")}|${chars}`;
    try {
      if (!cache.has(key)) cache.set(key, fromGoogle(family, ws, chars).catch((e) => { cache.delete(key); throw e; }));
      all.push(...(await cache.get(key)!));
      fromGoogleOk = true;
    } catch {
      for (const w of ws) { const fb = brandFallback(family, w); if (fb) { all.push(fb); usedFallback = true; } }
    }
  }));
  return { fonts: all, source: fromGoogleOk ? "google" : all.length && !usedFallback ? "local" : usedFallback ? "local" : "none" };
}
