// Hirdetés renderelés: HTML -> PDF (A4) vagy PNG (social méretek) headless Chromiummal.
// A `puppeteer` csomag szükséges (npm install puppeteer).
import type { FlyerFormat } from "@/lib/flyer";
import { launchBrowser } from "@/lib/browser";

export async function renderFlyer(
  html: string,
  format: FlyerFormat
): Promise<{ bytes: Uint8Array; ext: string; contentType: string }> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: format.width, height: format.height, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0" });

    // Fit-to-page: ha a tartalom magasabb a lapnál, arányosan lekicsinyítjük,
    // hogy semmi (arculat/lábléc) ne vágódjon le. Vízszintesen középre igazítjuk.
    await page.evaluate((targetH: number) => {
      const el = document.querySelector(".flyer") as HTMLElement | null;
      if (!el) return;
      const natural = el.scrollHeight;
      if (natural > targetH) {
        const scale = targetH / natural;
        const offset = (el.offsetWidth - el.offsetWidth * scale) / 2;
        el.style.transformOrigin = "top left";
        el.style.transform = `translateX(${offset}px) scale(${scale})`;
      }
    }, format.height);

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
