// Google Fonts TTF betöltő a Satori (next/og) rendereléshez.
// A Satori valódi betűfájlt igényel (nem CSS-t). Bevált módszer: a css2 API-t böngésző
// User-Agent NÉLKÜL hívjuk, a ténylegesen használt karakterekkel (`text=`), ekkor a
// Google `format('truetype')` (TTF) URL-t ad vissza — a modern böngésző woff2-t kapna,
// amit a Satori nem olvas. A `text=` a magyar „ő"/„ű" glyph-eket is garantálja.

export type LoadedFont = { weight: number; data: ArrayBuffer };

const cache = new Map<string, Promise<LoadedFont[]>>();

/** A CSS-családnévből (pl. "'Open Sans', sans-serif") a Google családnevet adja (Open Sans). */
export function googleFamilyOf(cssFamily: string): string {
  const m = cssFamily.match(/'([^']+)'/);
  return (m ? m[1] : cssFamily.split(",")[0]).trim();
}

async function fetchFamily(family: string, text: string): Promise<LoadedFont[]> {
  const url =
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;700` +
    `&text=${encodeURIComponent(text)}`;
  // FONTOS: nincs böngésző User-Agent → a Google truetype (TTF) URL-t ad.
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font CSS hiba (${res.status})`);
  const css = await res.text();

  const fonts: LoadedFont[] = [];
  const blocks = css.match(/@font-face\s*{[^}]*}/g) ?? [];
  for (const block of blocks) {
    const wMatch = block.match(/font-weight:\s*(\d+)/);
    const uMatch = block.match(/src:\s*url\((https:[^)]+)\)\s*format\('(?:truetype|opentype)'\)/);
    if (!uMatch) continue;
    const weight = wMatch ? Number(wMatch[1]) : 400;
    const fontRes = await fetch(uMatch[1]);
    if (!fontRes.ok) continue;
    fonts.push({ weight, data: await fontRes.arrayBuffer() });
  }
  if (!fonts.length) throw new Error(`Nem találtam TTF-et: ${family}`);
  return fonts;
}

/**
 * Egy család 400 + 700 súlyát adja, a megadott karakterekre szűkítve (cache-elve).
 * @param text a hirdetésen ténylegesen előforduló karakterek (a glyph-lefedettséghez).
 */
export function loadGoogleFont(family: string, text: string): Promise<LoadedFont[]> {
  const key = `${family.toLowerCase()}|${text}`;
  if (!cache.has(key)) cache.set(key, fetchFamily(family, text).catch((e) => { cache.delete(key); throw e; }));
  return cache.get(key)!;
}

// --- Magyar ékezet-ellenőrzés -------------------------------------------------
// A hosszú kettős ékezetek (ő ű Ő Ű) sok díszes betűkészletből HIÁNYOZNAK, és a
// Google ilyenkor csendben kihagyja őket → a hirdetésen üres négyzet jelenne meg.
// Ezért a betűfájl karaktertáblájából (cmap) tételesen ellenőrizzük őket.
const HU_REQUIRED = [
  0x0151, 0x0171, 0x0150, 0x0170, // ő ű Ő Ű
  0x00e1, 0x00e9, 0x00ed, 0x00f3, 0x00f6, 0x00fa, 0x00fc, // á é í ó ö ú ü
  0x00c1, 0x00c9, 0x00cd, 0x00d3, 0x00d6, 0x00da, 0x00dc, // Á É Í Ó Ö Ú Ü
];

/** Egy TTF/OTF cmap táblájából kiolvassa a lefedett kódpontokat (4-es és 12-es formátum). */
function cmapHas(data: ArrayBuffer, codepoints: number[]): boolean {
  try {
    const v = new DataView(data);
    const numTables = v.getUint16(4);
    let cmapOff = 0;
    for (let i = 0; i < numTables; i++) {
      const rec = 12 + i * 16;
      const tag = String.fromCharCode(v.getUint8(rec), v.getUint8(rec + 1), v.getUint8(rec + 2), v.getUint8(rec + 3));
      if (tag === "cmap") { cmapOff = v.getUint32(rec + 8); break; }
    }
    if (!cmapOff) return false;

    // A legjobb alátábla kiválasztása: Unicode teljes (3,10) → BMP (3,1) → bármi.
    const nSub = v.getUint16(cmapOff + 2);
    let best = 0, bestScore = -1;
    for (let i = 0; i < nSub; i++) {
      const rec = cmapOff + 4 + i * 8;
      const pid = v.getUint16(rec), eid = v.getUint16(rec + 2);
      const off = cmapOff + v.getUint32(rec + 4);
      const score = pid === 3 && eid === 10 ? 3 : pid === 3 && eid === 1 ? 2 : pid === 0 ? 1 : 0;
      if (score > bestScore) { bestScore = score; best = off; }
    }
    if (!best) return false;

    const covered = new Set<number>();
    const format = v.getUint16(best);
    if (format === 4) {
      const segX2 = v.getUint16(best + 6);
      const endBase = best + 14;
      const startBase = endBase + segX2 + 2;
      const deltaBase = startBase + segX2;
      const rangeBase = deltaBase + segX2;
      for (let s = 0; s < segX2 / 2; s++) {
        const end = v.getUint16(endBase + s * 2);
        const start = v.getUint16(startBase + s * 2);
        if (start > end || end === 0xffff) continue;
        for (const cp of codepoints) if (cp >= start && cp <= end) {
          const ro = v.getUint16(rangeBase + s * 2);
          if (ro === 0) { if (((cp + v.getInt16(deltaBase + s * 2)) & 0xffff) !== 0) covered.add(cp); }
          else {
            const gi = v.getUint16(rangeBase + s * 2 + ro + (cp - start) * 2);
            if (gi !== 0) covered.add(cp);
          }
        }
      }
    } else if (format === 12) {
      const nGroups = v.getUint32(best + 12);
      for (let g = 0; g < nGroups; g++) {
        const rec = best + 16 + g * 12;
        const start = v.getUint32(rec), end = v.getUint32(rec + 4);
        for (const cp of codepoints) if (cp >= start && cp <= end) covered.add(cp);
      }
    } else {
      return false; // ismeretlen formátum — inkább ne kockáztassunk
    }
    return codepoints.every((cp) => covered.has(cp));
  } catch {
    return false;
  }
}

/** Igaz, ha MINDEN betöltött súly tartalmazza a magyar ékezetes betűket. */
export function supportsHungarian(fonts: LoadedFont[]): boolean {
  return fonts.length > 0 && fonts.every((f) => cmapHas(f.data, HU_REQUIRED));
}
