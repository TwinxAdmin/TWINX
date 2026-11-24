# CLAUDE.md — TWINX marketing

> Ez a fájl a TWINX marketingmunkájához ad háttértudást Claude-nak.
> Aki használja: **Tibi** (Radics Tibor, társalapító, ő viszi a marketingkampányt) és Márk.
> Nyelv: **magyarul** dolgozunk, magyar piacra. Frissítve: 2026-11-23 (irányváltás, D23–D53; a D47–D53 belső működési döntések, kifelé nem kommunikáljuk).
> Ami `[TIBI TÖLTI KI]` jelölésű, azt a kampány előtt érdemes kitölteni.
>
> **IRÁNYVÁLTÁS (D23):** a TWINX **egyedi, cégre szabott modulok gyártója**, bármilyen cég számára. A kreditalapú eszköztár-modell megszűnik, ezért a korábbi üzenetek (kredit, kreditcsomag, „10 ajándék kredit", „nincs havidíj, csak a kész anyagért fizetsz") **nem használhatók.** A hivatalos leírás: `claude/00-iranyvaltas-D23.md`. A főoldal szövegei: `claude/11-fooldal-es-landing-terv.md`.

---

## 1. Mi a TWINX — egy mondatban

**A TWINX olyan egyedi modulokat épít cégeknek, amelyek a napi munkájukat gyorsítják: felmérjük, hol megy el sok idő, és olyan eszközt készítünk, ami pontosan az ő folyamatukra szól.**

- Weboldal: **twinx.hu** · Közös cím: **office@twinx.hu**
- Nem sablonos oldalt építünk, hanem olyan modulokat és funkciókat, amelyek konkrét üzleti folyamatokat gyorsítanak.
- A cég két úton indulhat: **felmérjük a napi működését** (és megmondjuk, hol lehet gyorsítani), vagy **konkrét ötlettel jön hozzánk**, és azt építjük meg.
- **Referencia:** a TWINX a **GDN Mandala Ingatlanirodával** együtt készült, valódi ingatlanos munkára, és a GDN Mandala kollégái naponta használják. A kész ingatlanos modulokat (lásd 2. szakasz) bizonyítékként mutatjuk meg.
- **A főoldal üzenete (D36):** cím: **„A te cégedre szabott modul."** Alcím: *„Profi felmérés után a TWINX a napi munkádhoz igazított eszközt épít."* Ez az elfogadott szlogen-irány; kampányanyagnál ehhez igazodj. A régi „Profi munka, egy kattintásra." az eszköztárat hirdette, nem használható.

## 2. Mit kínálunk

### Egyedi modul (a fő ajánlat)
- **Hogyan indul:** **ingyenes felmérés és beszélgetés** Kovács Márkkal vagy Radics Tiborral. A cég a weboldalon **kapcsolatfelvételi blokkban** foglal időpontot, két lépésben: előbb az időpontot választja, utána megadja az adatait. Mi adjuk meg a szabad időpontokat és az elérhetőségeket, mi hívjuk vissza őket. A blokk a főoldalon belépés előtt, és regisztráció/belépés után is elérhető.
- **Foglaláskor kötelező:** név, cég, e-mail, telefonszám (mert telefonon keressük őket). **Opcionális:** pár mondatban megírhatják, milyen fejlesztést vagy munkafolyamatot modernizálnának, hol megy el sok idő; konkrétum nélkül is lehet foglalni. Ha nincs szabad időpont, az adatok akkor is elküldhetők, és visszahívjuk őket.
- **Az út, ahogy a cég látja (D42):** ingyenes felmérés → mi megépítjük a modult → átadjuk → a cégvezető előfizet → a kollégái belépnek és használják.
- **Hol fut az egyedi modul** (a cég választ):
  1. **A TWINX oldalán** (**„Ajánlott kezdés"**): a kollégák a saját fiókjukkal belépnek, és használják a modult. Költséghatékonyabb, nem kell külön appot vagy weblapot fejleszteni.
  2. **Saját app vagy oldal**, amit a cégnek fejlesztünk.
  3. **Beépítés a cég saját oldalába**, ha hozzáférést adnak.
  4. **Meglévő csatornában**: Telegram, Slack vagy Excel.
- **Hozzáférés és irodai fiók (D35, D41, D45, D46):**
  - A modult a kollégák **a saját fiókjukban, egyedül** használják; irodai fiók nem kell hozzá. A **cégvezető** (aki a modult rendelte, és az előfizetést köti) **maga hívja meg a kollégáit e-mail címmel**: a kolléga egy „Belépés" gombos üzenetet kap, belép vagy regisztrál (ha még nincs fiókja, ugyanazzal az e-mail címmel kell regisztrálnia), és a modul egyből ott van nála. A cégvezető a kollégát el is távolíthatja, és a helyére újat hívhat. Előfizetést X kollégára a cégvezető köt (egy cégnél több cégvezető is lehet, mindegyikük fizethet).
  - Az **irodai fiók opcionális közös tér**: ha a kollégák együtt akarnak dolgozni, ott küldhetik egymásnak a munkát, kérhetnek tanácsot, vagy megmutathatják az elkészült munkát átnézésre.
  - **Amit még nem mondhatsz kifelé:** a közös tér funkciói (munka küldése, tanácskérés, átnézés) még nem készek, a főoldalon „Hamarosan" jelzéssel szerepelnek. **Ne említsd** a „vezető látja a használatot" lehetőséget az egyedi moduloknál (nincs ilyen nézet), és a létszám-alapú árat sem közöljük. A belső működést (modul-regiszter, aktiválás, állapotok, szerepkörök) sem részletezzük kifelé.
- **Ár (D39):** mindegyik változatnak külön fejlesztési díja és havi előfizetése van (a havi díj később Stripe-on keresztül fizethető), **mindig egyedi és modulfüggő**, mert minden modul más költséggel jár (fejlesztés, API-k, egyéb). **A weboldalon és hirdetésben árat nem közlünk**; az ajánlat a felmérés után készül.
- **Titoktartás:** a cég adatait titoktartási szerződés (NDA) védi. `[A sablon még nincs kész — amíg nincs, kifelé ne ígérj konkrét szerződéses feltételt.]`

### Referencia-modulok: ingatlan (élő, a GDN-nel fejlesztve)
Ezeket **referenciaként** mutatjuk meg a külön **referencia-landingen**, a főoldalon pedig három kiemelt kártyán (Látványterv, Hirdetés-ellenőrző, Értékbecslés). Az ajánlatban „Ingatlan csomag"-ként szerepelnek. **Hozzáférés (D30, D40, D44):** a GDN kollégák használják; a hozzáférést **csak mi adjuk**, minden ingatlanosnak, **önkiszolgáló vásárlás nincs**. Ezt **nem hirdetjük**: az Ingatlan csomag a landing alján egy diszkrét sor, nem a fő ajánlat, és nem hirdetünk „bárki megvásárolhatja" lehetőséget. A „kredit" szót nem használjuk.

**A referencia-landing felépítése (D38):** hero: *„A GDN Mandala kollégái naponta használják."* (szám és idézet nélkül, amíg nincs valódi, jóváhagyott adat). A modulok munkafolyamat szerint csoportosítva:
- **Az ingatlan bemutatása:** Képjavító, Látványterv, Hirdetéskép-készítő, Marketingvideó, 3D bejárás (**„Hamarosan"** jelzéssel, külön, halványabb kártyán)
- **A hirdetés és az ár:** Hirdetés-ellenőrző, Értékbecslés
- **Az iroda és a háttér:** Szakember-kereső, Irodai fiók

`[Tibi hitelesítse a csoportokat és a modulleírásokat, mielőtt éles lesz.]` A landing sávja: *„Ingatlanra készült, de bármilyen területre építünk egyedi modult."*

| Modul | Mit csinál |
|---|---|
| **Látványterv** | Lakásfotóból felújítási koncepcióterv, 9 stílusban. Megmutatja, hogyan nézhetne ki a lakás felújítva. |
| **Képjavító** | Telefonos fotóból profi hirdetési fotó: jobb fény, rendrakás, a szoba ugyanaz marad. |
| **Hirdetéskép-készítő** | Kész, arculatos hirdetési kép több sablonban, social méretekben (1:1, 9:16, 4:3). |
| **Hirdetés-ellenőrző** | Bemásolod egy meglévő hirdetés linkjét: pontozza, megmondja, mi hiányzik, és újraírja a szöveget. |
| **Értékbecslés** | Ingatlanadatokból tájékoztató ársáv egyoldalas, arculatos PDF-ben, „miért ennyi az ár?" magyarázattal. |
| **Marketingvideó** | Fotókból és adatokból zenés, függőleges (9:16) vagy négyzetes videó Reelsre és TikTokra, több sablonban. |
| **Szakember-kereső** | Ingatlanos munkához szükséges szakemberek és szolgáltatók felkutatása, nyilvános elérhetőséggel. |
| **Irodai fiók** | Egy közös tér, ahol az iroda kollégái együtt dolgozhatnak (az ingatlanos irodai fiókban a vezetői és kollégai nézet él). Az egyedi modulok használatához nem kell. |

### Készül — kifelé NE kommunikáld élőként
- **3D bejárás:** alaprajzból bejárható, méretarányos lakás. A referencia-landingen **kizárólag „Hamarosan" jelzéssel** szerepelhet; hirdetésben, posztban, e-mailben nem hirdetjük.
- **Hirdetésből videó:** egy hirdetés linkjéből automatikus ingatlanbemutató videó. **Sehol nem szerepel.**

## 3. Árak (D23, D30, D32, D39, D40)

- **Nyilvános ár nincs.** A régi kreditcsomagok (Induló, Közepes, Nagy) és a modulonkénti kreditárak **nem szerepelnek a kommunikációban**, és a felületről is kikerültek: önkiszolgáló vásárlás nincs.
- **Mit mondhatsz:** a felmérés **ingyenes**; az ajánlat modulfüggő és egyedi; van egyszeri fejlesztési díj és havi előfizetés. Összeget nem, árlistát nem.
- **Nem mondhatod:** „nincs havidíj", „a kredit nem jár le", „10 ajándék kredit", „sikertelen futásnál visszajár a kredit", „bárki megvásárolhatja az ingatlanos modulokat".
- `[KITÖLTENDŐ — belső ajánlat-ellenőrző lista, ÁFA-tájékoztatás: Márk és Tibi döntése.]`
- A fejlesztést Márk végzi. Ha egy modul működéséről vagy új funkcióról kérdés van, hozzá kell fordulni.

## 4. Kiknek szól

### Célcsoport: bármilyen cég (D23)
- **Kik ők:** olyan cégek, ahol egy vagy több munkafolyamat sok időt visz el, ismétlődő, kézi, vagy több eszközön szétszórt.
- **Jelek, hogy nekik jó:** „minden héten órákat töltünk ezzel", „Excelben vezetjük, és mindig elcsúszik", „három helyre kell beírni ugyanazt", „az új kolléga hetekig tanulja ezt a folyamatot".
- **Amit a TWINX ad nekik:** az ő folyamatukra szabott modul, amit mi építünk meg; a felmérés ingyenes, és a cég megmondhatja, hol fusson (TWINX-en, saját appban, saját oldalba építve, vagy Telegramban/Slackben/Excelben).
- **Legerősebb érvek:** (1) **visszakapott idő**: konkrét folyamat gyorsul; (2) **nem sablon**: a cég működésére szabott; (3) **kockázatmentes kezdés**: az első beszélgetés ingyenes, és konkrétum nélkül is lehet foglalni.

### Cégek, több kolléga
A TWINX-en futó modult a kollégák a saját fiókjukkal használják, külön app vagy weblap fejlesztése nélkül; ez a cégnek olcsóbb is. A kollégákat a cégvezető hívja meg e-mailben, pár kattintással. Ha együtt akarnak dolgozni, az **irodai fiók** közös teret ad nekik (a közös tér funkciói még nem készek, lásd 2. szakasz).

### Ingatlanosok
A meglévő modulok valódi ingatlanos munkára készültek, ők a **referencia-közönség**: róluk mutatjuk meg, hogy működik. Új, ingatlanos csomagolású kampány csak külön döntéssel indulhat.

### Vendéglátás
A vendéglátás modulok rejtettek, és a vonal később megszűnhet. **Vendéglátós célcsoportnak ne készüljön anyag**, és a vendéglátás modulokat ne említsd.

## 5. Hangnem és arculat

- **Tegeződünk.** A weboldal és az eddigi hírlevelek is így beszélnek. `[TIBI TÖLTI KI — ha cégeknek inkább magázódni akartok, írjátok át]`
- **Egyszerű, konkrét, mellébeszélés nélkül.** Rövid mondatok, kézzelfogható eredmény (pl. „az a heti 3 óra, amit most kézzel csinálsz, 5 perc lesz"), nem technológiai szöveg. **Csak valós, alátámasztott példát írj**, számot ne találj ki.
- **Az AI-t nem hangsúlyozzuk túl.** A vevőt az eredmény érdekli (idő, egyszerűbb folyamat), nem a technológia.
- **Kerülendő:** „forradalmi", „mesterséges intelligencia erejével", „egyedülálló", túlzó szuperlatívuszok, ellenőrizhetetlen számok.
- **Vizuális irány:** sötét, bronzos/fekete alap, korall kiemelőszín, Space Grotesk címbetű.
- **Kulcsmondatok — az új irányhoz illők:**
  - „A te cégedre szabott modul."
  - „Profi felmérés után a TWINX a napi munkádhoz igazított eszközt épít."
  - „Nem sablonos oldal: konkrét folyamatot gyorsítunk"
  - „Több idő az ügyfélre, kevesebb adminisztráció"
  - „A GDN Mandala kollégái naponta használják."
  - „−10 óra / hét kézi munka helyett" (csak ha alá tudjuk támasztani)
- **Elavult kulcsmondatok (ne használd):** „Másodpercek alatt kész anyag, 1 kattintás", „Profi munka, egy kattintásra" mint a főüzenet. Ezek az eszköztárról szóltak.

## 6. A mostani kampány és a meglévő anyagok

- **Cél (D23):** **ingyenes felmérési időpont-foglalások** a főoldalról és a referencia-landingről. `[TIBI TÖLTI KI — konkrét cél: hány foglalás / milyen időszak alatt]`
- **A korábbi cél** (ingatlanosok regisztrációja a **twinx.hu/ingatlan** oldalon, 10 ajándék kredittel) **megszűnik.** A futó Meta-hirdetést és az /ingatlan landinget **később, az új vonalra tervezzük át** (D31); addig új kreditet ígérő anyag nem készülhet. A kredit-alapú regisztrált felhasználók háttérbe kerülnek, rájuk nem építünk kampányt.
- **Csatornák:** LinkedIn (cégvezetők, irodai döntéshozók), Meta (Facebook/Instagram), TikTok — az új üzenethez igazítva. A függőleges 9:16 videók és a négyzetes (1:1) képek maradnak használhatók.
- **Új anyag (2026-11):** a „TWINX irodai fiók" LinkedIn-kampány: filmes, „megfagyott káosz" állókép és 12 mp-es videó (egy nyugodt ember dolgozik, körülötte a káosz extrém lassított mozgásban), rá szöveges kártyák, záró snitt, és egy 1:1-es kísérőkép („AI-agent, irodai fiók és saját modul rendelhető a TWINX-től"). Az AI-jelölés egyelőre nem kerül ki; ezt a későbbi anyagoknál újra kell dönteni. **Figyelem (D35):** az „irodai fiók" itt közös teret jelent; az üzenetet úgy igazítsd, hogy ne ígérjen még nem kész közös funkciókat.
- **Meglévő anyagok, amik átdolgozásra várnak:**
  - **5 részes e-mail sorozat** (Smartlead/Brevo) és FB-posztok: az 5. („Ajándék 10 kredit") megszűnik; a többi is az eszköztár-üzenetet viszi → **átírandó vagy leállítandó.**
  - **„Anna és a hétfő" reklámvideó-koncepció (30 mp):** érzelmi mag: visszakapott idő. Az üzenet továbbra is használható, de a „TWINX tábla → pár perc alatt kész" jelenet a modulokra szóljon, ne kreditre/eszköztárra. **Anna kitalált reklámszereplő, nem TWINX-munkatárs.** Soha nem jelenhet meg ügyfélszolgálatosként, kapcsolattartóként vagy levél aláíróként. A levelek aláírója mindig „A TWINX csapata" (vagy a felmérést vezető valódi kolléga, a hozzájárulásával).
  - Kreatív elemek: hook, „stopper" animáció, checklist-animáció, CTA zárókártya, AI-bevágóképek, magyar narráció, valódi TWINX képernyőfelvételek.
- **Mérés:** Google Analytics fut a twinx.hu-n. A régi kulcsesemények: `sign_up`, `generate_lead`. **Új kulcsesemény javaslat:** `book_assessment` (felmérés-foglalás). Az UTM marad (pl. `utm_source=linkedin&utm_campaign=...`). `[Márk + CODE: bekötés]` Az esemény csak a szerver által visszaigazolt sikeres foglalás után lő (D48).
- **Költségkeret:** `[TIBI TÖLTI KI]` · **Időszak:** `[TIBI TÖLTI KI]` · **KPI:** `[TIBI TÖLTI KI — pl. foglalás/fő költsége, foglalásból megrendelés arány]`
- **Elérhetőség:** közös cím: **office@twinx.hu**. Nyomtatott anyagokon: Radics Tibor, +36 70 207 7988, mandala@gdn-ingatlan.hu

## 7. Bevált formulák

### Hook-típusok (az első 1–2 másodperc)
- **Káosz → nyugalom:** „Körülötted minden szétesik. Közben a munka magától megy." (A LinkedIn-videó hangulata.)
- **Fájdalompont:** „Még mindig kézzel írod át ugyanazt háromszor?"
- **Kérdés a cégtől:** „Hol megy el a legtöbb időd?" — „Mondd el, és megmutatjuk, mit lehet vele kezdeni. Ingyen."
- **Referencia:** „Ez a modul egy ingatlanirodánál dolgozik. Mi lenne, ha a tiédnél is?"
- **Visszakapott idő:** „Ami eddig órák voltak, az most percek."

### Poszt- és videószerkezet
1. Hook (probléma vagy látványos kontraszt)
2. A folyamat, ami lassú (konkrétan)
3. A megoldás: valódi TWINX képernyőfelvétel egy referencia-modulból, vagy egy kész egyedi modul
4. Egy érv (a te folyamatodra szabva / ingyenes felmérés / ahol neked jó, ott fut)
5. CTA

### CTA-k
- „Foglalj ingyenes felmérést: twinx.hu"
- „Mondd el pár mondatban, hol megy el az időd — mi felmérjük."
- „Nincs konkrét ötleted? Nem baj, így is foglalhatsz."

## 8. Szabályok — mit soha

- **Ne találj ki** véleményt, ügyfélidézetet, felhasználószámot vagy statisztikát. Csak valós, ellenőrzött adatot és valódi ügyfél engedélyével készült idézetet használunk. A GDN-ről annyit mondunk, hogy „naponta használják"; számot (pl. megspórolt idő) csak valós, a GDN által jóváhagyott adattal.
- **Előtte/utána anyag csak valódi TWINX-kimenetből** készülhet, utólagos szépítés nélkül.
- **Árat, kreditet, díjat ne közölj.** A felmérés ingyenes; az ajánlat a felmérés után készül.
- **Ne ígérj konkrét üzleti eredményt** („+30% eladás", „kétszer gyorsabban működik") és ne ígérj időtartamot egy egyedi modulra, amíg nincs felmérés.
- **Ügyféladat és titoktartás:** ügyfelet, céget, belső folyamatot **csak a cég engedélyével** említesz. Az NDA-sablon még készül, addig szerződéses vállalást kifelé ne tegyél.
- **Referencia-modulnál:**
  - Az **értékbecslés tájékoztató ársáv, nem hivatalos értékbecslés** (nem bank vagy hivatalos szakértő készíti). Soha ne nevezd hitelesnek, és ne ígérj vele garantált eladási árat.
  - A **látványterv koncepcióterv**: azt mutatja, *hogyan nézhetne ki* a lakás, nem a mostani állapotát. A képeken rajta van a „Twinx AI látványterv" jelölés. Ezt ne vágd le, és hirdetésben is jelezd, hogy illusztráció.
- **Sebességet óvatosan:** „percek alatt" mehet a referencia-moduloknál. Konkrét másodpercet csak akkor írj, ha az aktuális mérés alátámasztja.
- **Készülő funkciót ne hirdess élőként** (3D bejárás: csak a referencia-landingen „Hamarosan" jelzéssel; Hirdetésből videó: sehol; az irodai fiók közös terének még nem kész funkciói: csak „Hamarosan" jelzéssel a főoldalon).
- **Meta-szabályok:** ingatlanos hirdetésnél nézd meg a Meta aktuális lakhatási/ingatlanos hirdetési szabályait és célzási korlátait; az új, általános cégeknek szóló hirdetésnél a Meta aktuális szabályait ellenőrizd a kampány indítása előtt.
- **GDPR:** hírlevélre csak hozzájárulással iratkozhat fel valaki. Az időpontfoglalási űrlapon **GDPR-hozzájárulás pipa** van, az adatokat (név, cég, e-mail, telefon, a szabad szöveg) csak a felmérés egyeztetésére használjuk, és erről az űrlapon tájékoztatás kell. A cégvezető által meghívott kollégák e-mail címét csak a meghívásra használjuk. `[Adatkezelési tájékoztató: a vázlat kész (`claude/17-adatkezelesi-tajekoztato-vazlat.md`), jogászi ellenőrzés és a cég adatai kellenek hozzá; a foglalási űrlap és a meghívás éles indítása előtt kész kell legyen.]`

## 9. Hogyan dolgozz Tibivel (utasítások Claude-nak)

- Ha a kérés nem egyértelmű, előbb tisztázd: **mi a cél, melyik csatorna, kinek szól, van-e határidő.** Legfeljebb 1–2 kérdés, aztán dolgozz.
- **Mindig 2–3 változatot adj** (hook, szöveg, koncepció), röviden megindokolva, miben mások, és jelöld, melyiket ajánlod.
- **Csatornára szabj:** Reels/TikTok = nagyon rövid, az első 1–2 másodperc dönt; LinkedIn-poszt = lehet hosszabb, egy érvvel; hirdetésszöveg = elsődleges szöveg + címsor + CTA külön.
- **Ellenőrizd a 8. szakasz szabályait** minden szöveg előtt. Ha egy kérés ütközik velük, szólj, és adj szabálykövető alternatívát.
- Videónál **forgatókönyvet, jelenetlistát, narrációs szöveget és prompt-javaslatokat** adj. A videót a vágóprogramban rakják össze.
- Ha hiányzik egy adat (ár, határidő, célszám), **ne találd ki**: jelöld `[ADAT KELL]`-lel, és kérdezz rá.
- Kampány után segíts kiértékelni, mi működött. A tanulságokat javasold beírni ebbe a fájlba (a 7. szakaszba).

## 10. Kapcsolódó dokumentumok (a TWINX projektben)

- **`claude/00-iranyvaltas-D23.md`:** az új irány hivatalos leírása és a bemásolható szöveg. **Ez az irányadó.**
- **`claude/11-fooldal-es-landing-terv.md`:** a főoldal és a referencia-landing szövegei és szerkezete, az előfizetés és az irodai fiók modellje (D34–D46).
- **`claude/12-admin-terv.md`**, **`claude/13-hozzaferesek-terv.md`**, **`claude/14`–`20`:** az admin, a hozzáférés-kezelés, az adatmodell, a foglalás, az e-mail szövegek, az adatkezelés, a díjak és fizetés, a plafon belső tervei (marketingnek csak háttér: a belső működést, az árazás és a költségvédelem részleteit kifelé nem kommunikáljuk).
- **`claude/ai-ugynokseg/04-CLAUDE-fejlesztes.md`:** a TWINX fejlesztési tudásbázisa (modulok, működés). Ha egy modul pontos működése kell, ott nézd meg.
- **`claude/TWINX-memoria-export-web_twinx.md`:** a régi fejlesztési szál jegyzetei (régi irány), köztük a hírlevél-sorozat, az /ingatlan kampány, a reklámvideó és a landing részletei. Az ottani kredites üzenetek történetiek.
- **`claude/ai-ugynokseg/01-alap-es-szabalyok.md`:** az AI ügynökség terve és a döntési napló (D01–D53). Később ebből lesz a marketing-ügynök.
- **`claude/ai-ugynokseg/06-aktivalo-ugynok-hangnem.md`:** a felhasználóknak szóló levelek hangneme (háttérbe került ág, D23). A „TWINX csapata" aláírás és a hangnem-elvek továbbra is érvényesek; a kreditről szóló részek nem.

## 11. Hogyan bővítsd ezt a fájlt

- Ami bevált (hook, CTA, videószerkezet), az kerüljön a **7. szakaszba** egy rövid sorban. Ami nem működött, az is, hogy ne ismételjük meg.
- Új modul, árképzési szabály vagy indulásra kész funkció → **2. és 3. szakasz**.
