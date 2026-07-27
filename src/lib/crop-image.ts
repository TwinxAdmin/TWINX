// Négyzetes kivágás a portré-fotóhoz — a partner állítja a nagyítást és a képkivágást,
// így egy egészalakos képből is lehet mellkép. Kliensoldali, ingyenes.
"use client";

export type CropState = { zoom: number; x: number; y: number }; // x/y: -1..1 eltolás

export const DEFAULT_CROP: CropState = { zoom: 1, x: 0, y: 0 };

/**
 * A kép látható részét (a kör/négyzet előnézetben beállított kivágást) menti ki.
 * A logika megegyezik az előnézetével: a képet "cover" módban illesztjük, majd a
 * zoom-mal nagyítjuk és az x/y-nal toljuk.
 * @param size a kimeneti négyzet oldalhossza pixelben
 */
export async function cropToSquare(file: File, crop: CropState, size = 800): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("A böngésző nem támogatja a képfeldolgozást.");

  // "cover" alapskála + a felhasználói nagyítás
  const base = Math.max(size / bitmap.width, size / bitmap.height);
  const scale = base * Math.max(1, crop.zoom);
  const drawW = bitmap.width * scale;
  const drawH = bitmap.height * scale;

  // Középre igazítás, majd eltolás a szabad mozgástér arányában
  const freeX = Math.max(0, drawW - size) / 2;
  const freeY = Math.max(0, drawH - size) / 2;
  const dx = (size - drawW) / 2 + crop.x * freeX;
  const dy = (size - drawH) / 2 + crop.y * freeY;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bitmap, dx, dy, drawW, drawH);

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Nem sikerült a kép mentése."))), "image/jpeg", 0.9)
  );
  return new File([blob], "portre.jpg", { type: "image/jpeg" });
}
