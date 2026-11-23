# VISSZAJELZÉS (a fejlesztési és az ügynökség-beszélgetés vezeti; új bejegyzés felülre)

Minden lépés végén egy bejegyzés. Márk bemásolja a tervező projektbe, ott kerül átvezetésre a terv.
Sablon: `docs/terv/VISSZAJELZES.md`.

## 2026-11-23 – 2. lépés: ingyenes felmérés foglalása (2a–2e)
Melyik beszélgetés: Fejlesztés
Terv, amiből dolgoztunk: docs/terv/15-foglalas-terv.md, 16-email-szovegek.md, 17 (hozzájárulási szöveg), D33, D37, D48, D49, D51
Elkészült:
- 2a: migráció `20261123190000_bookings.sql` (+ `supabase/down/…down.sql`): booking_hosts, availability_templates, availability_slots (átfedés-tiltás), bookings (egy aktív foglalás e-mail/telefon szerint), booking_events, booking_attempts; DB-függvények (create_booking, lemondás tokennel, admin-műveletek, sablon alkalmazása helyi időben); RLS: csak admin olvas, írás csak service_role. Lefuttatva, gazdák felvéve.
- 2b: Admin → Foglalások → Időpontok: gazda-váltó, heti sablon, „Sablon alkalmazása (4 hét)”, kézi időpont, törlés „⋯” menüből.
- 2c: kétlépéses foglaló űrlap a kapcsolatblokkban (időpont → adatok → visszaigazolás, fix doboz), visszahívási kérés időpont nélkül; /api/bookings: szerveroldali validáció, honeypot, sebességkorlát (IP 8/óra, e-mail 4/nap), tranzakciós foglalás; `book_assessment` GA4-esemény.
- 2d: e-mailek a 16-os szövegekkel (visszaigazolás „Lemondás” gombbal, visszahívás, lemondás), értesítés Márknak és Tibinek (e-mail + Telegram, ha beállítva; egyszerű szöveg); lemondás oldal (`/foglalas/lemondas`): megnyitás nem mond le, csak a gomb (POST), egyszer használatos token.
- 2e: Admin → Foglalások → Beérkezett: szűrő (aktív / állapot) és „csak az enyém”, Új felül, kibontható sor (teljes leírás szövegként, belső jegyzet, történet), „⋯” menü: Állapot módosítása, Jegyzet, Értesítés újraküldése, Céggé alakítás („Hamarosan”), Lemondás; fix helyű jelzés a Foglalások menüponton az új foglalások számával.
Eltérés a tervtől:
- Új `booking_hosts` tábla a gazdák megjelenített nevéhez („Márk”, „Tibor”).
- `bookings.company_id` külső kulcs nélkül: a Cég-tábla (terv 14) még nincs; azt a migrációt kell kiegészíteni a kulccsal. A „Céggé alakítás” ezért „Hamarosan”.
- Foglalt időpontnál az admin „⋯” menüje csak „Foglalás törlése” (az időpont azonnal újra szabad); időpont csak szabad állapotban törölhető (Márk kérése).
- A nyilvános időpont-lista egy átlátszó időpont-kulcsot (uuid) is kiad, mert a foglaláshoz kell; felhasználói azonosító, e-mail nem megy ki.
- Az újraküldésnél a látogató új lemondási linket kap (a régi nyers token nincs tárolva), a régi link érvénytelen lesz.
- Élesítésig a foglalás API-ja is csak adminnak érhető el; nyitás: `BOOKINGS_PUBLIC=1` (Vercel).
Új buktató / tanulság: a Resend csak hitelesített domainről küld (403 „twinx.hu domain is not verified”); az office@twinx.hu postafiók ehhez nem elég, a DNS-rekordok kellenek.
Nem lett kész / Hamarosan: Céggé alakítás (4. lépés); emlékeztető e-mail az időpont előtt; Telegram-értesítés (bot és csoport még nincs); a levelek a twinx.hu Resend-hitelesítéséig nem mennek ki.
Ellenőrzési lépések eredménye: `tsc` és `eslint` rendben; Márk localhoston kipróbálta: foglalás, „már van aktív foglalás”, admin Foglalás törlése → az időpont újra szabad; levélküldés: Resend 403 (domain nincs hitelesítve). A versenyhelyzet, az óraátállítás (budapesti idő-átszámolás kódszinten ellenőrizve) és az RLS valódi tokenes tesztje még hátra van.
Döntés kell tőled, Márk:
- Resend domain-hitelesítés: a twinx.hu DNS-rekordjai a Rackforestnél (hozzáférés kell). Utána Vercel: `BOOKING_MAIL_FROM`, `BOOKING_NOTIFY_EMAILS`.
- Telegram: kell-e, és melyik csoportba (bot létrehozása, `TELEGRAM_BOT_TOKEN`, `BOOKING_TELEGRAM_CHAT_ID`).
- Az adatkezelési tájékoztató a foglalás élesítése előtt kötelező (kapu).
Éles állapot: a foglalás csak adminnak látszik (/uj, /referenciak és az API is); az admin Foglalások menüpont él.

## 2026-11-23 – 1. lépés: új főoldal, felső sáv, referencia-landing (admin-előnézet)
Melyik beszélgetés: Fejlesztés
Terv, amiből dolgoztunk: docs/terv/11-fooldal-es-landing-terv.md (2026-11-23-i export), D34–D38, D51
Elkészült:
- Új felső sáv (`src/components/site/SiteHeader.tsx`): kijelentkezve Hogyan működik · Referenciák · Kapcsolat · [Ingyenes felmérés] · Belépés · Regisztráció; belépve Moduljaim ▾ (üres állapot: „Itt jelennek meg az egyedi moduljaid.”) · Irodai fiók (fix hely az értesítési pöttynek) · Referenciák · Kapcsolat · [Ingyenes felmérés] · profil ▾ (Admin felület csak adminnak). Nincs „kredit”. Mobilon hamburger, a sáv fix magasságú.
- Új főoldal `/uj`: hero, Hogyan működik (3 kártya), Hol fut a modul (4 fix kártya, „Ajánlott kezdés”), Irodai fiók sáv „Hamarosan” résszel, referencia-előzetes (3 kártya + gomb), kapcsolatblokk, lábléc. A szövegek szó szerint a terv 11-ből.
- Referencia-landing `/referenciak`: hero szám és idézet nélkül, 3 csoport (a 3D bejárás halvány, nem kattintható, „Hamarosan”), „bármilyen területre” sáv, diszkrét Ingatlan csomag sor, kapcsolatblokk.
- Kapcsolatblokk (`ContactBlock.tsx`) és lábléc (`SiteFooter.tsx`) közös komponensként.
- Admin-előnézet: mindkét oldal csak adminnak látszik (másnak 404), `noindex`; a tetején sáv, amivel a felső sáv belépett és kijelentkezett állapota váltható (`?nezet=kint`).
Eltérés a tervtől:
- A kapcsolatblokkban az időpontfoglalás helyén „Hamarosan” címke és „Írok e-mailt” gomb (office@twinx.hu) áll; az űrlap a 2. lépésben ugyanebbe a fix dobozba kerül (Márk döntése).
- A „Moduljaim” most a mostani katalógus látható moduljait listázza; a felhasználónkénti hozzáférés a 4. lépésben jön.
- Az új felső sáv csak az új nyilvános oldalakon fut; a dashboard felső sávja változatlan (a csere a 3. lépés személyre szabott kezdőlapjával együtt logikus).
- A láblécben az ÁSZF és a süti-beállítások linkje is megmaradt (jogi okból), a tervben nem szerepeltek.
- A referencia-kártyák ikonnal készültek, képernyőkép nélkül (a képi anyag nyitott pont).
Új buktató / tanulság: a felső sáv kliensoldali, ezért a közös konstansok (`src/lib/site.ts`) és a szerveroldali előnézeti kapu (`src/lib/site-preview.ts`) külön fájlban vannak.
Nem lett kész / Hamarosan: időpontfoglalás (2. lépés); Adatkezelési tájékoztató („Hamarosan” a láblécben); értesítési pötty; átkapcsolás a `/`-re, a régi főoldal és a `/pricing` kivezetése (külön lépés, Márk döntése szerint akkor kezeljük).
Ellenőrzési lépések eredménye: `npx tsc --noEmit` rendben; `npx eslint` az érintett fájlokra rendben; `npm run build` és a felület megnézése a fejlesztési gépen még hátra van (a fejlesztői környezetben a build nem futtatható).
Döntés kell tőled, Márk:
- Tibi hitelesítse a referencia-csoportokat és a modulleírásokat (különösen: Képjavító, Hirdetéskép-készítő, Marketingvideó, Szakember-kereső, Irodai fiók szövege).
- Mikor kapcsoljuk át élesre (`/uj` → `/`), és mi legyen a régi oldalakkal (/pricing, /egyedi-modul, /bemutatkozas, /ingatlan).
Éles állapot: élesen semmi nem változott; az új `/uj` és `/referenciak` csak adminnak látszik.
