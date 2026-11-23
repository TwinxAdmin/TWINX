# TWINX Adatkezelési tájékoztató — VÁZLAT jogi átnézésre (D50)

> **Státusz:** vázlat, 2026-11-23. **Ez nem jogi tanács és nem végleges szöveg.** A TWINX valós működéséből (tervek `11`–`16`, az éles séma) készült alap, amelyet **jogásznak vagy az adatvédelmi ügyekben jártas szakembernek kell átnéznie és jóváhagynia**, mielőtt kikerül az oldalra.
> **Kapu:** a foglalási űrlap és a meghívás éles indítása előtt készen kell lennie (D33, D46). A jelenleg éles regisztráció, számlázás és modulhasználat adatkezelését is lefedi; érdemes ezt is mielőbb rendezni.
> **Jelölés:** `[ ]` = kitöltendő adat; `[JOGÁSZ]` = a jogász döntése vagy ellenőrzése kell; `[ELLENŐRIZENDŐ]` = tényt kell ellenőrizni a szolgáltatónál.
> **Nyelv:** magyar, tegező, közérthető. A felhasználói szöveg a 3–9. szakasz; az 1–2. és 10. szakasz belső útmutató.

---

## 1. A vázlat használata (belső)

- **Hol jelenik meg a szöveg:** a lábléc „Adatkezelési tájékoztató" linkje (addig „Hamarosan"), a foglalási űrlap hozzájárulási pipájánál, a meghívó e-mailek láblécében, a regisztrációs űrlapnál.
- **Verziózás:** a tájékoztató verziója (pl. `2026-12-v1`) kerül a foglalás `consent_version` mezőjébe (`15`, 3.3). Szöveg-módosításnál új verzió.
- **Mi nem szerepel a nyilvános szövegben:** belső működés (modul-regiszter, állapotok), titkos kulcsok, konkrét biztonsági beállítások. Csak olyan állítás kerülhet be, amely a megvalósítással egyezik.

## 2. Mit kell a TWINX-nek belül is rendeznie (nem a nyilvános szöveg része)

- **Adatkezelési nyilvántartás** (GDPR 30. cikk): ebből a vázlatból készíthető. `[JOGÁSZ]`
- **Adatfeldolgozói megállapodás a cégekkel:** az egyedi modulban a cég saját és ügyfelei adatait mi dolgozzuk fel, **általában mint adatfeldolgozó**. Ehhez az NDA mellé adatfeldolgozói szerződés (DPA) kell. `[JOGÁSZ]`
- **Szerződések a szolgáltatókkal** (adatfeldolgozói feltételek, harmadik országba továbbítás): lásd 6–7. szakasz.
- **Incidenskezelési szabály** (adatvédelmi incidens bejelentése a hatóságnak 72 órán belül, ha szükséges). `[JOGÁSZ]`

---

# A nyilvános szöveg

## 3. Ki kezeli az adataidat?

**Adatkezelő:** [cég neve] · székhely: [cím] · cégjegyzékszám: [ ] · adószám: [ ] · e-mail: office@twinx.hu · weboldal: twinx.hu
*(A cégalapításra vár. Az adatok hiányában a szöveg nem tehető közzé.)*
Adatvédelmi tisztviselő: `[JOGÁSZ: kell-e kijelölni; ha nem, ez a sor kimarad]`

Amikor egy cég egyedi modulját használod, a cég a saját és az ügyfelei adatait **a TWINX rendszerében** kezeli. Ilyenkor a cég az adatkezelő, mi pedig az ő megbízásából dolgozzuk fel az adatokat (adatfeldolgozó). `[JOGÁSZ: ellenőrizendő a modulonkénti szerepmegosztás.]`

## 4. Milyen adatokat, miért és meddig kezelünk?

> Az alábbi táblázat sorai külön adatkezelések. A **megőrzési idők javaslatok**, a végleges értéket a jogász és Márk/Tibor hagyja jóvá.

| # | Mire használjuk | Milyen adatot kezelünk | Jogalap | Meddig |
|---|---|---|---|---|
| 4.1 | **Időpontfoglalás és visszahívás** (ingyenes felmérés egyeztetése) | név, cég, e-mail, telefonszám, a szabadon megadott leírás, a kiválasztott időpont, a hozzájárulás időpontja | Hozzájárulás (GDPR 6. cikk (1) a) `[JOGÁSZ: vagy 6. cikk (1) b), szerződéskötést megelőző lépés]` | Ha nem lesz belőle együttműködés: `[javaslat: 12 hónap]`; ha lesz, a cég ügyfélkapcsolati adataival együtt (4.4) |
| 4.2 | **Kapcsolattartás e-mailen** (office@twinx.hu) | név, e-mail, az üzenet tartalma | Jogos érdek (6. cikk (1) f)) `[JOGÁSZ]` | A kapcsolattartás lezárásától `[javaslat: 12 hónap]` |
| 4.3 | **Regisztráció, fiók, belépés** | név, e-mail, a jelszó hash-e / belépési adatok, a regisztráció ideje, a cég, amelyhez a fiókodat soroljuk | Szerződés teljesítése (6. cikk (1) b)) | A fiók törléséig `[JOGÁSZ: törlés utáni megőrzés]` |
| 4.4 | **Ügyfélkapcsolat és cég-nyilvántartás** (a megrendelő cég adatai, cégvezetők, kapcsolattartók) | cégnév, kapcsolattartó neve, e-mail, telefon, a megbeszélés tárgya, a cégvezetői státusz | Szerződés teljesítése / szerződéskötést megelőző lépés (6. cikk (1) b)); jogos érdek (f) `[JOGÁSZ]` | Az együttműködés végéig, utána `[javaslat: 5 év]` `[JOGÁSZ: elévülés]` |
| 4.5 | **Kollégák meghívása és hozzáférés-kezelés** | a meghívott e-mail címe, a meghívó neve és cége, a modul, a meghívás/elfogadás/eltávolítás ideje | A cég és a TWINX jogos érdeke a hozzáférés biztonságos kezelésére (6. cikk (1) f)) `[JOGÁSZ]` | A hozzáférés megszűnése után `[javaslat: 12 hónap]` a naplóban |
| 4.6 | **Az egyedi modul használata** | amit a modulba írsz, töltesz fel vagy a modul előállít (a modultól függ) | A cég megbízása; a TWINX adatfeldolgozó (lásd 3.) | A megbízás szerint; a szerződés megszűnésekor törlés vagy visszaadás `[JOGÁSZ: DPA]` |
| 4.7 | **A meglévő ingatlanos modulok használata** (pl. képjavító, látványterv, hirdetés-ellenőrző, értékbecslés) | feltöltött képek és szövegek, a megadott ingatlanadatok, az elkészült anyagok, a használati előzmények | Szerződés teljesítése (6. cikk (1) b)) | `[javaslat: a fiók törléséig, a felhasználó törölheti az anyagait]` |
| 4.8 | **Számlázás és fizetés** | számlázási név és cím, adószám (cég esetén), e-mail, a számla adatai, a fizetés azonosítója (a kártyaadatokat a Stripe kezeli, nálunk nincs) | Jogi kötelezettség (6. cikk (1) c)) a számlákra; szerződés teljesítése | A számviteli bizonylatokra a jogszabályi megőrzési idő `[ELLENŐRIZENDŐ/JOGÁSZ: jelenleg 8 év]` |
| 4.9 | **Hírlevél** | név, e-mail | Hozzájárulás (6. cikk (1) a)), bármikor visszavonható | A leiratkozásig; a leiratkozást nyilvántartjuk, hogy ne írjunk újra |
| 4.10 | **Weboldal-látogatás, mérés** (Google Analytics, sütik) | a látogatás adatai, eszköz- és böngészőinformáció, süti-azonosítók | Hozzájárulás a süti-sávon keresztül (6. cikk (1) a)) | A süti és a mérés beállítása szerint `[ELLENŐRIZENDŐ: GA4 megőrzési beállítás]` |
| 4.11 | **Biztonság és visszaélés elleni védelem** (naplózás, sebességkorlát, hozzáférési napló) | IP-cím, időpont, a művelet típusa, a hozzáférés-kezelési napló | Jogos érdek (6. cikk (1) f)) `[JOGÁSZ: érdekmérlegelési teszt]` | `[javaslat: IP és sebességkorlát: rövid ideig; hozzáférési napló: 2 év]` |
| 4.12 | **Lezárt cég archívuma, az ügyféladat törlése vagy visszaadása** (a megrendelés megszűnése után) | a cég és a kapcsolattartók adatai, a modul-hozzárendelés története, a hozzáférési napló; az ügyfél adata a modulban a szerződés szerint | Jogos érdek és jogi kötelezettség (a számviteli adatra); a modul adataira a cég megbízása `[JOGÁSZ]` | Az ügyféladat a lezárástól a szerződésben rögzített határidőig `[KITÖLTENDŐ: napok száma]`, utána törlés vagy visszaadás; a számviteli adat a jogszabályi ideig `[ELLENŐRIZENDŐ]`; a törölt adat a biztonsági mentésekben a mentés lejártáig még szerepelhet |

**Lemondás, lezárás, törlés (D54, belső működés):** a modul lemondása a kifizetett időszak végével lép hatályba; a cég lezárásakor a tagok hozzáférése megszűnik, a fiókjuk megmarad, a cég archívuma és a számviteli adat megmarad. Az ügyfél adatát a megőrzési határidőn belül **visszaadjuk vagy töröljük**; a törlés kétlépéses, jóváhagyott művelet. **Biztonsági mentések:** a Supabase mentéseiben a törölt adat a mentés lejártáig még létezhet; ezt a nyilvános szövegben pontosítani kell `[JOGÁSZ]`. A szövegben csak a ténylegesen megvalósított állítás szerepelhet. Részletek: `21`.

**Szabad szöveges mezők** (pl. a foglalás leírása): kérjük, ne adj meg bennük különleges adatot (egészség, vallás stb.) és harmadik személy személyes adatát. A mezőt nem használjuk automatizált döntésre.

**Nem hozunk kizárólag automatizált döntést,** amely rád nézve jogi hatással járna. Az AI-t a modulokban eszközként használjuk az anyagok elkészítéséhez. `[JOGÁSZ: az AI használatának tájékoztató szövege]`

## 5. Kinek adjuk át az adataidat? (adatfeldolgozók és címzettek)

Az adataidat csak a szükséges mértékben, a szolgáltatás nyújtásához adjuk át az alábbi szolgáltatóknak. Mindegyikkel `[JOGÁSZ: adatfeldolgozói feltételek / szerződés]` szükséges.

| Szolgáltató | Mire használjuk | Mely adatokat érinti | Székhely / adattovábbítás |
|---|---|---|---|
| Supabase | adatbázis, belépés, fájltárolás | a fiók, a foglalás, a cég, a modulhasználat adatai | EU-régió (Írország) `[ELLENŐRIZENDŐ: a szolgáltató szerződéses háttere]` |
| Vercel | a weboldal üzemeltetése | a kérések technikai adatai | `[ELLENŐRIZENDŐ]` |
| Resend | rendszerlevelek küldése (foglalás, meghívó, lemondás) | név, e-mail, a levél tartalma | `[ELLENŐRIZENDŐ]` |
| Brevo | hírlevél (csak hozzájárulóknak) | név, e-mail | `[ELLENŐRIZENDŐ]` |
| Stripe | online fizetés | a fizetés adatai | `[ELLENŐRIZENDŐ]` |
| [számlázó szolgáltató] | számlák kiállítása | számlázási adatok | `[KITÖLTENDŐ: melyik szolgáltató]` |
| Google (Workspace, Analytics, Gemini) | levelezés, mérés, képek és szövegek AI-feldolgozása a modulokban | e-mail, mérési adatok, a modulba feltöltött anyagok | `[ELLENŐRIZENDŐ]` |
| Perplexity, fal.ai és további AI-szolgáltatók | kutató és videós modulok | a modulba megadott adatok | `[ELLENŐRIZENDŐ: mely modulok, mely adatok]` |
| Telegram | belső értesítés a foglalásokról a TWINX munkatársainak | a foglaló neve, cége, telefonja, e-mailje, a leírás kurtított része | `[JOGÁSZ: harmadik országba továbbítás miatt vizsgálandó]` |
| Rackforest | domain és DNS | – (nem kezel személyes adatot a szolgáltatás tartalmából) | `[ELLENŐRIZENDŐ]` |

**Egyéb címzettek:** a cég cégvezetői látják a saját cégük kollégáinak e-mail címét, nevét és a hozzáférés állapotát (a meghívás és eltávolítás miatt). Jogszabályi kötelezettség esetén hatóságnak adhatunk át adatot.

## 6. Harmadik országba történő adattovábbítás

Egyes szolgáltatóknál az adatok az Európai Gazdasági Térségen kívülre is kerülhetnek. Ilyenkor a továbbítás jogalapja `[JOGÁSZ: megfelelőségi határozat / általános szerződési feltételek (SCC) / egyéb]`. Kérésre tájékoztatást adunk az adott garanciáról.

## 7. Hogyan védjük az adataidat?

- Az adatok átvitele titkosított (HTTPS), a belépés védett.
- A hozzáférést **szerveroldalon** ellenőrizzük: mindenki csak a saját adatait és a jogosultsága szerinti adatokat látja; a titkos kulcsok nem kerülnek a böngészőbe.
- A meghívó és lemondási linkek egyszer használatosak, lejárnak, és az adatbázisban csak titkosított (hash-elt) formában tárolódnak.
- A hozzáférés-kezelési műveleteket naplózzuk.
- `[JOGÁSZ/Márk: a szöveg csak olyan állítást tartalmazhat, amelyet a megvalósítás tényleg teljesít; ellenőrizni a fejlesztés végén.]`

## 8. Milyen jogaid vannak, és hogyan élhetsz velük?

Kérhetsz **tájékoztatást** és **hozzáférést** az adataidhoz, kérheted azok **helyesbítését**, **törlését**, a kezelés **korlátozását**, élhetsz az **adathordozhatósághoz** való joggal, és **tiltakozhatsz** a jogos érdeken alapuló kezelés ellen. Ha hozzájáruláson alapul az adatkezelés, azt **bármikor visszavonhatod**; a visszavonás nem érinti a korábbi kezelés jogszerűségét.

- **Hogyan:** írj az office@twinx.hu címre. A kérésedre legfeljebb **egy hónapon belül** válaszolunk `[JOGÁSZ: ellenőrizni]`. A személyazonosságodat ellenőrizhetjük.
- **Hírlevél:** minden levélben van leiratkozási link.
- **Foglalás:** a visszaigazoló levél „Lemondás" gombjával lemondhatod az időpontot.
- **Panasz:** ha úgy érzed, megsértettük a jogaidat, fordulhatsz a **Nemzeti Adatvédelmi és Információszabadság Hatósághoz (NAIH)** `[ELLENŐRIZENDŐ: elérhetőségek: cím, weboldal]`, vagy bírósághoz.

## 9. Módosítások

A tájékoztatót módosíthatjuk; a hatályos változat mindig itt érhető el, a verziószámával és a hatálybalépés dátumával. Verzió: `[2026-12-v1]` · hatályos: `[dátum]`.

---

## 10. A hozzájárulási szövegek (űrlapokhoz)

- **Foglalási űrlap (kötelező pipa):** *„Elolvastam az Adatkezelési tájékoztatót, és hozzájárulok, hogy a megadott adataimat a TWINX az ingyenes felmérés egyeztetése céljából kezelje."* `[JOGÁSZ: a jogalaptól függően finomítható; ha 6. cikk (1) b) jogalap lesz, a pipa „tudomásul vétel" jellegű]`
- **Hírlevél (külön, alapból üres pipa, sosem kötelező):** *„Szeretnék hírlevelet kapni a TWINX-től. Bármikor leiratkozhatok."*
- **Regisztráció:** *„Elfogadom az Általános Szerződési Feltételeket, és tudomásul veszem az Adatkezelési tájékoztatót."* `[ÁSZF: külön dokumentum, jelenleg a profil „terms" mezői szerint kezeljük; ellenőrizendő]`

## 11. Átnézési lista a jogásznak / Tibinek (döntésre váró pontok)

1. **A cég adatai** (név, székhely, cégjegyzékszám, adószám): a cégalapítás után kitölthető. Addig a szöveg nem tehető közzé.
2. **Jogalap a foglalásnál:** hozzájárulás vagy szerződéskötést megelőző lépés.
3. **Megőrzési idők** minden sorra (különösen a nem céggé alakított foglalások, a naplók, a törölt fiókok).
4. **Adatfeldolgozói szerződés a cégekkel** (DPA) és az NDA együtt: a modulban kezelt ügyféladatok.
5. **A szolgáltatók ellenőrzése:** székhely, adatkezelési feltételek, EGT-n kívüli továbbítás (különösen Telegram, AI-szolgáltatók, Google, Vercel).
6. **Az AI-használat tájékoztató szövege** és a feltöltött anyagok kezelése az AI-szolgáltatóknál.
7. **Süti-sáv és mérés:** a jelenlegi sáv megfelel-e, a GA4 beállításai.
8. **Régi felhasználók:** a már regisztrált felhasználók (D31) adatainak kezelése és tájékoztatása az új szöveg szerint.
9. **A számlázó szolgáltató** és a számviteli megőrzési idő.
10. **Adatvédelmi tisztviselő és adatkezelési nyilvántartás:** szükséges-e, ki vezeti.
11. **Érdekmérlegelési tesztek** a jogos érdekű sorokra (4.2, 4.4, 4.5, 4.11).
12. **Incidenskezelési szabály** és belső felelős.
13. **Lezárt cégek és törlés (D54):** a megőrzési határidő napjai az ügyféladatra; a számviteli megőrzés; a mentésekben megmaradó adat tájékoztatása; a törlés jóváhagyási rendje (két személy); az adatfeldolgozói szerződés (DPA) törlési és visszaadási pontja.
