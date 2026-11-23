# VISSZAJELZÉS (a fejlesztési és az ügynökség-beszélgetés vezeti; új bejegyzés felülre)

Minden lépés végén egy bejegyzés. Márk bemásolja a tervező projektbe, ott kerül átvezetésre a terv.
Sablon: `docs/terv/VISSZAJELZES.md`.

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
