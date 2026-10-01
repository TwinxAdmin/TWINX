// pdf-kit.ts — közös segédek a szerveroldali (pdf-lib) PDF-ekhez.
//
// 1) cleanAiText: az AI (Perplexity / modell) válaszából eltávolítja azt, ami a
//    PDF-ben „nyersen" csúnya lenne: markdown-jelek (**, ##, |táblák|), [1]
//    forrásjelölések, és azok a karakterek, amelyek a betűtípusból hiányoznak
//    (→ ≈ ✓ emoji — ezek helyén eddig üres négyzet jelent meg).
// 2) wrapLines: sortördelés valódi szélesség-méréssel; a sornál szélesebb
//    „szót" (pl. hosszú URL) is eltöri, így semmi nem lóg le a lapról.
// 3) loadBrandFonts: a TWINX arculati betűi (Lato + Poppins, SIL OFL) — valódi
//    félkövérrel, részhalmazként beágyazva (kicsi PDF).
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import type { PDFDocument, PDFFont } from "pdf-lib";

// ---------------------------------------------------------------------------
// Szövegtisztítás
// ---------------------------------------------------------------------------

/** Karakterek, amelyek a beágyazott betűkből hiányoznak → olvasható megfelelő. */
const GLYPH_MAP: [RegExp, string][] = [
  [/→|⇒|➔|➜/g, "->"],
  [/←|⇐/g, "<-"],
  [/≈/g, "kb. "],
  [/≥/g, "legalább "],
  [/≤/g, "legfeljebb "],
  [/^(\s*)[✓✔☑✅]\s*/g, "$1• "],   // sor eleji pipa → felsorolásjel
  [/\s*[✓✔☑✅]/g, ""],              // mondat közbeni pipa → elhagyjuk
  [/[✗✘❌]/g, "×"],
  [/​|‌|‍|﻿/g, ""],
];

/** Emoji és egyéb képjelek (a betűkben nincsenek meg). */
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;

/** Egysoros elem (lista-pont, cím) tisztítása: markdown és hivatkozás nélkül. */
export function cleanInline(text: string): string {
  let t = String(text ?? "");
  t = t.replace(/\[(\d+(?:\s*[,–-]\s*\d+)*)\]/g, "");          // [1] [1,2] [3-4]
  t = t.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1");       // [szöveg](url)
  t = t.replace(/\*\*(.+?)\*\*|__(.+?)__/g, "$1$2");            // **félkövér**
  t = t.replace(/(^|[\s(])\*(?!\s)([^*\n]+?)\*(?=[\s).,!?:;]|$)/g, "$1$2"); // *dőlt*
  t = t.replace(/`([^`]+)`/g, "$1");
  for (const [re, to] of GLYPH_MAP) t = t.replace(re, to);
  t = t.replace(EMOJI, "");
  return t.replace(/[ \t]{2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
}

/**
 * Többsoros AI-szöveg tisztítása a sorok szerkezetének megtartásával:
 * „## Cím" → „Cím", „- pont" / „* pont" → „• pont", „|a|b|" → „a · b",
 * a „|---|" és „---" elválasztók kimaradnak. Idempotens: többször is futtatható.
 */
export function cleanAiText(text: string): string {
  const out: string[] = [];
  for (const raw of String(text ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    let line = raw.replace(/\s+$/, "");
    if (/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line)) continue; // |---|---|
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) continue;                       // ---
    if (/^\s*\|.*\|\s*$/.test(line)) {
      line = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()).filter(Boolean).join(" · ");
    }
    line = line.replace(/^\s*#{1,6}\s+/, "");             // ## Cím
    line = line.replace(/^\s*>\s?/, "");                   // > idézet
    const bullet = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    if (bullet) line = `${bullet[1]}• ${bullet[2]}`;
    const indent = /^\s*/.exec(line)?.[0] ?? "";
    out.push(indent + cleanInline(line));
  }
  // Legfeljebb egy üres sor egymás után.
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Az AI néha a „null" / „N/A" szót adja vissza érték helyett. */
export function isEmptyValue(v: unknown): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return !s || s === "null" || s === "undefined" || s === "n/a" || s === "nincs adat" || s === "-";
}

// ---------------------------------------------------------------------------
// Sortördelés
// ---------------------------------------------------------------------------

/** Egy túl hosszú „szó" (pl. URL) feldarabolása, hogy beférjen a sorba. */
function breakLongWord(font: PDFFont, word: string, size: number, maxW: number): string[] {
  const parts: string[] = [];
  let cur = "";
  for (const ch of Array.from(word)) {
    if (cur && font.widthOfTextAtSize(cur + ch, size) > maxW) { parts.push(cur); cur = ch; }
    else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
}

/**
 * Tördelés valódi szélességre. Üres bemeneti sor → "" (bekezdés-köz).
 * Csak szóközön/tabon tör — a nem törhető szóközzel (1 234 567 Ft) összefűzött
 * számok egyben maradnak.
 */
export function wrapLines(font: PDFFont, text: string, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const raw of String(text ?? "").split("\n")) {
    if (raw.trim() === "") { out.push(""); continue; }
    let cur = "";
    for (const w of raw.trim().split(/[ \t]+/)) {
      const pieces = font.widthOfTextAtSize(w, size) > maxW ? breakLongWord(font, w, size, maxW) : [w];
      for (const p of pieces) {
        const test = cur ? `${cur} ${p}` : p;
        if (cur && font.widthOfTextAtSize(test, size) > maxW) { out.push(cur); cur = p; }
        else cur = test;
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

/** Egy sorba vágás „…"-tal, ha nem fér el. */
export function fitLine(font: PDFFont, s: string, size: number, maxW: number): string {
  if (font.widthOfTextAtSize(s, size) <= maxW) return s;
  let t = s;
  while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > maxW) t = t.slice(0, -1);
  return t.trimEnd() + "…";
}

/** URL rövidítése a lapra: domain + útvonal, „www." és protokoll nélkül. */
export function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "")).replace(/\s+/g, "");
  } catch {
    return String(url ?? "").replace(/^https?:\/\/(www\.)?/, "");
  }
}

// ---------------------------------------------------------------------------
// Arculati betűk
// ---------------------------------------------------------------------------

export type BrandFonts = {
  /** Folyószöveg (Lato Regular) */
  body: PDFFont;
  /** Félkövér folyószöveg (Lato Bold) */
  bold: PDFFont;
  /** Címsorok (Poppins Bold) */
  head: PDFFont;
  /** Alcímek, címkék (Poppins Medium) */
  headMed: PDFFont;
};

const BRAND_DIR = path.join(process.cwd(), "assets", "fonts", "brand");

export async function loadBrandFonts(pdfDoc: PDFDocument): Promise<BrandFonts> {
  pdfDoc.registerFontkit(fontkit);
  const load = async (file: string) =>
    pdfDoc.embedFont(await readFile(path.join(BRAND_DIR, file)), { subset: true });
  const [body, bold, head, headMed] = await Promise.all([
    load("Lato-Regular.ttf"),
    load("Lato-Bold.ttf"),
    load("Poppins-Bold.ttf"),
    load("Poppins-Medium.ttf"),
  ]);
  return { body, bold, head, headMed };
}
