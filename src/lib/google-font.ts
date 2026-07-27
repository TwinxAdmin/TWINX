// Google Fonts TTF betöltő a Satori (next/og) rendereléshez.
// A Satori valódi betűfájlt igényel (nem CSS-t), ezért a Google Fonts v1 CSS API-ból
// — régi böngésző User-Agenttel, ami TTF-et ad vissza — kiolvassuk a .ttf URL-t, és
// letöltjük a fájlt. Az eredményt memóriában cache-eljük (családonként).
//
// A TTF a teljes latin + latin-ext készletet tartalmazza, így a magyar „ő"/„ű" is megvan.

export type LoadedFont = { weight: number; data: ArrayBuffer };

const cache = new Map<string, Promise<LoadedFont[]>>();

// Régi UA → a Google TTF formátumot szolgál ki (a modern UA woff2-t adna, amit a Satori nem olvas).
const LEGACY_UA = "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)";

/** A CSS-családnévből (pl. "'Open Sans', sans-serif") a Google családnevet adja (Open Sans). */
export function googleFamilyOf(cssFamily: string): string {
  const m = cssFamily.match(/'([^']+)'/);
  return (m ? m[1] : cssFamily.split(",")[0]).trim();
}

async function fetchFamily(family: string): Promise<LoadedFont[]> {
  const url = `https://fonts.googleapis.com/css?family=${encodeURIComponent(family)}:400,700`;
  const res = await fetch(url, { headers: { "User-Agent": LEGACY_UA } });
  if (!res.ok) throw new Error(`Font CSS hiba (${res.status})`);
  const css = await res.text();

  const fonts: LoadedFont[] = [];
  const blocks = css.match(/@font-face\s*{[^}]*}/g) ?? [];
  const seen = new Set<number>();
  for (const block of blocks) {
    const wMatch = block.match(/font-weight:\s*(\d+)/);
    // A Satori a ttf/otf/woff formátumot olvassa (a woff2-t NEM).
    const uMatch = block.match(/url\((https:[^)]+\.(?:ttf|otf|woff))\)/);
    if (!uMatch) continue;
    const weight = wMatch ? Number(wMatch[1]) : 400;
    if (seen.has(weight)) continue;
    const fontRes = await fetch(uMatch[1]);
    if (!fontRes.ok) continue;
    fonts.push({ weight, data: await fontRes.arrayBuffer() });
    seen.add(weight);
  }
  if (!fonts.length) throw new Error(`Nem találtam TTF-et: ${family}`);
  return fonts;
}

/** Egy család 400 + 700 súlyát adja (cache-elve). Hibánál a hívó gondoskodik tartalékról. */
export function loadGoogleFont(family: string): Promise<LoadedFont[]> {
  const key = family.toLowerCase();
  if (!cache.has(key)) cache.set(key, fetchFamily(family).catch((e) => { cache.delete(key); throw e; }));
  return cache.get(key)!;
}
