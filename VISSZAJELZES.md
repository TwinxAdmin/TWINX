# VISSZAJELZÉS (a fejlesztési és az ügynökség-beszélgetés vezeti; új bejegyzés felülre)

Minden lépés végén egy bejegyzés. Márk bemásolja a tervező projektbe, ott kerül átvezetésre a terv.
Sablon: `docs/terv/VISSZAJELZES.md`.

## 2026-11-27 – Logó: belépve a kezdőlapra visz
Melyik beszélgetés: Fejlesztés
Elkészült (Márk kérése: „a bal felső TWINX logó kivisz a kezdőlapról — a kezdőlapra kell vinnie"): a felső sáv logója
(`SiteHeader` → `SiteLogo`) belépve a saját kezdőlapra (`/dashboard`), kijelentkezve a nyilvános főoldalra (`/`) visz.
A nyilvános főoldal belépve a profil-menüből és a mobilmenüből érhető el („TWINX főoldal" sor).
Eltérés a tervtől: a terv 11 / 4. szerint „a nyilvános főoldal a logóra kattintva elérhető" a belépett kezdőlapról —
Márk döntése szerint ez megfordul; a tervbe átvezetendő.
Ellenőrzési lépések eredménye: tsc + eslint rendben.

## 2026-11-27 – 7. lépés, 2. kör: automatikus működés, elválasztott háttér, árnyék
Melyik beszélgetés: Fejlesztés
Elkészült (Márk kérése):
- A „Mutass rá, vagy koppints rá" felirat kikerült. **Automatikus működés:** ha a szekció a képbe ér, kb. 0,6 mp múlva
  egy láthatatlan „kurzor" lassan (4,2 mp) végigsöpör az ábrán balról jobbra, enyhe hullámmal — a pontok szétrebbennek,
  a gömbök kitérnek, majd minden visszaáll; ~7 mp-enként ismétlődik, amíg a szekció látszik. Valódi egér / érintés
  esetén az automatika azonnal átadja a vezérlést, és 2,5 mp tétlenség után folytatja. „Mozgás csökkentése": nincs söprés.
- **Háttér elválasztása:** az időspórolás-városkép hidegebb, fakó kékesszürke tónust kapott (a réz helyett), halványabb
  (45%) és enyhén elmosott (mélységélesség), így a réz gömbök kiemelkednek előtte.
- **Árnyék:** a 3D ábrán kettős, lefelé eső árnyék (drop-shadow), ami a gömbökkel és a szétrebbenő pontokkal együtt mozog.
- **Levágás megszüntetve** (Márk: a kitérő gömbök és pontok a doboz szélén „kettévágódtak"): a vászon minden oldalon
  18%-kal túllóg a dobozon, a kamera arányosan hátrébb áll (az ábra mérete és a bal oldali szöveg nem változik), a
  vászon szélén lágy, kör alakú elhalványulás van — éles vágás sehol. Az egeret a doboz figyeli, a túllógó rész nem
  fog egeret (a szöveg felett nem indul el a szétrebbenés).
Eltérés a tervtől: a terv 30 szerint a szétrebbenés csak egérre / érintésre indul — Márk kérésére most magától is.
Ellenőrzési lépések eredménye: tsc + eslint rendben; megtekintés Márknál.

## 2026-11-27 – 7. lépés: „Mi az egyedi modul?" – gömbös 3D ábra (D72, terv 30)
Melyik beszélgetés: Fejlesztés
Terv, amiből dolgoztunk: `docs/terv/30-gombos-abra-terv.md` + `docs/terv/design/gombos-abra-minta.html` (4. export,
2026-11-27; a `docs/terv/` mappa a `terv-export.zip`-pel lecserélve, a külön küldött minta azonos a zipben lévővel).
Elkészült:
- `src/components/site/b/GlassOrbs3D.tsx`: a minta átültetése a projekt Three.js-ére — 7 üveggömb (fresnel réz perem,
  csúcsfény, alsó izzás) a szavakkal (vászon-sprite a weboldal Inter betűjével, betöltés után újrarajzolva), réz ívek a
  középtől és a szomszédok között, két megdöntött pálya, ~3000 pont + 14 kis rézgömb; szétrebbenés RAD 150 px /
  erősség 2,9 / visszaállás 0,06; nagy gömbök: RAD + sugár 60%-a, 0,75 / középen 0,35, a vezetékek minden képkockán
  követik őket; véletlen gömb-izzás (sin², 1,4–2,3 mp, szünet 1,8–6,3 mp, fényudvar). Rajzolás csak látható szekciónál
  és előtérben lévő fülnél; nyugalomban csak az izzás számolódik; DPR ≤ 2; ResizeObserver; elhagyáskor dispose.
- `src/components/site/b/GlassOrbs.tsx`: fix 1:1 arányú doboz (role="img", aria-label a 7 szóval); a 3D rész
  `next/dynamic` (ssr: false) külön darabban, csak ha a doboz 400 px-en belül van; WebGL nélkül kapszulás tartalék;
  „mozgás csökkentése": álló ábra, nem reagál, nincs izzás.
- A szavak egy helyen: `src/lib/site-copy.ts` → `ORB_WORDS`.
- A főoldal szekciójában csak a jobb oldali doboz cserélődött (bal oldali szöveg, pecsét, háttér változatlan; alatta a
  „Mutass rá, vagy koppints rá" felirat).
- A régi téglás animáció (`ModuleTower3D.tsx`) **törölve** (máshol nem használta semmi). Az időspórolás-városképet
  (`TimeSkyline.tsx`) Márk kérésére visszahoztam: a gömbös ábra mögött áll, alul, 60%-os erősséggel.
Eltérés a tervtől:
- Three.js: a projektben már telepítve van, **0.180.0** (a `package.json`-ban `^0.180.0`). Nem írtam át pontos
  rögzítésre, mert a `package-lock.json`-nal együtt kellene frissíteni (`npm install three@0.180.0 --save-exact`) —
  ha kéred, ezt a parancsot futtasd.
- r149 → r180 különbségek: a saját shaderek végére `colorspace_fragment` került (különben a színek sötétebbek lennének),
  a pontfény fizikai lecsengése miatt az erőssége nagyobb (a kis rézgömbök fényessége így egyezik a mintáéval).
- Első betöltés: a Three.js ma is a főoldal első csomagjában van, mert a referenciák „Alaprajzból 3D" animációja
  (`Floorplan3DDemo`) statikusan tölti be (korábbi állapot). Az új ábra emiatt nem növeli a méretet; ha a Three.js-t
  teljesen ki akarjuk venni az első betöltésből, a `Floorplan3DDemo`-t is késleltetve kell betölteni (külön lépés).
Új buktató / tanulság: a Three.js r152+ saját shadereiben a kimeneti színtér-konverziót (`#include <colorspace_fragment>`)
kézzel kell hozzáadni.
Nem lett kész / Hamarosan: `next build`, képernyőképek (1440 / 390 px, nyugalom és szétrebbenés) és a Performance-mérés
Márknál — a munkakörnyezetből nem futtatható, a Chrome-ellenőrzést Márk kérésére nem végzem.
Ellenőrzési lépések eredménye: `tsc --noEmit` és `eslint` (érintett fájlok) rendben.
Döntés kell tőled, Márk: nincs — Márk a fejlesztésre bízta (2026-11-27), és mindkettő megtörtént:
- **Three.js pontosan rögzítve:** `package.json` és `package-lock.json`: `"three": "0.180.0"` (a telepített változat is
  0.180.0, újratelepítés nem kell).
- **Az „Alaprajzból 3D" demó késleltetve:** a `GdnShowcase` a `Floorplan3DDemo`-t `next/dynamic`-kal (ssr: false) tölti,
  betöltésig azonos méretű sötét felülettel; a kör hossza külön fájlban (`floorplanDemoTiming.ts`). Így a főoldal első
  csomagjában **nincs Three.js** — mindkét 3D rész (gömbös ábra, alaprajz-demó) külön darabban, igény szerint töltődik.
Éles állapot: a push után a főoldalon mindenkinek látszik.

## 2026-11-25 – 6. lépés, 18. kör: elkülönülő felső sáv

**Mi változott (Márk: „a felső rész ne olvadjon bele ennyire" a sötét, videós nyitórészbe), `SiteHeader.tsx`:**
melegebb, kicsit világosabb sötét-barna átmenetes háttér (#30251d → #261d17), alul vékony korall keret + középen
felerősödő korall fényvonal, lágy árnyék lefelé; a középső menüpontok (Hogyan működik · Referenciák · Kapcsolat) egy
halvány, keretes kapszulába kerültek — szimmetrikusan a jobb oldali Belépés · Regisztráció kapszulával.
tsc + eslint hibamentes.
- Visszavonva (Márk: „vissza eggyel; a feliratok mögötti blokk maradjon, a keret nem kell"): a sáv háttere újra az
  eredeti `bg-b-dark`, alsó keret, fényvonal és árnyék nélkül; csak a menüpontok kapszulája maradt.

## 2026-11-25 – 6. lépés, 17. kör: interaktív 3D „modul-tárgy" a „Mi az egyedi modul?" sávban

**Mi változott (Márk döntése: A) egy nagy 3D tárgy; a kép helyett animáció, ami egérre változik; „selymesebb szín,
olvadjon bele"):** új `src/components/site/b/ModuleTower3D.tsx` (three.js, a feltöltött *3d-feature-objects* skill
módszerével, egyetlen nagyobb tárgyra). A sáv: balra a szöveg és a pecsét, jobbra a tárgy (asztalin két oszlop,
mobilon egymás alatt; fix magasság 440 / 340 px).
- Tárgy: moduláris kockatorony — 4 lekerekített élű, egymásba illeszkedő bronz blokk (mély, szatén és világosabb
  árnyalat), középen korall fényű mag.
- Egér rajta: ±0,7 rad fordulás a vízszintes helyzet szerint + lassú forgás (0,58 rad/s), a blokkok szétnyílnak, a mag
  felizzik; simítás `1−e^(−10·dt)`. Egér el: a legrövidebb úton (atan2) vissza, a blokkok összezárnak. Érintésre /
  Enter-re nyit-zár. „Mozgás csökkentése": álló kép, azonnali váltás. Csak látható és mozgó állapotban rajzol.
- „Selymes": szatén bronz anyag lágy környezeti tükröződéssel (RoomEnvironment), meleg fő- és hűvös élfény, kemény
  árnyék nélkül; átlátszó vászon, mögötte lágy bronz/korall derengés és elmosott „talaj-árnyék" (CSS).
- Bővítés (Márk kérése): nagyobb (540 / 400 px magas, szélesebb oszlop). **Zárva izzik**: a fugákban és a magban
  mozgó láva-textúra, amit áramszerű, kékesfehér villanások szőnek át, a blokkok is felhevülnek, mögöttük meleg
  izzás-fény — minél jobban zár, annál erősebb (zárva folyamatosan pulzál). **Nyitva** az izzás kialszik, és a fugákból
  6 kártya úszik ki balra-jobbra a napi munkával: Ajánlat · Heti riport · Ügyfélválasz · Időpont-egyeztetés ·
  Nyilvántartás · Számla-előkészítés (sötét-bronz üvegkártyák, krém szöveg, korall pont; HTML, éles szöveg).
  „Mozgás csökkentése": nincs pulzálás és villanás.
- 2. bővítés (Márk: „általánosabb felirat; a lapok a téglák között feküdjenek, és a mozgáshoz igazodjanak"): a kártyák
  már nem HTML-ben lebegnek, hanem **3D lapok a torony belsejében**: zárva a fugákban fekszenek (rejtve), nyitáskor a téglák
  közül sugárirányban kicsúsznak, és ~64°-ban a néző felé billennek; a toronnyal együtt mozognak és forognak.
  Feliratok (egy szó, iparág-független): Ajánlatok · Riportok · Ügyfelek · Határidők · Dokumentumok · Nyilvántartás.
  Lap: sötét-bronz, bronz keret, korall pont, krém betű (vászon-textúra); fugánként kettő, kicsit eltolt indulással.
  Módosítás (Márk: „a TWINX szolgáltatásaira utaljanak"): Ingyenes felmérés · Egyedi modul · Cégre szabva ·
  AI-automatizálás · Irodai fiók · Saját arculat; a betűméret a felirat hosszához igazodik.
- Áram (Márk: „a villogás helyett mintha áram járná körbe a téglákat belülről, a láva mellett"): a régi villanás
  kikerült. Minden fugában két vékony, lekerekített gyűrű fut körbe a téglák belső peremén; rajtuk kékesfehér
  áramimpulzusok haladnak (ellentétes irányban, kicsit eltérő sebességgel), finom „sercegő" remegéssel (saját shader,
  additív fény). Az erőssége a hővel nő (zárva a legerősebb, nyitva kialszik). A láva megmaradt, egyenletesen pulzál.
- Téglák modernebb, profibb megjelenése (Márk kérése):
  • csiszolt (szálirányos) bronz felület finom lakkréteggel, élesebb, kisebb sugarú élek;
  • minden blokkon körbefutó grafit „panelvonal", a felső élen vékony korall fénycsík (zárva erősebben világít);
  • **digitális óra** a 2. blokk elülső oldalán: sötét üvegkijelző, 7-szegmenses borostyán-korall számok, élő idő
    (ÓÓ:PP), villogó kettőspont;
  • **beleégetett „TWINX"** a 3. blokk jobb oldalán: sötét égésnyom, zárva parázsló, izzó szélekkel (a hővel együtt).
- Módosítás (Márk: „vissza az előzőhöz, az órát vegyük ki; a felület legyen a feltöltött képhez hasonló" — fekete
  kerámia fali lámpa): az óra, a grafit panelvonal, a korall LED-csík és a csiszolt bronz kikerült. A téglák most
  **matt, durva, pórusos fekete kerámiából** vannak (szénfekete alap, szürkés kérges foltok, apró pórusok — vászonból
  rajzolt szín- és dombor-térkép, három kissé eltérő változat). Az izzás mélyebb vörös-narancs lett (mint a lámpa
  vörös fénye). A **beleégetett „TWINX"** maradt: hamus-barna égésnyom a fekete kerámián, mindig halványan, zárva erősen parázsló szélekkel.
- Végső felület (Márk: „vissza az eredetihez, de a kinyílásnál menjen át feketébe"): ZÁRVA az eredeti szatén bronz
  (eredeti élsugár, narancs láva-izzás); NYITÁSKOR a téglák fokozatosan matt, pórusos fekete kerámiává válnak — a szín,
  a fémesség, az érdesség és a pórusos dombor-térkép együtt úszik át a nyílás mértékével; záráskor vissza bronzba.
  A beleégetett „TWINX" maradt.
- Háttér a tárgy mögött (Márk kérése, minta: az ügynökségi plakát izzó épületei): új `TimeSkyline.tsx` — izzó
  korall körvonalú „városkép", ahol az épületek helyén időspórolásra és modern, digitális munkára utaló tárgyak állnak:
  monitor kóddal és villogó kurzorral, homokóra pergő homokkal, szerverszekrény villogó LED-ekkel, stopper forgó
  mutatókkal, naptárköteg, óratorony, chip áramköri vonalakkal, laptop grafikonnal, kis homokóra, telefon órával;
  mögöttük szaggatott „üveg" szellemtornyok, alul vízszerű tükröződés és meleg pára. Kódból rajzolt SVG, 60%-os
  erősséggel a tárgy mögött; „mozgás csökkentése": minden áll.
- Izzó kötelek (Márk kérése, minta: az ügynökségi plakát kezek feletti fényszálai): minden lapot 4 vékony, izzó
  szál köt a téglák belsejéhez (a fugában rögzítve → a lap belső éléig, enyhe ívvel); a szálakon apró fénycseppek
  futnak a torony felől a lap felé. A szálak minden képkockán a lap helyzetéből számolódnak, így együtt mozognak,
  feszülnek és forognak; nyitáskor jelennek meg, záráskor eltűnnek. „Mozgás csökkentése": álló cseppek.
- Finomítás (Márk: „erősebb glow; az előbújás finomabb, nagyobb egérmozgásra jöjjenek elő teljesen"):
  • glow: a szálak mentén szálanként 14 nagy, lágy, lassan pulzáló fényfolt (izzó dereng), világosabb szál, nagyobb cseppek;
  • előbújás: a nyitás mértéke az egér által megtett vízszintes úttal nő (kb. a doboz szélességének 1,2-szerese kell a
    teljes előbújáshoz); megálláskor ott marad, elengedve visszazár. A követés lassú és lágy (nyitás ~2,6, zárás ~3,6 /s
    csillapítás), így a lapok fokozatosan „bújnak elő", nem ugranak. Érintésre továbbra is teljesen nyit (lassan).
    Módosítás (Márk: „ennek a fele legyen"): a teljes előbújáshoz szükséges egérút a felére csökkent (a doboz ~0,6-szorosa).
- Visszavonva (Márk: „az áramot vegyük ki"): az áram-gyűrűk és a hűvös árnyalat kikerültek; zárva tiszta, lágyan
  pulzáló láva-izzás maradt.
- A 16. körben generált állókép (`silk-still.png`) **már nem kell** — a `SilkStill` komponens megmaradt, de nincs használva.

tsc + eslint hibamentes. Chrome-ellenőrzés Márk kérésére nem volt.

## 2026-11-25 – 6. lépés, 16. kör: videós hero, AI-állókép a sötét sávban, ugrásmentes futó sáv

**Mi változott (Márk kérése):**
- **Hero:** a selymes háttérvideó (`SilkVideo`) a lap tetejére került. A hero sötét lett (a felső sávval egybeolvad),
  a cím, a leírás és a gombok balra, a videó sötét bal felén állnak; „Referenciák megtekintése" világos keretes gomb.
- **Futó sáv:** a hero aljára került, a videóhoz illő **üveges** kapszulákkal és üveges kiemelő címkékkel
  (`IdeaMarquee tone="dark"`). **Ugrás javítva:** a két listapéldány közti `gap` miatt a −50%-os hurok 6 px-et
  ugrott; most minden kapszula saját margót kap, így a hurok varrat nélküli. Lassabb (40 mp/kör), a széleken lágy
  elhalványulás.
- **„Mi az egyedi modul?" sötét sáv:** sötét marad, a videó helyett AI-val generált, illő **állókép** (`SilkStill`,
  Higgsfield / GPT Image: bronz selyemszalagok sötét háttéren, bal oldalt üres sötét tér a szövegnek, ember nélkül;
  2 változat készült, 1,5 kredit). **Fájl: `public/design/silk-still.png`** — Márk tölti le és teszi a helyére
  (a munkakörnyezetből nincs hálózat); amíg nincs ott, a sáv egyszerűen sötét.
- A korábbi világos hero selyemszalagjai kikerültek.

tsc + eslint hibamentes. Chrome-ellenőrzés Márk kérésére nem volt.

## 2026-11-24 – 6. lépés, 15. kör: Kapcsolat oldal reklámblokkja általános; „Minden elérhetőség" gomb a foglalási sávban

**Mi változott (Márk kérése):**
- `/kapcsolat`, jobb alsó sötét blokk: az ingatlanos szöveg és a mért-szerű számok (pl. „2–3 nap helyett ~20 perc",
  „~40 mp feljavított fotó") helyett általános céges feladatok, szám nélkül: „EGYEDI MODUL A NAPI MUNKÁHOZ · Kevesebb
  kézi munka, gyorsabb nap." + négy csempe (Ajánlat · Heti riport · Ügyfélkérdés · Nyilvántartás). A kijelentkezett
  gomb „Kipróbálom ingyen" (regisztráció, kredites korszak) helyett „Ingyenes felmérés →" (főoldal foglalási sávja).
- Foglalási sáv (`ContactBlock`, mindhárom helyen): az e-mail sor alatt új, „selymes" áttetsző gomb: „Minden
  elérhetőség →" → `/kapcsolat`. Új közös osztály: `.b-silk-btn` (sötétített üveg, fehér keret; a fehér betű
  kontrasztja ≥ 4,5:1).
- Megjegyzés: a `/kapcsolat` oldal többi része még a régi stílusban van (nem kérted az átalakítását).

tsc + eslint hibamentes. Chrome-ellenőrzés Márk kérésére nem volt.

## 2026-11-24 – 6. lépés, 14. kör: felső sáv — nincs dupla „Ingyenes felmérés", kiemelt Belépés/Regisztráció

**Mi változott (Márk kérése, `SiteHeader.tsx`):**
- Az asztali felső sáv jobb oldaláról kikerült az „Ingyenes felmérés" gomb (kijelentkezve és belépve is), mert közvetlenül
  alatta, a hero-ban és a foglalási sávban ott van. A mobilmenüben megmaradt. A menü továbbra is pontosan középen van
  (3 oszlopos rács).
- „Belépés · Regisztráció" egy halvány, áttetsző fehér kapszulába került (vékony keret); a „Regisztráció" kicsit
  erősebb háttérrel, így elkülönülnek a középső menüpontoktól.
- **Eltérés a terv 29-től** (ott a sáv jobb szélén ott volt a gomb) — a tervezőnek átvezetendő.

tsc + eslint hibamentes. Chrome-ellenőrzés Márk kérésére nem volt.

## 2026-11-24 – 6. lépés, 13. kör: „Így működik" animáció az Irodai fiók oldalon

**Mi változott (Márk kérése):** belépve az **Irodai fiók** menüpontban (új felület) megjelenik a korábbi irodai
animáció utódja: `src/components/office/OfficeShareScene.tsx` — „Így működik · Megosztod, és a csapat már látja."
- Általános, iparág-független szövegek (a régi `OfficeHandoffScene` ingatlanos példája, nevei és kredit-sávja nélkül):
  Elkészül a munka (Ajánlat · kész PDF) → Megosztva a közös mappában → A kolléga megnyitja → Mindenki ugyanazt látja.
  Szereplők: „Te" · „Közös mappa" · „Kolléga". Csak a már működő részeket mutatja (zárolás és verziónapló nincs benne,
  mert az új közös térben nem ellenőriztük).
- Helye (`OfficeHub.tsx`): ha még nincs irodai fiók → a bevezető alatt, a „Csatlakozás kóddal / létrehozás" kártya
  fölött; ha van → a közös tér felülete alatt. B arculat, fix méret, „mozgás csökkentése" esetén álló kép.
- A régi `OfficeHandoffScene` / `OfficeShowcase` (régi, kredites ismertető) változatlanul a régi felületen maradt.
- Háttér (Márk kérése: „selymes, mint az időpontfoglaló, de más dinamikus szín, ne narancs"): új `.b-office-silk`
  (globals.css) — mély petróleum → türkiz → éjkék átlós átmenet, halvány türkiz fényfolt, lassan vonuló selyemfény,
  halvány selyemszalagok; a szöveg krém (kontraszt ≥ 5,2:1, mérve), a korall kiemelések (aktív szereplő, „PDF kész")
  maradnak. „Mozgás csökkentése": a fény áll.

tsc + eslint hibamentes. Chrome-ellenőrzés Márk kérésére nem volt.

## 2026-11-24 – 6. lépés, 12. kör: a foglalási folyamat minden pontja egységes

**Mi változott (Márk: „minden más helyen, ahol időpontfoglalás van, vigyük végig, hogy egyezzen"):**
- A foglalási sáv (`ContactBlock` + `BookingForm`) mindhárom helyen ugyanaz a közös komponens volt (főoldal,
  Referenciák, belépett kezdőlap) → ott már egyezett, nincs több másolat.
- **Foglalás lemondása oldal** (`/foglalas/lemondas`, a visszaigazoló levél linkje): a régi sötét kártya helyett
  ugyanaz a korall „selyem" kártya (`.b-contact-silk`) világos B háttéren; fehér „Lemondom" gomb; érvénytelen
  linknél „Új időpontot foglalok" gomb (→ főoldal foglalási sáv). A lemondás logikája változatlan.
- **Foglalási e-mailek** (`lib/booking-notify.ts` → közös `layout`): a gomb a B korall (#c8401f) fehér betűvel, a
  háttér a B krém, a logó „X" és a linkek a B korall. A közös sablont a meghívó levél (`invite-mail.ts`) is
  használja, így az is egységes lett. (E-mailben átmenetes háttér nem megbízható, ezért ott telt szín.)
- A régi `/ingatlan` landing saját konzultációs ablaka (`IngatlanConsultModal`) nem elérhető (az oldal a
  Referenciákra irányít), ezért nem nyúltam hozzá.

tsc + eslint hibamentes. Chrome-ellenőrzés Márk kérésére nem volt.

## 2026-11-24 – 6. lépés, 11. kör: „selymesebb" kapcsolat-sáv

**Mi változott (Márk: „nagyon sárgás, legyen több színdinamika, selymesebb"):** a kapcsolat-sáv („Foglalj ingyenes
felmérést", főoldal / Referenciák / kezdőlap) a telt korall helyett új `.b-contact-silk` hátteret kapott (globals.css):
mély terrakotta → korall → málna/bordó átlós átmenet, sarokban mélyebb árnyalatok és halvány meleg fényfolt, rajta
lassan (14 mp) oda-vissza vonuló, nagyon halvány selyemfény; a krémfehér selyemszalagok maradnak. A fehér szöveg
kontrasztja a legvilágosabb ponton is ≥ 4,7:1 (mérve). „Mozgás csökkentése": a fény áll. tsc + eslint hibamentes.
- Módosítás (Márk: „a jobb oldalon a lila cserélődjön"): a málna/bordó (lilás) árnyalatok helyett a jobb oldal mély,
  égetett rozsdabarna (#8f2e17 → #6f2412, a sarokban sötét barna árnyék) — a márka meleg színeihez illik.

## 2026-11-24 – 6. lépés, 10. kör: „Miért érdemes?" blokk a belépett kezdőlapon

**Mi változott (Márk kérése):** a belépett kezdőlapon a magyarázó rész (moduljaim / „Még nincs modulod" kártya) és a
„Legutóbbi munkáim" közé új blokk került (`NewHome.tsx`, szöveg: `site-copy.ts` → `WHY_CUSTOM_MODULE`):
- bal oldalt: „Miért érdemes? · A modern cégeknél az AI-modul lassan alapfelszereltség." + két rövid bekezdés (a napi
  gyors munkához kevés az általános program; cégre szabva készül, úgy dolgozik, ahogy ti) + három címke
  (Cégre szabva · Gyorsabb napi munka · Kevesebb kézi lépés);
- jobb oldalt a korábbi „Mi az egyedi modul?" ismertető animációja (`custom-module/MainGoalAnimation.tsx`, változatlanul):
  szétszórt kézi munkadarabok → a modul → egy kattintás → egy kész anyag. Fix magasságú dobozban.
- Szám vagy mért ígéret nincs a szövegben (az animáció saját „Órákig tartó kézi munka → Percek alatt kész" felirata
  a korábbi oldalról jön — ha ez túl erős állítás, átírható).
- Megjegyzés: az animáció SVG (SMIL), a „mozgás csökkentése" beállításra nem áll le — ha kell, ezt külön javítom.

- Olvashatóság (Márk: „a felette lévő blokkban nem olvasható mindenhol a szöveg"): a „Még nincs modulod" kártyában a
  selyemszalagok halványabbak (70%), a szövegek új `.b-glow-text` osztályt kaptak (puha fehér fény a betűk körül;
  gombon és korall elemen kikapcsolva), és erősebb színt: a leírás és az idővonal szövege `b-ink` (eddig `b-ink-2`), félkövérebb.

tsc + eslint hibamentes. Chrome-ellenőrzés Márk kérésére nem volt.

## 2026-11-24 – 6. lépés, 9. kör: kezdőlapi referencia-ízelítő helyett átvezető sor; bemutató a Referenciák oldalon

**Mi változott (Márk kérése):**
- Belépett kezdőlap (`NewHome.tsx`): a „Nézd meg, mit építettünk egy ingatlaniroda számára" rész (3 kis kártya)
  kikerült; helyette egy vékony sor: „Referenciák" + „Tekintsd meg a referenciákat →" gomb → `/referenciak`.
  Márk kérésére sötét sáv lett (`bg-b-dark`, krém szöveg, telt korall gomb), mint a felső menüsor.
- Referenciák oldal (`/referenciak`): a hero alá bekerült a főoldali interaktív GDN-bemutató (`GdnShowcase`,
  benne az „Alaprajzból 3D" three.js-animáció), „Interaktív bemutató · Amit egy ingatlaniroda kapott tőlünk." címmel,
  világos B-sávban. Az oldal többi része változatlan (régi sötét stílus — a teljes B-átalakítás továbbra is nyitott).
- A `ReferenceCards.tsx` már sehol nincs használva (a `CityLines.tsx`-szel és a `ModuleWindow.tsx`-szel együtt kérésre törölhető).

tsc + eslint hibamentes. Chrome-ellenőrzés Márk kérésére nem volt.

## 2026-11-24 – 6. lépés, 8. kör: aranyozott kiemelő címkék a hero-ban

**Mi változott (Márk kérése):** új közös osztály `.b-gold` (globals.css, `@layer components`): arany átmenetes
háttér, sötétbarna szöveg (kontraszt > 7:1), finom árnyék és lassú fényvillanás (csökkentett mozgásnál áll).
- A hero „EGYEDI, CÉGRE SZABOTT MODULOK" címkéje aranyozott, nagyobb.
- A futó sáv fölötti felirat aranyozott címke lett: „Bármilyen iparágra építünk." — a „Néhány ötlet:" rész Márk
  döntésére kikerült. **Eltérés a terv 29-től** (ott a sáv elemei „ötletként" felcímkézve szerepelnek) — a tervezőnek
  átvezetendő.

**Képernyőkép:** `docs/visszajelzes/6-b-arculat/v7-arany-cimkek.jpg` (még az arany változat). tsc + eslint hibamentes.
- Módosítás (Márk: „ne arany legyen"; döntés: sötét + korall): az osztály neve `.b-highlight` lett — sötétbarna
  kapszula (mint a felső sáv), krém betű (kontraszt > 12:1), korall szegély és korall pont a szöveg előtt, halvány
  korall fényvillanás. Chrome-ellenőrzés Márk kérésére nem volt, a felületet ő nézi meg.
- Áthelyezés (Márk kérése): az „Egyedi, cégre szabott modulok" címke lekerült a hero tetejéről, és a „Bármilyen
  iparágra építünk" mellé került, a futó sáv fölé — a kettő egymás mellett, középre igazítva (keskeny kijelzőn
  egymás alá törnek). A szimmetria kedvéért a második címke végéről a pont kikerült. A hero most a főcímmel indul.

## 2026-11-24 – 6. lépés, 7. kör: „Alaprajzból 3D" a modul SAJÁT three.js motorjával, falszínezés nélkül

**Mi változott (Márk kérése: „vegyük le a falak színezését, a falak illeszkedése és a hitelesség legyen tökéletes,
ha kell, three.js"):** a `Floorplan3DDemo.tsx` CSS 3D helyett már a modul saját motorját használja:
`lib/floorplan3d/scene.ts → buildApartment` a modul mintalakásán (`lib/floorplan3d/demo.ts`, 10,60 × 7,00 m — a plakát
lakása), a modul alap falvastagságaival (belső 10 cm, külső 30 cm). Így a falak valódi vastagságúak, a sarkok és a
T-csatlakozások pontosan illeszkednek, az ablakok (keret + üveg) és ajtók (tok + lap, erkélyajtó üveges) a valódi
helyükön vannak, valódi fénnyel és árnyékkal. Új külső függőség nincs (a `three` már a projekt része).
- Ütemek (14,5 mp, minden átmenet folyamatos): egyenes alaprajz felülnézetből (sötét falvonalak, helyiségnév + m²)
  → a kamera lágyan megdől és ráfordul → a falak egyszerre, egyenletesen kinőnek (a falvonal színe közben
  vakolatszínre úszik) → áttűnéssel a nyílászárók → áttűnéssel a burkolat (a modul bemutatójának padlói:
  `demoFloors.ts`) → helyiségcímkék m²-rel, lágyan induló forgás, gyorsan érkező érdeklődő üzenetek → áttűnéssel újra.
- **Falszínezés nincs**: a falak a modul vakolt fehérjében maradnak.
- Villódzás ellen: a „papír" padló és a burkolat közé polygonOffset + emelés, szűkebb kamera-mélységtartomány.
- Csak akkor rajzol, ha látszik; a fülek automatikus lapozása is csak látható blokknál fut (különben a 3D „lemaradna").
- Mobilon a kamera hátrébb lép, és csak a legfrissebb üzenet látszik. „Mozgás csökkentése": kész, álló kép.

**Képernyőkép:** `docs/visszajelzes/6-b-arculat/v6-alaprajz-3d-animacio.jpg`. Asztali és 390 px-es nézet ellenőrizve.
tsc + eslint hibamentes.

## 2026-11-24 – 6. lépés, 6. kör: „Alaprajzból 3D" animáció, első fülként

**Mi változott (Márk kérése, minta: TWINX prémium 3D plakát):** új `src/components/site/b/Floorplan3DDemo.tsx`
(tiszta CSS 3D + SVG, kép nélkül), a GDN-bemutató **első** füle.
- Életszerű minta-lakás: nappali erkéllyel, hálószoba, szoba, fürdő, előszoba, konyha; reális helyű ablakok
  (kettős vonal) és ajtók (nyitásív), bejárati ajtó az előszobán, erkélyajtó a nappaliból.
- Ütemek (~13,5 mp, ismétlődik): alaprajz → megdől 3D-be → kinőnek a falak (ajtó/ablak helye nyitva, ablakban
  üveg, parapet, szemöldök) → helyiségenként más színre festődnek → lerakódik a burkolat (parketta, fürdőcsempe,
  járólap, mintás konyhacsempe, erkélykő) → megjelennek a helyiségek m²-rel, a modell forog, gyorsan jönnek az
  érdeklődő üzenetek. Alul ütem-felirat, fent „Szemléltető animáció" jelölés.
- A 3D-fül addig marad, amíg az animáció végigfut, utána lapoz tovább; a többi fül 8 mp. A színpad magasabb lett
  (400 / mobilon 300 px), minden fülnél ugyanakkora. „Mozgás csökkentése": a kész állapot áll, forgás nélkül.
- A m²-adatok és az üzenetek a minta-lakásé / illusztráció, nem ügyféladat.
- Finomítás (Márk kérése): a falaknak két oldala van — **kívül egységes homlokzatszín**, belül a helyiség saját
  színe (a fal két oldala a mellette lévő helyiséget kapja; két lap `backface-visibility: hidden`-nel).
  Lágyabb mozgás: a megdőlés 1,3 mp, a falak egymás után, 1,3 mp alatt, lassuló görbével nőnek ki; utánuk
  áttűnéssel érkeznek az ablakok (üveg + fehér keret) és az ajtókeretek.
- 2. finomítás (Márk: „ugrások vannak a festésben és az ajtók megjelenésében"): az ok az volt, hogy a háttér-
  színt / mintás burkolatot közvetlenül cseréltük (a mintás háttér nem animálható, ezért ugrott), és falanként
  eltérő késleltetéssel. Most a festés és a burkolat külön réteg, **egyenletes áttűnéssel (1,1 mp), minden falon
  és helyiségen egyszerre**; a falak egyszerre nőnek ki (1,6 mp, lágy görbe), a nyílászárók egyszerre, csak
  áttűnéssel jönnek (méretugrás nélkül); a forgás lágyan indul. Mérve: az áttűnések folyamatosak, nincs ugrás.
- 3. finomítás (Márk: „a színek ugrálnak össze-vissza"): két ok volt. (1) A forgást a framer `animate`
  kulcskocka-tömbje vezérelte, és minden új érdeklődő-üzenetnél (újrarajzolás) **elölről indult** → a modell
  visszaugrott, a látott falszínek ugráltak. Most a forgás CSS-animáció (`fp-spin`, globals.css) egy belső
  „tányéron": pontosan egy kör az 5. ütem alatt, lágy indulással és megállással, ugyanabban a szögben ér véget →
  újrarajzolás és újrakezdés sem ugrasztja. Mérve: a szög folyamatosan, egy irányba nő. (2) A fal két lapja egy
  síkban volt (villódzhatott); most 1,2 px-re elállnak egymástól (falvastagság).
- A teljes referencia-blokk teljes szélességű, sötétebb sávot kapott (`bg-b-surface`), alatta térköz a kapcsolat-sávig.

**Képernyőkép:** `docs/visszajelzes/6-b-arculat/v6-alaprajz-3d-animacio.jpg`. Asztali és 390 px-es nézet ellenőrizve
(mobilon a modell kisebb, a m²-lista rejtve, az üzenetek a jobb felső sarokban). tsc + eslint hibamentes.

## 2026-11-24 – 6. lépés, 5. kör: GDN-referencia interaktív bemutató

**Mi változott (Márk döntése):** a főoldali „Működő példa" 3 kártyája helyére interaktív bemutató került
(`src/components/site/b/GdnShowcase.tsx`, szövegek: `site-copy.ts` → `GDN_SHOWCASE`).
- Cím: „Működő példa · GDN Mandala Ingatlaniroda — Amit egy ingatlaniroda kapott tőlünk." + „A GDN Mandala kollégái
  naponta használják…" (terv 11 szerinti mondat).
- 6 fül: Látványtervező, Képjavító, Hirdetés-ellenőrző, Hirdetésszöveg, Értékbecslés, Alaprajzból 3D (a videó Márk
  döntésére kimaradt). Fix méretű színpad: a látványtervnél és a képjavítónál VALÓDI előtte–utána kép húzható
  csúszkával („Koncepcióterv", ill. „AI-val javított kép" jelöléssel); a többinél rajzolt, animált mini-felület
  (ellenőrző lista, gépelt mintaszöveg „illusztráció" jelöléssel, ársáv szám nélkül, alaprajz → 3D billenés).
- Alatta „Előtte / Most, a modullal" összevetés, **szám és idézet nélkül** (terv 11: csak GDN által jóváhagyott adattal).
- Magától lapoz 8 mp-enként (haladásjelző a fülön), egér fölötte megáll, kattintás után nem lapoz tovább.
  „Mozgás csökkentése": nincs lapozás és pásztázás. Mobilon a fülsor vízszintesen görget, az aktív fül látszik.
- A régi `ReferenceCards` a kezdőlapi ízelítőben marad.

**Képernyőkép:** `docs/visszajelzes/6-b-arculat/v5-gdn-referencia-bemutato.jpg`. 1440 és 390 px-en ellenőrizve
(nincs kilógás, a szövegdobozok nem csordulnak túl). tsc + eslint hibamentes.

**Márknak:** az „Előtte / Most" mondatokat érdemes Tiborral/a GDN-nel átnézni (site-copy.ts). Ha lesz jóváhagyott
szám (pl. időmegtakarítás), egy sorral kiemelhető.

## 2026-11-24 – 6. lépés, 4. kör: Irodai fiók bemutató a példa-modulok helyén

**Mi változott (Márk kérése):** a főoldalon a hero alatti „példa-modulok" ablak (ModuleWindow) helyére azonos
vékonyságú, animált **Irodai fiók** blokk került (`src/components/site/b/OfficeShowcase.tsx`).
- Cím: „Irodai fiók · Egy cég, egy közös tér." + egy mondat: a cégnek épített modulokat minden kolléga eléri,
  a munkát megosztják egymással, gyorsabb a napi munka.
- Bal oldalon „Közös modulok" polc (Ajánlatkészítő, Ügyfélkérdés-válaszoló; mindegyiken a csapat jelei — „Mindenki eléri").
- Jobb oldalon a munka útja, 4 ütem ismétlődik (2,8 mp): elkészül a modullal → megosztva a közös mappában →
  a kolléga folytatja → „Minden modul, mindenkinek" (a polc kiemelődik). Fix méretek, nincs ugrálás;
  „mozgás csökkentése" beállításnál álló kép (megosztva).
- Csak a már működő részeket mutatja (közös mappa, közös modulok). A „munka küldése egymásnak" még „Hamarosan",
  ezért nem szerepel. Szerepek (Kolléga / Vezető), nincs kitalált név vagy szám.

- Utólagos finomítás (Márk kérése): a blokk teljes szélességű, kicsit sötétebb sávot kapott (`bg-b-surface`),
  a cím és a leírás pedig sötét kiemelő dobozba került (krém szöveg, korall „IRODAI FIÓK" címke).

**Képernyőkép:** `docs/visszajelzes/6-b-arculat/v4-irodai-fiok-bemutato.jpg`. 390 px-en ellenőrizve: egymás alá
rendeződik, nincs kilógás. tsc + eslint hibamentes.

**Nyitva:** `ModuleWindow.tsx` már sehol nincs használva (a `CityLines.tsx`-szel együtt kérésre törölhető).
A terv 29 / 4.3 (modul-ablak) átvezetendő: helyette Irodai fiók bemutató.

## 2026-11-24 – 6. lépés, 3. kör: selymes háttérvideó és bronz selyemszalagok

**Mi változott (Márk döntése):** a bronz selyemszalagos AI-klip a sötét „Mi az egyedi modul?" sáv háttere lett
(áttűnéses hurok), a vonalas városkép (CityLines) helyére kódból rajzolt bronz selyemszalagok kerültek.
- `public/design/silk-loop.mp4` (11 mp, 1600 px, hang nélkül, ~1,4 MB) + `silk-poster.jpg`. A hurok a fájlba van
  „sütve": az eredeti klip utolsó 2 mp-e áttűnik az elejébe, ezért a sima `loop` sem ugrik. Újravágás parancsa a
  komponens fejkommentjében.
- `src/components/site/b/SilkVideo.tsx`: videó + állókép + balról sötét átmenet (a szöveg a kép fekete felén).
  Mobilon és „mozgás csökkentése" beállításnál csak állókép (kevesebb adat, nincs mozgás).
- `src/components/site/b/SilkRibbons.tsx`: 3 csavarodó, hullámzó szalag bronz átmenettel, nagyon lassú sodródás
  (`.b-silk`, globals.css; csökkentett mozgásnál áll). Helyek: főoldali hero alja, kapcsolat-sáv (krémfehér
  változat), kezdőlap üres-állapot kártyája.
- A sötét sáv elrendezése: eddig két hasáb volt, most a szöveg egy hasábban balra kerül (a jobb oldalon az alak),
  alatta a TWINX pecsét. A korábbi meleg fényfolt és a városkép innen kikerült.

**Képernyőképek:** `docs/visszajelzes/6-b-arculat/v3-sotet-sav-selyem-video.jpg`, `v3-kapcsolat-selyemszalag.jpg`.

**Ellenőrzés:** `tsc --noEmit` és eslint (érintett fájlok) hibamentes. A videó fut (readyState 4), nincs konzolhiba,
390 px-en nincs vízszintes kilógás; ott az állókép látszik, a szöveg olvasható.

**Nyitva:** a `CityLines.tsx` már sehol nincs használva, törölhető (kérésre törlöm). Mobilon a sötétítés erős,
így a kép alig látszik — ha kell, lazítható. A terv 29-be átvezetendő: a sötét sáv videós háttere + selyemszalagok.

## 2026-11-24 – 6. lépés, 2. kör: sötét felső sáv, hangulati vonalgrafika, TWINX pecsét
Melyik beszélgetés: Fejlesztés
Terv, amiből dolgoztunk: Márk visszajelzése a 6. lépésre (három ötletkép). Döntései: teljesen sötét felső sáv; kódból rajzolt vonalgrafika; pecsét-elem egy szekcióban; HTML-minta nélkül, egyből kódba.
Elkészült:
- **Felső sáv:** sötét (`b-dark`), világos szöveggel, korall „Ingyenes felmérés” gombbal. A logó X-e `b-accent-on-dark`. A mobil menü is sötét. A rács és a középvonal változatlan.
- **`CityLines`** (`src/components/site/b/CityLines.tsx`): vonalas, „modern város” SVG. Épületkontúrok, ablaksorok, tornyok, fényvonal, felül elhalványítva. Abszolút pozícióban, `aria-hidden`, nincs layout shift.
  - Világos változat: a hero és a futó sáv mögött, és a kezdőlap üres állapotú kártyájának alján.
  - Sötét, izzó változat: a „Mi az egyedi modul?” sávban, meleg korall fénnyel a sarokban.
- **`TwinxStamp`** (`src/components/site/b/TwinxStamp.tsx`): „TWINX · EGYEDI MODUL · CÉGRE SZABVA” pecsét a „Mi az egyedi modul?” sávban, a cím alatt. Szám és állítás nincs rajta.
Képernyőképek: `docs/visszajelzes/6-b-arculat/`
- `v2-fooldal-sotet-savval.jpg`
- `v2-kezdolap-modul-nelkul.jpg`
- `v2-kezdolap-modullal.jpg`
Eltérés a tervtől:
- A terv 29 3. szakasza a felső sávot a világos háttéren írja le; most sötét (Márk döntése). **A tervezőben át kell vezetni** (D69/D70 kiegészítése: „a felső sáv sötét”).
- A hangulati elemek nem szerepelnek a terv 29-ben, ezért új elemekként kell rögzíteni.
Új buktató / tanulság: az SVG-szöveg (pecsét) más betűvel szélesebb lehet, ezért `textLength`-tel rögzítettük a szélességét.
Nem lett kész / Hamarosan:
- A hangulati elem nincs a kapcsolat sávban és a láblécben (szándékosan, ne legyen túl sok).
- A Referenciák oldal átdolgozása továbbra is nyitott.
Ellenőrzési lépések eredménye:
- `tsc` és `eslint` az érintett fájlokon rendben.
- A felső sáv a localhoston ellenőrizve belépve, és a kezdőlapon Besorolatlan előnézettel; a mobilnézet a sötét sávval még nincs újramérve.
Döntés kell tőled, Márk:
- a vonalgrafika erőssége (most halvány);
- kell-e a pecsét máshol is (pl. kapcsolat sáv, lábléc).
Éles állapot: helyben kész, push nélkül.

## 2026-11-24 – 6. lépés: B arculat – főoldal és belépett kezdőlap
Melyik beszélgetés: Fejlesztés
Terv, amiből dolgoztunk: docs/terv/29 (D69, D70), design/B-fooldal.dc.html, design/B-kezdolap.dc.html, 11 (tartalom); 3. export
Elkészült:
- Design-tokenek központi helyen: `src/app/globals.css`, „B ARCULAT” blokk.
  - Tailwind `@theme` színek: `b-bg`, `b-card`, `b-line`, `b-surface`, `b-surface-2`, `b-accent-soft`, `b-accent-tint`, `b-ink`, `b-ink-2`, `b-ink-3`, `b-accent`, `b-accent-ink`, `b-dark`, `b-on-dark`, `b-on-dark-2`, `b-accent-on-dark`.
  - Lekerekítés: `--radius-card*`. Árnyék: `shadow-b`, `shadow-b-lg`.
  - Közös osztályok (`@layer components`): `.b-btn`, `.b-btn-outline`, `.b-btn-dark`, `.b-btn-light`, `.b-card`, `.b-tag`, `.b-eyebrow`.
  - Mozgások: `.b-marquee` (30 mp), `.b-float` (6 mp), `.b-pulse` (2,6 mp), `.b-bar`. Csökkentett mozgásnál állnak.
  - A régi `--twx-*` változók az admin-körig változatlanok.
- **Felső sáv** (`SiteHeader.tsx`): világos B-változat, háromoszlopos rács (`minmax(0,1fr) | auto | minmax(0,1fr)`), fix 72 px. Belépés előtti és utáni változat; az Irodai fiók mellett marad az értesítési hely. Asztali menü 1280 px-től, alatta hamburger.
- **Főoldal** (`(public)/page.tsx`):
  - hero, futó sáv (`IdeaMarquee`), lebegő modul-ablak (`ModuleWindow`);
  - sötét „Mi az egyedi modul?”;
  - Hogyan működik, Hol fut a modul (4 fix kártya);
  - Referenciák (`ReferenceCards`), korall Kapcsolat sáv, világos lábléc.
  - A szövegek egy helyen: `src/lib/site-copy.ts`. A „Mi az egyedi modul?” szöveg Márk átnézésére vár.
- **Kezdőlap** (`NewHome.tsx`):
  - üdvözlés;
  - modul nélkül nagy kártya pulzáló „Időpontot foglalok” gombbal (a lenti foglalási blokkhoz visz) és 3 lépéses idővonallal; Besorolatlan felhasználónál ugyanez, plusz a terv 22 sora;
  - modullal Moduljaim kártyák (fix 96 px, „⋯” menü, jobb klikk);
  - Legutóbbi munkáim, Irodai fiók („Hamarosan”), referencia-ízelítő, foglalási blokk.
  - A kezdőlap a dashboardon 1200 px-es keretet kap (`DashboardFrame`); a modulok kerete változatlan.
- **Foglalás:** a `BookingForm` `tone="light"` változatot kapott (CSS-változókkal), a logikája nem változott. A `ContactBlock` korall sáv minden oldalon (főoldal, referenciák, kezdőlap).
- **`Reveal.tsx`:** mostantól figyeli a csökkentett mozgás beállítást.
Képernyőképek: `docs/visszajelzes/6-b-arculat/`
- `fooldal-kijelentkezve-1000-es-390.jpg`
- `kezdolap-modullal-1440.jpg`

A belépett, modul nélküli (Besorolatlan) nézetet 1440 px-en és 390 px-en is ellenőriztem, ezekről nem mentettem képet.
Ellenőrzési lépések eredménye:
- `tsc` rendben. `eslint` az érintett fájlokon rendben; meglévő, nem érintett hibák: `image-enhance/page.tsx`, `visualization/page.tsx` (nem használt változók).
- `next build` rendben (Márk gépén).
- **Középvonal:** a menü közepe és az oldal közepe közti eltérés 0,00 px belépve és kijelentkezve is (1425 px széles nézet). A sáv mindkét állapotban 72 px.
- **Mobil (390 px):** nincs vízszintes kilógás (`scrollWidth` = `clientWidth`). A hamburger jobbra, a logó balra áll.
- **Kontraszt (számolva):**
  - fő szöveg és `#5a4d42` a háttéren: 7.26;
  - `#7a6a5a` a háttéren: 4.63, kártyán: 5.2;
  - fehér a korall gombon: 4.99;
  - címkék (`b-accent-ink` a halvány korallon): 4.89;
  - sötét sávon a szöveg: 11.06, az akcent: 8.6.
- **Admin:** a fő lapok (`/admin`, Felhasználók, Cégek, Előfizetések, Foglalások, Egyedi modulok, Pénzügy) 200-zal betöltenek; az admin elrendezéséhez nem nyúltam.
Eltérés a mintától:
- A korall SZÖVEG világos háttéren `#b3381a` (`b-accent-ink`), nem `#c8401f`, mert az csak 4.06–4.44 kontrasztot ad. A gombok és kitöltések `#c8401f`-ek maradtak.
- A minta `#8a7a6a` halvány szövege helyett `#7a6a5a` (4.14 helyett 4.63/5.2).
- A korall kapcsolat-sávban a halvány `#ffe9e1` szöveg helyett fehér (4.28 helyett 4.99).
- **Kapcsolat sáv:** a minta egy gombot mutat; nálunk a sávban a meglévő kétlépéses foglalási doboz áll (a CODE-prompt szerint). Élesítésig (`BOOKINGS_PUBLIC`) kijelentkezve az e-mailes tartalékdoboz látszik.
- **Lábléc:** a mintánál bővebb (Hogyan működik, Referenciák, Kapcsolat, ÁSZF, süti-beállítások — a terv 11 szerint).
- **Irodai fiók sáv:** a főoldalról kimaradt (a terv 11-ben benne van, a B-mintában nincs). A kezdőlapon kártyaként szerepel.
- **Üdvözlés:** „Üdv újra, [teljes név]!”. A sorrendet (vezeték- / keresztnév) nem tippeljük.
- **Referencia-képek:** csak a Látványtervhez van valódi kép (`showcase/visual-after.jpg`, „Koncepcióterv” jelöléssel). A Hirdetés-ellenőrző és az Értékbecslés „Képernyőkép hamarosan” helyőrzőt kapott.
- **Középre igazítás:** mérve pontos, de kijelentkezve a jobb oldali gombsor közel esik a menühöz (kb. 45 px hézag 1440 px-en). Ez a mintában is így van.
Mit használtunk fel a régi /ingatlan oldalból: semmit. A sötét, filmes hero és a felugró főcímek nem illenek a világos B arculathoz. A futó sáv és a lebegés egyszerű CSS-animáció lett. A `/ingatlan` komponensei érintetlenek.
5/b állapota: élesben van (`8ddc6fc`), a `/ingatlan` → `/referenciak` átirányítás működik. Nem vontam vissza.
Nyitott maradt:
- **Csökkentett mozgás:** a CSS- és a Framer-szabály kódban kész, de a macOS-beállítással Márk próbálja ki (Kisegítő lehetőségek → Mozgás csökkentése).
- **Referenciák oldal** (`/referenciak`): a felső sáv és a kapcsolat-sáv már B, a többi szekciója még a régi sötét stílusú. Külön kör kell.
- **Valódi képernyőkép** a Hirdetés-ellenőrzőhöz és az Értékbecsléshez.
- **Kezdőlap modullal:** admin nézetben ellenőrizve. Ingatlan-hozzáféréses felhasználóval ugyanez a komponens fut.
- **Admin átalakítása:** külön lépés (D70).
Döntés kell tőled, Márk:
- a „Mi az egyedi modul?” szöveg jóváhagyása;
- a sötétebb korall szövegszín elfogadása;
- a Referenciák oldal átdolgozása mikor jöjjön.
Éles állapot: helyben kész, push nélkül.

## 2026-11-24 – 5/b: Kampányoldalak, kisebb módosítások
Melyik beszélgetés: Fejlesztés
Terv, amiből dolgoztunk: docs/terv/28 (5/b); D63, D65, D66
Elkészült:
- **`/ingatlan`:** 301-es átirányítás a `/referenciak` oldalra (`next.config.ts`). Az oldal kódja, az `ingatlan_invites` és a `profiles.invite_code` megmarad.
- **`/bemutatkozas`:** a kredites regisztrációs blokk helyén az új irány áll: „A te cégedre szabott modul”, a javasolt szöveg és „Ingyenes felmérés” gomb (a főoldal kapcsolat/foglalás blokkjára visz). Ár és „kredit” nincs. Az angol változat változatlan, abban nem volt kredit.
- **Regisztráció** (ablak és `/register`): nincs ajándékkredit- és ajándékkód-szöveg. A „Ha meghívót kaptál…” szöveg mindenkinek látszik. A kampány-forrás csak a mérésekhez marad.
- **Központi konstansok:** `src/lib/policy.ts`.
  - `RETENTION_DAYS` = 90, ideiglenes, a jogász véglegesíti. Cég lezárásakor beállítja a megőrzési határidőt (lezárás napja + 90 nap); a határidő előtt a törlés továbbra is csak a jelöléssel kérhető.
  - `INVITE_VALID_DAYS` = 7: a meghívó és a levél szövege is ebből dolgozik.
  - `INVITE_HOURLY_LIMIT` = 20.
- **Végleges felhasználói szövegek egy helyen:** `src/lib/user-texts.ts` („modul nem érhető el”, leállási szöveg).
- **Felhasználó szerinti előnézet:** az Irodai fiók oldal a megjelenített felhasználó irodáját és taglistáját mutatja (`readSubjectId`). Csak olvasás, a módosítás az előnézetben továbbra is tiltott.
Eltérés a tervtől:
- **Meghívó-korlát:** a 20/óra értéket az adatbázis-függvény (`create_invitation`) ellenőrzi. A TS-konstans dokumentálja, de a módosításához migráció kell. Nem írtam át a függvényt, hogy ne kelljen újabb migráció.
- **Megőrzési határidő:** a lezárás után külön lépésben mentődik. Ha ez nem sikerül, üres marad, és akkor a szigorúbb (jelöléses) szabály él.
- **A Meta-hirdetés szüneteltetését** Márk a folytatással jóváhagyta (nem külön üzenetben).
Új buktató / tanulság: a `/bemutatkozas` gombja nem mutathat a saját oldal `#kapcsolat` horgonyára (ugyanaz a blokk), ezért a főoldal `/#kapcsolat` blokkjára visz.
Nem lett kész / Hamarosan:
- a ConfirmEmailModal `bonusCredits` szövege a kódban maradt, de már semmi nem hívja;
- a régi `landing.ts` `ctaNote` és `/ingatlan` oldal kódja érintetlen (nem érhető el).
Ellenőrzési lépések eredménye: `tsc` és `eslint` (érintett fájlok) rendben. Függő kampány-jelentkező: **0** (az `ingatlan_invites` táblában 1 sor, „elfogadva”) — a Meghívók oldal nyugodtan maradhat menün kívül.
Döntés kell tőled, Márk: a megőrzési napok véglegesítése (NDA, jogász).
Éles állapot: helyben kész, push nélkül.

## 2026-11-24 – A vendéglátós modulok kódjának törlése
Melyik beszélgetés: Fejlesztés
Terv, amiből dolgoztunk: Márk kérése („minden, ami vendéglátás, töröljük"), nem tervből; D23 (egyedi modulok iránya)
Elkészült:
- Törölve:
  - 7 dashboard oldal (`/dashboard/hospitality/*`);
  - 13 API (`/api/hospitality/*`);
  - 5 komponens (`components/hospitality`);
  - a lib-fájlok (`hospitality`, `costing`, `simulation`, `recipes`, `suppliers`, `supplier-finalize`);
  - a vendéglátós PDF-ek;
  - 6 prompt-modul (menü, önköltség, profit-terv, beszállító belföld/EU, vendéglátós szakember);
  - a katalógus és a landing „Vendéglátás” fül és sorai;
  - az irodai és a kedvenc-címkék;
  - a „Korábbi munkák” típus-címkék;
  - a vendéglátós példák az egyedi modul oldalán.
- A Szakember-kereső csak ingatlanos maradt (a vendéglátós szakmák, szűrők és prompt kikerültek; az ingatlanos működés változatlan).
- A régi `/dashboard/hospitality/*` linkek a Dashboardra irányítanak.
Eltérés a tervtől: nincs terv. Az adatbázis érintetlen (Márk döntése): a 12 vendéglátós tábla és a régi migrációk maradnak; a lomtár-takarítás a régi beszállító-keresések fájljait továbbra is törli.
Új buktató / tanulság: a Szakember-kereső és a PDF-készítő közös volt a két iparággal — ezeket részlegesen kellett bontani, nem fájlonként törölni.
Nem lett kész / Hamarosan: a vendéglátós táblák eldobása (külön döntés, mentéssel); a `_backup` mappa régi főoldal-másolatai és a `docs/ugynokseg` szövegei érintetlenek.
Ellenőrzési lépések eredménye: `tsc` rendben; `eslint` az érintett fájlokon rendben (a meglévő `MAX_IMAGES` hibán kívül).
Döntés kell tőled, Márk: kell-e később a vendéglátós táblák végleges törlése.
Éles állapot: helyben kész, push nélkül.

## 2026-11-24 – 5/a: Az Ingatlan csomag havi költségkerete
Melyik beszélgetés: Fejlesztés
Terv, amiből dolgoztunk: docs/terv/27, 28 (5/a), 20; D62
Elkészült:
- Migráció `20261124200000_package-caps.sql` (+ down): cégenkénti Ingatlan-keret (Ft, nettó önköltség), havi használat budapesti hónap szerint, foglalás sorzárral és idempotens kéréskulccsal, feloldás hibánál, 80/100%-os jelzés egyszer / hónap / keret-érték, keret-módosítás csak adminnak, indoklással, naplózva; a hozzáférés-adás egy tranzakcióban ellenőrzi a cég-tagságot és a keretet.
- Hook a közös kredit-ponton (`src/lib/credits.ts`). A korábbi „hozzáféréssel nincs levonás” ág helyett most a cég keretéből foglal. Hibánál a modulok egységesen `refundCharge`-dzsel oldanak fel. Az admin továbbra sem foglal.
- Központi becslő: `src/lib/package-cap.ts`. A `costs.ts` konstansaiból számol, ugyanazokból, amelyekkel a Költségfigyelő naplóz. Ismeretlen szolgáltatásnál hibát ad, nem enged át csendben.
- Leálláskor a terv 22 szövege jelenik meg, szám nélkül, 429-es kóddal.
- Felhasználók → Ingatlan pipa: Besorolatlan felhasználónál előbb a „Céghez rendelés” ablak nyílik. Keret nélküli cégnél a felület bekéri a havi keretet (kötelező, Ft).
- Előfizetések: új „Ingatlan csomag — havi keretek” doboz keret-sávval. A „⋯” menüben „Keret módosítása”, indoklással.
  - A már Ingatlan-hozzáféréssel rendelkező, de keret nélküli cégek is megjelennek, „Nincs keret” jelöléssel. Náluk a „⋯ → Keret megadása” pótolja a keretet.
  - A cégben nem lévő (Besorolatlan) hozzáférésesek nem jelennek meg itt. Ők céghez rendelés nélkül nem indíthatnak költséges műveletet.
- A napi cron az Ingatlan-keretekre is lefut.
Eltérés a tervtől:
- **Tábla-döntés:** külön, additív táblák készültek (`package_caps`, `package_usage_events`, `package_cap_notifications`), nem egy `ingatlan` sor a `company_modules`-ban. Ok: a `company_modules` sorához aktiválás, helyek, érvényesség és meghívásos `module_access` tartozik. Az Ingatlan-hozzáférés viszont felhasználóhoz kötött (`company_access`). A mezőkészlet a terv 20-é.
- **Elszámolás:** a közös kredit-pont nem kap jelzést a hívás sikeréről, ezért a foglalás egyben elszámolás a becsült költséggel; hibánál feloldás.
  - Tényleges költséggel nem számolunk újra. A becslés felső értékkel dolgozik: képjavításnál újrapróbálással, videónál a csomag szerint, értékbecslésnél fotó-elemzéssel.
- **Értékbecslés:** indulás előtt csak ellenőrzés történik. A kész riport utólag számít be a keretbe, akkor is, ha közben elfogyott (a kész eredményt nem dobjuk el).
- **Csak az Ingatlan szolgáltatások mennek a keretre.** A vendéglátós modulok Ingatlan-hozzáféréssel a korábbi módon (levonás nélkül) futnak.
- **Felhasználónként a legkorábbi aktív cég-tagság kerete számít,** ha annak a cégnek van Ingatlan-kerete.
Új buktató / tanulság:
- Ahol a hiba később, a háttérben derül ki (telekkutatás állapot-lekérdezése, videó háttérfolyamat), ott a foglalás nem oldódik fel. Ez a védelem javára túlszámol.
- Nem mennek át a kredit-ponton, ezért a keret sem védi őket:
  - képjavítás „újragenerálás” (`image-enhance/regenerate`);
  - a 3D-labor lépései (digitize / furnish / target / quality);
  - a logótisztítás.
  Ezek költségét csak a Költségfigyelő mutatja.
- A `floorplan-3d` jóváhagyásnak nincs egységes becslése, ezért Ingatlan-kerettel hibát ad, nem fut ingyen. Jelenleg prototípus.
- A szórólap és a 3D-megosztás meghosszabbítása 0 Ft (nincs külső API). A saját videómotort is 0 Ft-tal számoljuk: nincs hívásonkénti API-díja, de a futtatási költsége nincs benne.
- Meglévő, nem érintett eslint-hiba: `visualization/route.ts` nem használt `MAX_IMAGES` import (nem javítottam).
Nem lett kész / Hamarosan:
- a tényleges költséggel történő utólagos elszámolás;
- a fenti, a kredit-pontot megkerülő hívások bekötése;
- műveletenkénti használati lista az Ingatlan-keretnél.
Ellenőrzési lépések eredménye: `tsc` rendben; `eslint` az érintett fájlokon rendben (a fenti, meglévő hibán kívül). A migráció és a terv 27 / 5. szakasz 10 pontja Márk tesztjére vár: tesztcég kis kerettel, 80% / 100%, két párhuzamos kérés, admin, Besorolatlan felhasználó.
Döntés kell tőled, Márk:
- a kezdeti keretek cégenként;
- a kredit-pontot megkerülő hívások (újragenerálás, 3D-labor) bekötése;
- a saját videómotor 0 Ft-os becslése elfogadható-e;
- a vendéglátós modulok Ingatlan-hozzáféréssel maradjanak-e levonás nélkül.
Éles állapot: a migráció lefutott; push után élesben. Push után azonnal: keret megadása a meglévő Ingatlan-hozzáféréses cégeknek (Előfizetések → „Nincs keret” → ⋯ → Keret megadása).

## 2026-11-24 – Belépés, regisztráció és maradék régi szövegek
Melyik beszélgetés: Fejlesztés
Terv, amiből dolgoztunk: docs/terv/22 (5. C), D23 (nincs „kredit"), 3d utómunka
Elkészült: regisztráció (ablak és /register) fölött a terv 22 szövege („Ha meghívót kaptál…”) — kampány-forrásnál a régi ajándékkredites szöveg marad; a megerősítő ablak kredit nélkül; Beállítások új felületen kredit-kérés és saját (kreditvásárlási) számlázás nélkül; Kapcsolat oldal linkjei az Ingyenes felmérésre és a Referenciákra, a téma „Előfizetés, fizetés, számla”; leiratkozás szövege kredit nélkül.
Eltérés a tervtől: nincs.
Új buktató / tanulság: a 3d kivezetésből kimaradt a Beállítások oldal kredit-kérés panelje — most pótolva.
Nem lett kész / Hamarosan: ÁSZF (/aszf) még a kredites modellt írja le — jogászi átírás kell; /ingatlan és /bemutatkozas kampányoldalak érintetlenek (tervezői döntés).
Ellenőrzési lépések eredménye: `tsc` és `eslint` rendben.
Döntés kell tőled, Márk: ÁSZF átírása; kampányoldalak sorsa.
Éles állapot: push után élesben.

## 2026-11-24 – Terv 21: lemondás, lezárás, ügyféladat
Melyik beszélgetés: Fejlesztés
Terv, amiből dolgoztunk: docs/terv/21; D54
Elkészült: migráció `20261124180000_closure.sql` (lefuttatva): modul lemondása (hatályos napig él, nyitott meghívók vissza, nincs új meghívó / „Használom én is” / hosszabbítás / lejárati jelzés; napi cron „Lemondva”), újranyitás (Szünetel → Aktiválás), cég lezárása (archiválás; tagok Besorolatlanok, munkák megmaradnak; force indoklással), cég újranyitása, végleges törlés csak fizetési tétel nélkül, ügyféladat visszaadása (napló) és törlése négy szem elvvel (kijelölt jóváhagyók, saját kérés nem hagyható jóvá, részleges végrehajtás újraindítható), „Lezárt cég nyitott tétele” címke, Cégek menü jelzése a függő kérésekre; regiszter: kötelező `storesCustomerData`, törlő kezelők helye `src/lib/module-data-handlers.ts`.
Eltérés a tervtől: a megőrzési határidő amíg nincs eldöntve, a törlés csak „határidő előtt, az ügyfél írásbeli kérésére” jelöléssel kérhető; a cégvezetői „Lemondás kérése” és az automatikus törlés Hamarosan (a terv szerint).
Új buktató / tanulság: a closure migráció több korábbi függvényt (meghívás, Fizetve, lejárati jelzés, hozzáférés) új változatra cserélt — a down szkript visszaállítja őket.
Nem lett kész / Hamarosan: Telegram-értesítés a törlési kérésről (Telegram még nincs); a felhasználónak mutatott szöveg a hozzáférés megszűnésekor (jóváhagyandó).
Ellenőrzési lépések eredménye: `tsc` és `eslint` rendben; migráció lefutott; Márk tesztje: lemondás, lezárás, négy szem elv, végleges törlés.
Döntés kell tőled, Márk: megőrzési határidő (napok, NDA-val); jóváhagyók (Tibor felvétele).
Éles állapot: élesben, csak admin.

## 2026-11-24 – Felhasználók cég-oszlop, terv 20 (plafon) és terv 19 (ajánlat, fizetés)
Melyik beszélgetés: Fejlesztés
Terv, amiből dolgoztunk: docs/terv/12 (1.2), 19, 20, 22 (3.A); D31, D52, D53
Elkészült:
- Felhasználók: cég-tagságok (★ cégvezető), „Besorolatlan” jelölés és szűrő (Mind / Besorolatlan / Cégben), „Céghez rendelés”.
- Terv 20 — migráció `20261124120000_module-usage.sql` (lefuttatva): foglalás → elszámolás / feloldás (sorzár, idempotens kéréskulcs, naplózási hibánál a hívás nem indul), budapesti havi időszak, 80/100% jelzés (egyszer / hónap / keret; e-mail + Telegram, ha beállítva; személyes adat nélkül), leállás semleges szöveggel (terv 22), pluszcsomag, keret módosítása indoklással, napi cron (elakadt foglalások, jelzések); Előfizetéseknél keret-sáv és használati lista; a próba modulban 10 Ft-os próbaművelet.
- Terv 19 — migráció `20261124150000_finance.sql` (lefuttatva): ajánlat (Vázlat → Elküldve → Elfogadva / Elutasítva / Lejárt; elfogadás tételekkel, összeg-egyezés egy tranzakcióban), fizetési tételek (Esedékes → Kiszámlázva → Fizetve; Visszatérítve / Törölve indoklással; egyedi számlaszám; számlázási pillanatkép; havi díj „Fizetve” → érvényesség-hosszabbítás, idempotens), „Késik” jelzés, a cég Pénzügy ablaka (Ajánlatok / Fizetések / Számlázási adatok), Admin → Pénzügy (fülek, cégszűrő, CSV BOM-mal), lejárati figyelmeztetés 3 és 1 nappal előtte; a pluszcsomag mostantól fizetési tételt is ad.
Eltérés a tervtől:
- A 20 és a 19 sorrendje megcserélve (Márk döntése); a pluszcsomag fizetési tételét a 19-es migráció pótolta (cap_add_pack új változata).
- A keret (monthly_cap) első beállítása az Előfizetés-adatlapon történik; utána csak „Keret módosítása” (indoklással, naplózva).
- A Telegram helyett / mellett e-mail megy a BOOKING_NOTIFY_EMAILS címekre (Márk döntése); Telegram: TELEGRAM_BOT_TOKEN + CAP_TELEGRAM_CHAT_ID.
- A visszatérítés nem vonja vissza az érvényességet (a terv javaslata szerint az admin dönt).
Új buktató / tanulság: a terv 20 csak az egyedi modulokra szól — az Ingatlan-hozzáféréssel ingyenes használat költségét jelenleg semmi nem korlátozza (csak a Költségfigyelő mutatja).
Nem lett kész / Hamarosan: terv 21 (lemondás, lezárás, ügyféladat-törlés); cégvezetői „Számláim” nézet; Számla Agent és Stripe; cégnek küldött lejárati e-mail; műveletenkénti használati bontás és grafikon.
Ellenőrzési lépések eredménye: `tsc` és `eslint` (érintett fájlok) rendben; mindkét migráció lefutott; a plafon és a pénzügyi folyamat Márk tesztjére vár (próba modul: 50 Ft-os keret, 80% / 100%, pluszcsomag; ajánlat → tételek → számlaszám → Fizetve → érvényesség).
Döntés kell tőled, Márk:
- Ingatlan csomag költségvédelme (keret felhasználónként vagy a csomagra) — tervezői döntés.
- A leállási szöveg (terv 22 / 3.A) végleges jóváhagyása; a meghívó-korlát (20/óra/cég) és a 7 napos meghívó jóváhagyása.
- Mikor jön a terv 21 (az első lemondó ügyfél előtt kell).
Éles állapot: Felhasználók cég-oszlop, Pénzügy, Előfizetések keret-sávval élesben (csak admin látja); valódi ügyfélmodul még nincs aktiválva.

## 2026-11-23 – 3f és 4. lépés: nézet-váltó, egyedi modulok, előfizetés, meghívás
Melyik beszélgetés: Fejlesztés
Terv, amiből dolgoztunk: docs/terv/12 (1., 6.), 13, 14 (2.3–2.5, 3.), 16 (1.), 22 (3.A, 4.B, 6.D), 23; D43, D44, D46, D54, D56
Elkészült:
- 3f: nézet-váltó cég/felhasználó szerint („Kit nézzek?" kereső; cégnél a cégvezető szemével), a megjelenített személy valódi hozzáféréseivel; előnézetben minden beküldés tiltott (middleware, nem-GET API → 403); a Sales nézet megszűnt.
- 4a: migráció `20261124090000_company-modules.sql` (lefuttatva): `company_modules`, `module_handovers`, `module_invitations` (hash-elt token, 7 nap), `module_access`; függvények: állapot, előfizetés, átadás rögzítése/visszavonása, Aktiválás (6 DB-feltétel + regiszter és dataPolicy az API-ban), Kikapcsolás, meghívás/újraküldés/visszavonás (helyszámítás zárolással, 20 meghívó/óra/cég), „Használom én is", eltávolítás, elfogadás (megerősített, egyező e-mail).
- 4b: kód-regiszter (`src/lib/module-registry.ts`); Admin → Egyedi modulok (állapotok, felelős, átadási adatlap, történet, Aktiválás/Kikapcsolás) és Előfizetések (foglalt/összes hely, érvényesség, plafon, 3 napon belüli lejárat pirossal).
- 4c: cégvezető „Hozzáférések" ablaka (`/dashboard/hozzaferesek`, profilmenüből): modulonként egy sor, kollégák állapottal, meghívás, újraküldés, visszavonás, eltávolítás, „Használom én is", Cégvezetők doboz (kinevezés, lemondás).
- 4d: meghívó oldal (`/meghivo`): belépés/regisztráció zárolt e-maillel, „Elfogadom" (POST); egyedi modulok a Moduljaim menüben; belső „Próba modul" a regiszterben (Márk kérése) a teljes út kipróbálásához.
Eltérés a tervtől:
- Resend nélkül (Márk döntése) a meghívó link egyszer megjelenik a cégvezetőnek másolásra; Resend után automatikusan e-mail megy.
- Regisztráció + e-mail-megerősítés után a meghívót újra meg kell nyitni (nincs automatikus elfogadás) — az oldal ezt jelzi.
- Az átadási bejegyzés egyszerű adatlapként már most kész (terv 23), a pénzügyi emlékeztető (terv 19) nélkül.
- A Kikapcsolás Szünetel állapotba visz; az újraaktiválás Szünetelből érvényes átadással engedett.
Új buktató / tanulság: a nézet-váltó előnézetben az irodai fiók oldal még a saját (admin) irodát mutatja (az irodai API a valódi felhasználót nézi).
Nem lett kész / Hamarosan: plafon-mérés és leállás (terv 20); ajánlat és fizetés (terv 19); lemondás/lezárás (terv 21); Felhasználók táblában cég-oszlop és „Besorolatlan" jelölés; cégvezetői „Átvettem" gomb.
Ellenőrzési lépések eredménye: `tsc` és `eslint` (érintett fájlok) rendben; a teljes meghívási út (aktiválás → Használom én is → meghívás link-tartalékkal → elfogadás → Moduljaim) Márk tesztjére vár; a párhuzamossági és RLS-tesztek valódi felhasználói tokennel még hátravannak.
Döntés kell tőled, Márk: a meghívó-korlát (20/óra/cég) és a 7 napos érvényesség jóváhagyása; mi a következő lépés (Felhasználók cég-oszlop, terv 19, 20 vagy 21).
Éles állapot: Egyedi modulok, Előfizetések, Hozzáférések ablak és meghívó oldal élesben; valódi ügyfélmodul még nincs aktiválva (csak a próba modul).

## 2026-11-23 – 3. lépés (3a–3e) és élesítés
Melyik beszélgetés: Fejlesztés
Terv, amiből dolgoztunk: docs/terv/12-admin-terv.md, 14-adatmodell-terv.md (2.1, 2.2, 2.6), 11 (4. szakasz), 22 (3.A, 5.C), D30, D31, D40, D42, D45, D46, D51
Elkészült:
- 3a: új admin menü (Foglalások, Megkeresések, Felhasználók, Cégek, Előfizetések/Pénzügy/Egyedi modulok „Hamarosan”, Költségfigyelő, Eszközök); a Kredit-napló, Kredit-kérések, Meghívók kikerült a menüből (a kód és a cím megmaradt).
- 3b: migráció `20261123210000_admin-roles.sql`: csak admin és user; admin jog adása/elvétele megerősítéssel, naplózva (`role_audit_log`, `admin_set_role`); az utolsó admin DB-védelme; a 2 sales fiók user lett (lefuttatva).
- 3c: migráció `20261123220000_companies.sql`: `companies`, `company_members` (cégvezetői státusz cégenként, az utolsó cégvezető trigger-védelme), `access_audit_log` (csak hozzáfűzhető); Admin → Cégek (tagok, kinevezés, napló); „Céggé alakítás” a foglalásból (a regisztrált foglaló automatikusan tag lesz, nem cégvezető).
- 3d: kredit-kivezetés az „Új felület” kapcsoló mögött (app_settings.new_ui; admin mindig látja): Ingatlan-hozzáférés pipa a Felhasználóknál (company_access, naplózva); bekapcsolt kapcsolónál hozzáféréssel nincs levonás; a „kredit” eltűnik a fejlécből, a modulokból, a kezdőlapról, a vásárlásokból; modul-kapu hozzáférés nélkül (terv 22 szöveg); az irodai fiók kredit nélküli közös tér (OfficeSpaceView); az admin Kredit/Egyenleg oszlop és „+” gomb bekapcsolt kapcsolónál rejtve; a szerver-hibaüzenetekből kikerült a kredit.
- 3e: új felületen személyre szabott kezdőlap (Moduljaim, Legutóbbi munkáim, Irodai fiók, kapcsolatblokk; üres és Besorolatlan állapot) és az új felső sáv a dashboardon.
- Élesítés (Márk döntése): az új főoldal a `/` címen, a `/referenciak` mindenkinek; `/uj` → `/`; `/pricing` és `/egyedi-modul` → `/` (ideiglenes átirányítás); a régi főoldal mentve: `src/app/(public)/_backup/page.landing-v2-kredites.tsx.txt`.
Eltérés a tervtől:
- „Hozzáféréssel ingyen” (Márk döntése): az Ingatlan-hozzáféréssel rendelkezőknek nincs levonás; a pénztárca láthatatlanul marad; a költséget a későbbi plafon védi (terv 20).
- A modul-kártyákon nincs „⋯” menü (csak megnyitás van, más művelet nincs).
- A foglalás élesítéséig (BOOKINGS_PUBLIC=1) a kapcsolatblokk e-mailes tartalékot mutat a látogatóknak — kapu: adatkezelési tájékoztató + Resend-hitelesítés.
- A Felhasználók táblában a cég-oszlop és a „Besorolatlan” jelölés még nincs (a kezdőlap már kezeli).
Új buktató / tanulság: a „kredit” ~90 fájlban élt; a felületi kivezetés kapcsoló mögé tétele (UiModeProvider, useCr) lehetővé tette az admin-előnézetet és a visszakapcsolhatóságot.
Nem lett kész / Hamarosan: 3f (nézet-váltó cég/felhasználó szerint); a /ingatlan és /bemutatkozas kampányoldalak még kredites üzenetet hordoznak (D31: a futó hirdetés átterve később); a /login oldal régi stílusú; hospitality (rejtett) modulok szövegei.
Ellenőrzési lépések eredménye: `tsc` és `eslint` (érintett fájlok) rendben; Márk localhoston: foglalás, admin jog, Cégek; a többi 3d/3e rész admin-nézetben átnézendő; RLS valódi felhasználói tokennel még nincs tesztelve.
Döntés kell tőled, Márk:
- Mikor kapcsolod be az „Új felület” kapcsolót (előtte: GDN-es kollégák Ingatlan-pipája)?
- /ingatlan és /bemutatkozas: maradnak (futó kampány), átirányítás, vagy átírás?
- Foglalás élesítése: adatkezelési tájékoztató + Resend DNS, utána `BOOKINGS_PUBLIC=1` a Vercelen.
Éles állapot: az új főoldal és a referencia-landing mindenkinek; az új dashboard-felület adminnak, a kapcsoló bekapcsolása után mindenkinek.

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
