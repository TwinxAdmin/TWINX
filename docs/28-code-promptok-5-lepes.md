# 28 – CODE-promptok az 5. lépéshez (2026-11-24)

Két kicsi, külön átadandó prompt. **Egyszerre egy témát** adj át; az 5/a után szinkron (VISSZAJELZES), utána jöhet az 5/b.

---

## 5/a – Az Ingatlan csomag havi költségkerete (D62, terv 27)

**Felhasználói folyamat**
- Az admin Ingatlan-hozzáférést ad egy felhasználónak. Ha a felhasználó cége (a Felhasználók lapon: „Céghez rendelés”) még nem kapott Ingatlan-keretet, a felület kéri a **havi keretet forintban** (kötelező). Besorolatlan felhasználónál az admin előbb céget rendel.
- A felhasználó ugyanúgy használja az Ingatlan modulokat, mint eddig, kredit és szám nélkül. Egy költséges művelet (kép, videó, kutatás stb.) a cég keretéből foglal; siker után elszámol, hibánál feloldja a foglalást.
- 80%-nál a csapat egyszer értesítést kap (e-mail, és Telegram, ha be van állítva); 100%-nál a költséges műveletek leállnak, a felhasználó ezt látja: „A havi keret erre a funkcióra elfogyott, ezért most nem indítható. Az elkészült anyagaidat továbbra is eléred. Szóltunk a csapatnak.” Szám, Ft-érték nincs.
- Az admin az Előfizetések (vagy Cégek) lapon látja az Ingatlan keret-sávot (használat / keret), és a „⋯” menüben módosíthatja a keretet indoklással. Az admin saját használata nem foglal és nem von le.

**Technikai részletek** (terv: `docs/terv/27`, alap: `docs/terv/20`)
- A terv 20 meglévő mechanikáját terjeszd ki az Ingatlan csomagra (migráció `20261124120000_module-usage.sql`: foglalás, elszámolás, feloldás, sorzár, idempotens kéréskulcs, budapesti hónap, 80/100% jelzés). Nézd meg a kódban, hogyan van kulcsolva a keret és a `company_access`; ha modul-kulcs alapú, vegyél fel egy `ingatlan` csomag-kulcsot, ha ez ütközik a `company_modules` szerkezetével, készíts additív, azonos mezőkészletű táblát. Jelezd a döntést.
- A hook-pont: minden költséges Ingatlan-művelet a közös helyen menjen át (a mostani „hozzáféréssel nincs levonás” ág); ne szórd szét a modulokban. A becsült költséget a meglévő költségnaplóból / költség-konstansokból vedd, számot ne találj ki; ahol nincs becslés, a művelet ne induljon csendben ingyen (hiba).
- Nincs pluszcsomag, nincs fizetési tétel, nincs ajánlat-kalkuláció az Ingatlan csomagnál (egyszerű marad, GDN-re nincs külön szabály).
- Szerveroldali védelem (RLS), böngészőben nincs titkos kulcs, minden állapotváltás egy tranzakcióban; a keret módosítása csak admin, indoklással, naplózva. Additív, visszafordítható migráció, down szkript, mentés (D51). A hozzáférés-adás keret nélkül nem megy.
- Felület: a dobozok ne ugráljanak, a váltós dobozok mérete fix, a műveletek a „⋯” menüben, ami nem kész, „Hamarosan”. Nincs „kredit” szó a felületen.
- Ne legyen `git push`, csak ha Márk kéri.

**Ellenőrzési lépések:** a terv 27 5. szakaszának 10 pontja; `tsc`, `eslint`; a migráció lefuttatása előtt mentés; próba: egy tesztcég kis kerettel (80% és 100% elérése), két párhuzamos kérés, admin használata, Besorolatlan felhasználó hozzáférése.

**Visszajelzés:** `VISSZAJELZES.md` bejegyzés a repó gyökerében a sablon szerint.

---

## 5/b – Kampányoldalak, kisebb módosítások (D63, D65, D66)

> Átadás előtt Márk megerősíti: a Meta-hirdetés szünetel. A megőrzési napok és a szövegek ajánlás szerinti alapértelmezések (a 4–5. pont válasza még nyitott).

**Felhasználói folyamat**
- Aki a `/ingatlan` címre érkezik, a `/referenciak` oldalra kerül (átirányítás). A `/bemutatkozas` oldal rövid, új szöveget kap: az új irányt mondja el (egyedi, cégre szabott modul, ingyenes felmérés), gombja az „Ingyenes felmérés”, ár és „kredit” nélkül. Javasolt szöveg (a főoldal alcíme szerint): „A TWINX egyedi modult épít a te cégedre. Profi felmérés után a napi munkádhoz igazított eszközt kapsz.”
- A regisztráció nem ígér ajándékkreditet; a kampány-forrású szöveg ág kikerül.
- A nézet-váltó előnézetben az irodai fiók oldal a megjelenített felhasználó irodáját mutassa (jelenleg az admin irodáját).

**Technikai részletek**
- `/ingatlan` → átirányítás (301), a `/bemutatkozas` átírása. A kampány-táblák és a függőben lévő jelentkezők adata **nem törlődik** (`ingatlan_invites`, `profiles.invite_code`); csak a felületi ág és a kredites szöveg tűnik el. Ha van függő jelentkező, jelezd Márknak, mielőtt az admin Meghívók oldal eltűnne.
- A megőrzési határidő **központi konstans** (`RETENTION_DAYS`, ideiglenes érték: 90), jelölve, hogy az NDA és a jogász véglegesíti. Az ügyféladat törlése a határidő előtt továbbra is csak „határidő előtt, az ügyfél írásbeli kérésére” jelöléssel kérhető. A számviteli megőrzés (fizetési adatok) érintetlen.
- A szövegek véglegesek (a terv 22 szerint): leállási szöveg, „modul nem érhető el” szöveg; a meghívó-korlát 20/óra/cég, a meghívó érvényessége 7 nap, mindkettő konfigurálható konstans.
- Az ÁSZF (`/aszf`) érintetlen marad (D64), a lábléc linkje marad.

**Ellenőrzési lépések:** `/ingatlan` átirányít; `/bemutatkozas` nem említ kreditet; regisztrációs oldalon nincs ajándékkredit-szöveg; a nézet-váltó előnézetben az irodai fiók a megjelenített felhasználó irodáját mutatja; `tsc`, `eslint`; függő jelentkezők száma jelentve.

**Visszajelzés:** `VISSZAJELZES.md` bejegyzés.
