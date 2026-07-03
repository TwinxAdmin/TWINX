// PDF generálás pdf-lib-bel, Unicode (magyar ékezetes) fonttal.
// A font fájlt ide kell tenni:  assets/fonts/NotoSans-Regular.ttf
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const FONT_PATH = path.join(process.cwd(), "assets", "fonts", "NotoSans-Regular.ttf");

export async function generateValuationPdf(params: {
  title: string;
  meta: string[]; // fejléc sorok
  body: string; // az AI válasz szövege
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  let fontBytes: Buffer;
  try {
    fontBytes = await readFile(FONT_PATH);
  } catch {
    throw new Error(
      "Hiányzó betűtípus: tedd a NotoSans-Regular.ttf fájlt az assets/fonts/ mappába."
    );
  }
  const font = await pdfDoc.embedFont(fontBytes);

  const pageW = 595.28;
  const pageH = 841.89; // A4
  const margin = 50;
  const maxWidth = pageW - margin * 2;
  const fontSize = 11;
  const lineHeight = 16;

  let page = pdfDoc.addPage([pageW, pageH]);
  let y = pageH - margin;

  function newPageIfNeeded(gap: number) {
    if (y < margin + gap) {
      page = pdfDoc.addPage([pageW, pageH]);
      y = pageH - margin;
    }
  }

  function draw(text: string, size = fontSize, gap = lineHeight) {
    newPageIfNeeded(gap);
    page.drawText(text, { x: margin, y, size, font, color: rgb(0.1, 0.1, 0.1) });
    y -= gap;
  }

  function wrap(text: string, size: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth) {
        if (cur) lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  // Cím + fejléc
  draw(params.title, 18, 26);
  for (const m of params.meta) draw(m, 10, 14);
  y -= 10;

  // Törzs: bekezdésenként tördelve
  for (const paragraph of params.body.split(/\n/)) {
    if (paragraph.trim() === "") {
      y -= lineHeight / 2;
      continue;
    }
    for (const line of wrap(paragraph, fontSize)) draw(line);
  }

  return await pdfDoc.save();
}
