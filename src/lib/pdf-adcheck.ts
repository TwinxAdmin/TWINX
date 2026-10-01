// Hirdetés-ellenőrzés — nyomtatható, továbbküldhető riport (A4, pdf-lib).
//
// A TARTALOM változatlan (pontszám, Miben jó / Miben rossz / Mit kell javítani,
// javított szöveg) — ez a fájl csak a MEGJELENÉSÉRT felel:
//   1. oldal: TWINX fejléc, az ingatlan címe, pontszám-kártya (gyűrű + értékelés),
//      erősségek és hibák két oszlopban, számozott teendők.
//   2. oldaltól: a javított hirdetésszöveg formázva (címsorok, felsorolás,
//      kitöltendő [ … ] mezők kiemelve).
//   Minden oldalon: lábléc oldalszámmal; a további oldalakon kis fejléc.
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { AdCheckResult } from "@/lib/adcheck";
import { cleanInline, fitLine, loadBrandFonts, shortUrl, wrapLines } from "@/lib/pdf-kit";

const hex = (h: string): RGB => {
  const n = parseInt(h.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

const K = {
  ink: hex("#1C1815"),
  body: hex("#3A332D"),
  muted: hex("#7A7067"),
  line: hex("#E8E1D6"),
  cream: hex("#F7F3EC"),
  card: hex("#FDFBF6"),
  coral: hex("#EF7A5A"),
  coralDeep: hex("#C4512F"),
  coralSoft: hex("#FCE9E2"),
  green: hex("#2F8F5B"),
  greenSoft: hex("#E6F3EB"),
  red: hex("#C2412D"),
  redSoft: hex("#FBE7E3"),
  amber: hex("#9A6412"),
  amberSoft: hex("#FBF1DC"),
  white: rgb(1, 1, 1),
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 54;                     // margó
const CW = PAGE_W - M * 2;        // tartalomszélesség
const FOOT = 58;                  // a lábléc fölötti alsó határ

/** Pontszám → szín + szöveges értékelés. */
function verdict(score: number): { color: RGB; soft: RGB; label: string } {
  if (score >= 80) return { color: K.green, soft: K.greenSoft, label: "Erős hirdetés, kisebb finomításokkal" };
  if (score >= 60) return { color: K.coralDeep, soft: K.coralSoft, label: "Jó alap, javítandó részletekkel" };
  if (score >= 40) return { color: K.amber, soft: K.amberSoft, label: "Jelentős javításra szorul" };
  return { color: K.red, soft: K.redSoft, label: "Átírás javasolt" };
}

/** Lekerekített téglalap SVG-útvonala (bal felső sarokból, lefelé növő y). */
function roundRectPath(w: number, h: number, r: number): string {
  const rr = Math.min(r, w / 2, h / 2);
  return `M ${rr} 0 H ${w - rr} A ${rr} ${rr} 0 0 1 ${w} ${rr} V ${h - rr} A ${rr} ${rr} 0 0 1 ${w - rr} ${h}` +
    ` H ${rr} A ${rr} ${rr} 0 0 1 0 ${h - rr} V ${rr} A ${rr} ${rr} 0 0 1 ${rr} 0 Z`;
}

export async function generateAdCheckPdf(params: {
  result: AdCheckResult;
  sourceUrl: string | null;
  toneLabel?: string;
}): Promise<Uint8Array> {
  const { result, sourceUrl } = params;
  const pdf = await PDFDocument.create();
  const F = await loadBrandFonts(pdf);

  const title = cleanInline(result.title) || "Ingatlanhirdetés";
  const dateStr = new Date().toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" });

  pdf.setTitle(`Hirdetés-ellenőrzés – ${title}`);
  pdf.setSubject("Ingatlanhirdetés szakmai ellenőrzése");
  pdf.setAuthor("TWINX AI Portál");
  pdf.setCreator("TWINX AI Portál · twinx.hu");
  pdf.setLanguage("hu-HU");

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H;

  // ---- rajzoló segédek -------------------------------------------------------
  const text = (s: string, x: number, yy: number, font: PDFFont, size: number, color: RGB = K.ink) =>
    page.drawText(s, { x, y: yy, size, font, color });
  const textRight = (s: string, xr: number, yy: number, font: PDFFont, size: number, color: RGB = K.ink) =>
    text(s, xr - font.widthOfTextAtSize(s, size), yy, font, size, color);
  /** Ritkított nagybetűs címke (pdf-lib-ben nincs betűköz → karakterenként). */
  const tracked = (s: string, x: number, yy: number, font: PDFFont, size: number, color: RGB, track = 1.2) => {
    let cx = x;
    for (const ch of Array.from(s.toUpperCase())) {
      page.drawText(ch, { x: cx, y: yy, size, font, color });
      cx += font.widthOfTextAtSize(ch, size) + track;
    }
    return cx - x;
  };
  const trackedWidth = (s: string, font: PDFFont, size: number, track = 1.2) =>
    Array.from(s.toUpperCase()).reduce((w, ch) => w + font.widthOfTextAtSize(ch, size) + track, 0);
  const box = (x: number, top: number, w: number, h: number, fill: RGB, border?: RGB, r = 10) =>
    page.drawSvgPath(roundRectPath(w, h, r), {
      x, y: top, color: fill, borderColor: border, borderWidth: border ? 0.8 : 0,
    });
  const circle = (cx: number, cy: number, r: number, fill: RGB) =>
    page.drawCircle({ x: cx, y: cy, size: r, color: fill });
  const wordmark = (x: number, yy: number, size: number) => {
    text("TWIN", x, yy, F.head, size, K.ink);
    text("X", x + F.head.widthOfTextAtSize("TWIN", size), yy, F.head, size, K.coral);
  };

  /** Kis fejléc a 2. oldaltól. */
  const runningHeader = () => {
    wordmark(M, PAGE_H - 40, 11);
    const label = fitLine(F.body, `Hirdetés-ellenőrzés · ${title}`, 8.5, CW - 80);
    textRight(label, PAGE_W - M, PAGE_H - 39, F.body, 8.5, K.muted);
    page.drawRectangle({ x: M, y: PAGE_H - 50, width: CW, height: 0.6, color: K.line });
    y = PAGE_H - 74;
  };
  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    runningHeader();
  };
  const ensure = (h: number) => { if (y - h < FOOT) newPage(); };

  // =========================================================================
  // 1. OLDAL — fejléc
  // =========================================================================
  page.drawRectangle({ x: 0, y: PAGE_H - 6, width: PAGE_W, height: 6, color: K.coral });
  wordmark(M, PAGE_H - 50, 18);
  text("AI eszköztár ingatlanosoknak", M, PAGE_H - 64, F.body, 8.5, K.muted);
  const docLabel = "Hirdetés-ellenőrzés";
  tracked(docLabel, PAGE_W - M - trackedWidth(docLabel, F.headMed, 8.5), PAGE_H - 47, F.headMed, 8.5, K.coralDeep);
  textRight(dateStr, PAGE_W - M, PAGE_H - 62, F.body, 9, K.muted);
  page.drawRectangle({ x: M, y: PAGE_H - 80, width: CW, height: 0.8, color: K.line });
  y = PAGE_H - 108;

  // ---- az elemzett hirdetés ----
  tracked("Elemzett hirdetés", M, y, F.headMed, 8, K.muted);
  y -= 24;
  for (const line of wrapLines(F.head, title, 19, CW).slice(0, 3)) {
    text(line, M, y, F.head, 19, K.ink);
    y -= 25;
  }
  if (sourceUrl) {
    const src = fitLine(F.body, shortUrl(sourceUrl), 8.5, CW - 44);
    text("Forrás:", M, y + 4, F.bold, 8.5, K.muted);
    text(src, M + F.bold.widthOfTextAtSize("Forrás: ", 8.5), y + 4, F.body, 8.5, K.muted);
    y -= 14;
  }
  y -= 12;

  // ---- pontszám-kártya ----
  const score = Math.max(0, Math.min(100, Math.round(Number(result.score) || 0)));
  const v = verdict(score);
  const cardH = 118;
  box(M, y, CW, cardH, K.card, K.line, 14);

  // gyűrű
  const gcx = M + 74, gcy = y - cardH / 2, gr = 38;
  page.drawCircle({ x: gcx, y: gcy, size: gr, borderColor: K.line, borderWidth: 9 });
  if (score > 0) {
    const a = (Math.min(score, 99.9) / 100) * Math.PI * 2;
    const ex = Math.sin(a) * gr, ey = -Math.cos(a) * gr; // SVG-ben a y lefelé nő
    const large = a > Math.PI ? 1 : 0;
    page.drawSvgPath(`M 0 ${-gr} A ${gr} ${gr} 0 ${large} 1 ${ex} ${ey}`, {
      x: gcx, y: gcy, borderColor: v.color, borderWidth: 9, borderLineCap: 1,
    });
  }
  const sTxt = `${score}%`;
  text(sTxt, gcx - F.head.widthOfTextAtSize(sTxt, 21) / 2, gcy - 7, F.head, 21, K.ink);

  // értékelés
  const vx = M + 136;
  const counts: [string, number, RGB][] = [
    ["erősség", result.good.length, K.green],
    ["probléma", result.bad.length, K.red],
    ["teendő", result.fixes.length, K.coralDeep],
  ];
  const colW = 104;
  const textW = CW - (vx - M) - colW - 18;
  tracked("Megfelelőség", vx, y - 30, F.headMed, 8, K.muted);
  let vy = y - 50;
  for (const l of wrapLines(F.head, v.label, 14, textW).slice(0, 2)) {
    text(l, vx, vy, F.head, 14, K.ink);
    vy -= 18;
  }
  for (const l of wrapLines(F.body, "A hirdetés szakmai összképe: mennyire teljes, pontos, áttekinthető és meggyőző a vevő szemével.", 9, textW).slice(0, 3)) {
    text(l, vx, vy - 2, F.body, 9, K.muted);
    vy -= 12.5;
  }
  // számlálók jobb oldalt
  const cx0 = M + CW - colW - 6;
  page.drawRectangle({ x: cx0 - 14, y: y - cardH + 22, width: 0.8, height: cardH - 44, color: K.line });
  let cy = y - 38;
  for (const [label, n, col] of counts) {
    circle(cx0 + 4, cy + 3.5, 3.5, col);
    text(String(n), cx0 + 14, cy, F.head, 12, K.ink);
    text(label, cx0 + 14 + F.head.widthOfTextAtSize(String(n), 12) + 5, cy + 0.5, F.body, 9.5, K.muted);
    cy -= 24;
  }
  y -= cardH + 26;

  // =========================================================================
  // Erősségek + problémák — két oszlop
  // =========================================================================
  const gap = 16;
  const halfW = (CW - gap) / 2;
  const itemSize = 10, itemLh = 14.5, pad = 16;
  const listLines = (items: string[], w: number) =>
    items.map((t) => wrapLines(F.body, cleanInline(t), itemSize, w - pad * 2 - 14));
  const goodL = listLines(result.good, halfW);
  const badL = listLines(result.bad, halfW);
  const colHeight = (ls: string[][]) =>
    48 + ls.reduce((h, l) => h + l.length * itemLh + 8, 0) + (ls.length ? 6 : 18);

  const drawColumn = (x: number, top: number, h: number, label: string, col: RGB, soft: RGB,
    icon: "check" | "cross", ls: string[][]) => {
    box(x, top, halfW, h, K.card, K.line, 12);
    // fejsáv
    circle(x + pad + 9, top - 24, 9, soft);
    if (icon === "check") {
      page.drawSvgPath("M -4 0 L -1 3 L 4.5 -3", { x: x + pad + 9, y: top - 24, borderColor: col, borderWidth: 1.8, borderLineCap: 1 });
    } else {
      page.drawSvgPath("M -3.5 -3.5 L 3.5 3.5 M 3.5 -3.5 L -3.5 3.5", { x: x + pad + 9, y: top - 24, borderColor: col, borderWidth: 1.8, borderLineCap: 1 });
    }
    text(label, x + pad + 26, top - 28.5, F.head, 11.5, K.ink);
    let iy = top - 54;
    if (!ls.length) { text("Nincs megjegyzés.", x + pad, iy, F.body, 9.5, K.muted); return; }
    for (const lines of ls) {
      circle(x + pad + 3, iy + 3.4, 2.6, col);
      for (const l of lines) {
        text(l, x + pad + 14, iy, F.body, itemSize, K.body);
        iy -= itemLh;
      }
      iy -= 8;
    }
  };

  const twoH = Math.max(colHeight(goodL), colHeight(badL));
  ensure(twoH);
  drawColumn(M, y, twoH, "Miben jó", K.green, K.greenSoft, "check", goodL);
  drawColumn(M + halfW + gap, y, twoH, "Miben rossz", K.red, K.redSoft, "cross", badL);
  y -= twoH + 22;

  // =========================================================================
  // Mit kell javítani — számozott lépések
  // =========================================================================
  if (result.fixes.length) {
    const fixL = result.fixes.map((t) => wrapLines(F.body, cleanInline(t), 10.5, CW - 34));
    ensure(40 + fixL[0].length * 15.5);
    tracked("Teendők", M, y, F.headMed, 8, K.coralDeep);
    y -= 20;
    text("Mit kell javítani", M, y, F.head, 14, K.ink);
    y -= 22;
    fixL.forEach((lines, i) => {
      ensure(lines.length * 15.5 + 6);
      circle(M + 9, y + 3.5, 9, K.coral);
      const n = String(i + 1);
      text(n, M + 9 - F.head.widthOfTextAtSize(n, 9.5) / 2, y, F.head, 9.5, K.white);
      for (const l of lines) {
        text(l, M + 28, y, F.body, 10.5, K.body);
        y -= 15.5;
      }
      y -= 9;
    });
  }

  const rewritten = String(result.rewritten ?? "").replace(/\r\n?/g, "\n").trim();

  // ---- „A riportról" doboz az 1. oldal alján (ha marad hely) ----
  // Ha az elemzés szakszót használ (CTA), itt egy mondatban megmagyarázzuk.
  const usesCta = [...result.good, ...result.bad, ...result.fixes].some((t) => /\bCTA\b/i.test(t));
  const ctaNote = "CTA (call to action) = cselekvésre ösztönzés: a hirdetés zárása, amely megmondja az érdeklődőnek, mit tegyen — hívjon, írjon vagy foglaljon időpontot megtekintésre.";
  {
    const about = rewritten
      ? "Az elemzést a TWINX hirdetés-ellenőrzője készítette a megadott hirdetés alapján. A javaslatok szerint átírt, közlésre kész szöveg a következő oldalon található — közzététel előtt ellenőrizd az adatokat."
      : "Az elemzést a TWINX hirdetés-ellenőrzője készítette a megadott hirdetés alapján. Közzététel előtt ellenőrizd az adatokat.";
    const lines = wrapLines(F.body, about, 9, CW - 36);
    const noteLines = usesCta ? wrapLines(F.body, ctaNote, 9, CW - 36) : [];
    const h = 30 + lines.length * 12.5 + (noteLines.length ? 8 + noteLines.length * 12.5 : 0);
    const top = FOOT + 8 + h;
    if (page === pdf.getPages()[0] && y - 16 > top) {
      box(M, top, CW, h, K.cream, undefined, 10);
      tracked("A riportról", M + 18, top - 18, F.headMed, 7.5, K.muted);
      let ay = top - 32;
      for (const l of lines) { text(l, M + 18, ay, F.body, 9, K.body); ay -= 12.5; }
      if (noteLines.length) {
        ay -= 8;
        for (const l of noteLines) { text(l, M + 18, ay, F.body, 9, K.muted); ay -= 12.5; }
      }
    } else if (noteLines.length) {
      // Nincs hely a dobozra az 1. oldalon → a magyarázat az elemzés végére kerül.
      ensure(noteLines.length * 12.5 + 10);
      y -= 4;
      for (const l of noteLines) { text(l, M, y, F.body, 9, K.muted); y -= 12.5; }
      y -= 10;
    }
  }

  // =========================================================================
  // 2. OLDALTÓL — javított hirdetésszöveg
  // =========================================================================
  if (rewritten) {
    // Az 1. oldal után külön lapon kezdődik (nyomtatva leválasztható); ha az
    // elemzés már átfolyt egy további oldalra, és azon bőven van hely, ott folytatjuk.
    const onFirst = page === pdf.getPages()[0];
    if (onFirst || y - FOOT < 300) newPage();
    else { page.drawRectangle({ x: M, y: y + 4, width: CW, height: 0.6, color: K.line }); y -= 30; }
    tracked("Javított hirdetésszöveg", M, y, F.headMed, 8, K.coralDeep);
    y -= 22;
    text("Közlésre kész változat", M, y, F.head, 17, K.ink);
    y -= 18;
    const hasPlaceholders = /\[[^\]\d][^\]]*\]/.test(rewritten);
    const note = hasPlaceholders
      ? "A fenti javaslatok alapján átírt szöveg. A sárgával jelölt [ … ] részeket közlés előtt töltsd ki pontos adattal."
      : "A fenti javaslatok alapján átírt szöveg — változtatás nélkül bemásolható a hirdetési felületre.";
    for (const l of wrapLines(F.body, note, 9.5, CW)) { text(l, M, y, F.body, 9.5, K.muted); y -= 13; }
    y -= 14;

    const IND = 16;            // a bal oldali vezetővonal utáni behúzás
    const TW = CW - IND;
    /** Bal oldali, oldalakon átívelő vezetővonal az adott sor mellé. */
    const rule = (h: number) =>
      page.drawRectangle({ x: M, y: y - h + 11, width: 2, height: h, color: K.coralSoft });

    const isPlaceholderLine = (s: string) => /^\[[^\]]+\]$/.test(s.trim());
    let first = true;
    for (const raw of rewritten.split("\n")) {
      const t = raw.trim();
      if (!t) { if (!first) { ensure(8); rule(8); y -= 8; } continue; }

      const h1 = /^#\s+(.*)$/.exec(t);
      const h2 = /^#{2,6}\s+(.*)$/.exec(t);
      const bullet = /^[-*•]\s+(.*)$/.exec(t);

      if (h1) {
        const lines = wrapLines(F.head, cleanInline(h1[1]), 14, TW);
        ensure(lines.length * 19 + 6);
        for (const l of lines) { rule(19); text(l, M + IND, y, F.head, 14, K.ink); y -= 19; }
        rule(6); y -= 6;
      } else if (h2) {
        const lines = wrapLines(F.headMed, cleanInline(h2[1]), 11, TW);
        if (!first) { ensure(10 + lines.length * 16 + 16); rule(10); y -= 10; }
        for (const l of lines) { rule(16); text(l, M + IND, y, F.headMed, 11, K.coralDeep); y -= 16; }
        rule(2); y -= 2;
      } else if (bullet) {
        const lines = wrapLines(F.body, cleanInline(bullet[1]), 10.5, TW - 14);
        ensure(lines.length * 15);
        lines.forEach((l, i) => {
          rule(15);
          if (i === 0) circle(M + IND + 2.5, y + 3.6, 2, K.coral);
          text(l, M + IND + 12, y, F.body, 10.5, K.body);
          y -= 15;
        });
      } else if (isPlaceholderLine(t)) {
        const s = cleanInline(t);
        const w = Math.min(F.body.widthOfTextAtSize(s, 9.5) + 14, TW);
        ensure(20);
        rule(20);
        box(M + IND, y + 13, w, 17, K.amberSoft, undefined, 4);
        text(fitLine(F.body, s, 9.5, TW - 14), M + IND + 7, y + 1, F.body, 9.5, K.amber);
        y -= 20;
      } else {
        const lines = wrapLines(F.body, cleanInline(t), 10.5, TW);
        for (const l of lines) { ensure(15.5); rule(15.5); text(l, M + IND, y, F.body, 10.5, K.body); y -= 15.5; }
      }
      first = false;
    }
  }

  // =========================================================================
  // Lábléc minden oldalra
  // =========================================================================
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawRectangle({ x: M, y: 40, width: CW, height: 0.6, color: K.line });
    p.drawText("Készült a TWINX AI Portállal · twinx.hu", { x: M, y: 26, size: 8, font: F.body, color: K.muted });
    const pn = `${i + 1} / ${pages.length}`;
    p.drawText(pn, { x: PAGE_W - M - F.body.widthOfTextAtSize(pn, 8), y: 26, size: 8, font: F.body, color: K.muted });
  });

  return pdf.save();
}
