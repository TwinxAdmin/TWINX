# TWINX – Adatkezelési tájékoztató

> **Belső jegyzet (nem része a közzétett szövegnek):** 2026-11-27, D74. A `17` vázlatból, Márk döntéseivel (megőrzési idők elfogadva, D73 visszahívás-kérés, a foglalási rendszer parkolva) készült, közzétételre szánt változat. Jogász később átnézi. Közzététel előtt: a `[KITÖLTENDŐ]` helyeket Márk tölti ki; a `[HA VAN]` jelű sorokat a fejlesztés **csak akkor hagyja meg, ha az a funkció ténylegesen működik** (különben törli); az `[ELLENŐRIZENDŐ]` helyeket a fejlesztés a kódból és a szolgáltatók oldaláról ellenőrzi. A saját foglalási rendszer (D48) bekapcsolásakor új verzió kell (a foglalási sor visszakerül).

---

**Verzió:** 2026-12-v1 · **Hatályos:** [közzététel napja]

Ez a tájékoztató elmondja, milyen személyes adatokat kezelünk, miért, meddig, kinek adjuk át őket, és milyen jogaid vannak. Igyekeztünk érthetően fogalmazni; ha kérdésed van, írj nekünk.

## 1. Ki kezeli az adataidat?

**Adatkezelő:** Kovács Márk egyéni vállalkozó (TWINX)
- Székhely: 1143 Budapest, Tábornok utca 27.
- Nyilvántartási szám: [KITÖLTENDŐ] · Adószám: [KITÖLTENDŐ]
- E-mail: office@twinx.hu · Telefon: +36 20 563 0561, +36 70 207 7988 · Weboldal: twinx.hu

Adatvédelmi tisztviselő kijelölésére nem vagyunk kötelesek; adatvédelmi kérdésben az office@twinx.hu címen érsz el minket.

**Ha egy cég egyedi modulját használod:** a cég a saját és az ügyfelei adatait a TWINX rendszerében kezeli. Ilyenkor a cég az adatkezelő, mi pedig a megbízásából, az utasításai szerint dolgozzuk fel az adatokat (adatfeldolgozó). Ezekről az adatokról a cég ad tájékoztatást; a vele kötött szerződésünk rögzíti a feldolgozás szabályait.

## 2. Milyen adatokat, miért és meddig kezelünk?

| # | Mire használjuk | Milyen adatot | Jogalap | Meddig |
|---|---|---|---|---|
| 2.1 | **Kapcsolatfelvétel, az ingyenes felmérés egyeztetése** (e-mailben vagy telefonon) | név, e-mail-cím, telefonszám, cégnév, a megadott időpontok, az üzenet tartalma | Szerződéskötést megelőző lépés a kérésedre (GDPR 6. cikk (1) b)) | Ha nem lesz belőle együttműködés: az utolsó kapcsolattól számított 12 hónap; ha lesz, a 2.3 szerint |
| 2.2 | **Regisztráció, fiók, belépés** | név, e-mail-cím, a jelszó titkosított (hash) formája, a regisztráció ideje, az ÁSZF elfogadásának ideje és verziója, a cég, amelyhez a fiókodat soroljuk | Szerződés teljesítése (6. cikk (1) b)) | A fiók törléséig |
| 2.3 | **Ügyfélkapcsolat és cég-nyilvántartás** | cégnév, a kapcsolattartók és cégvezetők neve, e-mail-címe, telefonszáma, az együttműködés adatai | Szerződés teljesítése (6. cikk (1) b)); a szerződő céggel való kapcsolattartás jogos érdeke (6. cikk (1) f)) | Az együttműködés végéig; a lezárt cég adatai a lezárástól 90 napig, a számviteli adatok a 2.7 szerint |
| 2.4 | **Kollégák meghívása és hozzáférés-kezelés** | a meghívott e-mail-címe, a meghívó neve és cége, a modul, a meghívás, elfogadás és eltávolítás ideje | A cég és a TWINX jogos érdeke a hozzáférés biztonságos kezelésére (6. cikk (1) f)) | A hozzáférés megszűnése után 1 évig a hozzáférési naplóban |
| 2.5 | **A modulok használata** (pl. látványterv, hirdetés-ellenőrző, értékbecslés, egyedi modul) | amit a modulba írsz vagy feltöltesz (pl. képek, szövegek, ingatlanadatok), az elkészült anyagok, a használat ideje és költsége | Szerződés teljesítése (6. cikk (1) b)); egyedi modulnál a cég megbízása (adatfeldolgozás) | A fiók törléséig; az anyagaidat te magad is bármikor törölheted. Egyedi modulnál a cég szerződése szerint, a lezárást követő legfeljebb 90 napig, utána törlés vagy visszaadás |
| 2.6 | **Biztonság és visszaélések elleni védelem** | IP-cím, időpont, a művelet típusa, hibanaplók | Jogos érdek a szolgáltatás és az adatok védelmére (6. cikk (1) f)) | 1 év |
| 2.7 | **Számlázás** (csak ha szerződést kötünk és díjat fizetsz) | számlázási név és cím, adószám, a számla adatai | Jogi kötelezettség (6. cikk (1) c); a számvitelről szóló 2000. évi C. törvény) | 8 év |
| 2.8 | **Hírlevél** [HA VAN] | név, e-mail-cím, a feliratkozás ideje | Hozzájárulás (6. cikk (1) a)), bármikor visszavonható | A leiratkozásig; a leiratkozás tényét megőrizzük, hogy ne írjunk újra |
| 2.9 | **Weboldal-mérés, sütik** [HA VAN] | a látogatás adatai, eszköz- és böngészőinformáció, süti-azonosítók | A működéshez szükséges sütiknél jogos érdek; a mérőknél (Google Analytics) hozzájárulás a süti-sávon (6. cikk (1) a)) | A mérési adatok legfeljebb [ELLENŐRIZENDŐ: a GA4 megőrzési beállítása, pl. 14 hónap] |

**Mit ne adj meg:** a szabad szöveges mezőkben és a feltöltött anyagokban kérjük, ne adj meg különleges adatot (pl. egészségügyi adat), és más személy adatát csak akkor, ha jogod van hozzá.

**Automatizált döntés:** nem hozunk rólad kizárólag automatizált döntést, amely rád nézve jogi hatással járna. Az AI-t a modulokban eszközként használjuk az anyagok elkészítéséhez.

**Gyermekek:** a szolgáltatás 16 év alattiaknak nem szól; tudatosan nem kezeljük az adataikat.

## 3. Kinek adjuk át az adataidat?

Az adataidat nem adjuk el. Csak a szolgáltatás nyújtásához szükséges mértékben dolgoznak velük az alábbi szolgáltatók (adatfeldolgozók), a velük kötött adatfeldolgozási feltételek szerint:

| Szolgáltató | Mire használjuk | Mely adatokat érinti | Hol |
|---|---|---|---|
| Supabase Inc. | adatbázis, belépés, fájltárolás | fiók, cég, modulhasználat, feltöltött anyagok | EU-régió [ELLENŐRIZENDŐ] |
| Vercel Inc. | a weboldal üzemeltetése | a kérések technikai adatai (pl. IP-cím) | USA / globális [ELLENŐRIZENDŐ] |
| Google (Workspace) | e-mailes kapcsolattartás (office@twinx.hu) | név, e-mail-cím, az üzenet tartalma | EU / USA [ELLENŐRIZENDŐ] |
| Google (Gemini API) | képek és szövegek AI-feldolgozása a modulokban | a modulba feltöltött anyagok | USA [ELLENŐRIZENDŐ] |
| [ELLENŐRIZENDŐ: további AI-szolgáltatók a kódból, pl. Perplexity, fal.ai] | kutató, képi és videós funkciók | a modulba megadott adatok | [ELLENŐRIZENDŐ] |
| Resend [HA VAN] | rendszerlevelek (pl. meghívó) küldése | név, e-mail-cím, a levél tartalma | [ELLENŐRIZENDŐ] |
| Brevo [HA VAN] | hírlevél küldése (csak feliratkozóknak) | név, e-mail-cím | EU [ELLENŐRIZENDŐ] |
| Google Analytics [HA VAN] | weboldal-mérés (csak hozzájárulással) | mérési adatok, süti-azonosítók | USA [ELLENŐRIZENDŐ] |
| [KITÖLTENDŐ: számlázó szolgáltató, pl. Számlázz.hu] [HA VAN] | számlák kiállítása | számlázási adatok | Magyarország |
| könyvelő [HA VAN] | számviteli kötelezettség teljesítése | számlázási adatok | Magyarország |

**Egyéb címzettek:** egy cég cégvezetői látják a saját cégük kollégáinak nevét, e-mail-címét és a hozzáférés állapotát (a meghívás és az eltávolítás miatt). Jogszabályi kötelezettség esetén hatóságnak adhatunk át adatot.

## 4. Adattovábbítás az EU-n kívülre

Egyes szolgáltatóink (pl. Vercel, Google, AI-szolgáltatók) az Európai Gazdasági Térségen kívül, főként az USA-ban is kezelhetnek adatot. Ilyenkor a továbbítás az EU–USA adatvédelmi keretrendszer (Data Privacy Framework) szerinti megfelelőségi határozaton alapul, ha a szolgáltató ebben tanúsított, egyébként az Európai Bizottság általános szerződési feltételein (SCC). Kérésre tájékoztatunk az adott garanciáról.

## 5. Hogyan védjük az adataidat?

- Az adatok átvitele titkosított (HTTPS), a jelszavakat csak titkosított formában tároljuk.
- A hozzáférést szerveroldalon ellenőrizzük: mindenki csak a saját és a jogosultsága szerinti adatokat látja; a titkos kulcsok nem kerülnek a böngészőbe.
- A meghívó linkek egyszer használatosak és lejárnak.
- A hozzáférés-kezelési műveleteket naplózzuk.
- Ha adatvédelmi incidens történik, a jogszabály szerint kivizsgáljuk, szükség esetén 72 órán belül bejelentjük a hatóságnak, és ha nagy kockázattal jár rád nézve, téged is értesítünk.

## 6. Milyen jogaid vannak?

- **Tájékoztatás és hozzáférés:** megkérdezheted, milyen adataidat kezeljük, és másolatot kérhetsz róluk.
- **Helyesbítés:** kérheted a pontatlan adatok javítását.
- **Törlés:** kérheted az adataid törlését, ha nincs okunk tovább kezelni őket (pl. a számlákat a törvény miatt meg kell őriznünk).
- **Korlátozás:** kérheted, hogy átmenetileg ne használjuk az adataidat.
- **Adathordozhatóság:** a szerződés vagy hozzájárulás alapján kezelt adataidat géppel olvasható formában kikérheted.
- **Tiltakozás:** a jogos érdeken alapuló kezelés ellen tiltakozhatsz.
- **Hozzájárulás visszavonása:** bármikor, ez nem érinti a korábbi kezelés jogszerűségét. A hírlevélről minden levélben leiratkozhatsz [HA VAN].

**Hogyan:** írj az office@twinx.hu címre. Legfeljebb egy hónapon belül válaszolunk; ezt indokolt esetben, értesítéssel, további két hónappal meghosszabbíthatjuk. A kérés teljesítése előtt ellenőrizhetjük a személyazonosságodat. A kérés díjmentes.

**Panasz:** ha úgy érzed, megsértettük a jogaidat, kérjük, először jelezd nekünk. Fordulhatsz a **Nemzeti Adatvédelmi és Információszabadság Hatósághoz** (NAIH; 1055 Budapest, Falk Miksa utca 9–11.; postacím: 1363 Budapest, Pf. 9.; ugyfelszolgalat@naih.hu; +36 1 391 1400; naih.hu [ELLENŐRIZENDŐ: aktuális elérhetőségek]), vagy a lakóhelyed szerinti törvényszékhez.

## 7. Módosítás

A tájékoztatót a működés változásakor frissítjük. A hatályos változat mindig a twinx.hu/adatkezeles oldalon érhető el, a verziószámmal és a hatálybalépés dátumával. Lényeges változásról a regisztrált felhasználókat belépéskor vagy e-mailben értesítjük.

---

## 8. Hozzájárulási és elfogadási szövegek (a fejlesztésnek, nem része a közzétett szövegnek)

- **Regisztráció (kötelező pipa):** „Elfogadom az [Általános Szerződési Feltételeket], és megismertem az [Adatkezelési tájékoztatót].” A pipa ideje és a két dokumentum verziója a fiókhoz mentve.
- **Hírlevél (külön, alapból üres, nem kötelező) [HA VAN]:** „Szeretnék hírlevelet kapni a TWINX-től. Bármikor leiratkozhatok.”
- **A kapcsolatfelvételi blokk alatt (D73), apró betűvel:** „Ha írsz vagy hívsz, az adataidat az időpont egyeztetésére használjuk. Részletek: [Adatkezelési tájékoztató].”
