# 30 – „Mi az egyedi modul?” szekció: gömbös 3D ábra (D72)

> **Státusz:** elfogadott irány, 2026-11-27. Működő minta: a TWINX projekt „TWINX – gömbös ábra minta” artifactja, forrása `docs/terv/design/gombos-abra-minta.html` (a Three.js nélküli, olvasható változat; a mintában r149 UMD van beágyazva).
> **Kiegészíti:** `29` (B arculat). A szekció sötét háttere és a bal oldali szöveg **változatlan**, csak a jobb oldali ábra cserélődik.

---

## 1. Döntések (Márk, 2026-11-27)

- A mostani téglás animáció helyére **valódi 3D ábra** kerül (Three.js / WebGL).
- **Helye:** jobb oldalt, a szöveg mellett. A szöveg helye és mérete nem változik, az ábra igazodik hozzá.
- **Szavak a gömbökben** (a TWINX előnyei, nem iparágak): **TWINX AI** (középen, nagy), **Biztonságos, Időt spórol, Cégre szabva, Bővíthető, Automatizál, AI-ügynökség**.
- **Folyamatos finom mozgás (Márk, 2026-11-27):** nyugalomban is él az ábra: **a nagy gömbök véletlenszerűen, finoman felizzanak** (glow), egymástól függetlenül, egyszerre általában 1–2. Az izzás nem nagy, de jól látszik. A gömbök helye, a pontok és a pályák nyugalomban állnak. *(Az előző változat vezetéken futó fényimpulzusait Márk elvetette.)*
- **Mozgás az egérre:** ezen felül Ahol az egér áthalad, az apró elemek (pontok és kis rézgömbök) szétrebbennek és megritkulnak, majd lassan visszaállnak. **A nagy gömbök a szavaikkal együtt is reagálnak** (Márk kérése, 2026-11-27): kisebb mértékben kitérnek a kurzor elől (a középső „TWINX AI” a legkevésbé), és a hozzájuk kötött vezetékek követik őket, így a háló nem szakad szét. **Mobilon az érintés** ugyanígy működik.
- **Színek:** a mostani szekcióhoz igazodik: sötétbarna háttér, réz `#c8703a`, peremfény `#e9a374`, izzás `#ff6a3d`, krém szöveg `#f6e6d2`.

## 2. Az ábra felépítése

- **7 üveggömb:** átlátszó, fényes réz pereme van (fresnel), egy csúcsfénye, és alul halvány narancs izzása. Mindegyik közepén egy szó, krém színnel, enyhe narancs ragyogással.
- **Vezetékek:** vékony réz ívek a középső gömbtől a többiig, ívek a szomszédok között, és két nagy, megdöntött pálya a csoport körül.
- **Apró elemek:** kb. 3000 pont a vezetékeken, a pályákon, egy héj a középső gömb körül, és ritka por körülöttük. Ehhez jön kb. 14 kis, fémes rézgömb a vezetékeken és a pályákon.
- **Nagy gömbök:** a kurzor körüli kb. 150 px + a gömb sugarának 60%-a körben kitérnek: a mellék-gömbök legfeljebb 0,75, a középső 0,35 egységnyit, kicsit előre is, a szó együtt mozog a gömbbel; a vezeték-ívek minden képkockán a gömbök aktuális helyéhez igazodnak.
- **Gömb-izzás:** gömbönként véletlen ütemezés: szünet 1,8–6,3 mp (az első 0,4–3,9 mp), utána 1,4–2,3 mp-es felizzás sin² görbével, erőssége 0,5–0,9. Izzáskor a perem és a belső narancsosabb, fényesebb lesz (a shader `uPulse` értéke), és egy halvány, additív narancs fényudvar jelenik meg a gömb körül (sugara a gömb kb. 1,55-szöröse, átlátszósága legfeljebb kb. 0,55). A szó olvasható marad. Az izzás a kitérő gömbbel együtt mozog.
- **Szétrebbenés:** a kurzor körüli kb. 150 px-es körben az elemek a kurzortól kifelé és mélységben elmozdulnak, és halványulnak (ritkulás). Ha a kurzor elmegy, kb. 1 mp alatt finoman visszaállnak.

## 3. Teljesítmény és tartalék

- A rajzolás folyamatos, amíg a szekció látszik (az izzás miatt), de nyugalomban **csak az izzás** számolódik (7 érték), a pontok nem. Ha a szekció kimegy a képből, vagy a fül háttérbe kerül, a rajzolás megáll.
- Pixelarány legfeljebb 2. A Three.js-t csak ez a komponens tölti be, csak a böngészőben, és csak akkor, amikor a szekció a képernyő közelébe ér.
- **Nincs WebGL:** a 7 szó kapszulákban jelenik meg, a B arculat stílusában.
- **Csökkentett mozgás** beállításnál az ábra áll, nincs izzás, és nem reagál.
- **Akadálymentesség:** az ábra `role="img"`, és az `aria-label` felsorolja a 7 szót.

---

## 4. CODE-prompt (Cowork) – 7. lépés: gömbös 3D ábra

```
7. lépés – „Mi az egyedi modul?” szekció: a téglás animáció cseréje gömbös 3D ábrára (D72, terv 30)

Felhasználói folyamat
- A látogató a főoldalon a sötét „Mi az egyedi modul?” szekcióhoz ér. Bal oldalt ugyanaz a szöveg és pecsét áll, mint most (helye és mérete nem változik). Jobb oldalt a téglás animáció helyett egy álló, 3D ábra látszik: 7 átlátszó, réz peremű üveggömb, mindegyikben egy szó (középen nagyban „TWINX AI”, körülötte Biztonságos, Időt spórol, Cégre szabva, Bővíthető, Automatizál, AI-ügynökség), vékony réz ívek kötik össze őket, körülöttük apró réz pontok, kis rézgömbök és két nagy pálya.
- Ha a látogató áthúzza az egeret az ábrán, a kurzor körül az apró pontok és kis gömbök szétrebbennek és megritkulnak; a nagy gömbök a szavaikkal együtt kisebb mértékben kitérnek (a középső a legkevésbé), és a vezetékek követik őket. Amikor a kurzor továbbmegy, minden lassan visszaáll. Mobilon az érintés ugyanígy hat, és az oldal görgetése továbbra is működik.
- Nyugalomban is van finom élet: a nagy gömbök véletlenszerűen, egymástól függetlenül finoman felizzanak (glow), egyszerre általában 1–2; az izzás nem nagy, de látszik, és a szó olvasható marad.
- Az ábra alatt marad a „Mutass rá, vagy koppints rá” felirat.

Technikai részletek
- Olvasd el: docs/terv/30-gombos-abra-terv.md, és nyisd meg a mintát: docs/terv/design/gombos-abra-minta.html (a Three.js-t a mintában egy <script>/*THREE*/</script> helyőrző jelöli; a működő változat a projekt artifactja, Márk megmutatja). A minta a pontos szándék: geometria, színek, shaderek, a szétrebbenés képlete (RAD 150 px, erősség 2.9, visszaállás 0.06-os csillapítással; nagy gömbök: RAD + a gömb sugarának 60%-a, eltolás 0.75 / középen 0.35, a vezetékek újraszámolva), a csak-ha-mozog rajzolás. Kövesd, de a projekt konvencióival építsd meg.
- A Three.js-t npm-csomagként vedd fel (aktuális stabil verzió, pontosan rögzítve), ES modulként, csak a szükséges részekkel. Az ábra külön kliens-komponens (next/dynamic, ssr: false), amely csak akkor töltődik be, amikor a szekció a képernyő közelébe ér (IntersectionObserver). A főoldal első betöltését nem lassíthatja.
- A szekció háttere, a bal oldali szöveg, a pecsét és a felirat változatlan. Csak a jobb oldali ábra-dobozt cseréld; a doboz fix arányú (1:1), így semmi nem ugrik, amíg az ábra betölt (addig a tartalék vagy üres, azonos méretű hely).
- A szavak a gömbökben vászon-textúrán (sprite) vagy troika-three-text-tel legyenek, Inter betűvel, a betöltött font után újrarajzolva. A szavak egy tömbben, könnyen cserélhetően legyenek.
- A gömb-izzás miatt a rajzolás folyamatos, amíg a szekció látszik, de nyugalomban csak az izzást számold (a pontokat csak egér vagy érintés után, amíg vissza nem álltak). Ha a szekció kimegy a képből vagy a fül háttérbe kerül, a rajzolás álljon le. Pixelarány legfeljebb 2. Átméretezéskor (ResizeObserver) az ábra kövesse a doboz méretét. Komponens elhagyásakor a WebGL erőforrásokat szabadítsd fel (dispose).
- Tartalék: ha nincs WebGL, a 7 szó kapszulákban jelenjen meg (B arculat). prefers-reduced-motion esetén az ábra álló, nem reagál.
- Akadálymentesség: a doboz role="img", aria-label a 7 szóval.
- A régi téglás animáció komponensét vedd ki a szekcióból; a fájlt csak akkor töröld, ha máshol nem használja semmi, és ezt írd meg a visszajelzésben.
- Nincs adatbázis-változás. Ne legyen git push, csak ha kérem.

Ellenőrzési lépések
- tsc, eslint, next build hiba nélkül; a főoldal JavaScript-mérete az első betöltésnél ne nőjön (a Three.js külön darabban, késleltetve töltődjön).
- Képernyőkép desktopon (1440 px) és mobilon (390 px), nyugalomban és szétrebbenés közben; vesd össze a mintával.
- Mozgasd az egeret az ábrán: a pontok szétrebbennek, a nagy gömbök a szavakkal együtt kitérnek, a vezetékek velük mozognak és nem szakadnak el; elhagyva minden visszaáll. A szavak mozgás közben is olvashatók. Mobilon érintéssel ugyanez, és a görgetés működik.
- Nyugalomban a gömbök véletlenszerűen felizzanak, a pontok állnak; a szekciót elgörgetve a rajzolás leáll (Performance fül). Egy átlagos laptopon a processzorterhelés nyugalomban is alacsony marad.
- Csökkentett mozgás beállítással az ábra áll, izzás nélkül. WebGL kikapcsolásával a kapszulás tartalék látszik.
- A bal oldali szöveg helye és mérete pixelre ugyanaz, mint előtte.

Visszajelzés: VISSZAJELZES.md bejegyzés a sablon szerint, benne a képernyőképek, a Three.js verziója és a betöltött darab mérete, és az eltérések a mintától.
```
