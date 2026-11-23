# TWINX — IRÁNYVÁLTÁS (D23) — mesterszöveg és kiegészítők

> **Mire való:** ez a TWINX új irányának egyetlen, hivatalos leírása. A mesterszöveget minden TWINX-hez kapcsolódó beszélgetésbe be kell másolni, mellé a beszélgetéshez tartozó rövid kiegészítőt.
> **Jóváhagyva:** Kovács Márk, 2026-11-23. **Frissítve:** 2026-11-23 (D29: alügynökök; D30–D33: Ingatlan csomag, háttérbe került felhasználók, fizetés, kapcsolatblokk; D34–D39: főoldal és referencia-landing, irodai fiók és előfizetés modellje, egyedi árazás; D40–D46: új admin szerkezet, kredit kivezetése a felületről, szerepkörök (admin, cégvezető, user), cégvezetői meghívás és hozzáférések, modul-regiszter; D47–D54: adatmodell, időpontfoglalás, e-mail szövegek, adatkezelési tájékoztató, tesztkörnyezet, díjak és fizetés követése, havi plafon és használat-mérés, modul lemondása, cég lezárása és a modul megőrzése; D55–D57: felhasználói szövegek, átadási bejegyzés, belső ajánlat-ellenőrző lista és kalkuláció). **Döntési napló:** `claude/ai-ugynokseg/01-alap-es-szabalyok.md`, 7. szakasz (D23–D57). **Részletes tervek:** `claude/11-fooldal-es-landing-terv.md` (főoldal), `claude/12-admin-terv.md` (admin), `claude/13-hozzaferesek-terv.md` (hozzáférések, meghívás, cégvezetői szabályok), `claude/14-adatmodell-terv.md` (adatmodell), `claude/15-foglalas-terv.md` (foglalás), `claude/16-email-szovegek.md` (e-mail szövegek), `claude/17-adatkezelesi-tajekoztato-vazlat.md` (adatkezelés), `claude/19-dijak-es-fizetes-terv.md` (díjak, fizetés), `claude/20-plafon-es-hasznalat-terv.md` (plafon, használat), `claude/21-lezaras-es-lemondas-terv.md` (lemondás, lezárás, ügyféladat, modul megőrzése), `claude/22-felhasznaloi-szovegek.md` (felhasználói szövegek), `claude/23-atadas-jovahagyasa-terv.md` (átadási bejegyzés), `claude/24-ajanlat-ellenorzo-lista-es-kalkulacio.md` (belső ajánlat-ellenőrző lista és kalkuláció); áttekintő átadó: `claude/18-atadas-fejlesztesi-beszelgetesnek.md`.
> **Ha egy másik dokumentum ellentmond ennek, ez az irányadó.**

---

## 1. Mesterszöveg (bemásolható minden beszélgetésbe)

```
TWINX – IRÁNYVÁLTÁS (D23–D57, 2026. 11. 23.) – ez felülír minden korábbi, ezzel ellentétes leírást

1) Mi a TWINX mostantól?
Egyedi, cégre szabott modulokat gyártunk. Nem sablonos oldalt építünk, hanem olyan modulokat és funkciókat, amelyek konkrét üzleti folyamatokat gyorsítanak. A célcsoport BÁRMILYEN cég. A kollégáink (Kovács Márk, Radics Tibor) felmérik a cég napi működését, vagy a cég konkrét ötlettel jön, és erre építünk modult.

2) Mi változik a korábbihoz képest?
- A kreditalapú, "regisztrálj és használd a modulokat" modell nem lett népszerű, ezért a "kredit" mint ajánlat, üzenet és felületi elem megszűnik: az admin felületről és a felhasználói felületről is kikerül minden, ami kredithez köthető (napló, kérések, "+" gomb, üdvözlő kredit, kreditvásárlás, a szó maga). A korábban regisztrált felhasználók háttérbe kerülnek (az új regisztráló "Besorolatlan", amíg egy céghez nem soroljuk), velük az aktiváló/gyártó ügynökség egyelőre nem foglalkozik. Technikailag a pénztárca láthatatlanul marad meg; a költséget cégenként és modulonként egy láthatatlan havi használati plafon védi (forintban, nettó önköltségben; alapból üres; az API-költséges moduloknál kép, videó, kutatás kötelezően beállítandó, mielőtt a cég használatba veszi; 80%-nál figyelmeztetés, 100%-nál leállás).
- A meglévő ingatlanos modulokat a GDN Mandala Ingatlaniroda kollégáival fejlesztettük, ők naponta használják. Ezek mostantól REFERENCIÁK, külön referencia-landingen mutatjuk be őket, és "Ingatlan csomagként" egy kalap alá kerülnek. Az ingatlan modulokhoz a hozzáférést CSAK MI adjuk az admin felületen, minden ingatlanosnak; nincs önkiszolgáló vásárlás. Fizetés eddig még nem volt, ezért nincs mit migrálni.
- Szerepkörök (három szerep, két szinten): ADMIN (rendszerszint): fejleszt, tesztel, egyedi modulokat intéz, a weblapot kezeli; több admin lehet (Márk, később Tibi); admin jogot csak admin adhat, az admin felületen, naplózva, az utolsó admint senki nem veheti le. CÉGVEZETŐ (cégen belüli státusz, cégenként él, rendszerszinten user): aki az egyedi modult rendelte, kifizeti a fejlesztést és az előfizetést, és intézi a céghez kapcsolódó dolgokat; egy cégnél több cégvezető lehet, és mindegyik fizethet; minden cégnek mindig van legalább egy cégvezetője; az admin felületet a cégvezető nem látja. USER: aki használja az egyedi modult, ha a cégvezetőtől meghívást kapott, egyedül vagy irodai fiókban.
- Az admin felület szerkezete: Foglalások, Felhasználók, Cégek, Előfizetések, Pénzügy, Egyedi modulok (fejlesztés), Költségfigyelő, Eszközök (Promptok, Videólabor). A megjelenés marad; az admin nézet-váltóval cég vagy felhasználó szerint láthatja a weblapot.
- Belépés után személyre szabott kezdőlap jelenik meg (Moduljaim, Legutóbbi munkáim, Irodai fiók, kapcsolatblokk), a felső sávban a "Moduljaim" legördülő menüvel.
- A főoldal RÖVID: átadja a TWINX lényegét ("A te cégedre szabott modul."), kapcsolatot ad, regisztrációt és belépést kínál, és egy gombbal átvisz a referencia-landingre. A felső sávban az "Ingyenes felmérés" a kiemelt gomb. A kapcsolatfelvételi blokk belépés előtt és belépés (regisztráció) után is elérhető.

3) Hogyan kap egy cég egyedi modult? (az ügyfélút)
Foglalás → Cég létrehozása → Egyedi modul fejlesztése → Aktiválás → Előfizetés → a cégvezető meghívja a kollégáit.
A megrendelés egy INGYENES felmérés és beszélgetés Kovács Márkkal vagy Radics Tiborral (később bővíthető kollégákkal). A cég időpontot foglal a kapcsolatfelvételi blokkban, két lépésben: előbb az időpont, utána az adatok. Az admin felületen mi adjuk meg a szabad időpontokat és elérhetőségeket, mi hívjuk vissza őket. KÖTELEZŐ mezők: név, cég, e-mail, telefonszám. Opcionális: pár mondat arról, milyen fejlesztést vagy munkafolyamatot modernizálnának, hol megy el sok idő; konkrétum nélkül is lehet foglalni. Ha nincs szabad időpont, az adatok akkor is elküldhetők, és visszahívjuk őket. Külső naptár-integráció egyelőre nincs. Közös cím: office@twinx.hu.

4) Hol fut az egyedi modul? (a cég választ)
a) A TWINX oldalán: a kollégák a saját fiókjukkal belépnek, és használják a modult (ezt ajánljuk elsősorban, "Ajánlott kezdés": költséghatékonyabb, nem kell külön app vagy weblap).
b) Saját app vagy oldal, amit a cégnek fejlesztünk.
c) Beépítés a cég saját oldalába (ha hozzáférést adnak).
d) Meglévő csatornában: Telegram, Slack vagy Excel.
Mindegyiknek külön fejlesztési díja és havi előfizetése van, mindig modulfüggő és egyedi: nincs fix árlista, mert minden modul más költséggel jár (fejlesztés, API-k, egyéb). A havi előfizetést később a Stripe-on keresztül kezeljük (a fizetési mód marad, a struktúra más; az előfizetést mi hozzuk létre egyedi összeggel a cégnek, és bármelyik cégvezető fizethet). Árat a weboldalon nem közlünk, az ajánlat a felmérés után készül.

5) Az egyedi modul hozzáférése, a cégvezető, az előfizetés és az irodai fiók
- A fejlesztés alatt álló modul csak az admin "Egyedi modulok" lapján látszik (állapotok: Felmérés → Ajánlat → Fejlesztés → Teszt → Átadva → Aktív; mellék-állapotok: Szünetel, Lemondva); a cégvezető és a user nem látja a készülő dolgokat. Minden egyedi modul a kódban él, rejtve marad, és az admin az "Aktiválás" gombbal kapcsolja be egy cég számára (csak ha a modul kódja az éles rendszeren van, az állapot Átadva (ide csak átadási bejegyzéssel lehet lépni: ki fogadta el a cég részéről, hogyan, mikor és mit kapott meg), az előfizetés érvényes, a cégnek van legalább egy aktív cégvezetője, a modul regiszter-bejegyzésében szerepel a törlési és exportálási leírás, és API-költséges modulnál be van állítva a havi plafon). Az aktiválás önmagában nem ad felhasználói hozzáférést.
- A CÉGVEZETŐ státusz CÉGENKÉNT él (a cég minden moduljára érvényes). Egy cégnél több cégvezető lehet, és mindegyik fizethet (külön "fizető cégvezető" és külön "meghívási jog" nincs). Minden cégnek mindig van legalább egy cégvezetője: az utolsót nem lehet feladni vagy levenni. Cégvezetővé az admin tehet bárkit; a cégvezető a cég már aktív tagját nevezheti ki (megerősítéssel, naplózva; a kinevezett jogai bővülnek). Mindenki csak a saját cégvezetői státuszát adhatja fel; másét elvenni csak az admin tudja.
- Hozzáférések: a cégvezető egy közös "Hozzáférések" ablakban, modulonként egy sorral látja a helyeket (pl. 3 / 5) és a kollégákat. Meghív kollégát e-mail címmel: a kolléga "Belépés" gombos üzenetet kap; ha már van TWINX fiókja, belép, és a modul egyből elérhető a "Moduljaim" menüben; ha még nincs, ugyanazzal az e-mail címmel regisztrálnia kell (erről a levél tájékoztat). A meghívó lefoglalja a helyet az elfogadásig vagy lejáratig (javaslat: 7 nap); a cégvezető vissza is vonhatja. A cégvezető csak akkor foglal helyet, ha ő is használja a modult. A cégvezető maga is eltávolíthat kollégát: a hely azonnal felszabadul, a kolléga hozzáférése megszűnik, a munkái nála maradnak. A helyek számát (előfizetés-keret) csak az admin állítja. A meghívás egyszer használatos, lejár, a meghívott e-mail címhez kötött, a levél és az oldal minden címnek ugyanazt mondja; a helyek számát a szerver érvényesíti tranzakcióban; minden lépés naplózott.
- A modul-hozzáférés FELHASZNÁLÓHOZ kötött: a felhasználó a saját fiókjában ("Moduljaim") használja, egyedül dolgozik vele; irodai fiók nem szükséges hozzá. Ha kikerül egy irodai fiókból, a hozzáférése megmarad. Ha a havidíj nem újul meg, a modul senkinek sem elérhető.
- A GDN-nek (Ingatlan csomag) és minden ingatlanosnak a hozzáférést csak mi adjuk.
- Az IRODAI FIÓK opcionális KÖZÖS TÉR: ha a kollégák együtt akarnak dolgozni, létrehoznak egyet, ahol egymásnak küldhetik a munkát, tanácsot kérhetnek, vagy megmutathatják az elkészült munkát átnézésre. Bárki létrehozhat irodai fiókot; a létrehozó az irodai fiók adminja (ő hívja meg és cseréli a tagokat a közös térben); egy felhasználó több irodai fiókban is lehet. Az irodai fiók nem feltétele a modul használatának, és nem ő adja a modul-hozzáférést. Az irodai fiók (felhasználói közös tér) és a Cég (a mi ügyfélnyilvántartásunk) két külön fogalom. A közös tér funkciói később épülnek.
- Az irodai fiók a HÍVOGATÓ ESZKÖZ része: arra motiváljuk a cégeket, hogy az egyedi modult a mi oldalunkon futtassák, ahol akár együtt is dolgozhatnak. Az irodai fiók fejlesztése kiemelt, de a sorrend: először a főoldal.
- Három fázis: (1) admin-oldali előfizetés-kezelés és a cégvezetői meghívás, szerveroldali érvényesítéssel; (2) Stripe-előfizetés automatizmus; (3) a közös tér funkciói és az értesítési jelzés. A modulokra egyelőre nincs "vezető látja a használatot" nézet; az ingatlanos irodai fiókban a meglévő működés marad.
- Titoktartási szerződés (NDA) kell az ügyféladatok és a nálunk futó modulok védelmére; a sablon még nincs meg (jogász/Tibor). Az Egyedi modulok lap csak követési adatot tárol, titkos ügyféladatot nem.

6) Az ügynökség (MAX + alügynökök)
Két ág marad: (A) felhasználókat kiszolgáló ág (aktiváló, gyártó), amely háttérbe kerül; (B) TWINX fejlesztői ág, amely előtérben van. A B ág indulási magja 6 alügynök: hibakeresés, modulépítés, tudásrendszerezés, webfejlesztő, modul tesztelő és felmérő (a felmérő egyben piackutató és cégfelmérő). Később szükség lehet rájuk: ajánlat- és költségbecslő, dokumentáló, üzemeltető-figyelő, ügyfélkapcsolattartó (kapcsolattartás új cégekkel). A marketinget egyelőre Márk és Tibor csinálja kézzel. Cél: ha egy cégtől megrendelés érkezik, az ügynökök profi segítséget adjanak az egyedi modul építésében, közös munkában velünk.

7) Sorrend
Először az üzenet és a főoldal (rövid twinx.hu főoldal, felső sáv, kapcsolatblokk, külön referencia-landing, személyre szabott kezdőlap belépés után), utána az új admin (Foglalások, Cégek, Egyedi modulok lap, modul-regiszter, szerepkörök), az előfizetés-kezelés és a cégvezetői meghívás (1. fázis), az irodai fiók átalakítása, az egyedi modulok futtatása. A futó hirdetést később, az új vonalra tervezzük át. A főoldal és az admin tervezése itt történt, a módosítást később adjuk át a fejlesztésnek (Claude Code, később a webfejlesztő ügynök).

8) Változatlan szabályok
Szerveroldali védelem (RLS; a modul-hozzáférést, a szerepköröket, a meghívást, a helyek számát, a cégvezetői státuszt és a lejáratot is szerveroldalon érvényesítjük; a cégvezetői státusz sosem ad admin jogot), böngészőben nincs titkos kulcs, AI-képeken "Koncepcióterv"/vízjel jelölés, GDPR szerinti hozzájárulás hírlevélhez és a foglalási űrlapnál, stabil felület (nem ugráló dobozok, "⋯" menü, "Hamarosan" jelzés az el nem készült résznél, készülő funkciót nem hirdetünk élőként), fejlesztés végén nincs git push, csak ha kérem. A kredit-árazási szabályok (pl. 100% haszon) érvénytelenek, kivéve az API-költséges funkcióknál az önköltség-védelmet (láthatatlan havi plafon, ajánlat-ellenőrző lista); a pénzügyi műveletek és az állapotváltások egy tranzakcióban futnak, és a használati keret csak sikeres futás után fogy.

9) Működési részletek (D47–D57)
- Adatmodell: új, külön táblák (cég, cég-tagság cégvezetői jelölővel, modul-állapot és hely-keret, meghívó, modul-hozzáférés, napló); az irodai fiók és a régi felhasználók érintetlenek; minden írás szerveroldali függvényen megy át, egy tranzakcióban, az utolsó cégvezetőt és az utolsó admint az adatbázis is védi.
- Időpontfoglalás: hibrid szabad-időpont kezelés (heti sablon és egyedi időpontok), minden időpontnak gazdája van (Márk vagy Tibor), egy aktív foglalás e-mail címenként és telefonszámonként, lemondás a levélben kapott linkről (csak gombnyomásra), visszahívási kérés, ha nincs szabad időpont. A jóváhagyott rendszer-e-mailek rövidek, tegezők, "A TWINX csapata" aláírással.
- Díjak és fizetés: ajánlat-követés és külön fizetési napló (fejlesztési díj, havi díj, egyéb; részletfizetés mérföldkőhöz kötve); a számlát egyelőre kézzel állítjuk ki a Számlázz.hu-ban (később automatizálható); a pénzügyi adatot csak az admin látja; a havi díj kifizetésekor a modul érvényessége egy tranzakcióban nő; a lejárat előtt 3 és 1 nappal az admin automatikus figyelmeztetést kap.
- Plafon: forintban, nettó önköltségben; a havi díj egy megadott mennyiségre szól, a pluszcsomag modulonként előre megtervezett; elszámolás csak sikeres futás után; 80%-nál figyelmeztetés, 100%-nál leállás; az értesítés a közös Telegram-beszélgetésbe megy; minden egyedi modulhoz kalkuláció készül a reális havi költségről.
- Adatkezelés és tesztelés: az adatkezelési tájékoztató vázlata kész, a jogász és a cégadatok hiányoznak (kapu a foglalás és a meghívás éles indítása előtt); külön tesztkörnyezet nincs, ezért csak additív, visszafordítható migrációk készülnek, mentéssel és visszacsináló szkripttel, az új funkciók pedig csak adminnak látszanak, amíg nincsenek leellenőrizve.
- Lemondás és lezárás (D54): a modul lemondását csak az admin rögzíti, és a kifizetett időszak végén lép hatályba; a cég lezárása archiválás (a tagok hozzáférése megszűnik, a fiókjuk és a munkáik megmaradnak, a számviteli adat megmarad). A lefejlesztett modul (kód és regiszter-bejegyzés) soha nem törlődik: a TWINX vagyona, és más cégnek is adható; a tulajdont és az újrahasznosítást a szerződés dönti el. Az ügyféladatot a megőrzési határidőn belül töröljük vagy visszaadjuk; a törlés kétlépéses és jóváhagyott (másik, kijelölt jóváhagyó). Minden modulnál kötelező a törlési és exportálási leírás: ez az Aktiválás feltétele. Az admin a határidőn belül visszaállíthatja a lemondott modult vagy a lezárt céget.
- Felhasználói szövegek (D55): ha a modul nem elérhető (lejárt, lemondott vagy nem aktív), a felhasználó mindig ugyanazt a szöveget kapja, az ok és a pénzügyi vagy belső részlet nélkül; a meghívó-oldal hibás, lejárt, visszavont és elfogadott meghívóra ugyanazt mondja; a kinevezett cégvezető értesítő levelet kap, az eltávolított kolléga nem.
- Átadási bejegyzés (D56): az Átadva állapotba csak bejegyzéssel lehet lépni (az elfogadó neve, módja, ideje, az átadott modul leírása és verziója; csak admin látja); az Aktiválás feltétele az érvényes bejegyzés; az „átadáskor” fizetési tétel csak emlékeztetőt kap; érdemi változásnál új bejegyzés kell (az utolsó érvényes számít), hibajavításnál nem; az elfogadás feltételei a szerződésben dőlnek el.
- Ajánlat és kalkuláció (D57): a havi díj legalább 2× a tipikus havi önköltség, és sosem kisebb a plafonnál (plusz az egyéb havi költség); a pluszcsomag ára legalább 2× az önköltsége; a fejlesztési díj nem lehet az önköltség-alapú alsó határ alatt indoklás és Márk–Tibor jóváhagyás nélkül; az ajánlat küldése előtt mindketten jóváhagyják; nincs nyilvános ár.
```

## 2. Rövid kiegészítők (beszélgetésenként egy, a mesterszöveg alá)

- **Fejlesztés / CODE:** „Feladatod (a sorrend kötött): 1) rövid főoldal, új felső sáv és külön referencia-landing, `claude/11-fooldal-es-landing-terv.md` szerint; 2) kapcsolatfelvétel és időpontfoglalás (két lépés, admin időpont-kezelés, e-mail és Telegram értesítés) `claude/15-foglalas-terv.md` és `claude/16-email-szovegek.md` szerint; 3) új admin szerkezet és szerepkörök `claude/12-admin-terv.md` szerint (Foglalások, Felhasználók, Cégek, Előfizetések, Egyedi modulok lap és modul-regiszter, nézet-váltó cég/felhasználó szerint, admin jog adása naplózva, a kredit kivezetése a felületről, láthatatlan plafon), személyre szabott kezdőlap; 4) adatmodell (`claude/14-adatmodell-terv.md`), előfizetés-kezelés 1. fázis, a cégvezetői státusz és a meghívás `claude/13-hozzaferesek-terv.md` szerint („Hozzáférések” ablak, szerveroldali érvényesítés, tranzakció, napló), majd az ajánlat- és fizetés-követés (`claude/19-dijak-es-fizetes-terv.md`), a plafon (`claude/20-plafon-es-hasznalat-terv.md`), a lemondás, lezárás, ügyféladat-törlés (`claude/21-lezaras-es-lemondas-terv.md`), a felhasználói szövegek (`claude/22-felhasznaloi-szovegek.md`) és az átadási bejegyzés (`claude/23-atadas-jovahagyasa-terv.md`). Minden migráció additív és visszafordítható (D51). Az irodai fiók közös terének funkciói és a Stripe-automatizmus később jön.”
- **Marketing / LinkedIn / Meta:** „Az új üzenet: egyedi, cégre szabott modulok bármilyen cégnek, ingyenes felméréssel. Az ingatlanos modulok referenciák, a GDN Mandala kollégái naponta használják. A futó Meta-hirdetés és a posztok üzenetét ehhez igazítsd, a kreditről és a 10 ingyen kreditről ne szóljon semmi. Az irodai fiókról annyit mondj: közös tér, ha a kollégák együtt dolgoznak; a használati nézetről és a közös tér még nem kész funkcióiról ne.”
- **Ügynökség:** „A B ág (fejlesztői) kerül előtérbe, 6 alügynökkel: hibakeresés, modulépítés, tudásrendszerezés, webfejlesztő, modul tesztelő, felmérő (piackutató és cégfelmérő egyben). Az aktiváló és a gyártó ág háttérbe kerül, a regisztrált felhasználók vonala szünetel. A félretett szerepek és a részletek: `10-fejlesztoi-ag-alugynokok.md`.”
- **Üzlet / jog:** „Kell NDA-sablon és az ügyféladatok kezelésének szabálya a nálunk futó modulokhoz, valamint az adatkezelési tájékoztató a foglalási űrlaphoz és a meghívó e-mailekhez. Árképzés: mindig egyedi (fejlesztési díj plusz havi előfizetés, a Stripe-on), belső ajánlat-ellenőrző lista kell, nincs fix árlista.”

## 3. A dokumentumok állapota az irányváltás után (2026-11-23)

| Dokumentum | Állapot |
|---|---|
| `00-iranyvaltas-D23.md` (ez) | Új, irányadó (D57-ig frissítve). |
| `11-fooldal-es-landing-terv.md` | **Új (D34–D39), D46-ig frissítve (a D48 foglalási részletek a `15`-ben):** a főoldal, a belépett kezdőlap, a kapcsolatblokk, a referencia-landing, az előfizetés és az irodai fiók modellje. |
| `12-admin-terv.md` | **Új (D40–D56-ig frissítve):** az admin szerkezete (Pénzügy menü, plafon), a szerepkörök, a kredit kivezetése a felületről, az Egyedi modulok lap és a modul-regiszter. |
| `13-hozzaferesek-terv.md` | **Új (D46, kiegészítve D47–D49):** a „Hozzáférések” ablak, a meghívás folyamata, a cégvezetői szabályok, a biztonsági követelmények, az állapotgép. |
| `14-adatmodell-terv.md` | **Új (D47, kiegészítve D48–D56):** táblák, függvények, RLS, átállítás, ellenőrzés. |
| `15-foglalas-terv.md` | **Új (D48):** időpontfoglalás, Foglalások lap, értesítések. |
| `16-email-szovegek.md` | **Új (D49):** jóváhagyott e-mail- és Telegram-szövegek. |
| `17-adatkezelesi-tajekoztato-vazlat.md` | **Új (D50):** adatkezelési tájékoztató vázlata, jogász-ellenőrzési lista. |
| `18-atadas-fejlesztesi-beszelgetesnek.md` | **Új:** áttekintő átadó-dokumentum a fejlesztési beszélgetésnek. |
| `19-dijak-es-fizetes-terv.md` | **Új (D51–D52):** ajánlat, fizetési napló, számlázás, lejárati figyelmeztetés. |
| `20-plafon-es-hasznalat-terv.md` | **Új (D53):** havi plafon, használat-mérés, pluszcsomag, modul-kalkuláció. |
| `21-lezaras-es-lemondas-terv.md` | **Új (D54):** modul lemondása, cég lezárása, ügyféladat törlése/visszaadása, a modul megőrzése, újraaktiválás. |
| `22-felhasznaloi-szovegek.md` | **Új (D55):** felhasználói szövegek: modul nem elérhető, meghívó-oldal, fiók-állapotok, cégvezetői megerősítések, kinevezési levél. |
| `23-atadas-jovahagyasa-terv.md` | **Új (D56):** az átadási bejegyzés (az Átadva állapot jóváhagyási nyoma). |
| `24-ajanlat-ellenorzo-lista-es-kalkulacio.md` | **Új (D57):** belső ajánlat-ellenőrző lista és kalkuláció sablon (belső dokumentum). |
| `ai-ugynokseg/01-alap-es-szabalyok.md` | **Átírva:** küldetés, ágak, döntési napló D23–D57, nyitott döntések. |
| `ai-ugynokseg/02-keretrendszer-spec.md` | **Frissítve:** a fejlesztői ág előtérben, a 6 alügynök (D29); a partner ág építési sorrendje (11. szakasz) szünetel. |
| `ai-ugynokseg/03-dontesi-lap.md` | Történeti (2026-10-16), fejléc jelzi. |
| `ai-ugynokseg/04-CLAUDE-fejlesztes.md` | **Átírva:** mi a TWINX, modulok állapota, admin, szerepkörök, meghívás, modul-regiszter, új fejlesztési feladatok (D56-ig frissítve). |
| `ai-ugynokseg/05-CLAUDE-marketing.md` | **Átírva:** új üzenet, ajánlat, célcsoport, szabályok (D53-ig frissítve). |
| `ai-ugynokseg/06`–`08` | **Háttérbe került (partner ág):** fejléc jelzi, mi érvénytelen. Újratervezésük külön döntés. |
| `ai-ugynokseg/09-ugynokok-spec.md` | **Frissítve:** a fejlesztői ág előtérben (6 alügynök). |
| `ai-ugynokseg/10-fejlesztoi-ag-alugynokok.md` | **Új (D29):** a 6 alügynök részletei és a félretett szerepek. |
| `TWINX-memoria-export-web_twinx.md` | Történeti anyag (régi irány); a technikai tudás és a buktatók érvényesek. |

## 4. Elavult kifejezések (ha ezek valahol szerepelnek, ellentmondanak az új iránynak)

- „kredit”, „kreditcsomag”, „10 ajándék kredit”, „a kreditjeid nem járnak le” mint **ajánlat, üzenet vagy felületi elem**. (Technikailag a pénztárca láthatatlanul marad; a felületen nincs kredit-napló, -kérés, „+” gomb, üdvözlő kredit, kreditvásárlás.)
- „Önkiszolgáló kreditvásárlás az ingatlanosoknak” és „a nem GDN-es ingatlanosok a meglévő csomagokat vásárolják” — helyesen: a hozzáférést csak mi adjuk, mindenkinek (D40, D44).
- „AI-eszköztár / AI-appstore, amit regisztrált felhasználók kreditért használnak” mint **a TWINX lényege**.
- „Csak az ingatlanos vonalra koncentrálunk” mint **célcsoport**. Helyesen: bármilyen cég; az ingatlan referencia.
- „A partner ág az első éles ág” (D11, D16). Helyesen: a fejlesztői ág az előtérben.
- „Az alügynökök listája nem végleges” — a mag eldőlt (D29), bővítés később, igény szerint.
- „Az irodai fiók közös kreditkeret” és „az egyedi modul az irodai fiókon keresztül jár” — helyesen: a modul-hozzáférés felhasználóhoz kötött; az irodai fiók opcionális közös tér (D35).
- „A cégvezető dönti el, ki használja a modult” / „a vezető dönt az irodai fiókban” mint cím alapú jog — helyesen a pontos jog: a **cégvezető** (cégenként élő státusz) meghív és eltávolít kollégát, fizet és kinevez másik cégvezetőt; az **irodai fiók adminja** csak a közös tér tagságát kezeli, modul-hozzáférést nem ad (D45, D46).
- „Fizető cégvezető” (csak egy fizethet) és „meghívási jog” mint külön jog — megszűnt: **mindegyik cégvezető fizethet**, és a cégvezetői kinevezés fedi a meghívást is (D46).
- „A cégvezetői státuszt csak az admin állítja” — helyesen: az admin bárkit kinevezhet, a cégvezető a cég aktív tagját; saját státuszt mindenki feladhat, másét csak az admin veheti el; minden cégnek marad legalább egy cégvezetője (D46).
- „Megrendelő” mint szerep- vagy státusznév — a szó helyett **„cégvezető”** (D45). (A „megrendelés” mint folyamat — ingyenes felmérés — megmarad.)
- „A hozzáférés cseréje igény alapján, nálunk történik” (egyedi modulnál) — helyesen: a cégvezető maga hív meg és távolít el kollégát (D41); az ingatlan hozzáférést mi adjuk.
- „Csak Márk lehet admin” (D44 korábbi változata) — helyesen: több admin lehet, admin jogot csak admin adhat, naplózva, az utolsó admint nem lehet levenni (D45).
- „Kollégák közösen dolgoznak a modullal” mint alapértelmezés — helyesen: mindenki egyedül dolgozik vele; a közös munka az irodai fiók opcionális funkciója.
- „Fix árlista / csomagárak az egyedi moduloknál” — helyesen: az ár mindig egyedi (D39).
- `sales` szerepkör, „keretet fogyasztó” szerepkörök — megszűnt (D44).
- Az admin régi menüpontjai: Kredit-napló, Kredit-kérések, Meghívók (/ingatlan ajándékkód-kampány) — kikerülnek (D40).

## 5. Nyitott kérdések

- `[DÖNTÉSRE VÁR]` A partner ág (aktiváló, gyártó) hosszú távú jövője; most szünetel (D31).
- `[DÖNTÉSRE VÁR]` A Modul tesztelő teszt-környezete, és a beszélgetés jegyzetének útja a Felmérőhöz.
- `[MEGERŐSÍTENDŐ]` A D46 alapértelmezései: a külön meghívási jog megszűnik; egy felhasználó több cégben is lehet; a meghívó 7 napig érvényes; ha az előfizetés az elfogadás után lejár, a hozzáférés nem aktiválódik.
- `[KITÖLTENDŐ]` Cég lezárása és modul lemondása (D54, eldöntve): hátravan a megőrzési határidő napjainak száma (NDA, adatfeldolgozói szerződés), a számviteli megőrzési idő, a szerződés- és ajánlat-sablon a modul tulajdonáról és az átvétel feltételeiről (jogász).
- `[KITÖLTENDŐ]` A láthatatlan havi plafon konkrét értékei az API-költséges moduloknál (a mértékegység eldőlt: forint, nettó önköltség): az első ilyen modulnál, a modul-kalkulációval és az ajánlat-ellenőrző listával együtt.
- `[KITÖLTENDŐ]` A felhasználói szövegek (D55) finomhangolása a próbafelületen; az elfogadás feltételei (elfogadási kritériumok, hibajavítási időszak) a szerződés- és ajánlat-sablonban (D56, jogász).
- `[KITÖLTENDŐ]` Az alügynökök alapokmányai, NDA-sablon, a belső óradíj és az első kitöltött kalkuláció (D57), a futó Meta-kampány és az /ingatlan landing új változata.
- `[TEENDŐ, kapu]` Adatkezelési tájékoztató (vázlat kész: `17`; jogász és cégadatok hiányoznak) és a Resend domain-hitelesítés a foglalási űrlap és a meghívás éles indítása előtt; Tibi hitelesíti a referencia-landing csoportjait.
