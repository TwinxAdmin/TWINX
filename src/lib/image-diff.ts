// Böngészőoldali, könnyű kép-összehasonlítás a rendrakás „no-op" felismeréséhez.
//
// A rendrakás néha (nagyon zsúfolt szobánál) egy majdnem azonos képet ad vissza —
// ilyenkor a partnernek felajánljuk az ingyenes újragenerálást. Ezt úgy vesszük
// észre, hogy a két képet EGY KIS vászonra rajzoljuk, és megnézzük, mennyire
// térnek el. Kis felbontáson elég gyors, és nem kell hozzá szerveroldali dekódolás.
//
// Csak kliensen fut (canvas). Cross-origin kép esetén a getImageData „tainted
// canvas" hibát dobhat — ilyenkor null-lal térünk vissza (nem tippelünk rosszat).

const SIZE = 40; // ennyi × ennyi pixelre kicsinyítünk (gyors, elég a durva eltéréshez)

function loadToData(url: string): Promise<Uint8ClampedArray | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // hogy olvasható legyen a pixeladat
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = SIZE;
        c.height = SIZE;
        const ctx = c.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        resolve(ctx.getImageData(0, 0, SIZE, SIZE).data);
      } catch {
        resolve(null); // tainted canvas / CORS — nem tudjuk összemérni
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * A két kép átlagos, 0..1-re normalizált eltérése (fényesség-alapon).
 * Kicsi érték = alig változott. `null`, ha nem mérhető (CORS/hiba).
 */
export async function imageMeanDiff(urlA: string, urlB: string): Promise<number | null> {
  const [a, b] = await Promise.all([loadToData(urlA), loadToData(urlB)]);
  if (!a || !b || a.length !== b.length) return null;

  let sum = 0;
  let n = 0;
  for (let i = 0; i < a.length; i += 4) {
    // Szürkeárnyalat (luma) — a fényesség-eltérés a lényeg, a színzaj nem.
    const ga = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];
    const gb = 0.299 * b[i] + 0.587 * b[i + 1] + 0.114 * b[i + 2];
    sum += Math.abs(ga - gb);
    n++;
  }
  return n ? sum / n / 255 : null;
}

// E fölött „változott", alatta „alig változott" (no-op). A rendrakás valódi
// eredménye jóval nagyobb eltérést ad (tárgyak tűnnek el + minőségjavítás), egy
// visszamásolt kép pedig szinte nullát. Óvatosan alacsony küszöb, hogy inkább
// kihagyjunk pár no-opot, mint hogy jó eredménynél nyaggassuk a partnert.
export const NOOP_DIFF_THRESHOLD = 0.02;

/**
 * „Zsúfoltság" becslése egy képre (0..1). Ingyenes, kliensoldali heurisztika:
 * a szomszédos pixelek közötti átlagos fényesség-gradiens — sok apró tárgy →
 * sok él → magas érték; üres, letisztult szoba → alacsony. NEM tökéletes (egy
 * mintás tapéta vagy erős textúra is „zsúfoltnak" tűnhet), ezért csak PUHA
 * figyelmeztetéshez használjuk. `null`, ha nem mérhető (CORS/hiba).
 *
 * Kalibráció valós fotókon: berendezett/tiszta ~0,01-0,02, normál ~0,03-0,045,
 * EXTRÉM rendetlen ~0,065-0,08. A küszöb szándékosan magas, hogy csak a tényleg
 * extrém eset süljön el (kevés téves riasztás áráért).
 */
export async function imageBusyness(url: string): Promise<number | null> {
  const d = await loadToData(url);
  if (!d) return null;
  const W = SIZE;
  let sum = 0;
  let n = 0;
  const luma = (i: number) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const g = luma(i);
      if (x + 1 < W) { sum += Math.abs(g - luma(i + 4)); n++; }
      if (y + 1 < W) { sum += Math.abs(g - luma(i + W * 4)); n++; }
    }
  }
  return n ? sum / n / 255 : null;
}

export const EXTREME_BUSYNESS_THRESHOLD = 0.065;
