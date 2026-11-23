// Az új nyilvános oldal (D34–D38, terv: docs/terv/11-fooldal-es-landing-terv.md) közös adatai.
//
// ELŐNÉZET (D51): amíg nincs jóváhagyva, az új főoldal a /uj, a referencia-landing a /referenciak
// címen fut, és CSAK adminnak látszik (másnak 404). Átkapcsoláskor elég a SITE_HOME-ot "/"-re állítani
// és a régi főoldalt lecserélni — a linkek mind innen jönnek.
// Ez a fájl a böngészőben is fut (SiteHeader) — szerveroldali dolog: lib/site-preview.ts.

export const SITE_HOME = "/uj";
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
  isAdmin: boolean;
  /** A „Moduljaim" legördülő tartalma — csak amihez a felhasználónak hozzáférése van. */
  modules: SiteModule[];
} | null;
