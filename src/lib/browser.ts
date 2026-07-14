// Headless Chromium indítása környezet szerint.
// - Vercel / serverless: puppeteer-core + @sparticuz/chromium (méret-limit miatt).
// - Lokális fejlesztés: a teljes `puppeteer` csomag (saját Chromiummal).
// A hívó a visszakapott browser-t használja, majd browser.close()-t hív.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBrowser = any;

function isServerless(): boolean {
  return !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_VERSION;
}

export async function launchBrowser(): Promise<AnyBrowser> {
  if (isServerless()) {
    // @ts-ignore - Vercelen települ (package.json dependency)
    const chromiumMod = await import("@sparticuz/chromium");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chromium: any = (chromiumMod as { default?: unknown }).default ?? chromiumMod;
    // @ts-ignore - Vercelen települ (package.json dependency)
    const coreMod = await import("puppeteer-core");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const puppeteer: any = (coreMod as { default?: unknown }).default ?? coreMod;

    // Serverless-ajánlás: grafikus mód kikapcsolása (kisebb lábnyom, kevesebb lib-függés).
    if (typeof chromium.setGraphicsMode !== "undefined") chromium.setGraphicsMode = false;

    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  // Lokális: teljes puppeteer (saját Chromiummal).
  // @ts-ignore - lokálisan telepített csomag
  const mod = await import("puppeteer");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const puppeteer: any = (mod as { default?: unknown }).default ?? mod;
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}
