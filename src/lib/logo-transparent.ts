// Logó fehér hátterének átlátszóvá tétele — KLIENSOLDALON, ingyen.
// A legtöbb ingatlanos logó fehér (vagy közel fehér) háttéren van, éles kontraszttal;
// ilyenkor ez tökéletes eredményt ad. Bonyolult, fotószerű logónál az AI-tisztítás jobb.
"use client";

/**
 * A sarkokból induló "flood fill"-lel csak a KÜLSŐ világos hátteret tünteti el,
 * így a logón belüli fehér részek (pl. betűk belseje egy sötét körben) megmaradnak.
 * @param file a feltöltött logó
 * @param tolerance 0–255: mennyire térhet el a fehértől (alap: 24)
 */
export async function makeLogoTransparent(file: File, tolerance = 24): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("A böngésző nem támogatja a képfeldolgozást.");
  ctx.drawImage(bitmap, 0, 0);

  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  const isLight = (i: number) =>
    d[i] >= 255 - tolerance && d[i + 1] >= 255 - tolerance && d[i + 2] >= 255 - tolerance;

  // Sarkokból induló bejárás — csak az összefüggő külső háttér lesz átlátszó.
  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    visited[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }

  while (stack.length) {
    const p = stack.pop()!;
    const i = p * 4;
    if (!isLight(i)) continue;
    d[i + 3] = 0; // átlátszó
    const x = p % w;
    const y = (p / w) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }

  ctx.putImageData(img, 0, 0);
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Nem sikerült a kép mentése."))), "image/png")
  );
  const name = file.name.replace(/\.[^.]+$/, "") + "-atlatszo.png";
  return new File([blob], name, { type: "image/png" });
}
