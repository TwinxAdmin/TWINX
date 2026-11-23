// Az új nyilvános oldal (D34–D38, terv: docs/terv/11-fooldal-es-landing-terv.md) közös adatai.
//
// ÉLES (2026-11-23, Márk döntése): az új főoldal a / címen, a referencia-landing a /referenciak címen fut,
// mindenkinek. A régi /uj előnézeti cím a főoldalra irányít.
// Ez a fájl a böngészőben is fut (SiteHeader) — szerveroldali dolog: lib/site-preview.ts.

export const SITE_HOME = "/";
export const SITE_REFERENCES = "/referenciak";
export const SITE_EMAIL = "office@twinx.hu";

/** A felső sáv / lábléc horgonyai. A „Kapcsolat" az adott oldal saját kapcsolatblokkjához görget. */
export const SITE_LINKS = {
  how: `${SITE_HOME}#hogyan`,
  references: SITE_REFERENCES,
  contact: "#kapcsolat",
};

export type SiteModule = { label: string; href: string; icon?: string };

/** A felső sávnak szükséges adatok a belépett felhasználóról (null = nincs belépve). */
export type SiteViewer = {
  email: string;
  /** A profilban megadott név (a foglalási űrlap előtöltéséhez). */
  name: string;
  isAdmin: boolean;
  /** A „Moduljaim" legördülő tartalma — csak amihez a felhasználónak hozzáférése van. */
  modules: SiteModule[];
} | null;
