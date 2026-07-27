// Szövegzónák a hirdetéshez + a háttér elemzése.
// A szöveg helyét MI határozzuk meg (nem az AI), így a hirdetés mindig rendezett.
// A háttér adott zónáját megmérjük: milyen világos és mennyire "zajos" — ebből dől el,
// hogy világos vagy sötét betű kerül rá, és kell-e alá tömör sáv az olvashatósághoz.
"use client";

export type Zone = { x: number; y: number; w: number; h: number }; // 0–1 arányban

/** A hirdetés fix zónái (a vászon arányában). */
export const ZONES = {
  header: { x: 0.06, y: 0.05, w: 0.88, h: 0.16 },   // cím + alcím
  price: { x: 0.62, y: 0.62, w: 0.32, h: 0.12 },    // ár-doboz
  facts: { x: 0.06, y: 0.62, w: 0.52, h: 0.10 },    // adat-chipek
  footer: { x: 0.0, y: 0.80, w: 1.0, h: 0.20 },     // ügynök-sáv
} as const;

export type ZoneReading = {
  /** Átlagos világosság 0–1 (0 = fekete, 1 = fehér). */
  luma: number;
  /** Mennyire változatos a terület 0–1 (0 = teljesen sima, 1 = nagyon zajos). */
  noise: number;
  /** Olvasható betűszín erre a területre. */
  ink: string;
  /** Kell-e alátámasztó sáv (túl zajos vagy közepes világosságú a háttér). */
  needsPlate: boolean;
};

/**
 * Egy zóna elemzése a háttérképen. A képet canvasra rajzoljuk, és a zóna
 * pixeleiből átlagot + szórást számolunk (mintavételezéssel, hogy gyors legyen).
 */
export async function readZone(imageUrl: string, zone: Zone): Promise<ZoneReading> {
  const img = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  const W = img.naturalWidth || img.width;
  const H = img.naturalHeight || img.height;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { luma: 0.5, noise: 1, ink: "#ffffff", needsPlate: true };
  ctx.drawImage(img, 0, 0);

  const x = Math.max(0, Math.round(zone.x * W));
  const y = Math.max(0, Math.round(zone.y * H));
  const w = Math.max(1, Math.min(W - x, Math.round(zone.w * W)));
  const h = Math.max(1, Math.min(H - y, Math.round(zone.h * H)));

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(x, y, w, h).data;
  } catch {
    // Idegen eredetű kép (CORS) esetén nem tudunk mérni — biztonságra játszunk.
    return { luma: 0.5, noise: 1, ink: "#ffffff", needsPlate: true };
  }

  // Mintavétel: minden N. pixel, hogy nagy képnél is gyors legyen.
  const step = Math.max(1, Math.floor((w * h) / 20000));
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4 * step) {
    const l = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    sum += l;
    sumSq += l * l;
    n++;
  }
  const luma = n ? sum / n : 0.5;
  const variance = n ? Math.max(0, sumSq / n - luma * luma) : 0.25;
  const noise = Math.min(1, Math.sqrt(variance) * 3.2); // 0–1 skálára húzva

  return {
    luma,
    noise,
    ink: luma > 0.58 ? "#16120e" : "#ffffff",
    // Zajos háttéren, vagy középszürkén nehéz olvasni → alátámasztó sáv kell.
    needsPlate: noise > 0.28 || (luma > 0.38 && luma < 0.62),
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("A kép nem tölthető be."));
    img.src = src;
  });
}
