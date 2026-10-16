# TWINX – 3D bejárás modul, 2. kör: minőség, katalógus, szerkesztés, berendezés

> Márk briefje, 2026-10-16 (szó szerint). Elemzés és döntések: `2-kor-elemzes.md`.

## Összegzés – mibe kezdünk bele

### Miről szól ez a kör
A prototípus elkészült: alaprajzból méretpontos, bejárható 3D lakás készül, japandi stílusban. A geometria hibátlan, de a bejárás még „blokkszerű”, mert hiányzik a valóságérzet öt forrása: fény, anyag, részletek, berendezés-sűrűség és kamera. Ebben a körben a **partnernek linken átadott bejárható 3D modellt** fejlesztjük tovább:
1. jobb minőség (fény, anyagok, részletek, kilátás, telefonos teljesítmény);
2. a TWINX saját, központi 3D-katalógusa („bútorgyár”): bútorok, berendezési tárgyak, anyagok, amelyeket a TWINX maga állít elő;
3. új funkciók a bejárásban;
4. szerkesztés asztali gépen, automatikus és kézi berendezéssel;
5. felkészülés a későbbi tervező módra;
6. a fejlesztés közben szerzett tudás rögzítése, hogy a további bővítés gördülékeny legyen.

Ebben a körben **nem** foglalkozunk az offline (path tracing) videó-renderrel és az AI-finomított állóképekkel; ezek később jönnek.

### A kör célja
A linken továbbküldhető bejárás érje el azt a szintet, hogy vevőnek bemutatva, hirdetésben megállja a helyét; a lakás egy gombnyomással berendezhető legyen a TWINX saját katalógusából; és a partner maga tudja finomítani az eredményt.

### Mit ad a partnereinknek
- Élethűbb, hihetőbb bejárás: a vevő jobban érzi a tereket és az anyagokat.
- A bútorok pontosan a lakás méreteihez igazodnak, és változatos, stílus szerint szűrhető választékból jönnek.
- Egy gombnyomással berendezett lakás, amit a partner kézzel is finomíthat vagy teljesen maga rendezhet be.
- Koppintásra látszanak a helyiségek méretei: kevesebb kérdés, nagyobb bizalom.
- Napszak-csúszka déltől éjszakáig (naplementével, kék órával), berendezett és üres nézet, a partner logója a bejáráson.
- Egyszerű képernyős navigáció, ugrás szobába és automatikus túra azoknak is, akik nem járatosak a 3D-ben.
- Telefonon is gyorsan betölt és simán fut.
- Videó csak akkor készül, amikor a partner kéri, így nem fizet feleslegesen.

### Szabályok (az első kör szabályai továbbra is érvényesek)
1. **Semmi nem lehet megtévesztő.** Bemutató módban a geometria rögzített: falak, ajtók, ablakok, méretek a valóságot követik; a szerkesztés csak falszínt, burkolatot és bútorokat változtathat. A „Koncepcióterv” jelölés mindig látható, de nem takar el fontos tartalmat (ez a logóra és minden új felületi elemre is vonatkozik).
2. **A lakásleírás (JSON) az egyetlen igazságforrás.** Minden szerkesztés ezt módosítja; a 3D, az alaprajz és a videó ebből dolgozik.
3. **Költség:** ami pénzbe kerül, az csak az előzetes engedélyemmel futhat. Előtte mondd meg, mire kell, hány hívás és mennyi a becsült költség.
4. **Nem veszünk kész 3D-modellt, nem fizetünk elő semmire, nem töltünk le idegen 3D-modellt.** A katalógus elemeit a TWINX maga állítja elő. Kivételek, mert ingyenesek és CC0 licencűek: a Poly Haven és az ambientCG anyagai (textúrák, HDRI-k), valamint a nehéz darabokhoz (növények, dekor) a Poly Haven CC0 3D-modelljei, ingyenes lépésként, a fizetős generálás előtt. Mindkét oldalról csak célzottan, egyenként válogass, vagy a hivatalos nyilvános API-t használd annak feltételei szerint; tömeges letöltés (scraping) tilos. Az ambientCG első használata előtt ellenőrizd a licencet a hivatalos licencoldalukon, és jelezd, ha eltér a CC0-tól.
5. **Mindig az ingyenes módszerrel kezdj;** fizetős eszközt csak a végén, ha az ingyenes nem éri el a minőséget, és csak engedéllyel.
6. **A feladatok egymás után futnak.** A katalógusban egyszerre egy kategória; új kategóriába csak a megerősítésem után kezdhetsz.
7. **Jóváhagyás:** minden új katalóguselem és -csomag csak az én jóváhagyásommal kerül be; csoportosítva küldd (egy kategória egy oldalon, képekkel, méretekkel, elhelyezési adatokkal).
8. **Teljes szerkesztés csak asztali gépen.** Telefonon és tableten csak egyszerű módosítások.
9. Minden üzleti érték (kreditárak, korlátok, tűréshatárok, alapértékek, kör- és költségkorlátok) konfigurációban legyen, ne a kódban.
10. Meglévő TWINX-rendszerre építs (3D-motor, JSON, stíluslap, referenciaképek, Nano Banana-integráció, kreditek, fiókok); más modulokhoz ne nyúlj. Nagyobb architekturális döntés előtt kérdezz; ami nem egyértelmű, jelezd, ne találgass.

---

## Kiindulás
- Olvasd el a prototípus-jelentést és a tanulságnaplót (docs/3d-modul/tanulsagok.md).
- A korábbi kiegészítés pontjai érvényben maradnak: a videó csak külön gombra készül; a nyílászárók a 2D javítófelületen mozgathatók, hozzáadhatók, törölhetők, utólag is javíthatók (érintett helyiségek újraépítésével); tanulságnapló; skill- és stíluslap-módosítás csak jóváhagyással.
- Ez a munka ugyanabban a repóban, de külön munkamenetben, saját ágon fut.

---

## 1. Mérőpad
- A mintalakás 5 rögzített nézőpontja a bejárható link nézetéből (képernyőképek).
- Értékelés **páros összehasonlítással**: az új verzió kontra az előző (és a referencia/célkép): melyik a hihetőbb, és mi a legnagyobb különbség. Egyszerre egy hibát javíts.
- Minden minőségi lépés előtt és után futtasd le, és az eredményt (képekkel) tedd a jelentésbe.

## 2. Minőség (valós idejű szint – a bejárható link)
A prototípus-jelentés alapján rangsorold a javításokat; a rangsort mutasd meg, mielőtt nekiállsz.
- **Fény:** valósághű fények és árnyékok; a fény jóváhagyáskor egyszer „beégetve”, hogy telefonon is szép maradjon. A beégetés először a partner asztali böngészőjében fusson (új infrastruktúra nélkül); mérd az időt és az eredményt. Ha túl lassú vagy gyenge, jelezd, és döntünk a következő lépésről. Falszín- vagy burkolatcsere után a mentéskor újra kell égetni. A napállás igazodjon a lakás tájolásához, ha meg van adva.
- **Utómunka:** sarok-árnyékolás, finom ragyogás az ablakokon, tónusgörbe.
- **Részletek automatikusan a JSON-ból:** lábazat, ajtótok, ablakkáva, ablakpárkány, radiátor, konnektor és kapcsoló, lámpák.
- **Anyagok** a stíluslapból, matt felületekkel.
- **Kilátás és napsugár** az ablakokon: Poly Haven vagy ambientCG CC0 HDRI-k az ablakok mögötti környezethez és a természetes környezeti fényhez. Néhány gondosan kiválasztott városi és kertes környezet, a napszak-csúszka kulcsállapotaihoz igazítva (lásd 4. pont). A kiválasztott HDRI-kat jóváhagyásra mutasd meg.
- **Bejárás-érzet:** kellemes mozgási sebesség, finom gyorsulás és lassulás, ütközés a falakkal, kb. 1,6 m szemmagasság.
- **Telefonos cél:** iPhone 11 / Samsung Galaxy A52 szinten akadás nélkül töltsön be és fusson. Gyengébb eszközön automatikusan egyszerűsített minőség (kevesebb részlet, kisebb textúrák), de működjön. Mérd és jelentsd a betöltési időt.
- **Ár:** a 10 kredites 3D lakás tartalmazza a bejárható linket, a fénybeégetést és a mentés utáni újraégetést (konfigurálható).

## 3. Központi 3D-katalógus („bútorgyár”)

### Felépítés
- Csak központi katalógus van; partnerek nem töltenek fel saját elemeket.
- **Kategóriák** a látványtervező helyiségtípusai szerint csoportosítva, a kategória neve a bútordarab neve:
  - Nappali: kanapé, fotel, dohányzóasztal, TV-szekrény, polc, állólámpa, szőnyeg
  - Hálószoba: ágy, éjjeliszekrény
  - Étkező: étkezőasztal, szék, függőlámpa
  - Konyha: konyhamodulok (alsó, felső, magas szekrény, munkalap)
  - Fürdő: mosdó szekrénnyel, kád, zuhany, WC, tükör
  - Gardrób / előszoba: gardróbszekrény, előszobaszekrény
  - Kiegészítők: váza/kerámia, növény
  Ha egy elem több helyiségbe illik, egyszer szerepeljen, több helyiségcímkével.
- Kategóriánként **3–4, egymástól formában, arányban, anyagban jól eltérő elem**. Ne készíts négy hasonló darabot.
- A **stílus címke, nem kategória.** Egy elem neve lehet stílusos (pl. „Japandi alacsony kanapé”), és több stíluscímkét kaphat; a partner stílus szerint szűrhet.

### Hogyan készül egy elem
1. **Paraméteres forma kódból:** minden kategória egy paraméteres család (pl. kanapé: szélesség, ülésmélység, háttámla-magasság, karfa, láb, párnák, kárpit). A 3–4 elem ennek jól eltérő beállításai. Lekerekített élek, puha párnaformák, valós arányok.
2. **Anyag és textúra:** az anyag szerkezete (domborzat-, érdesség-, mélységtérkép, valós méret) a Poly Haven vagy az ambientCG CC0 anyagaiból jön (mindkettőben keress, és az adott anyaghoz a jobbat válaszd; az ambientCG különösen erős csempékben, parkettamintákban, terrazzóban, vakolatokban, tapétákban, szövetekben, és szín szerint is szűrhető); a színe és hangulata a TWINX saját referenciaképeihez igazítva (a látványtervező 90+ referenciaképe az adatbázisban), mindig a helyiségtípusnak megfelelő képekben keresve (csempéhez fürdőképek, konyhafronthoz konyhaképek). Ha egyik könyvtárban sincs megfelelő alap, a kiválasztott referencia-részletből készíts varrat nélküli textúrát és anyagtérképeket. Jegyezd fel, melyik könyvtári anyagból és melyik referenciából dolgoztál. Az anyagkészlet szerkezete a Poly Haven mintáját kövesse: minden anyaghoz szín-, domborzat-, érdesség- és mélységtérkép, valós méret, több felbontás, felhasználási felület szerinti besorolás (padló, fal, munkalap stb.).
3. **Mérce:** a kritikus páronként veti össze az elemről készült képet a referenciával, és megnevezi a legnagyobb eltérést.
4. **Ingyenes kiegészítés a nehéz darabokhoz:** növényeknél és dekornál, ha a kódból épített forma nem elég hihető, nézd meg a Poly Haven CC0 3D-modelljeit; a kiválasztott modellt optimalizáld telefonra, és jóváhagyásra mutasd meg.
5. **Fizetős lépés csak a végén, engedéllyel:** Nano Banana-textúra vagy -célkép; a nehéz, szabálytalan darabokhoz képből 3D-generálás.

### Fizetős 3D-generálás – első alkalom
Az első alkalommal, amikor képből 3D-generálás kellene, teszteld mindkét utat ugyanazon a darabon:
- A) Nano Banana kép + fal.ai képből-3D;
- B) Higgsfield MCP.
Mutasd meg az eredményeket költséggel és minőséggel; én választok, és onnantól azon az úton mész, amíg nem szólok, hogy váltsunk. Egyik utat sem zárjuk ki véglegesen.

### Minőségkapu (minden elemre)
- Valós méretek, cm-pontosan.
- Telefonos keret: meghatározott és betartott elemenkénti részletesség és textúraméret.
- Ha az elem japandi címkét kap, a japandi stíluslap kerülendő listája érvényes rá.
- Forrásnyilvántartás: saját kód / saját referenciakép / Poly Haven (CC0, az eredeti elem nevével) / ambientCG (CC0, az eredeti anyag azonosítójával) / Nano Banana / fal.ai / Higgsfield, dátummal.

### Elhelyezési adatok (minden elemhez kötelező)
- Front: melyik oldala a használati oldal.
- Falhoz kötött-e: kötelezően falhoz, lehet falhoz, vagy szabadon álló.
- Szükséges szabad hely a front előtt és oldalt (ajtónyílás, fellépő, szék kihúzása), cm-ben.
- Takarhat-e ablakot (magasság szerinti korlát).
- Csoportok és távolságok (pl. étkezőasztal + székek, ágy + éjjeliszekrények, kanapé + dohányzóasztal + szőnyeg).
- Gépészeti igény (víz, lefolyó, elszívó) – ezek csak a megfelelő falra kerülhetnek.
- Méretkorlátok: a paraméterek határai, és milyen helyiségmérethez illik.
Ezeket az elemlapon is mutasd meg a jóváhagyásnál.

### Adatszerkezet
Minden elemhez: kategória, helyiségcímkék, stíluscímkék, méretek, paraméterek és határaik, anyagok, elhelyezési adatok, forrás. Legyen hely később a gyártói adatoknak (gyártó, termékkód), de most ne töltsd ki. A burkolatcsomagok később a katalógus anyagaiból állnak össze; az adatszerkezet legyen erre felkészítve.

## 4. Új funkciók a bejárásban
- **Méretek:** koppintásra/kattintásra megjelenik a helyiség neve és alapterülete.
- **Napszak-csúszka** (0–100, 0 = legvilágosabb, 100 = legsötétebb), a „nappal/este” gomb helyett. A csúszka húzására minden folyamatosan és simán változik: a nap iránya és magassága, a fény színe és erőssége, az árnyékok hossza, az ég az ablakon túl, és a belső lámpák.
  - Kulcsállapotok és színskála:
    | Érték | Napszak | Fény | Ég az ablakban | Belső lámpák |
    |---|---|---|---|---|
    | 0 | Dél | semleges-hűvös, kb. 6000 K, erős szórt fény | világoskék | ki |
    | 30 | Délután | kb. 5000 K, hosszabb árnyékok | kék | ki |
    | 50 | Arany óra | meleg, kb. 3800 K, alacsony nap | halvány aranysárga | ki |
    | 70 | Naplemente | narancsos-rózsás, kb. 2700 K, hosszú meleg fénysávok | narancs-rózsaszín | halványan be |
    | 85 | Kék óra | kintről hideg kék, bent meleg | mélykék | dominálnak, 2700 K |
    | 100 | Éjszaka | csak belső meleg fény | sötét, város fényei | teljesen égnek |
  - A kulcsállapotok fénye be van égetve; a köztes értékeknél a rendszer finoman átúsztatja őket egymásba. Asztali gépen mind a 6 kulcsállapot, telefonon és tableten 4 (dél, arany óra, naplemente, éjszaka) a letöltési méret miatt; a csúszka mindkettőn folyamatos.
  - A 100 sem lehet koromsötét: este a belső lámpák mutatják a lakást.
  - A nap iránya a lakás tájolásához igazodik (ha meg van adva), így pl. egy nyugati helyiségbe a naplemente valóban bevilágít.
  - A belső lámpák automatikusan, a napszakhoz igazodva kapcsolnak és erősödnek; külön kapcsoló nincs.
  - A csúszkán a napszakok nevei látszanak kis ikonokkal (Dél, Délután, Arany óra, Naplemente, Kék óra, Éjszaka), nem számok.
  - A link délutáni állásban (30) nyílik meg.
  - A kulcsállapotokhoz illő HDRI-k (égbolt és környezet) a Poly Haven / ambientCG kínálatából; jóváhagyásra mutasd meg őket.
- **Berendezett / üres** nézet váltása.
- **Partner logója** a bejáráson (a partner fiókjából), fontos tartalmat nem takarhat.

### Képernyős navigáció (azoknak, akik nem W-A-S-D-vel vagy nyilakkal mozognának)
Csak a belső, szemmagasságú (POV) nézetben jelenik meg. Felülnézetben marad a megszokott egeres/érintéses mozgatás, képernyős vezérlő nélkül.
- **Mozgásvezérlő:** telefonon és tableten virtuális joystick (bal alul); asztali gépen nyílgombok (előre, hátra, fordulás balra/jobbra). Mindkettő átkapcsolható a másikra.
- **Ugrás szobába:** a képernyő alján a helyiségek nevei; koppintásra/kattintásra a kamera finoman átúszik az adott helyiségbe.
- **Automatikus túra:** „Túra indítása” gomb, amely végigvezet az összes helyiségen (ugyanazon a kameraúton, mint a videó), és bármikor megállítható, hogy a néző körülnézzen.
- **Koppintással/kattintással lépés** a padlón, mint eddig.
- **Láthatóság:** a vezérlők alapból 80%-ban átlátszók; csak akkor válnak teljesen láthatóvá, amikor a felhasználó rákattint, megérinti vagy használja őket, utána visszahalványulnak. Kicsik, és nem takarhatják a mini alaprajzot, a „Koncepcióterv” jelölést és a partner logóját.
- **Elrejtés asztali gépen:** egy nagyon apró gomb, amellyel a képernyős vezérlő elrejthető és újra előhívható (aki egérrel és billentyűkkel mozog, annak ne legyen útban).
- **Első megnyitás:** rövid, bezárható súgó, egyszer, eszközönként más szöveggel (pl. telefonon: „Húzd az ujjad a körbenézéshez, vagy válassz szobát lent”; asztali gépen: „Használd a nyilakat vagy a W-A-S-D billentyűket, vagy válassz szobát lent”).

## 5. Szerkesztés (asztali gépen)
- Egymás melletti (vagy egymás alatti) **2D alaprajz és 3D nézet**, állítható elválasztóval.
- **Közös kijelölés:** ami az egyikben ki van jelölve, a másikban is kiemelődik; a 3D kamera odafordul.
- Minden módosítás azonnal látszik mindkét nézetben; közös visszavonás és újra (Ctrl+Z / Ctrl+Shift+Z).
- **Falszín** falanként vagy helyiségenként, **padló- és falburkolat** helyiségenként; a stílushoz illők kiemelve.
- **Mentés verziókkal**, korábbi verzió visszaállítható; a bejárható link a mentett verzióval ingyen frissül (a fény újraégetésével).

## 6. Berendezés: automatikusan és kézzel

### Automatikus berendezés
- „Rendezd be”: a teljes lakás berendezése a központi katalógusból, a stílus és a helyiségtípusok alapján.
- „Csak ez a szoba”: egy helyiség (újra)rendezése, a többi változatlan.
- „Másik változat”: új elrendezési javaslat ugyanarra a helyiségre.
- Rögzítés: amit a partner kézzel helyezett el vagy rögzített, azt az automatikus (újra)rendezés nem mozdítja el.
- Üres indulás lehetősége.

### Berendezési szabályok
Az elhelyezési adatokból dolgozz, és tartsd be:
- ajtó nyílási íve és ablak elé nem kerül magas bútor;
- legalább 80–90 cm közlekedősáv marad (konfigurálható);
- az ágy fejtámlája falnál, mellette fellépő hely;
- a kanapé a TV vagy a fő nézőpont felé néz;
- a konyhasor és a fürdő elemei a gépészeti igényüknek megfelelő falra kerülnek;
- a bútorméret a helyiség méretéhez igazodik.
Ha egy szabály nem tartható be, helyezd el a lehető legjobban, és jelezd a partnernek, mi nem fért el szabályosan. A szabályokat külön tartsd nyilván a dokumentációban.

### Kézi berendezés
- Katalógus-panel a szerkesztőben: kategóriánként, stílus szerint szűrhető, képpel és mérettel.
- A bútor behúzható a 2D-be vagy a 3D-be; áthelyezhető, forgatható, cserélhető, törölhető; ütközésfigyelés és falhoz/padlóhoz igazítás. Szabálysértésnél figyelmeztetés, de nem tiltás.
- Behúzás után a paraméterek állíthatók (szélesség, láb, kárpit stb.) a katalóguselem határain belül.

## 7. Telefon és tablet
- A bejárás fekvő nézetben, érintéses irányítással.
- Egyszerű módosítások: falszín és burkolat cseréje. Nyílászárókhoz és bútorokhoz nem lehet nyúlni.
- A modul megnyitásakor jól látható, bezárható értesítés: a szerkesztés asztali gépen sokkal több lehetőséget ad és profibb eredményt hoz.

## 8. Videó
- Csak külön gombra („Videó készítése”), amikor a partner a tervet véglegesnek ítéli; külön kredit, konfigurálható.
- Későbbi módosítás után a meglévő videó nem frissül magától; újat külön lehet kérni.
- Ha ez a korábbi kiegészítés alapján már elkészült, csak ellenőrizd.

## 9. Felkészülés a tervező módra (most NEM kell megépíteni)
Később jön egy külön tervező mód („Saját tervezet” jelöléssel, felelősségi nyilatkozattal), ahol a felhasználó maga helyez el nyílászárókat, falat bonthat és új falat húzhat. Ehhez most:
- Az adatszerkezetet (falak, nyílászárók, anyagok, bútorok, verziók) úgy építsd fel, hogy a tervező mód átépítés nélkül ráépülhessen.
- Legyen megoldható, hogy egy bemutató modellből **másolat** készüljön egy tervező projektbe; az eredeti modell és a linkje változatlan marad. Az „Átvitel a tervező módba” gomb még ne jelenjen meg.
- Nyílászárók: szabványos méretlista és egyedi méret, figyelmeztetéssel (falból kilóg, ütközik, sarokhoz túl közel). A bontott és új falak az eredetihez képest jelölhetők legyenek (pl. bontott pirossal, új zölddel).

## 10. Tanulás és skillek
- **Tanulságnapló:** minden lépés és minden katalógus-kategória után röviden, dátummal: mi működött, mi nem, milyen hiba és megoldás, mért eredmény (idő, költség, minőség), mit csinálnál másképp. Munkamenet elején olvasd el.
- **Skill-javaslatok** (csak jóváhagyás után hozd létre, a projekt saját skill-mappájában), amint kiforrnak:
  - „Új bútorcsalád építése” (paraméterek, referencia- és textúrakészítés, minőségkapu, elhelyezési adatok, mérés) – 2–3 kész kategória után;
  - „Automatikus berendezés” (berendezési szabályok);
  - minden más ismétlődő folyamat, amit menet közben azonosítasz.
- **Stíluslap:** ha valami pontatlannak bizonyul (pl. egy szín 3D-ben másképp hat), javasolj módosítást indoklással; csak jóváhagyás után módosítsd.

---

## A fejlesztés menete (egymás után, minden lépés végén jelentéssel)
1. **Mérőpad** felállítása és az alapállapot rögzítése.
2. **Minőségi rangsor** a prototípus-jelentés alapján; jóváhagyás után a valós idejű minőségi javítások (fény és beégetés, utómunka, részletek, anyagok, kilátás, bejárás-érzet, telefonos teljesítmény). Mérés a mérőpadon.
3. **Katalógus alapjai:** adatszerkezet, minőségkapu, forrásnyilvántartás, elhelyezési adatok. Mutasd meg, mielőtt elemet gyártasz.
4. **Első kategória: Kanapé** – 3–4 eltérő elem, ingyenes módszerrel; jóváhagyás; beépítés a bejárásba; mérés előtte–utána.
5. **A többi kategória, egyenként** (javasolt sorrend: a nappali többi kategóriája, majd hálószoba, étkező, konyha, fürdő, gardrób/előszoba, kiegészítők). Minden kategória előtt megerősítést kérsz, minden kategória után jóváhagyás és mérés.
6. **Új funkciók a bejárásban** (méretek, nappal/este, berendezett/üres, logó).
7. **Asztali szerkesztő:** osztott 2D+3D nézet, közös kijelölés, visszavonás, falszín- és burkolatcsere, verziók, újraégetés mentéskor.
8. **Berendezés:** automatikus berendezés a szabályokkal, katalógus-panel, kézi berendezés és bútorparaméterek.
9. **Telefon/tablet** egyszerű mód és értesítés; a videó-gomb ellenőrzése.
10. **Felkészülés a tervező módra** és a másolhatóságra.

**Minden lépés végi jelentés tartalma:** mi készült el, mi nem; mérőpad-eredmény képekkel (ahol releváns); felmerült-e fizetős igény (költséggel); mi került a tanulságnaplóba; javasolsz-e skillt vagy stíluslap-módosítást; van-e eldöntendő kérdés.
