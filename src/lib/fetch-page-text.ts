// Szerveroldali oldal-letöltés + szöveg-kinyerés. Egy nyilvános URL HTML-jéből
// kiszedi az olvasható szöveget — ez megbízhatóbb, mint a keresőt kérni, hogy
// "nyissa meg" az oldalt. Hibánál üres stringet ad, hogy a hívó vissza tudjon esni.
// Használja: a Szöveg-ellenőrző és a Facebook hirdetésszöveg-generátor is.

const MAX_TEXT = 20000;

async function fetchOnce(url: string, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "hu-HU,hu;q=0.9,en-US;q=0.8,en;q=0.7",
        "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"macOS"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Upgrade-Insecure-Requests": "1",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return "";
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html") && !ct.includes("text/plain")) return "";

    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<\/(p|div|li|br|h[1-6]|tr|section|article)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/[ \t ]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^[ \t]+|[ \t]+$/gm, "")
      .trim();
    return text.slice(0, MAX_TEXT);
  } catch {
    clearTimeout(timer);
    return "";
  }
}

/** Több próbálkozás, növekvő időkerettel — a lassabb oldalaknak több idő. */
export async function fetchPageText(url: string): Promise<string> {
  for (const ms of [20000, 30000]) {
    const t = await fetchOnce(url, ms);
    if (t.length >= 200) return t;
  }
  return "";
}
