# 29 – Megjelenés: a B irány (világos, tiszta) – terv és CODE-prompt (D69, D70)

> **Státusz:** elfogadott irány, 2026-11-24. A vizuális minta a TWINX projekt design-vásznán van („TWINX – főoldal és kezdőlap: 3 megjelenési irány”, B oszlop), a forrásfájlok a `docs/terv/design/` mappában: `B-fooldal.dc.html`, `B-kezdolap.dc.html`.
> **Kiegészíti:** `11` (főoldal és kezdőlap tartalma). A szövegek és szekciók a `11` szerint maradnak, ez a terv a **megjelenést** rögzíti.

---

## 1. Döntések

- **D69 – A B irány a TWINX arculata.** Világos, meleg törtfehér alap, sötét szöveg, egy korall akcentszín, nagy, középre igazított hero. A kezdőlap belépés után is ezt a világot mutatja, akkor is, ha a felhasználónak még nincs modulja.
- **Iparágfüggetlen kirakat.** A hero alatti animációk (futó sáv, modul-ablak) **nem ingatlanos** példákat mutatnak, hanem „ötleteket bármilyen iparágra” (ajánlatkészítés, időpontfoglalás, készletfigyelés stb.). Ezek **ötletek, nem kész termékek**: így is vannak felcímkézve („Bármilyen iparágra építünk. Néhány ötlet:”, „példa-modulok”). Az ingatlanos modulok kizárólag a **Referenciák** részben szerepelnek, mint működő példa.
- **D70 – Egy design minden oldalon.** A B irány színei, betűi, kártyái, gombjai és mozgásai **minden** oldalra vonatkoznak: főoldal, kezdőlap, modulok, irodai fiók, profil, **az admin felület minden menüpontja és minden megnyitható füle/ablaka**. Az admin átalakítása **külön lépés** a főoldal és a kezdőlap után (lásd 6. szakasz), saját vizuális tervvel.

## 2. Design-alapok (tokenek)

| Elem | Érték |
|---|---|
| Háttér | `#f6f1ea` (meleg törtfehér) |
| Kártya | `#ffffff`, keret `#e3d8cb`, lekerekítés 18–28 px, finom árnyék `0 20px 50px rgba(80,50,30,.08)` |
| Másodlagos felület | `#efe6da`, halvány akcent-háttér `#fbe3da` / `#fff4ee` |
| Szöveg | fő `#1d1712`, másodlagos `#5a4d42`, halvány `#7a6a5a` (kontraszt legalább 4.5:1) |
| Akcentszín | korall `#c8401f` (fő gomb, számok, kiemelés) |
| Sötét sáv | `#1d1712` alap, rajta `#f6f1ea` szöveg, akcent `#ff9a7e` („Mi az egyedi modul?” szekció) |
| Betűk | címek: **Space Grotesk** 500/700 (már self-hosted, `--font-display`); szöveg: **Inter** 400/500/600 |
| Gombok | kapszula (999 px lekerekítés). Fő: korall alap, fehér szöveg. Másodlagos: 1.5 px sötét keret. Sötét: `#1d1712` alap (felső sáv „Ingyenes felmérés”) |
| Címkék | nagybetűs, 13 px, 1.6 px betűköz, korall szöveg halvány korall háttéren |

Ezek **központi helyre** kerülnek (Tailwind téma / CSS-változók), nem oldalanként beégetve, hogy az admin és a többi oldal ugyanabból dolgozzon.

## 3. Felső sáv

- Háromoszlopos rács: bal logó · **közép menü** · jobb gombok. A menüpontok **pontosan középen** vannak (ez volt a jelzett hiba: jobbra csúsztak).
- Belépés előtt: Hogyan működik · Referenciák · Kapcsolat | Belépés · Regisztráció · [Ingyenes felmérés].
- Belépés után: Moduljaim ▾ · Irodai fiók · Referenciák · Kapcsolat | [Ingyenes felmérés] · profil-ikon. Az Irodai fiók melletti értesítési hely megmarad (`11`, 2. szakasz).
- Mobilon hamburger; a sáv nem ugrál.

## 4. Főoldal (a `11` szekciói, B megjelenéssel)

1. **Hero** középre igazítva: címke „Egyedi, cégre szabott modulok” · cím „A te cégedre szabott modul.” · alcím · két gomb (Ingyenes felmérés, Referenciák megtekintése).
2. **Futó sáv** (lassú, végtelen vízszintes mozgás): felette „Bármilyen iparágra építünk. Néhány ötlet:”, kapszulák „feladat · iparág” formában.
3. **Modul-ablak bemutató** (böngészőablak keret, finoman lebeg): három iparágfüggetlen példa-kártya (Ajánlatkészítő, Ügyfélkérdés-válaszoló, Készletfigyelő), egyszerű, rajzolt felületelemekkel. Nincs kitalált szám, nincs ügyfélnév.
4. **Mi az egyedi modul?** sötét sávban: cím „Egy eszköz, ami pontosan a te munkafolyamatodra épül.” és két bekezdés (a vászonon lévő szöveg; Márk átnézi).
5. **Hogyan működik** (3 kártya, számozott korall körrel), **Hol fut a modul** (4 fix méretű kártya, az első „Ajánlott kezdés”), **Referenciák** (ingatlanos működő példa, 3 kártya valódi képernyőképpel; a Látványtervnél „Koncepcióterv” jelölés), **Kapcsolat** (korall sáv, a meglévő kétlépéses foglalási blokk), **Lábléc**.

## 5. Belépett kezdőlap

- Felső sáv (belépett változat), üdvözlés: „Üdv újra, [Név]!” és „Itt jelennek meg az egyedi moduljaid.”
- **Van modulja:** a Moduljaim kártyák (fix méret, „⋯” menü) a fenti üdvözlés alatt.
- **Nincs modulja (üres állapot):** nagy fehér kártya „Még nincs modulod. Építünk egyet neked.” szöveggel, rövid magyarázattal, pulzáló „Időpontot foglalok” gombbal és a 3 lépéses idővonallal (Felmérünk → Megépítjük → Használod). Ez a látványos, vonzó állapot; nem egy szürke mondat.
- Alatta: Legutóbbi munkáim (üres állapot szövege a `11` szerint) · Irodai fiók kártya („Hamarosan” sorral) · „Nézd meg, mit építettünk egy ingatlaniroda számára” (3 referencia-kártya).

## 6. Mozgás

- Csak finom mozgás: futó sáv (kb. 30 mp/kör), lebegés (6 mp), gomb-pulzálás (2,6 mp), belépő megjelenés görgetéskor (a meglévő `components/motion/Reveal.tsx`).
- `prefers-reduced-motion` esetén minden animáció kikapcsol.
- A dobozok nem ugrálnak: minden váltós vagy animált elem fix méretű helyet kap.

## 7. Admin és a többi oldal (D70, külön lépés)

A főoldal és a kezdőlap elkészülte után **külön vizuális kör** jön az adminhoz: a Cégek, Felhasználók, Előfizetések, Foglalások, Egyedi modulok, Költségfigyelő lapok és minden megnyitható ablak (pl. „Hozzáférések”) átláthatóbb elrendezése. Addig is: **ha a CODE bármelyik oldalhoz hozzányúl, a 2. szakasz tokenjeit használja**, és új, eltérő stílust nem vezet be.

---

## 8. CODE-prompt (Cowork) – 6. lépés: főoldal és kezdőlap a B irány szerint

```
6. lépés – Új megjelenés: főoldal és belépett kezdőlap (D69, D70, terv 29)

Felhasználói folyamat
- Aki megnyitja a twinx.hu-t, egy világos, tiszta, igényes oldalt lát: középre igazított hero („A te cégedre szabott modul.”), alatta lassan futó sáv iparágfüggetlen ötletekkel, egy lebegő modul-ablak három példa-modullal, majd egy sötét „Mi az egyedi modul?” szekció, ami elmagyarázza, mit kap a cég. Utána Hogyan működik, Hol fut a modul, Referenciák (az ingatlanos működő példa), Kapcsolat, lábléc.
- A felső sáv menüpontjai pontosan középen vannak (most jobbra csúsznak).
- Aki regisztrál és belép, de még nincs modulja, ugyanebben a világban egy vonzó üres állapotot lát: „Még nincs modulod. Építünk egyet neked.”, rövid magyarázat, pulzáló „Időpontot foglalok” gomb, 3 lépéses idővonal, alatta Legutóbbi munkáim, Irodai fiók („Hamarosan” sorral) és a referencia-ízelítő. Akinek van modulja, a Moduljaim kártyákat látja ugyanitt.

Technikai részletek
- Olvasd el: docs/terv/29 (ez a terv), docs/terv/11 (tartalom), és a vizuális mintát: docs/terv/design/B-fooldal.dc.html és B-kezdolap.dc.html (statikus HTML-minta; a szerkezetet, színeket, méreteket és animációkat kövesd, de a meglévő Next.js komponensekkel építsd meg, ne másold be a mintát).
- A terv 29 2. szakaszának tokenjeit tedd központi helyre (Tailwind téma / CSS-változók), és ezeket használd. Ugyanezek vonatkoznak minden más oldalra is (D70); az admin átalakítása külön lépés, most ne nyúlj hozzá, csak ha egy közös komponens (gomb, kártya, felső sáv) cseréje érinti.
- Felső sáv: háromoszlopos rács (logó | középen a menü | jobbra a gombok), belépés előtti és utáni változat a terv 29 3. szakasza szerint. Mobilon hamburger.
- A futó sáv és a modul-ablak példái ötletek, nem kész termékek: a címkék („Bármilyen iparágra építünk. Néhány ötlet:”, „példa-modulok”) maradjanak. Az ingatlanos modulok csak a Referenciák részben szerepelnek. Nincs kitalált szám, idézet vagy ügyfélnév. Nincs „kredit” szó.
- A Referencia-kártyákon a meglévő modulokból készült valódi képernyőkép legyen; ha nincs, jelölt helyőrző. A Látványterv képén „Koncepcióterv” jelölés.
- A „Mi az egyedi modul?” szöveg a mintából jön; Márk még átnézi, ezért egy helyen, könnyen cserélhetően legyen.
- Animációk: Framer Motion / CSS, a meglévő Reveal komponenssel; prefers-reduced-motion esetén kikapcsolnak. A dobozok nem ugrálnak, a váltós dobozok mérete fix, a kártyák műveletei a „⋯” menüben.
- A régi /ingatlan oldal komponenseit (animációk, „Mi az egyedi modul” fejléc) nézd meg, és ami illik a B irányhoz, használd fel; az /ingatlan átirányítását (5/b) még ne élesítsd, amíg Márk jóvá nem hagyja az új főoldalt.
- Ne legyen git push, csak ha Márk kéri.

Ellenőrzési lépések
- tsc, eslint, build.
- Képernyőkép desktopon (1440) és mobilon (390): kijelentkezett főoldal; belépett kezdőlap modul nélkül; belépett kezdőlap modullal. Küldd el Márknak összevetésre a mintával.
- A felső sáv menüje a középvonalon van (mérd meg); a sáv szélessége belépés előtt és után sem ugrál.
- Csökkentett mozgás beállítással az animációk állnak.
- Kontraszt: a szövegek legalább 4.5:1.

Visszajelzés: VISSZAJELZES.md bejegyzés a repó gyökerében a sablon szerint, benne a képernyőképek és minden eltérés a mintától.
```
