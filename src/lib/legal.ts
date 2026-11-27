// Jogi alapadatok — EGY helyen (ÁSZF, később az adatkezelési tájékoztató és az elfogadás-kezelés is innen olvas).
// Induló szakasz: a TWINX-et Kovács Márk egyéni vállalkozóként üzemelteti és számláz. A TWINX cég élesítésekor
// itt kell átírni az üzemeltetőt, és ÚJ VÁLTOZATOT kiadni (a partnerek újra elfogadják).

export const LEGAL_OPERATOR = {
  name: "Kovács Márk egyéni vállalkozó",
  address: "1143 Budapest, Tábornok utca 27.", // Márk megerősítése 2026-11-27 (D74); korábban: Székesfehérvár (ÁSZF 1.1)
  taxNumber: "48635253-1-27",
  /** Egyéni vállalkozói nyilvántartási szám — ha megvan, ide kerül (addig az oldal nem írja ki). */
  registrationNumber: "58736647" as string | null,
  email: "office@twinx.hu",
  website: "https://twinx.hu",
};

/** Tárhelyszolgáltató (az elektronikus kereskedelmi törvény szerint kötelező adat). */
export const HOSTING_PROVIDER = {
  name: "Vercel Inc.",
  address: "440 N Barranca Avenue #4133, Covina, CA 91723, Amerikai Egyesült Államok",
  email: "privacy@vercel.com",
  web: "https://vercel.com",
};

/**
 * A jogi dokumentumok (ÁSZF + Adatkezelési tájékoztató) KÖZÖS változata (D74, 9. lépés). Az elfogadás ehhez kötődik:
 * a profilon `terms_version` (ÁSZF) és `privacy_version` (tájékoztató) — ha bármelyik eltér, belépéskor elfogadó ablak.
 * FIGYELEM: az emelés MINDEN felhasználónál egyszer újra feldobja az elfogadást — CSAK Márk kifejezett kérésére emeld
 * (szövegjavítás, fejlesztés miatt NEM). A szövegek: src/content/legal/ (változatonként külön fájl).
 */
export const LEGAL_VERSION = "2026-12-v1";
export const ASZF_VERSION = LEGAL_VERSION;
export const PRIVACY_VERSION = LEGAL_VERSION;
/** A közzététel (hatálybalépés) napja — a 9. lépés élesítésekor (Márk erősíti meg). */
export const LEGAL_EFFECTIVE = "2026. november 27.";

/** Visszafelé kompatibilis nevek (regisztráció, Google-visszatérés): az ÁSZF változata. */
export const TERMS_VERSION = ASZF_VERSION;
export const TERMS_EFFECTIVE = LEGAL_EFFECTIVE;

/** Korábbi, archivált változatok (az ÁSZF oldal alján „Korábbi változatok"). */
export const ASZF_ARCHIVE = [{ version: "1.1", effective: "2026. október 17.", href: "/aszf/1-1", note: "kredites működés" }];
