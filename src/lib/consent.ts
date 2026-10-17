// Süti-hozzájárulás — két külön kategória, a választást a böngésző localStorage-e őrzi:
//   • statisztika (Google Analytics) — a régi kulcson, így a korábbi döntések megmaradnak;
//   • marketing (Meta / Facebook Pixel) — új kulcs (2026-10-17).
// "granted" = elfogadta, "denied" = elutasította, null = még nem döntött (ilyenkor jön fel a sáv).
// A GA és a Pixel alapból tiltott állapotban indul (GoogleAnalytics.tsx, MetaPixel.tsx); a döntéskor itt frissítjük őket.

export type ConsentChoice = "granted" | "denied";
export type ConsentState = { analytics: ConsentChoice | null; marketing: ConsentChoice | null };

export const CONSENT_KEY = "twx-consent-analytics";
export const MARKETING_CONSENT_KEY = "twx-consent-marketing";
/** Egyedi esemény: a lábléc „Süti-beállítások” linkje ezzel nyitja újra a sávot. */
export const OPEN_CONSENT_EVENT = "open-cookie-settings";

function read(key: string): ConsentChoice | null {
  try {
    const v = window.localStorage.getItem(key);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null; // pl. letiltott tárhely — ilyenkor minden látogatásnál rákérdezünk
  }
}

/** A statisztikai (GA) hozzájárulás. */
export function getConsent(): ConsentChoice | null {
  return read(CONSENT_KEY);
}

export function getConsentState(): ConsentState {
  return { analytics: read(CONSENT_KEY), marketing: read(MARKETING_CONSENT_KEY) };
}

/** Elfogadta-e a marketing-sütiket (Meta Pixel, Conversions API)? */
export function hasMarketingConsent(): boolean {
  return read(MARKETING_CONSENT_KEY) === "granted";
}

export function setConsentState(state: { analytics: ConsentChoice; marketing: ConsentChoice }) {
  try {
    window.localStorage.setItem(CONSENT_KEY, state.analytics);
    window.localStorage.setItem(MARKETING_CONSENT_KEY, state.marketing);
  } catch {
    /* tárhely nem elérhető — a döntés csak erre a látogatásra él */
  }
  const w = window as unknown as { gtag?: (...args: unknown[]) => void; fbq?: (...args: unknown[]) => void };
  // GA: csak az analitikai tárolást engedjük; a Google hirdetési tárolása (ad_storage) marad tiltva.
  w.gtag?.("consent", "update", { analytics_storage: state.analytics });
  // Meta Pixel: csak marketing-hozzájárulás után küldhet adatot.
  w.fbq?.("consent", state.marketing === "granted" ? "grant" : "revoke");
}

export function openConsentSettings() {
  window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
}
