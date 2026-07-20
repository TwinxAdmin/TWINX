// PDF generálás pdf-lib-bel, Unicode (magyar ékezetes) fonttal.
// A font fájlt ide kell tenni:  assets/fonts/NotoSans-Regular.ttf
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { CostingResult } from "@/lib/costing";
import type { SimResult } from "@/lib/simulation";
import { volumeLabel, type SupplierQuery, type SupplierResult } from "@/lib/suppliers";
import {
  professionLabel, professionsFor,
  type Industry, type ProfessionalQuery, type ProfessionalResult,
} from "@/lib/professionals";

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
  write(period ? `Időszak: ${period}` : `Önköltség & profit`, margin, y, 9.5, C.muted);
  y -= 14;
  write(
    `Rezsi-allokáció: árbevétel-arányos (étlap / menü)    ·    Időszaki költség: ${huf(t.overhead)}` +
      (oneTimeTotal && oneTimeTotal > 0 ? `  (ebből egyszeri: ${huf(oneTimeTotal)})` : "") +
      (t.oneTimeIncome > 0 ? `    ·    Egyszeri bevétel: ${huf(t.oneTimeIncome)}` : ""),
    margin, y, 9.5, C.muted
  );
  y -= 24;

  // --- KPI kártyák ---
  const kpis: { label: string; value: string; highlight?: boolean; neg?: boolean }[] = [
    { label: "Időszaki árbevétel", value: huf(t.revenue) },
    { label: "Alapanyagköltség", value: huf(t.ingredientCost) },
    { label: "Időszaki költség", value: huf(t.overhead) },
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

  // ===================== ÉTLAP =====================
  const e = result.etlap;
  sectionTitle("Étlap — ételenkénti bontás");
  write(
    `Árbevétel ${huf(e.revenue)}  ·  alapanyag ${huf(e.ingredientCost)}  ·  rezsi ${huf(e.overhead)}  ·  profit ${huf(e.profit)}`,
    margin, y, 8.5, C.muted
  );
  y -= 16;
  drawTableHeader();

  const rowH = 18;
  e.dishes.forEach((d, ri) => {
    if (y - rowH < margin + 30) { newPage(); drawTableHeader(); }
    if (ri % 2 === 1) page.drawRectangle({ x: margin, y: y - rowH + 4, width: contentW, height: rowH, color: C.cream });
    const cells: { text: string; align: "left" | "right"; color?: ReturnType<typeof rgb> }[] = [
      { text: truncate(d.name, 8.5, cols[0].w - 8), align: "left" },
      { text: String(d.qty), align: "right" },
      { text: num(d.fullUnitCost), align: "right" },
      { text: num(d.unitProfit), align: "right", color: d.unitProfit < 0 ? C.red : C.ink },
      { text: `${Math.round(d.unitMarginPct)}%`, align: "right", color: d.unitMarginPct < 0 ? C.red : C.ink },
      { text: num(d.periodProfit), align: "right", color: d.periodProfit < 0 ? C.red : C.ink },
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
  if (!e.dishes.length) { write("Nincs étlapos eladás ebben az időszakban.", margin, y - 8, 9, C.muted); y -= 20; }
  write("Ft-ban. „Önktg/adag” = alapanyag + rá jutó rezsi; „Fed.” = fedezeti darabszám.", margin, y - 6, 7.5, C.muted);
  y -= 30;

  // ===================== NAPI MENÜK =====================
  const m = result.menu;
  if (y < margin + 150) newPage();
  sectionTitle("Napi menük");
  if (m.count > 0) {
    write(
      `${m.count} eladott menü (${m.qty2} db 2 fogásos, ${m.qty3} db 3 fogásos)  ·  bevétel ${huf(m.revenue)}  ·  ` +
        `előállítás ${huf(m.ingredientCost)}  ·  rezsi ${huf(m.overhead)}  ·  profit ${huf(m.profit)}`,
      margin, y, 8.5, C.muted
    );
    y -= 20;

    // Egy menüre vetített kártya — a lényeg egy pillantásra.
    const boxH = 50;
    page.drawRectangle({ x: margin, y: y - boxH, width: contentW, height: boxH, color: C.soft, borderColor: C.coral, borderWidth: 1 });
    write("EGY MENÜRE VETÍTVE", margin + 10, y - 16, 8, C.coralDeep, true);
    const parts = [
      `Ár: ${huf(m.perMenuRevenue)}`,
      `Előállítás: ${huf(m.perMenuCost)}`,
      `Rezsi: ${huf(m.perMenuOverhead)}`,
      `Marad: ${huf(m.perMenuProfit)}`,
    ];
    let px = margin + 10;
    parts.forEach((p, i) => {
      const last = i === parts.length - 1;
      write(p, px, y - 34, last ? 11 : 10, last ? (m.perMenuProfit < 0 ? C.red : C.coralDeep) : C.ink, last);
      px += font.widthOfTextAtSize(p, last ? 11 : 10) + 24;
    });
    y -= boxH + 20;

    // Menübe felhasznált ételek költsége.
    const mCols: { w: number; align: "left" | "right"; h: string }[] = [
      { w: 240, align: "left", h: "Menübe felhasznált étel" },
      { w: 80, align: "right", h: "adag" },
      { w: 89, align: "right", h: "Önktg/adag" },
      { w: 90, align: "right", h: "Összesen" },
    ];
    const mColX = (idx: number) => margin + mCols.slice(0, idx).reduce((s, c) => s + c.w, 0);
    const drawMenuHeader = () => {
      const h = 20;
      page.drawRectangle({ x: margin, y: y - h + 4, width: contentW, height: h, color: C.soft });
      mCols.forEach((c, i) => {
        const x = mColX(i);
        if (c.align === "left") write(c.h, x + 4, y - h + 10, 8, C.coralDeep, true);
        else writeRight(c.h, x + c.w - 4, y - h + 10, 8, C.coralDeep, true);
      });
      y -= h + 2;
    };
    drawMenuHeader();
    m.dishes.forEach((d, ri) => {
      if (y - rowH < margin + 30) { newPage(); drawMenuHeader(); }
      if (ri % 2 === 1) page.drawRectangle({ x: margin, y: y - rowH + 4, width: contentW, height: rowH, color: C.cream });
      const yy = y - rowH + 9;
      write(truncate(d.name, 8.5, mCols[0].w - 8), mColX(0) + 4, yy, 8.5, C.ink, true);
      writeRight(String(d.qty), mColX(1) + mCols[1].w - 4, yy, 8.5, C.ink);
      writeRight(num(d.unitCost), mColX(2) + mCols[2].w - 4, yy, 8.5, C.ink);
      writeRight(num(d.totalCost), mColX(3) + mCols[3].w - 4, yy, 8.5, C.ink);
      page.drawRectangle({ x: margin, y: y - rowH + 3, width: contentW, height: 0.5, color: C.line });
      y -= rowH;
    });
    y -= 16;
  } else {
    write("Nincs rögzített menü-eladás ebben az időszakban.", margin, y - 8, 9, C.muted);
    y -= 30;
  }

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

// ---------------------------------------------------------------------------
// PROFIT-TERV (előretekintő szimuláció) — márkázott PDF.
// Ugyanaz a vizuális nyelv, mint az önköltség-riportnál, de a hangsúly a CÉLON van.
// ---------------------------------------------------------------------------
export async function generateSimulationPdf(params: {
  result: SimResult;
  narrative: string;
  period?: string;
}): Promise<Uint8Array> {
  const { result: r, narrative, period } = params;
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(await loadFontBytes());

  const pageW = 595.28, pageH = 841.89;
  const margin = 48;
  const contentW = pageW - margin * 2;
  const dateStr = new Date().toLocaleDateString("hu-HU");

  let page: PDFPage = pdfDoc.addPage([pageW, pageH]);
  let y = pageH;

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
  function newPage() {
    page = pdfDoc.addPage([pageW, pageH]);
    y = pageH - margin;
  }
  const sectionTitle = (label: string) => {
    if (y < margin + 90) newPage();
    write(label, margin, y, 13, C.ink, true);
    page.drawRectangle({ x: margin, y: y - 6, width: 42, height: 2.5, color: C.coral });
    y -= 22;
  };

  // --- fejléc ---
  const bandH = 84;
  page.drawRectangle({ x: 0, y: pageH - bandH, width: pageW, height: bandH, color: C.coral });
  page.drawRectangle({ x: 0, y: pageH - bandH, width: pageW, height: 4, color: C.coralDeep });
  write("Profit-terv", margin, pageH - 40, 20, C.white, true);
  write("TWINX · Vendéglátás", margin, pageH - 60, 10, C.softWhite);
  writeRight(dateStr, pageW - margin, pageH - 40, 10, C.white);
  y = pageH - bandH - 26;

  write(period ? `Tervezett időszak: ${period}` : "Tervezett időszak", margin, y, 9.5, C.muted);
  y -= 14;
  write(
    r.mode === "full"
      ? `Számítási mód: az étterem egyéb költségeivel együtt (időszaki egyéb költség: ${huf(r.otherCosts)})`
      : "Számítási mód: csak az ételeken elért profit (egyéb költségek nélkül)",
    margin, y, 9.5, C.muted
  );
  y -= 24;

  // --- KPI kártyák ---
  const kpis: { label: string; value: string; highlight?: boolean; neg?: boolean }[] = [
    { label: "Tervezett árbevétel", value: huf(r.revenue) },
    { label: "Tervezett költség", value: huf(r.cost) },
    { label: r.target > 0 ? "Cél-profit" : "Tételek", value: r.target > 0 ? huf(r.target) : String(r.dishes.length) },
    { label: "Várható profit", value: huf(r.profit), highlight: true, neg: r.profit < 0 },
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
  y -= cardH + 26;

  // --- Cél teljesülése ---
  if (r.target > 0) {
    const ok = r.gap <= 0;
    const boxH = 56;
    page.drawRectangle({
      x: margin, y: y - boxH, width: contentW, height: boxH,
      color: ok ? C.cream : C.soft, borderColor: ok ? C.line : C.coral, borderWidth: 1,
    });
    write(ok ? "A CÉL TELJESÜL" : "A CÉLHOZ MÉG HIÁNYZIK", margin + 10, y - 18, 8, ok ? C.muted : C.coralDeep, true);
    write(
      ok
        ? `A terv ${huf(-r.gap)}-tal meghaladja a ${huf(r.target)} célt.`
        : `${huf(r.gap)} hiányzik a ${huf(r.target)} célhoz.` +
            (r.scaleFactor ? `  A jelenlegi mix ~${Math.round(r.scaleFactor * 100)}%-ára skálázva jönne ki.` : ""),
      margin + 10, y - 36, 10, C.ink
    );
    y -= boxH + 20;
    if (r.bestLever && r.gap > 0) {
      write(
        `Leggyorsabb emelőkar: „${r.bestLever.name}" (${huf(r.bestLever.unitProfit)}/adag) — ` +
          `ebből ${r.bestLever.extraQty} adaggal több fedezné a hiányt.`,
        margin, y, 9.5, C.muted
      );
      y -= 22;
    }
  }

  // --- Tervezett tételek ---
  const cols: { w: number; align: "left" | "right"; h: string }[] = [
    { w: 200, align: "left", h: "Étel" },
    { w: 60, align: "right", h: "adag" },
    { w: 79, align: "right", h: "Profit/adag" },
    { w: 80, align: "right", h: "Árbevétel" },
    { w: 80, align: "right", h: "Profit" },
  ];
  const colX = (idx: number) => margin + cols.slice(0, idx).reduce((s, c) => s + c.w, 0);
  const drawHead = () => {
    const h = 20;
    page.drawRectangle({ x: margin, y: y - h + 4, width: contentW, height: h, color: C.soft });
    cols.forEach((c, i) => {
      const x = colX(i);
      if (c.align === "left") write(c.h, x + 4, y - h + 10, 8, C.coralDeep, true);
      else writeRight(c.h, x + c.w - 4, y - h + 10, 8, C.coralDeep, true);
    });
    y -= h + 2;
  };

  sectionTitle("Tervezett tételek");
  drawHead();
  const rowH = 18;
  r.dishes.forEach((d, ri) => {
    if (y - rowH < margin + 30) { newPage(); drawHead(); }
    if (ri % 2 === 1) page.drawRectangle({ x: margin, y: y - rowH + 4, width: contentW, height: rowH, color: C.cream });
    const yy = y - rowH + 9;
    write(truncate(d.name, 8.5, cols[0].w - 8), colX(0) + 4, yy, 8.5, C.ink, true);
    writeRight(String(d.qty), colX(1) + cols[1].w - 4, yy, 8.5, C.ink);
    writeRight(num(d.unitProfit), colX(2) + cols[2].w - 4, yy, 8.5, d.unitProfit < 0 ? C.red : C.ink);
    writeRight(num(d.revenue), colX(3) + cols[3].w - 4, yy, 8.5, C.ink);
    writeRight(num(d.profit), colX(4) + cols[4].w - 4, yy, 8.5, d.profit < 0 ? C.red : C.ink);
    page.drawRectangle({ x: margin, y: y - rowH + 3, width: contentW, height: 0.5, color: C.line });
    y -= rowH;
  });
  if (!r.dishes.length) { write("Nincs étlapos tétel a tervben.", margin, y - 8, 9, C.muted); y -= 20; }
  y -= 12;

  // --- Napi menük ---
  if (r.menu.count > 0) {
    if (y < margin + 90) newPage();
    sectionTitle("Napi menük");
    write(
      `${r.menu.count} menü (${r.menu.qty2} db 2 fogásos, ${r.menu.qty3} db 3 fogásos)  ·  bevétel ${huf(r.menu.revenue)}  ·  ` +
        `előállítás ${huf(r.menu.cost)}  ·  profit ${huf(r.menu.profit)}`,
      margin, y, 9, C.muted
    );
    y -= 24;
  }

  // --- AI-értékelés ---
  if (narrative.trim()) {
    if (y < margin + 90) newPage();
    sectionTitle("Értékelés és javaslatok");
    const size = 10, lh = 15;
    for (const line of wrapText(narrative.trim(), size, contentW)) {
      if (y - lh < margin + 24) newPage();
      if (line === "") { y -= lh / 2; continue; }
      write(line, margin, y - lh + 4, size, C.ink);
      y -= lh;
    }
  }

  // --- lábléc ---
  const pages = pdfDoc.getPages();
  pages.forEach((p, i) => {
    p.drawRectangle({ x: margin, y: 34, width: contentW, height: 0.6, color: C.line });
    p.drawText(`Készült a TWINX-szel · ${dateStr} · tervezési célú becslés`, { x: margin, y: 22, size: 8, font, color: C.muted });
    const pn = `${i + 1} / ${pages.length}`;
    p.drawText(pn, { x: pageW - margin - font.widthOfTextAtSize(pn, 8), y: 22, size: 8, font, color: C.muted });
  });

  return await pdfDoc.save();
}

// ---------------------------------------------------------------------------
// BESZÁLLÍTÓ-KERESŐ — TWINX stílusú PDF a megtalált termelőkkel/beszállítókkal.
// A hangsúly a KAPCSOLATFELVÉTELEN van: elérhetőségek + kész megkereső üzenet.
// ---------------------------------------------------------------------------
export async function generateSuppliersPdf(params: {
  query: SupplierQuery;
  result: SupplierResult;
}): Promise<Uint8Array> {
  const { query: q, result } = params;
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(await loadFontBytes());

  const pageW = 595.28, pageH = 841.89;
  const margin = 48;
  const contentW = pageW - margin * 2;
  const dateStr = new Date().toLocaleDateString("hu-HU");

  let page: PDFPage = pdfDoc.addPage([pageW, pageH]);
  let y = pageH;

  const write = (s: string, x: number, yy: number, size: number, color = C.ink, bold = false) => {
    page.drawText(s, { x, y: yy, size, font, color });
    if (bold) page.drawText(s, { x: x + 0.4, y: yy, size, font, color });
  };
  const writeRight = (s: string, xRight: number, yy: number, size: number, color = C.ink, bold = false) => {
    write(s, xRight - font.widthOfTextAtSize(s, size), yy, size, color, bold);
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
  function newPage() {
    page = pdfDoc.addPage([pageW, pageH]);
    y = pageH - margin;
  }
  const sectionTitle = (label: string) => {
    if (y < margin + 90) newPage();
    write(label, margin, y, 13, C.ink, true);
    page.drawRectangle({ x: margin, y: y - 6, width: 42, height: 2.5, color: C.coral });
    y -= 22;
  };
  const paragraph = (t: string, size = 9.5, color = C.ink) => {
    for (const line of wrapText(t, size, contentW)) {
      if (y - 14 < margin + 24) newPage();
      if (line === "") { y -= 7; continue; }
      write(line, margin, y - 10, size, color);
      y -= 14;
    }
  };

  // --- fejléc ---
  const bandH = 84;
  page.drawRectangle({ x: 0, y: pageH - bandH, width: pageW, height: bandH, color: C.coral });
  page.drawRectangle({ x: 0, y: pageH - bandH, width: pageW, height: 4, color: C.coralDeep });
  write("Beszállító-kereső", margin, pageH - 40, 20, C.white, true);
  write("TWINX · Vendéglátás", margin, pageH - 60, 10, C.softWhite);
  writeRight(dateStr, pageW - margin, pageH - 40, 10, C.white);
  y = pageH - bandH - 26;

  const area = q.radius === "orszagos" ? "országosan" : `${q.radius} km-es körzet`;
  write(`Keresett: ${q.what}`, margin, y, 10, C.ink, true);
  y -= 14;
  write(
    `Terület: ${q.county}${q.city ? `, ${q.city}` : ""} (${area})` +
      (volumeLabel(q) ? `    ·    Mennyiség: ${volumeLabel(q)}` : ""),
    margin, y, 9.5, C.muted
  );
  y -= 24;

  // --- Szezonalitás / piaci helyzet ---
  if (result.extras.season || result.extras.market) {
    const boxLines = [result.extras.season, result.extras.market].filter(Boolean) as string[];
    const wrapped = boxLines.flatMap((t) => wrapText(t, 9, contentW - 20));
    const boxH = 16 + wrapped.length * 13;
    page.drawRectangle({ x: margin, y: y - boxH, width: contentW, height: boxH, color: C.soft, borderColor: C.coral, borderWidth: 1 });
    let by = y - 16;
    for (const line of wrapped) { write(line, margin + 10, by, 9, C.ink); by -= 13; }
    y -= boxH + 20;
  }

  // --- Beszállítók ---
  sectionTitle(`Talált beszállítók (${result.suppliers.length})`);

  // Minden sort előre kiszámolunk (szöveg + méret + szín + sormagasság), így a kártya
  // magassága és a kirajzolás UGYANABBÓL az adatból jön — nem tud elcsúszni vagy egymásra futni.
  type CardLine = { t: string; size: number; color: ReturnType<typeof rgb>; bold?: boolean; lh: number };
  const innerW = contentW - 24;

  result.suppliers.forEach((s, i) => {
    const lines: CardLine[] = [];
    for (const t of wrapText(`${i + 1}. ${s.name}`, 11, innerW)) {
      lines.push({ t, size: 11, color: C.coralDeep, bold: true, lh: 15 });
    }
    const loc = [s.location, s.distance].filter(Boolean).join(" · ");
    for (const t of wrapText(loc, 8.5, innerW)) lines.push({ t, size: 8.5, color: C.muted, lh: 11.5 });
    if (s.offering) for (const t of wrapText(s.offering, 9, innerW)) lines.push({ t, size: 9, color: C.ink, lh: 12.5 });
    if (s.why) for (const t of wrapText(`Miért illik: ${s.why}`, 9, innerW)) lines.push({ t, size: 9, color: C.ink, lh: 12.5 });
    for (const c of [
      s.phone ? `Tel.: ${s.phone}` : "",
      s.email ? `E-mail: ${s.email}` : "",
      s.website ? `Web: ${s.website}` : "",
    ].filter(Boolean)) {
      for (const t of wrapText(c, 9, innerW)) lines.push({ t, size: 9, color: C.ink, lh: 12.5 });
    }
    if (s.source) for (const t of wrapText(`Forrás: ${s.source}`, 7.5, innerW)) {
      lines.push({ t, size: 7.5, color: C.muted, lh: 10.5 });
    }

    const padTop = 16, padBottom = 12;
    const cardH = padTop + lines.reduce((sum, l) => sum + l.lh, 0) + padBottom;
    if (y - cardH < margin + 40) newPage();

    page.drawRectangle({ x: margin, y: y - cardH, width: contentW, height: cardH, color: C.cream, borderColor: C.line, borderWidth: 1 });
    let cy = y - padTop;
    for (const l of lines) {
      write(l.t, margin + 12, cy - l.size * 0.15, l.size, l.color, l.bold);
      cy -= l.lh;
    }
    y -= cardH + 12;
  });

  if (!result.suppliers.length) {
    paragraph("Ezekkel a feltételekkel nem találtunk megbízható forrásból igazolható beszállítót. Próbáld tágabb körzettel vagy más beszállító-típussal.", 10, C.muted);
    y -= 10;
  }

  // --- Megkereső üzenet ---
  if (result.extras.outreach) {
    const lines = wrapText(result.extras.outreach, 9.5, innerW);
    const boxH = 18 + lines.length * 13.5 + 12;
    // A cím, a bevezető és a doboz EGYÜTT férjen ki — különben új lapon kezdjük.
    if (y - (boxH + 60) < margin + 40) newPage();
    sectionTitle("Kész megkereső üzenet");
    write("Ezt kimásolhatod és elküldheted a kiválasztott beszállítónak:", margin, y - 10, 9, C.muted);
    y -= 22;

    page.drawRectangle({ x: margin, y: y - boxH, width: contentW, height: boxH, color: C.cream, borderColor: C.line, borderWidth: 1 });
    let oy = y - 18;
    for (const line of lines) {
      if (line === "") { oy -= 7; continue; }
      write(line, margin + 12, oy, 9.5, C.ink);
      oy -= 13.5;
    }
    y -= boxH + 18;
  }

  // --- Tippek ---
  if (result.extras.tips?.length) {
    if (y < margin + 90) newPage();
    sectionTitle("Tárgyalási tippek");
    for (const t of result.extras.tips) paragraph(`•  ${t}`, 9.5);
    y -= 6;
  }

  // --- lábléc ---
  const pages = pdfDoc.getPages();
  pages.forEach((p, i) => {
    p.drawRectangle({ x: margin, y: 34, width: contentW, height: 0.6, color: C.line });
    p.drawText(`Készült a TWINX-szel · ${dateStr} · az elérhetőségeket kérjük ellenőrizni`, { x: margin, y: 22, size: 8, font, color: C.muted });
    const pn = `${i + 1} / ${pages.length}`;
    p.drawText(pn, { x: pageW - margin - font.widthOfTextAtSize(pn, 8), y: 22, size: 8, font, color: C.muted });
  });

  return await pdfDoc.save();
}

// ===========================================================================
// Szakember-kereső PDF (vendéglátás + ingatlan)
// ===========================================================================
export async function generateProfessionalsPdf(params: {
  query: ProfessionalQuery;
  result: ProfessionalResult;
}): Promise<Uint8Array> {
  const { query: q, result } = params;
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(await loadFontBytes());

  const pageW = 595.28, pageH = 841.89;
  const margin = 48;
  const contentW = pageW - margin * 2;
  const dateStr = new Date().toLocaleDateString("hu-HU");
  const industry = q.industry as Industry;
  const industryLabel = industry === "realestate" ? "Ingatlan" : "Vendéglátás";
  const profName =
    professionsFor(industry).find((p) => p.value === q.profession)?.label ??
    (q.professionCustom || professionLabel(industry, q.profession));

  let page: PDFPage = pdfDoc.addPage([pageW, pageH]);
  let y = pageH;

  const write = (s: string, x: number, yy: number, size: number, color = C.ink, bold = false) => {
    page.drawText(s, { x, y: yy, size, font, color });
    if (bold) page.drawText(s, { x: x + 0.4, y: yy, size, font, color });
  };
  const writeRight = (s: string, xRight: number, yy: number, size: number, color = C.ink, bold = false) => {
    write(s, xRight - font.widthOfTextAtSize(s, size), yy, size, color, bold);
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
  function newPage() { page = pdfDoc.addPage([pageW, pageH]); y = pageH - margin; }
  const sectionTitle = (label: string) => {
    if (y < margin + 90) newPage();
    write(label, margin, y, 13, C.ink, true);
    page.drawRectangle({ x: margin, y: y - 6, width: 42, height: 2.5, color: C.coral });
    y -= 22;
  };
  const paragraph = (t: string, size = 9.5, color = C.ink) => {
    for (const line of wrapText(t, size, contentW)) {
      if (y - 14 < margin + 24) newPage();
      if (line === "") { y -= 7; continue; }
      write(line, margin, y - 10, size, color);
      y -= 14;
    }
  };

  const bandH = 84;
  page.drawRectangle({ x: 0, y: pageH - bandH, width: pageW, height: bandH, color: C.coral });
  page.drawRectangle({ x: 0, y: pageH - bandH, width: pageW, height: 4, color: C.coralDeep });
  write("Szakember-kereső", margin, pageH - 40, 20, C.white, true);
  write(`TWINX · ${industryLabel}`, margin, pageH - 60, 10, C.softWhite);
  writeRight(dateStr, pageW - margin, pageH - 40, 10, C.white);
  y = pageH - bandH - 26;

  const area = q.radius === "orszagos" ? "országosan" : `${q.radius} km-es körzet`;
  write(`Keresett szakma: ${profName}`, margin, y, 10, C.ink, true);
  y -= 14;
  write(`Terület: ${q.county}${q.city ? `, ${q.city}` : ""} (${area})`, margin, y, 9.5, C.muted);
  y -= 24;

  if (result.extras.market) {
    const wrapped = wrapText(result.extras.market, 9, contentW - 20);
    const boxH = 16 + wrapped.length * 13;
    page.drawRectangle({ x: margin, y: y - boxH, width: contentW, height: boxH, color: C.soft, borderColor: C.coral, borderWidth: 1 });
    let by = y - 16;
    for (const line of wrapped) { write(line, margin + 10, by, 9, C.ink); by -= 13; }
    y -= boxH + 20;
  }

  sectionTitle(`Talált szakemberek (${result.professionals.length})`);

  type CardLine = { t: string; size: number; color: ReturnType<typeof rgb>; bold?: boolean; lh: number };
  const innerW = contentW - 24;

  result.professionals.forEach((s, i) => {
    const lines: CardLine[] = [];
    for (const t of wrapText(`${i + 1}. ${s.name}`, 11, innerW)) {
      lines.push({ t, size: 11, color: C.coralDeep, bold: true, lh: 15 });
    }
    const meta = [s.role, s.location, s.distance].filter(Boolean).join(" · ");
    for (const t of wrapText(meta, 8.5, innerW)) lines.push({ t, size: 8.5, color: C.muted, lh: 11.5 });
    const meta2 = [
      s.experience ? `Tapasztalat: ${s.experience}` : "",
      s.availability ? `Elérhető: ${s.availability}` : "",
      s.rate ? `Díjazás: ${s.rate}` : "",
    ].filter(Boolean).join("   ·   ");
    if (meta2) for (const t of wrapText(meta2, 8.5, innerW)) lines.push({ t, size: 8.5, color: C.muted, lh: 11.5 });
    if (s.why) for (const t of wrapText(`Miért illik: ${s.why}`, 9, innerW)) lines.push({ t, size: 9, color: C.ink, lh: 12.5 });
    for (const c of [
      s.phone ? `Tel.: ${s.phone}` : "",
      s.email ? `E-mail: ${s.email}` : "",
      s.website ? `Web: ${s.website}` : "",
    ].filter(Boolean)) {
      for (const t of wrapText(c, 9, innerW)) lines.push({ t, size: 9, color: C.ink, lh: 12.5 });
    }
    if (s.source) for (const t of wrapText(`Forrás: ${s.source}`, 7.5, innerW)) {
      lines.push({ t, size: 7.5, color: C.muted, lh: 10.5 });
    }

    const padTop = 16, padBottom = 12;
    const cardH = padTop + lines.reduce((sum, l) => sum + l.lh, 0) + padBottom;
    if (y - cardH < margin + 40) newPage();

    page.drawRectangle({ x: margin, y: y - cardH, width: contentW, height: cardH, color: C.cream, borderColor: C.line, borderWidth: 1 });
    let cy = y - padTop;
    for (const l of lines) {
      write(l.t, margin + 12, cy - l.size * 0.15, l.size, l.color, l.bold);
      cy -= l.lh;
    }
    y -= cardH + 12;
  });

  if (!result.professionals.length) {
    paragraph("Ezekkel a feltételekkel nem találtunk igazolható szakembert. Próbáld tágabb körzettel vagy kevesebb szűrővel.", 10, C.muted);
    y -= 10;
  }

  if (result.extras.outreach) {
    const lines = wrapText(result.extras.outreach, 9.5, innerW);
    const boxH = 18 + lines.length * 13.5 + 12;
    if (y - (boxH + 60) < margin + 40) newPage();
    sectionTitle("Kész megkereső üzenet");
    write("Ezt kimásolhatod és elküldheted a kiválasztott szakembernek:", margin, y - 10, 9, C.muted);
    y -= 22;

    page.drawRectangle({ x: margin, y: y - boxH, width: contentW, height: boxH, color: C.cream, borderColor: C.line, borderWidth: 1 });
    let oy = y - 18;
    for (const line of lines) {
      if (line === "") { oy -= 7; continue; }
      write(line, margin + 12, oy, 9.5, C.ink);
      oy -= 13.5;
    }
    y -= boxH + 18;
  }

  if (result.extras.tips?.length) {
    if (y < margin + 90) newPage();
    sectionTitle("Kiválasztási / tárgyalási tippek");
    for (const t of result.extras.tips) paragraph(`•  ${t}`, 9.5);
    y -= 6;
  }

  const pages = pdfDoc.getPages();
  pages.forEach((p, i) => {
    p.drawRectangle({ x: margin, y: 34, width: contentW, height: 0.6, color: C.line });
    p.drawText(`Készült a TWINX-szel · ${dateStr} · az elérhetőségeket kérjük ellenőrizni`, { x: margin, y: 22, size: 8, font, color: C.muted });
    const pn = `${i + 1} / ${pages.length}`;
    p.drawText(pn, { x: pageW - margin - font.widthOfTextAtSize(pn, 8), y: 22, size: 8, font, color: C.muted });
  });

  return await pdfDoc.save();
}
