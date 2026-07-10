// TWINX jelentés-PDF renderelés: HTML sablon -> PDF headless Chromiummal (puppeteer).
// FONTOS: a `puppeteer` csomagot lokálisan telepíteni kell: `npm install puppeteer`.
// (Chromiumot tölt le; élesben is szükséges egy Chromium a szerveren.)
import { buildReportHtml, reportFooterHtml } from "@/lib/report-template";
import { generateValuationPdf } from "@/lib/pdf";

export type ReportParams = { title: string; meta: string[]; body: string };

// Puppeteer betöltése; ha nincs telepítve, null-t adunk vissza (fallback a régi PDF-re).
async function loadPuppeteer(): Promise<unknown | null> {
  try {
    // @ts-ignore - a puppeteer csomagot lokálisan kell telepíteni (npm install puppeteer)
    const mod = await import("puppeteer");
    return (mod as { default?: unknown }).default ?? mod;
  } catch {
    return null;
  }
}

// HTML -> PDF (A4).
async function renderHtmlToPdf(html: string, puppeteer: any): Promise<Uint8Array> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: reportFooterHtml(),
      margin: { top: "0mm", bottom: "20mm", left: "0mm", right: "0mm" },
    });
    return new Uint8Array(pdf);
  } finally {
    await browser.close();
  }
}

export async function generateReportPdf(params: ReportParams): Promise<Uint8Array> {
  const puppeteer = await loadPuppeteer();
  if (!puppeteer) {
    // Puppeteer nincs telepítve -> visszaesünk a korábbi (egyszerű) PDF-motorra.
    return generateValuationPdf(params);
  }
  const html = buildReportHtml(params);
  return renderHtmlToPdf(html, puppeteer);
}
