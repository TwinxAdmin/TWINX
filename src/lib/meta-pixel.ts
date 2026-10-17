// Meta (Facebook) Pixel — közös segédfüggvények (csak kliensoldalon hívjuk).
// A Pixel csak a nyilvános oldalakon töltődik be (MetaPixel.tsx), és csak marketing-süti hozzájárulás után küld adatot
// (alapból `consent revoke`). A regisztrációs eseményt a szerver is elküldheti (Conversions API) ugyanazzal az eseményazonosítóval,
// így a Meta nem számolja kétszer (lib/meta-capi.ts).
import { LANDING_SIGNUP_SOURCE } from "@/lib/onboarding";

/** A Twinx hirdetési fiók Pixele (nyilvános azonosító). Élesben (production build) magától él; helyi fejlesztésnél csak akkor,
 *  ha a NEXT_PUBLIC_META_PIXEL_ID be van állítva — mint a GA-nál, hogy a tesztforgalom ne keveredjen az éles adatokba. */
const DEFAULT_PIXEL_ID = "1350181197026932";
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? (process.env.NODE_ENV === "production" ? DEFAULT_PIXEL_ID : "");

type Fbq = (...args: unknown[]) => void;

function fbq(): Fbq | null {
  if (typeof window === "undefined" || !META_PIXEL_ID) return null;
  const w = window as unknown as { fbq?: Fbq };
  return typeof w.fbq === "function" ? w.fbq : null;
}

/** Oldalmegtekintés — a MetaPixel komponens hívja kliensoldali útvonalváltáskor. */
export function pixelPageView() {
  fbq()?.("track", "PageView");
}

/** A regisztráció forrása a Meta számára: a landingről jövő (10 kredites) regisztráció külön címkét kap. */
export function registrationContentName(source: string | null | undefined): string {
  return source === LANDING_SIGNUP_SOURCE ? "ingatlan_10kredit" : "direct";
}

/** Új eseményazonosító (a böngészős és a szerveroldali esemény párosításához). */
export function newMetaEventId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/** Sikeres regisztráció — CSAK a szerver sikeres válasza után hívjuk. Hozzájárulás nélkül a Pixel nem küldi el. */
export function pixelCompleteRegistration(source: string | null | undefined, eventId: string) {
  fbq()?.("track", "CompleteRegistration", { content_name: registrationContentName(source) }, { eventID: eventId });
}
