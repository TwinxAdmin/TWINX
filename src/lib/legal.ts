// Jogi alapadatok — EGY helyen (ÁSZF, később az adatkezelési tájékoztató és az elfogadás-kezelés is innen olvas).
// Induló szakasz: a TWINX-et Kovács Márk egyéni vállalkozóként üzemelteti és számláz. A TWINX cég élesítésekor
// itt kell átírni az üzemeltetőt, és ÚJ VÁLTOZATOT kiadni (a partnerek újra elfogadják).

export const LEGAL_OPERATOR = {
  name: "Kovács Márk egyéni vállalkozó",
  address: "8000 Székesfehérvár, Palotai út 75. 10/198.",
  taxNumber: "48635253-1-27",
  /** Egyéni vállalkozói nyilvántartási szám — ha megvan, ide kerül (addig az oldal nem írja ki). */
  registrationNumber: "58736647" as string | null,
  email: "office@twinx.hu",
  website: "https://twinx.hu",
};

/** Tárhelyszolgáltató (az elektronikus kereskedelmi törvény szerint kötelező adat). */
export const HOSTING_PROVIDER = {
  name: "Vercel Inc.",
  address: "440 N Barranca Ave #4133, Covina, CA 91723, Amerikai Egyesült Államok",
  web: "https://vercel.com",
};

/** Az ÁSZF aktuális változata — módosításkor növelni (az elfogadás ehhez kötődik). */
// FIGYELEM: az emelés MINDEN felhasználónál egyszer újra feldobja a kötelező elfogadó ablakot —
// CSAK Márk kifejezett kérésére emeld (szövegjavítás, fejlesztés miatt NEM).
export const TERMS_VERSION = "1.1"; // 1.1 (2026-10-17): bankkártyás fizetés (Stripe), azonnali jóváírás, automatikus e-számla; visszatérítés kártyára
export const TERMS_EFFECTIVE = "2026. október 17.";
