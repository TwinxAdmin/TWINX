// Vízjel a LÁTVÁNYTERVEKRE — a mi rendszerünk teszi rá, nem az AI.
//
// Miért így: ha a promptból kérnénk a feliratot, minden képen máshol, más
// betűvel és néha hibás szöveggel jelenne meg. Így viszont pixelre ugyanott ül,
// egységes, és egyetlen helyen (ebben a fájlban) módosítható.
//
// Hol fut: a látványterv-route-ban, KÖZVETLENÜL a Storage-ba töltés előtt.
// Így nincs olyan út (előnézet, letöltés, könyvtár, hirdetés, videó), ahol
// vízjel nélküli kép szivárogna ki.
//
// Technika: a szöveget Satorival (next/og) rajzoljuk egy kis átlátszó PNG-be —
// beágyazott betűvel, tehát nem függünk a szerver betűkészletétől —, majd
// sharp-pal a képre komponáljuk, és JPEG-ként adjuk vissza (a fájlméret így nem
// nő; a Storage-kvóta miatt ez fontos).
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { loadGoogleFont } from "@/lib/google-font";

/** A vízjel megjelenése — MINDEN beállítás itt, egy helyen. */
export const WATERMARK = {
  text: "Twinx AI látványterv",
  /** Betűméret a kép szélességének arányában (1,8% → 1600 px-en ~29 px). */
  fontSizeRatio: 0.018,
  /** Alsó/jobb margó a kép szélességének arányában. */
  marginRatio: 0.025,
  /** Fehéres-szürke, visszafogott — ne vigye el a figyelmet a látványtervről. */
  color: { r: 238, g: 240, b: 242 },
  /** A felirat átlátszósága (0–1). */
  opacity: 0.55,
  /** Alsó határ: kis képen se legyen olvashatatlanul apró. */
  minFontPx: 15,
  /** JPEG minőség a kimeneten. */
  jpegQuality: 88,
} as const;

/** A felirat átlátszó PNG-ként (Satori — a betű be van ágyazva). */
async function renderLabelPng(fontPx: number): Promise<{ png: Buffer; width: number; height: number }> {
  const { r, g, b } = WATERMARK.color;
  // Bőven elég doboz a szöveghez; a felesleges rész átlátszó marad.
  const width = Math.round(fontPx * WATERMARK.text.length * 0.75);
  const height = Math.round(fontPx * 1.8);

  const fonts = await loadGoogleFont("Manrope", WATERMARK.text).catch(() => null);

  const el = {
    type: "div",
    key: null,
    props: {
      style: {
        display: "flex",
        width,
        height,
        alignItems: "center",
        justifyContent: "flex-end",
        fontFamily: "Manrope",
      },
      children: {
        type: "div",
        key: null,
        props: {
          style: {
            display: "flex",
            fontSize: fontPx,
            fontWeight: 700,
            // Az átlátszóság MAGÁBAN a színben — így nem kell külön képfeldolgozó lépés.
            color: `rgba(${r},${g},${b},${WATERMARK.opacity})`,
            letterSpacing: Math.round(fontPx * 0.02),
            // Enyhe sötét árnyék: világos falon is olvasható marad, de nem hangos.
            textShadow: `0 ${Math.max(1, Math.round(fontPx * 0.05))}px ${Math.round(fontPx * 0.18)}px rgba(0,0,0,0.45)`,
          },
          children: WATERMARK.text,
        },
      },
    },
  } as unknown as React.ReactElement;

  const res = new ImageResponse(el, {
    width,
    height,
    fonts: fonts
      ? fonts.map((f) => ({
          name: "Manrope",
          data: f.data,
          style: "normal" as const,
          weight: (f.weight >= 700 ? 700 : 400) as 400 | 700,
        }))
      : undefined,
  });
  return { png: Buffer.from(await res.arrayBuffer()), width, height };
}

/**
 * Vízjel rátétele egy kész képre. A kimenet JPEG.
 * Hibát DOB — a hívó dönt; a látványterv-route-ban ilyenkor az eredeti kép megy
 * fel, mert a vízjel miatt soha ne bukjon el a partner generálása.
 */
export async function addWatermark(
  input: Uint8Array
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const image = sharp(Buffer.from(input), { failOn: "none" });
  const meta = await image.metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  if (!W || !H) throw new Error("Ismeretlen képméret.");

  const fontPx = Math.max(WATERMARK.minFontPx, Math.round(W * WATERMARK.fontSizeRatio));
  const label = await renderLabelPng(fontPx);

  const margin = Math.round(W * WATERMARK.marginRatio);
  const left = Math.max(0, W - label.width - margin);
  const top = Math.max(0, H - label.height - margin);

  const out = await image
    // Ha a forrás PNG átlátszó részt tartalmaz, a JPEG ne feketedjen be.
    .flatten({ background: "#ffffff" })
    .composite([{ input: label.png, left, top }])
    .jpeg({ quality: WATERMARK.jpegQuality, mozjpeg: true })
    .toBuffer();

  return { bytes: new Uint8Array(out), mimeType: "image/jpeg" };
}
