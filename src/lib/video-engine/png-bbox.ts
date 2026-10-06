// PNG ÁTLÁTSZÓSÁG-DOBOZ — egy RGBA PNG nem átlátszó részének befoglaló téglalapja.
//
// Miért kell: a sablon rétegei (felirat, panel, ikon) teljes vászonméretű, többnyire
// átlátszó PNG-k. Ha a videóra csak a TARTALMAZÓ dobozukat keverjük rá, a keverés
// költsége a töredékére csökken (egy kis felirat ~5% a teljes képhez képest).
//
// Szerveroldali, függőség nélküli (zlib a Node része). A Satori/resvg kimenetét
// kezeli: 8 bites, nem sorközi (non-interlaced) RGBA vagy RGB PNG.
import zlib from "node:zlib";

export type Bbox = { x: number; y: number; w: number; h: number };

/**
 * A nem átlátszó pixelek doboza (páros koordinátákra kerekítve a yuv420p miatt).
 * `null`, ha a kép teljesen átlátszó. Ha a PNG nem értelmezhető, a teljes képet adja vissza.
 */
export function pngAlphaBbox(buf: Buffer): Bbox | null {
  try {
    if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("nem PNG");
    let p = 8;
    let W = 0, H = 0, bitDepth = 0, colorType = 0, interlace = 0;
    const idat: Buffer[] = [];
    while (p < buf.length) {
      const len = buf.readUInt32BE(p);
      const type = buf.toString("ascii", p + 4, p + 8);
      const data = buf.subarray(p + 8, p + 8 + len);
      if (type === "IHDR") {
        W = data.readUInt32BE(0); H = data.readUInt32BE(4);
        bitDepth = data[8]; colorType = data[9]; interlace = data[12];
      } else if (type === "IDAT") idat.push(data);
      else if (type === "IEND") break;
      p += 12 + len;
    }
    if (bitDepth !== 8 || interlace !== 0 || (colorType !== 6 && colorType !== 2)) {
      return { x: 0, y: 0, w: W, h: H }; // ismeretlen formátum → teljes kép (biztonságos)
    }
    if (colorType === 2) return { x: 0, y: 0, w: W, h: H }; // nincs alfa: minden látszik
    const bpp = 4;
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = W * bpp;
    let prev = Buffer.alloc(stride);
    let cur = Buffer.alloc(stride);
    let minX = W, minY = H, maxX = -1, maxY = -1;
    let o = 0;
    for (let y = 0; y < H; y++) {
      const filter = raw[o++];
      for (let i = 0; i < stride; i++) {
        const x = raw[o + i];
        const a = i >= bpp ? cur[i - bpp] : 0;
        const b = prev[i];
        const c = i >= bpp ? prev[i - bpp] : 0;
        let v: number;
        switch (filter) {
          case 1: v = x + a; break;
          case 2: v = x + b; break;
          case 3: v = x + ((a + b) >> 1); break;
          case 4: {
            const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
            v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
            break;
          }
          default: v = x;
        }
        cur[i] = v & 0xff;
      }
      o += stride;
      // Alfa-csatorna (minden 4. bájt) — van-e itt látható pixel?
      let rowMin = -1, rowMax = -1;
      for (let x = 0; x < W; x++) {
        if (cur[x * 4 + 3] !== 0) { if (rowMin < 0) rowMin = x; rowMax = x; }
      }
      if (rowMin >= 0) {
        if (rowMin < minX) minX = rowMin;
        if (rowMax > maxX) maxX = rowMax;
        if (y < minY) minY = y;
        maxY = y;
      }
      const t = prev; prev = cur; cur = t;
    }
    if (maxX < 0) return null;
    // Páros határok (yuv420p kroma-felbontás) + 2 px ráhagyás az élsimításnak.
    const x0 = Math.max(0, (minX - 2) & ~1), y0 = Math.max(0, (minY - 2) & ~1);
    const x1 = Math.min(W, (maxX + 4) & ~1), y1 = Math.min(H, (maxY + 4) & ~1);
    return { x: x0, y: y0, w: Math.max(2, x1 - x0), h: Math.max(2, y1 - y0) };
  } catch {
    return null;
  }
}
