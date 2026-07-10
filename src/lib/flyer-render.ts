// Hirdetés renderelés: HTML -> PDF (A4) vagy PNG (social méretek) headless Chromiummal.
// A `puppeteer` csomag szükséges (npm install puppeteer).
import type { FlyerFormat } from "@/lib/flyer";

async function loadPuppeteer(): Promise<any> {
  try {
    // @ts-ignore - a puppeteer csomagot lokálisan kell telepíteni
    const mod = await import("puppeteer");
    return (mod as { default?: unknown }).default ?? mod;
  } catch {
    throw new Error("A hirdetés-generáláshoz telepíteni kell a puppeteer csomagot (npm install puppeteer).");
  }
}

export async function renderFlyer(
  html: string,
  format: FlyerFormat
): Promise<{ bytes: Uint8Array; ext: string; contentType: string }> {
  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: format.width, height: format.height, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0" });

    if (format.kind === "pdf") {
      const pdf = await page.pdf({
        width: `${format.width}px`,
        height: `${format.height}px`,
        printBackground: true,
        pageRanges: "1",
      });
      return { bytes: new Uint8Array(pdf), ext: "pdf", contentType: "application/pdf" };
    }

    const png = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: format.width, height: format.height },
    });
    return { bytes: new Uint8Array(png), ext: "png", contentType: "image/png" };
  } finally {
    await browser.close();
  }
}
