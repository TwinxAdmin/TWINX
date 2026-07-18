// PDF generálás pdf-lib-bel, Unicode (magyar ékezetes) fonttal.
// A font fájlt ide kell tenni:  assets/fonts/NotoSans-Regular.ttf
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { CostingResult } from "@/lib/costing";

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");

// Az assets/fonts/ mappából bármelyik .ttf-et használja (a "Regular"-t előnyben).
async function loadFontBytes(): Promise<Buffer> {
  let files: string[];
  try {
    files = await readdir(FONT_DIR);
  } catch {
    throw new Error(
      "Hiányzó betűtípus: hozd létre az assets/fonts/ mappát és tegyél bele egy .ttf fájlt (pl. NotoSans-Regular.ttf)."
    );
  }
  const ttfs = files.filter((f) => f.toLowerCase().endsWith(".ttf"));
  const pick =
    ttfs.find((f) => /regular/i.test(f)) ?? ttfs[0];
  if (!pick) {
    throw new Error(
      "Nincs .ttf fájl az assets/fonts/ mappában. Tegyél bele egy Unicode fontot (pl. NotoSans-Regular.ttf)."
    );
  }
  return readFile(path.join(FONT_DIR, pick));
}

export async function generateValuationPdf(params: {
  title: string;
  meta: string[]; // fejléc sorok
  body: string; // az AI válasz szövege
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = await loadFontBytes();
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

// ---------------------------------------------------------------------------
// Igényes, márkázott PDF-sablon az Önköltség & profit riporthoz.
// Fejléc-sáv + KPI-kártyák + formázott táblázat + AI-elemzés + lábléc.
// ---------------------------------------------------------------------------
const C = {
  coral: rgb(0.937, 0.478, 0.353),
  coralDeep: rgb(0.78, 0.32, 0.19),
  ink: rgb(0.12, 0.12, 0.14),
  muted: rgb(0.44, 0.44, 0.48),
  line: rgb(0.86, 0.84, 0.81),
  soft: rgb(0.99, 0.93, 0.89),
  cream: rgb(0.985, 0.967, 0.945),
  white: rgb(1, 1, 1),
  red: rgb(0.71, 0.22, 0.18),
  softWhite: rgb(1, 0.9, 0.85),
};

const huf = (n: number) => `${Math.round(n).toLocaleString("hu-HU")} Ft`;
const num = (n: number) => Math.round(n).toLocaleString("hu-HU");

export async function generateCostingPdf(params: {
  result: CostingResult;
  narrative: string;
  period?: string;
  oneTimeTotal?: number;
}): Promise<Uint8Array> {
  const { result, narrative, period, oneTimeTotal } = params;
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(await loadFontBytes());

  const pageW = 595.28, pageH = 841.89;
  const margin = 48;
  const contentW = pageW - margin * 2;
  const dateStr = new Date().toLocaleDateString("hu-HU");

  let page: PDFPage = pdfDoc.addPage([pageW, pageH]);
  let y = pageH;

  // --- rajz-segédek ---
  const write = (s: string, x: number, yy: number, size: number, color = C.ink, bold = false) => {
    page.drawText(s, { x, y: yy, size, font, color });
    if (bold) page.drawText(s, { x: x + 0.4, y: yy, size, font, color });
  };
  const writeRight = (s: string, xRight: number, yy: number, size: number, color = C.ink, bold = false) => {
    write(s, xRight - font.widthOfTextAtSize(s, size), yy, size, color, bold);
  };
  const truncate = (s: string, size: number, maxW: number) => {
    if (font.widthOfTextAtSize(s, size) <= maxW) return s;
    let t = s;
    while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > maxW) t = t.slice(0, -1);
    return t + "…";
  };
  const wrapText = (t: string, size: number, maxW: number): string[] => {
    const out: string[] = [];
    for (const raw of t.split(/\n/)) {
      if (raw.trim() === "") { out.push(""); continue; }
      const words = raw.split(/\s+/);
      let cur = "";
      for (const w of words) {
        const test = cur ? `${cur} ${w}` : w;
        if (font.widthOfTextAtSize(test, size) > maxW) { if (cur) out.push(cur); cur = w; }
        else cur = test;
      }
      if (cur) out.push(cur);
    }
    return out;
  };

  // --- fejléc-sáv ---
  const drawHeader = () => {
    const bandH = 84;
    page.drawRectangle({ x: 0, y: pageH - bandH, width: pageW, height: bandH, color: C.coral });
    page.drawRectangle({ x: 0, y: pageH - bandH, width: pageW, height: 4, color: C.coralDeep });
    write("Önköltség & profit riport", margin, pageH - 40, 20, C.white, true);
    write("TWINX · Vendéglátás", margin, pageH - 60, 10, C.softWhite);
    writeRight(dateStr, pageW - margin, pageH - 40, 10, C.white);
    y = pageH - bandH - 26;
  };
  drawHeader();

  // --- meta sor ---
  const t = result.totals;
  const alloc = result.method === "revenue" ? "árbevétel-arányos" : "darab-arányos";
  write(
    period ? `Időszak: ${period}` : `Rezsi-allokáció: ${alloc}`,
    margin, y, 9.5, C.muted
  );
  y -= 14;
  write(
    `Rezsi-allokáció: ${alloc}    ·    Időszaki költség: ${huf(t.overhead)}` +
      (oneTimeTotal && oneTimeTotal > 0 ? `  (ebből egyszeri: ${huf(oneTimeTotal)})` : ""),
    margin, y, 9.5, C.muted
  );
  y -= 24;

  // --- KPI kártyák ---
  const kpis: { label: string; value: string; highlight?: boolean; neg?: boolean }[] = [
    { label: "Időszaki árbevétel", value: huf(t.revenue) },
    { label: "Alapanyagköltség", value: huf(t.ingredientCost) },
    { label: "Rávetített rezsi", value: huf(t.coveredOverhead) },
    { label: "Étterem időszaki profit", value: huf(t.netProfit), highlight: true, neg: t.netProfit < 0 },
  ];
  const gap = 10;
  const cardW = (contentW - gap * 3) / 4;
  const cardH = 56;
  kpis.forEach((k, i) => {
    const x = margin + i * (cardW + gap);
    page.drawRectangle({
      x, y: y - cardH, width: cardW, height: cardH,
      color: k.highlight ? C.soft : C.cream,
      borderColor: k.highlight ? C.coral : C.line, borderWidth: 1,
    });
    write(truncate(k.label, 8, cardW - 16), x + 10, y - 20, 8, C.muted);
    write(truncate(k.value, 13, cardW - 16), x + 10, y - 40, 13, k.neg ? C.red : k.highlight ? C.coralDeep : C.ink, true);
  });
  y -= cardH + 30;

  // --- szekció-cím segéd ---
  const sectionTitle = (label: string) => {
    if (y < margin + 80) newPage();
    write(label, margin, y, 13, C.ink, true);
    page.drawRectangle({ x: margin, y: y - 6, width: 42, height: 2.5, color: C.coral });
    y -= 22;
  };

  // --- lapváltás ---
  function newPage() {
    page = pdfDoc.addPage([pageW, pageH]);
    y = pageH - margin;
  }

  // --- táblázat oszlopok ---
  const cols: { key: string; w: number; align: "left" | "right"; h: string }[] = [
    { key: "name", w: 150, align: "left", h: "Étel" },
    { key: "qty", w: 44, align: "right", h: "eladott" },
    { key: "unit", w: 78, align: "right", h: "Önktg/adag" },
    { key: "profit", w: 78, align: "right", h: "Profit/adag" },
    { key: "margin", w: 45, align: "right", h: "Árrés" },
    { key: "monthly", w: 64, align: "right", h: "Időszaki" },
    { key: "be", w: 40, align: "right", h: "Fed." },
  ];
  const colX = (idx: number) => margin + cols.slice(0, idx).reduce((s, c) => s + c.w, 0);

  const drawTableHeader = () => {
    const h = 20;
    page.drawRectangle({ x: margin, y: y - h + 4, width: contentW, height: h, color: C.soft });
    cols.forEach((c, i) => {
      const x = colX(i);
      if (c.align === "left") write(c.h, x + 4, y - h + 10, 8, C.coralDeep, true);
      else writeRight(c.h, x + c.w - 4, y - h + 10, 8, C.coralDeep, true);
    });
    y -= h + 2;
  };

  sectionTitle("Ételenkénti bontás");
  drawTableHeader();

  const rowH = 18;
  result.dishes.forEach((d, ri) => {
    if (y - rowH < margin + 30) { newPage(); drawTableHeader(); }
    if (ri % 2 === 1) page.drawRectangle({ x: margin, y: y - rowH + 4, width: contentW, height: rowH, color: C.cream });
    const cells: { text: string; align: "left" | "right"; color?: ReturnType<typeof rgb> }[] = [
      { text: truncate(d.name, 8.5, cols[0].w - 8), align: "left" },
      { text: String(d.monthly_qty), align: "right" },
      { text: num(d.fullUnitCost), align: "right" },
      { text: num(d.unitProfit), align: "right", color: d.unitProfit < 0 ? C.red : C.ink },
      { text: `${Math.round(d.unitMarginPct)}%`, align: "right", color: d.unitMarginPct < 0 ? C.red : C.ink },
      { text: num(d.monthlyProfit), align: "right", color: d.monthlyProfit < 0 ? C.red : C.ink },
      { text: String(d.breakevenQty), align: "right" },
    ];
    cells.forEach((cell, i) => {
      const x = colX(i);
      const yy = y - rowH + 9;
      if (cell.align === "left") write(cell.text, x + 4, yy, 8.5, cell.color ?? C.ink, i === 0);
      else writeRight(cell.text, x + cols[i].w - 4, yy, 8.5, cell.color ?? C.ink);
    });
    page.drawRectangle({ x: margin, y: y - rowH + 3, width: contentW, height: 0.5, color: C.line });
    y -= rowH;
  });
  write("A számértékek forintban (Ft). „Önktg/adag” = alapanyag + rá jutó rezsi; „Fed.” = fedezeti darabszám.", margin, y - 6, 7.5, C.muted);
  y -= 30;

  // --- AI-elemzés ---
  if (narrative.trim()) {
    sectionTitle("AI-elemzés és javaslatok");
    const size = 10, lh = 15;
    for (const line of wrapText(narrative.trim(), size, contentW)) {
      if (y - lh < margin + 24) newPage();
      if (line === "") { y -= lh / 2; continue; }
      write(line, margin, y - lh + 4, size, C.ink);
      y -= lh;
    }
  }

  // --- lábléc + oldalszámok minden lapra ---
  const pages = pdfDoc.getPages();
  pages.forEach((p, i) => {
    p.drawRectangle({ x: margin, y: 34, width: contentW, height: 0.6, color: C.line });
    p.drawText(`Készült a TWINX-szel · ${dateStr}`, { x: margin, y: 22, size: 8, font, color: C.muted });
    const pn = `${i + 1} / ${pages.length}`;
    p.drawText(pn, { x: pageW - margin - font.widthOfTextAtSize(pn, 8), y: 22, size: 8, font, color: C.muted });
  });

  return await pdfDoc.save();
}
