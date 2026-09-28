// Google Analytics 4 — közös segédfüggvények (csak kliensoldalon hívjuk).
// A mérőazonosító a Vercel környezeti változójából jön: NEXT_PUBLIC_GA_ID (pl. G-XXXXXXX).
// Ha nincs beállítva (pl. helyi fejlesztésnél), semmi nem töltődik be és semmi nem mér.

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";

/** Ezeken az útvonalakon NEM mérünk: belső, bejelentkezett felületek. */
const PRIVATE_PREFIXES = ["/dashboard", "/admin", "/sales", "/auth", "/style"];

export function isTrackedPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return !PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

type Gtag = (...args: unknown[]) => void;

function gtag(): Gtag | null {
  if (typeof window === "undefined" || !GA_ID) return null;
  const w = window as unknown as { gtag?: Gtag };
  return typeof w.gtag === "function" ? w.gtag : null;
}

/** Oldalmegtekintés — a GoogleAnalytics komponens hívja útvonalváltáskor. */
export function gaPageView(url: string) {
  gtag()?.("event", "page_view", {
    page_location: window.location.origin + url,
    page_path: url,
    page_title: document.title,
  });
}

/** Egyedi esemény (pl. sign_up, cta_click). A paraméterek ne tartalmazzanak személyes adatot. */
export function gaEvent(name: string, params: Record<string, string | number | boolean> = {}) {
  gtag()?.("event", name, params);
}
