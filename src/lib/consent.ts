// Süti-hozzájárulás (analitika) — a választást a böngésző localStorage-e őrzi.
// "granted" = elfogadta, "denied" = elutasította, null = még nem döntött (ilyenkor jön fel a sáv).
// A GA alapból tiltott állapotban indul (lásd GoogleAnalytics.tsx); elfogadáskor itt frissítjük.

export type ConsentChoice = "granted" | "denied";

export const CONSENT_KEY = "twx-consent-analytics";
/** Egyedi esemény: a lábléc „Süti-beállítások” linkje ezzel nyitja újra a sávot. */
export const OPEN_CONSENT_EVENT = "open-cookie-settings";

export function getConsent(): ConsentChoice | null {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null; // pl. letiltott tárhely — ilyenkor minden látogatásnál rákérdezünk
  }
}

export function setConsent(choice: ConsentChoice) {
  try {
    window.localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    /* tárhely nem elérhető — a döntés csak erre a látogatásra él */
  }
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  // Csak az analitikai tárolást engedjük; hirdetési sütit nem használunk, az marad tiltva.
  w.gtag?.("consent", "update", { analytics_storage: choice });
}

export function openConsentSettings() {
  window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
}
