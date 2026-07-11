// TWINX jelentés-PDF renderelés: HTML sablon -> PDF headless Chromiummal (puppeteer).
// FONTOS: a `puppeteer` csomagot lokálisan telepíteni kell: `npm install puppeteer`.
// (Chromiumot tölt le; élesben is szükséges egy Chromium a szerveren.)
import { buildReportHtml, reportFooterHtml } from "@/lib/report-template";
import { generateValuationPdf } from "@/lib/pdf";
import { launchBrowser } from "@/lib/browser";

export type ReportParams = { title: string; meta: string[]; body: string };

// HTML -> PDF (A4) headless Chromiummal (lokál: puppeteer, Vercel: @sparticuz/chromium).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function renderHtmlToPdf(html: string, browser: any): Promise<Uint8Array> {
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
  try {
    const browser = await launchBrowser();
    const html = buildReportHtml(params);
    return await renderHtmlToPdf(html, browser);
  } catch {
    // Ha nincs elérhető Chromium -> visszaesünk a korábbi (egyszerű) PDF-motorra.
    return generateValuationPdf(params);
  }
}
