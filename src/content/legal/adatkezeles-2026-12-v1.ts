// Adatkezelési tájékoztató — 2026-12-v1 (D74; forrás: docs/terv/32-adatkezelesi-tajekoztato.md). A „Belső jegyzet" és a
// 8. szakasz (a fejlesztésnek szóló szövegek) NEM része a közzétett szövegnek. Kitöltve 2026-11-27: azonosítók (Márk),
// [HA VAN] sorok a kód alapján (hírlevél/Brevo, mérés: Google Analytics + Meta, Resend, Számlázz.hu — könyvelő-sor
// törölve), a 3. pont szolgáltatói a kódban ténylegesen hívott szolgáltatók (fájlonként: VISSZAJELZES.md), NAIH a
// hivatalos oldalról. Telefonszám Márk döntésére nem szerepel. Új változatnál ÚJ fájl készül, ez változatlan marad.
const ADATKEZELES_MD = `
Ez a tájékoztató elmondja, milyen személyes adatokat kezelünk, miért, meddig, kinek adjuk át őket, és milyen jogaid vannak. Igyekeztünk érthetően fogalmazni; ha kérdésed van, írj nekünk.

## 1. Ki kezeli az adataidat?

**Adatkezelő:** Kovács Márk egyéni vállalkozó (TWINX)

- Székhely: 1143 Budapest, Tábornok utca 27.
- Nyilvántartási szám: 58736647 · Adószám: 48635253-1-27
- E-mail: office@twinx.hu · Weboldal: twinx.hu

Adatvédelmi tisztviselő kijelölésére nem vagyunk kötelesek; adatvédelmi kérdésben az office@twinx.hu címen érsz el minket.

**Ha egy cég egyedi modulját használod:** a cég a saját és az ügyfelei adatait a TWINX rendszerében kezeli. Ilyenkor a cég az adatkezelő, mi pedig a megbízásából, az utasításai szerint dolgozzuk fel az adatokat (adatfeldolgozó). Ezekről az adatokról a cég ad tájékoztatást; a vele kötött szerződésünk rögzíti a feldolgozás szabályait.

## 2. Milyen adatokat, miért és meddig kezelünk?

| # | Mire használjuk | Milyen adatot | Jogalap | Meddig |
|---|---|---|---|---|
| 2.1 | **Kapcsolatfelvétel, visszahívás-kérés, az ingyenes felmérés egyeztetése** (a weboldal visszahívás-kérő űrlapján, e-mailben vagy az élő chaten) | név, e-mail-cím, telefonszám, cégnév, a megadott napok és napszakok, az üzenet vagy a chat tartalma | Szerződéskötést megelőző lépés a kérésedre (GDPR 6. cikk (1) b)) | Ha nem lesz belőle együttműködés: az utolsó kapcsolattól számított 12 hónap; ha lesz, a 2.3 szerint |
| 2.2 | **Regisztráció, fiók, belépés** | név, e-mail-cím, a jelszó titkosított (hash) formája, a regisztráció ideje, az ÁSZF elfogadásának és a tájékoztató megismerésének ideje és változata, a cég, amelyhez a fiókodat soroljuk | Szerződés teljesítése (6. cikk (1) b)) | A fiók törléséig |
| 2.3 | **Ügyfélkapcsolat és cég-nyilvántartás** | cégnév, a kapcsolattartók és cégvezetők neve, e-mail-címe, telefonszáma, az együttműködés adatai | Szerződés teljesítése (6. cikk (1) b)); a szerződő céggel való kapcsolattartás jogos érdeke (6. cikk (1) f)) | Az együttműködés végéig; a lezárt cég adatai a lezárástól 90 napig, a számviteli adatok a 2.7 szerint |
| 2.4 | **Kollégák meghívása és hozzáférés-kezelés** | a meghívott e-mail-címe, a meghívó neve és cége, a modul, a meghívás, elfogadás és eltávolítás ideje | A cég és a TWINX jogos érdeke a hozzáférés biztonságos kezelésére (6. cikk (1) f)) | A hozzáférés megszűnése után 1 évig a hozzáférési naplóban |
| 2.5 | **A modulok használata** (pl. látványterv, hirdetés-ellenőrző, értékbecslés, egyedi modul) | amit a modulba írsz vagy feltöltesz (pl. képek, szövegek, ingatlanadatok), az elkészült anyagok, a használat ideje és költsége | Szerződés teljesítése (6. cikk (1) b)); egyedi modulnál a cég megbízása (adatfeldolgozás) | A fiók törléséig; az anyagaidat te magad is bármikor törölheted. Egyedi modulnál a cég szerződése szerint, a lezárást követő legfeljebb 90 napig, utána törlés vagy visszaadás |
| 2.6 | **Biztonság és visszaélések elleni védelem** | IP-cím, időpont, a művelet típusa, hibanaplók | Jogos érdek a szolgáltatás és az adatok védelmére (6. cikk (1) f)) | 1 év |
| 2.7 | **Számlázás** (csak ha szerződést kötünk és díjat fizetsz) | számlázási név és cím, adószám, a számla adatai | Jogi kötelezettség (6. cikk (1) c); a számvitelről szóló 2000. évi C. törvény) | 8 év |
| 2.8 | **Hírlevél** | név, e-mail-cím, a feliratkozás ideje | Hozzájárulás (6. cikk (1) a)), bármikor visszavonható | A leiratkozásig; a leiratkozás tényét megőrizzük, hogy ne írjunk újra |
| 2.9 | **Weboldal-mérés, sütik** | a látogatás adatai, eszköz- és böngészőinformáció, süti-azonosítók | A működéshez szükséges sütiknél (belépés, süti-beállítás) és az élő chatnél jogos érdek; a mérőknél (Google Analytics) és a hirdetésmérésnél (Meta) hozzájárulás a süti-sávon (6. cikk (1) a)) | A Google Analytics mérési adatai legfeljebb 14 hónapig; a süti-beállításodat a böngésződ őrzi, amíg nem törlöd |

**Mit ne adj meg:** a szabad szöveges mezőkben és a feltöltött anyagokban kérjük, ne adj meg különleges adatot (pl. egészségügyi adat), és más személy adatát csak akkor, ha jogod van hozzá.

**Automatizált döntés:** nem hozunk rólad kizárólag automatizált döntést, amely rád nézve jogi hatással járna. Az AI-t a modulokban eszközként használjuk az anyagok elkészítéséhez.

**Gyermekek:** a szolgáltatás 16 év alattiaknak nem szól; tudatosan nem kezeljük az adataikat.

## 3. Kinek adjuk át az adataidat?

Az adataidat nem adjuk el. Csak a szolgáltatás nyújtásához szükséges mértékben dolgoznak velük az alábbi szolgáltatók (adatfeldolgozók), a velük kötött adatfeldolgozási feltételek szerint:

| Szolgáltató | Mire használjuk | Mely adatokat érinti | Hol |
|---|---|---|---|
| Supabase Pte. Ltd. | adatbázis, belépés, fájltárolás | fiók, cég, modulhasználat, feltöltött anyagok, kapcsolatfelvételi kérések | EU (Írország) |
| Vercel Inc. | a weboldal üzemeltetése | a kérések technikai adatai (pl. IP-cím) | USA / globális |
| Google Cloud EMEA Ltd. (Google Workspace) | e-mailes kapcsolattartás (office@twinx.hu) | név, e-mail-cím, az üzenet tartalma | EU / USA |
| Google Cloud EMEA Ltd. (Gemini API) | képek és szövegek AI-feldolgozása a modulokban (látványterv, képjavító, ingatlanfotók elemzése, alaprajzból 3D) | a modulba feltöltött képek és megadott adatok | USA / globális |
| Perplexity AI, Inc. | webes kutatás és szövegírás a modulokban (értékbecslés, hirdetés-ellenőrző, hirdetésszöveg, telek-ellenőrzés, szakember-kereső, szórólap-szöveg) | a modulba megadott adatok (pl. az ingatlan címe és jellemzői, a hirdetés szövege) | USA |
| fal.ai (Features & Labels, Inc.) | képjavítás és videókészítés a modulokban | a modulba feltöltött képek | USA |
| Shotstack Pty Ltd | a bemutató videók összeállítása | a videóhoz feltöltött képek és feliratok | EGT-n kívül (Ausztrália / USA) |
| Resend | rendszerlevelek (pl. meghívó, értesítés) küldése | név, e-mail-cím, a levél tartalma | USA |
| Brevo (Sendinblue SAS) | hírlevél küldése (csak feliratkozóknak) | név, e-mail-cím | EU (Franciaország) |
| Smartsupp.com, s.r.o. | élő chat a weboldalon | a chat tartalma, a megadott név és e-mail-cím, technikai adatok | EU (Csehország) |
| Google Ireland Ltd. (Google Analytics) | weboldal-mérés (csak hozzájárulással) | mérési adatok, süti-azonosítók | EU / USA |
| Meta Platforms Ireland Ltd. | hirdetésmérés (Meta Pixel és Conversions API, csak marketing-hozzájárulással) | mérési adatok, süti-azonosítók; regisztrációkor az e-mail-cím titkosított (hash) formája | EU / USA |
| Google (Google Ads) | a Google Ads-fiókod összekapcsolása, ha a hirdetésszöveg modulban ezt kéred | a fiók azonosítója, a hirdetés szövege | EU / USA |
| Telegram | a csapat belső értesítései (pl. a havi keret elérése) | cégnév, a használat adatai | EGT-n kívül |
| KBOSS.hu Kft. (Számlázz.hu) | számlák kiállítása | számlázási adatok | Magyarország |

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
- **Hozzájárulás visszavonása:** bármikor, ez nem érinti a korábbi kezelés jogszerűségét. A hírlevélről minden levélben leiratkozhatsz, a sütiket a lábléc „Süti-beállítások” linkjével módosíthatod.

**Hogyan:** írj az office@twinx.hu címre. Legfeljebb egy hónapon belül válaszolunk; ezt indokolt esetben, értesítéssel, további két hónappal meghosszabbíthatjuk. A kérés teljesítése előtt ellenőrizhetjük a személyazonosságodat. A kérés díjmentes.

**Panasz:** ha úgy érzed, megsértettük a jogaidat, kérjük, először jelezd nekünk. Fordulhatsz a **Nemzeti Adatvédelmi és Információszabadság Hatósághoz** (NAIH; 1055 Budapest, Falk Miksa utca 9–11.; postacím: 1363 Budapest, Pf. 9.; ugyfelszolgalat@naih.hu; +36 1 391 1400; naih.hu), vagy a lakóhelyed szerinti törvényszékhez.

## 7. Módosítás

A tájékoztatót a működés változásakor frissítjük. A hatályos változat mindig a twinx.hu/adatkezeles oldalon érhető el, a verziószámmal és a hatálybalépés dátumával. Lényeges változásról a regisztrált felhasználókat belépéskor vagy e-mailben értesítjük.
`;
export default ADATKEZELES_MD;
