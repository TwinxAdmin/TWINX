# 27 – Az Ingatlan csomag költségvédelme (D62 terv)

Állapot: terv, döntések rögzítve 2026-11-24-én. Kódolás nincs, a CODE-prompt a `28-code-promptok-5-lepes.md`-ben van.
Kapcsolódó: `20-plafon-es-hasznalat-terv.md` (a mechanika; ez a terv arra épül), `14-adatmodell-terv.md`, `12-admin-terv.md`, `22-felhasznaloi-szovegek.md` (3.A, leállási szöveg).

## 1. Döntések (Márk, 2026-11-24)

- **A hozzáféréssel használt Ingatlan csomagnak is legyen havi költségkerete, cégenként, forintban** (nettó önköltség, mint a `20`-ban). Ugyanaz a gépezet: foglalás a hívás előtt → elszámolás siker után → feloldás hibánál → 80% figyelmeztetés → 100% kemény leállás.
- **A keretet hozzáférés-adáskor kötelező megadni** (mint az egyedi moduloknál, D44(f)).
- **Egyszerű marad.** A GDN és a hozzánk közel álló ingatlanosok az általunk megadott kerettel használják a modulokat, nem fizetnek annyit, mint egy ismeretlen partner. Ezért az Ingatlan csomagnál **nincs** ajánlat-kalkuláció, pluszcsomag, fizetési tétel vagy mennyiség-számítás. A keret egyetlen szám, amelyet az admin ad meg és indoklással emel. A GDN-re **nincs külön szabály a kódban**: ugyanaz a mechanizmus, magasabb vagy lazább értékkel.
- A keret értékét Márk adja meg (a Költségfigyelő tényleges adatai alapján); a terv nem ír elő számot.

## 2. Folyamat

1. Egy Ingatlan-modul költséges művelete (kép, videó, kutatás, értékbecslés comp-lekérdezés stb.) elindul.
2. Ha a felhasználónak **Ingatlan-hozzáférése** van, a szerver a hozzáférés cégét veszi, és **lefoglalja a becsült költséget** a cég Ingatlan-keretéből (sorzár, idempotens kéréskulcs, mint a `20`-ban).
3. Ha belefér, a hívás elindul; siker után **elszámolódik** a tényleges költség (a meglévő költségnaplóból), hibánál a foglalás **felszabadul**. Ha a foglalás vagy a napló hibázik, a költséges hívás nem indul el.
4. 80%-nál egyszeri figyelmeztetés, 100%-nál egyszeri értesítés és leállás a hónap végéig vagy a keret emeléséig. A már elkészült anyagok megnyithatók maradnak. Az értesítés csatornája ugyanaz, mint a `20`-nál megépítettnél (e-mail a `BOOKING_NOTIFY_EMAILS` címekre, Telegram ha be van állítva), személyes adat nélkül.
5. Az **admin** korlátlan marad (nincs foglalás, nincs levonás), ahogy eddig.
6. A leállás felhasználói szövege a `22` 3.A szerinti (szám nélkül).

## 3. Adat és szabályok

- **A keret cégenként él.** Ha az Ingatlan-hozzáférés most felhasználóhoz kötött (`company_access`), a hozzáférés adásának előfeltétele, hogy a felhasználó **cégben legyen** („Céghez rendelés”); a Besorolatlan felhasználónak az admin először céget rendel, és ott kérjük a keretet. *(Ha a kód szerint a hozzáférés más kulcson él, a CODE jelezze; a megoldás a visszajelzésben dől el.)*
- **Additív migráció** (D51): a keret és a használat a `20` meglévő szerkezetébe illeszkedjen. Ha a meglévő táblák modul-kulcs alapon működnek, az Ingatlan csomag kapjon egy szerződéses kulcsot (`ingatlan`) a regiszter-szerű bejegyzésben; ha ez ütközik a `company_modules` szerkezetével, külön, additív tábla készüljön ugyanazzal a mezőkészlettel. A döntést a CODE a kód ismeretében hozza meg, és jelzi.
- **A becsült költség forrása** a meglévő költségnapló (nem kitalált szám): modulonkénti becslés a naplózott tényleges költségekből vagy a már meglévő költség-konstansokból; ha egy műveletnél nincs becslés, a modul ne induljon el keret nélkül (hiba, nem csendes átengedés).
- **Szerveroldali védelem (RLS)**; a böngészőben nincs titkos kulcs; a keret módosítása csak az adminnak, indoklással, naplózva.
- A hónap budapesti időszak szerint indul (mint a `20`-ban); a fel nem használt keret nem vihető át.
- A felhasználó **számot nem lát**.

## 4. Admin felület

- A keret-sáv (használat / keret, 80% és 100% jelzéssel) az **Előfizetések** (vagy Cégek) lapon, az Ingatlan csomag sorában. A „Keret módosítása” a „⋯” menüben, indoklással.
- A **Felhasználók** lapon az Ingatlan-hozzáférés pipájánál, ha a cégnek még nincs Ingatlan-kerete, a művelet a keret megadását is kéri (kötelező mező, Ft).
- Fix méretű dobozok, „Hamarosan” jelzés ami nem készül el.

## 5. Ellenőrzési lista (a fejlesztés végére)

1. Ingatlan-hozzáféréssel rendelkező felhasználó költséges műveleténél foglalás készül, siker után elszámolás, hibánál feloldás.
2. A keret 80%-ánál és 100%-ánál egyszeri értesítés megy, személyes adat nélkül.
3. 100%-nál a költséges művelet nem indul, a felhasználó a `22` szerinti szöveget látja, szám nélkül; az elkészült anyagok megnyithatók.
4. Két párhuzamos kérés nem lépheti túl a keretet.
5. Az admin használata nem foglal és nem von le.
6. Hozzáférés-adás keret nélkül nem megy; a Besorolatlan felhasználónál az admin előbb céget rendel.
7. A keret módosítása indoklással, naplózva; nem-admin nem módosíthatja.
8. Ahol nincs becslés, a művelet nem indul csendben ingyen.
9. Más cég használata nem csökkenti ennek a cégnek a keretét.
10. A régi (levonás nélküli) viselkedéshez képest egyetlen modul sem romlik el keret mellett; a mappák, a megnyitás, a letöltés érintetlen.

## 6. Nyitott pontok

- A kezdeti keret értéke cégenként (Márk, Költségfigyelő alapján).
- Ha a hozzáférés felhasználóhoz kötött és nem kell céghez rendelni, felhasználónkénti tartalék-keret kell-e (jelenleg nem javasolt).
