// Központi szabály-konstansok (5/b, D65–D66). Egy helyen állíthatók; a felület és a szerver is innen olvas.

/**
 * Ügyféladat megőrzési határideje a cég lezárása után (nap). IDEIGLENES érték — az NDA és a jogász véglegesíti.
 * Lezáráskor a companies.data_retention_until = lezárás napja + RETENTION_DAYS. A határidő előtt az ügyféladat
 * törlése csak „határidő előtt, az ügyfél írásbeli kérésére” jelöléssel kérhető (20261124180000_closure.sql).
 * A számviteli megőrzés (fizetési tételek) ettől független, nem érinti.
 */
export const RETENTION_DAYS = Number(process.env.RETENTION_DAYS || 90);

/** A modul-meghívó érvényessége (nap). A create_invitation / resend_invitation 1–30 nap közé szorítja. */
export const INVITE_VALID_DAYS = Number(process.env.INVITE_VALID_DAYS || 7);

/**
 * Meghívó-küldési korlát: cégenként óránként ennyi (újraküldéssel együtt). FIGYELEM: az adatbázis-függvény
 * (create_invitation) ugyanezt az értéket ellenőrzi — ha itt változik, a függvényt is módosítani kell (migráció).
 */
export const INVITE_HOURLY_LIMIT = 20;
