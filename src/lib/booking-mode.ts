// Időpont-egyeztetés módja a nyilvános felületen (D73, 8. lépés, 2026-11-27).
//   "callback" — ideiglenes: nincs űrlap és időpont-választó; a kapcsolat-blokkban naptáras visszahívás-kérés (három nap) és e-mail,
//                és egyik kollégánk visszahív (telefonszámot Márk kérésére NEM teszünk ki).
//   "booking"  — a saját foglalási rendszer (BookingForm; élesítés továbbra is a BOOKINGS_PUBLIC kapcsolóval).
// A foglalási rendszer (táblák, függvények, admin Foglalások lap, e-mailek) érintetlen; visszaállítás: ezt az egy
// értéket kell "booking"-ra írni.
export const BOOKING_MODE: "callback" | "booking" = "callback";

/** Az egyeztető levél címzettje, tárgya és előre kitöltött szövege (egy helyen cserélhető). */
export const CALLBACK_EMAIL = "office@twinx.hu";
export const CALLBACK_SUBJECT = "Visszahívás kérése – egyedi modul bemutató";
export const CALLBACK_BODY = [
  "Szia!",
  "",
  "Szeretném, ha visszahívnátok, hogy egyeztessünk egy beszélgetést az egyedi modulról.",
  "",
  "Cégem neve:",
  "",
  "Három nekem alkalmas nap a visszahíváshoz (hétköznap, délelőtt vagy délután):",
  "1.",
  "2.",
  "3.",
  "",
  "Telefonszámom:",
  "",
  "Röviden, miben segítene egy egyedi modul (nem kötelező):",
  "",
].join("\n");

export const CALLBACK_MAILTO =
  `mailto:${CALLBACK_EMAIL}?subject=${encodeURIComponent(CALLBACK_SUBJECT)}&body=${encodeURIComponent(CALLBACK_BODY)}`;
