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
