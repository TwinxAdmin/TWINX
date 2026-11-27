# 33 – CODE-prompt: 9. lépés – ÁSZF és adatkezelési tájékoztató közzététele (D74)

```
9. lépés – Az új ÁSZF és adatkezelési tájékoztató közzététele (D74, docs/terv/31 és 32)

Felhasználói folyamat
- A látogató a lábléc „Általános Szerződési Feltételek” és „Adatkezelési tájékoztató” linkjére kattintva egy-egy jól olvasható oldalt kap (twinx.hu/aszf és twinx.hu/adatkezeles), a B arculatban, felül a verzióval és a hatálybalépés dátumával, a hosszú szövegben szakaszlinkekkel. A lábléc „Hamarosan” jelzése eltűnik.
- Új regisztrációnál kötelező pipa: „Elfogadom az Általános Szerződési Feltételeket, és megismertem az Adatkezelési tájékoztatót.” (mindkét név link). Pipa nélkül nem lehet regisztrálni.
- A már regisztrált felhasználó a következő belépéskor egy ablakot lát: „Frissítettük az Általános Szerződési Feltételeket és az Adatkezelési tájékoztatót.” a két linkkel és egy „Elfogadom” gombbal. Elfogadás után az ablak nem jön elő újra; addig a modulok nem indíthatók, de a meglévő anyagai elérhetők, és kiléphet. Az ablak fix méretű, mobilon is jól olvasható.
- A kapcsolatfelvételi blokk (8. lépés, D73) alatt apró betűvel: „Ha írsz vagy hívsz, az adataidat az időpont egyeztetésére használjuk. Részletek: Adatkezelési tájékoztató.”

Technikai részletek
- A szövegek: docs/terv/31-aszf.md és docs/terv/32-adatkezelesi-tajekoztato.md. A „Belső jegyzet” blokk és a 32-ben a 8. szakasz NEM kerül az oldalra.
- Közzététel előtt:
  1. A [KITÖLTENDŐ] helyeket (adószám, nyilvántartási szám, ÁFA-mondat a 31-ben 9.2, számlázó szolgáltató) Márk adja meg. Amíg bármelyik hiányzik, ne élesítsd az oldalakat; jelezd, mi hiányzik.
  2. A [HA VAN] jelű sorokat (hírlevél/Brevo, Google Analytics és sütik, Resend, számlázó, könyvelő) a kódból ellenőrizd: ami ténylegesen működik, maradjon (a jelölés nélkül), ami nem, törlődjön. Ha van GA4 vagy más mérés süti-hozzájárulás nélkül, azt jelezd külön, mert az önmagában hiba.
  3. Az [ELLENŐRIZENDŐ] helyeket töltsd ki: a kódban ténylegesen használt AI- és külső szolgáltatók teljes listája (a 32-es 3. szakasz táblázata pontosan ezt mutassa: szolgáltató, mire, milyen adat); a Vercel és a Supabase hivatalos címe a szolgáltatók oldaláról; a Supabase projekt régiója; a GA4 adatmegőrzési beállítása, ha van. A forrást írd meg a visszajelzésben. A NAIH és a Budapesti Békéltető Testület elérhetőségét is nézd meg a hivatalos oldalukon.
- A szövegeket egy helyen tárold (pl. markdown vagy MDX fájl a repóban, verziószámmal), az oldalak ebből renderelnek. A régi, kredites ÁSZF-et ne töröld: archiváld, és az új oldal alján „Korábbi változatok” linkkel legyen elérhető.
- Elfogadás tárolása: a profilon (a meglévő terms mezők bővítésével vagy additív oszlopokkal) az elfogadott ÁSZF-verzió, az adatkezelési tájékoztató verziója és az elfogadás időpontja. A verziók egy központi konstansból jönnek (pl. LEGAL_VERSION = '2026-12-v1'); ha a konstans nő, mindenki újra elfogadást kap. Az elfogadás szerveroldali végponton megy, RLS-sel; a modulok indításának ellenőrzése is szerveroldali.
- Additív, visszafordítható migráció + down szkript, előtte mentés (D51). Az adminok (role = admin) ne kapjanak elfogadó ablakot, ami a munkát akadályozza (nekik egyszeri, bezárható jelzés elég).
- B arculat (terv 29): olvasható szélesség (max. kb. 70 karakter soronként), 16–17 px szöveg, a táblázatok mobilon egymás alá rendeződnek vagy vízszintesen görgethetők, nincs vízszintes kilógás.
- Ne legyen git push, csak ha kérem.

Ellenőrzési lépések
- tsc, eslint, next build hiba nélkül.
- Mindkét oldal megnyílik, a lábléc linkjei működnek, nincs benne [KITÖLTENDŐ], [HA VAN] vagy [ELLENŐRIZENDŐ] jelölés, sem belső jegyzet.
- Regisztráció pipa nélkül nem megy, pipával igen, és az adatbázisban rögzül a verzió és az idő.
- Egy régi tesztfelhasználó belépéskor megkapja az ablakot; elfogadás előtt modul nem indítható (szerveroldalon is ellenőrizve), utána igen, és az ablak nem jön vissza.
- A 32-es 3. szakasz szolgáltatólistája egyezik a kódban ténylegesen hívott szolgáltatókkal (listázd a visszajelzésben, fájlonként).
- Képernyőkép desktopon és mobilon mindkét oldalról és az elfogadó ablakról.

Visszajelzés: VISSZAJELZES.md bejegyzés a sablon szerint, benne a szolgáltatólista, a kitöltött [ELLENŐRIZENDŐ] értékek forrással, a törölt [HA VAN] sorok, és ha mérés hozzájárulás nélkül fut, azt külön.
```
