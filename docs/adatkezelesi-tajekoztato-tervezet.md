# TWINX — Adatkezelési tájékoztató (TERVEZET)

> **⚠ TERVEZET — élesítés előtt adatvédelmi szakembernek / ügyvédnek át kell néznie.**
> A tartalom a TWINX kódjából (2026. október 12-i állapot) összegyűjtött **tényleges** adatkezelésekre épül.
> `[KITÖLTENDŐ]` = hiányzó adat. A **jogalapok és a megőrzési idők JAVASLATOK** — ezeket a szakértő véglegesíti
> (különösen a jogos érdeken alapuló kezeléseknél az érdekmérlegelést).
> A dokumentum végén: **„Megállapítások a kódban"** — amit a tájékoztató mellett a rendszerben is rendezni érdemes.

---

## 1. Az adatkezelő

> **Induló szakasz (2026. október):** a TWINX-et **Kovács Márk** üzemelteti, ő az adatkezelő és ő állítja ki a számlákat.
> Amikor a TWINX cég élesedik, a tájékoztató új változata a cég adataival készül, és a partnerek a következő belépéskor megismerik.

| | |
|---|---|
| Név | **Kovács Márk egyéni vállalkozó** |
| Cím | 8000 Székesfehérvár, Palotai út 75. 10/198. |
| Adószám | 48635253-1-27 |
| Egyéni vállalkozói nyilvántartási szám | 58736647 |
| Kapcsolat adatvédelmi ügyekben | **office@twinx.hu** |
| Weboldal | https://twinx.hu |
| Adatvédelmi tisztviselő | `[KITÖLTENDŐ — várhatóan „nem kötelező kijelölni"; szakértő erősítse meg]` |

A szolgáltatás: **TWINX** — mesterséges intelligenciára épülő online eszköztár ingatlanközvetítőknek
(értékbecslés, hirdetéskép, képjavító, videó, látványterv, hirdetésszövegek stb.), irodai fiók és közös munkatér funkcióval.

---

## 2. Milyen adatokat, milyen célból kezelünk?

### 2.1 Regisztráció és felhasználói fiók
| | |
|---|---|
| **Adatok** | név, e-mail-cím, jelszó (titkosítva, a jelszót mi sem látjuk), cégnév, telefonszám (nem kötelező), a regisztráció forrása (pl. a twinx.hu/ingatlan oldalról érkezett-e), szerepkör, regisztráció időpontja |
| **Google-bejelentkezésnél** | a Google által átadott név és e-mail-cím |
| **Cél** | fiók létrehozása és kezelése, belépés, a szolgáltatás nyújtása, induló kredit jóváírása |
| **Jogalap (javaslat)** | szerződés teljesítése — GDPR 6. cikk (1) b) |
| **Megőrzés (javaslat)** | a fiók megszüntetéséig `[+ X nap / év — KITÖLTENDŐ]` |

### 2.2 A modulok használata (a szolgáltatás nyújtása)
| | |
|---|---|
| **Adatok** | amit a modulokban megadsz: ingatlan címe (település, utca, házszám), helyrajzi szám, ingatlan-jellemzők, szabad szöveges megjegyzések, hirdetés szövege vagy linkje; **feltöltött fényképek**, logók, saját fotó; a létrehozott eredmények (PDF, kép, videó, szöveg); a futtatás ideje és felhasznált kreditje |
| **Cél** | a kért eredmény elkészítése, tárolása a „Korábbi munkák" között, letöltés, megosztás |
| **Jogalap (javaslat)** | szerződés teljesítése — 6. cikk (1) b) |
| **Megőrzés (javaslat)** | a fiók megszüntetéséig `[KITÖLTENDŐ]`. A „Törlés" gomb jelenleg **elrejtést** jelent (visszaállítható) — lásd 7. pont |
| **Megjegyzés** | A feltöltött fényképeken harmadik személyek (pl. ingatlantulajdonos, bent lévő személyek) is szerepelhetnek. Kérjük, csak olyan képet tölts fel, amelyhez jogosultságod van. `[Szakértő: a felhasználó felelősségének rögzítése az ÁSZF-ben]` |

### 2.3 Arculati profil
| | |
|---|---|
| **Adatok** | megjelenítendő név, titulus, telefonszám, e-mail-cím, cégnév, weboldal, szlogen, logó, saját fotó |
| **Cél** | a hirdetésképeken, videókon, értékbecslésen megjelenő névjegy |
| **Jogalap (javaslat)** | szerződés teljesítése — 6. cikk (1) b) |
| **Megőrzés** | amíg a profilt nem törlöd / a fiók megszüntetéséig |

### 2.4 Kreditvásárlás és számlázás
| | |
|---|---|
| **Adatok** | számlázási név vagy cégnév, adószám (cégnél), ország, irányítószám, város, cím, számlázási e-mail; a kért csomag, összeg, számlaszám, fizetés időpontja |
| **Cél** | a megrendelés teljesítése, számla kiállítása, kredit jóváírása |
| **Jogalap (javaslat)** | szerződés teljesítése — 6. cikk (1) b); a számviteli bizonylatok megőrzése: jogi kötelezettség — 6. cikk (1) c) (számviteli törvény) |
| **Megőrzés (javaslat)** | számviteli bizonylatok: `[8 év — a szakértő erősítse meg]` |
| **Megjegyzés** | Bankkártya-adatot a TWINX nem kezel. Online kártyás fizetés (ha bekapcsoljuk) a Stripe fizetési oldalán történik. |

### 2.5 Irodai fiók és közös munkatér
| | |
|---|---|
| **Adatok** | tagság (melyik irodához / munkatérhez tartozol, szerep, jogosultság), kiosztott és felhasznált kreditkeret, kreditátadások a társak között, a közös mappákba tett munkák, irodai üzenetek és feladatok (szöveg, címzett, határidő, olvasottság), igénylésnél: iroda neve, létszám, telefonszám, megjegyzés |
| **Ki mit lát** | A munkák a készítőjüknél maradnak; mások csak a **közös mappába tett** munkákat látják. Az iroda létrehozója / vezetője a **kredithasználatot** látja (ki, melyik modulban, mennyit) — a munkák tartalmát nem. Közös munkatérben a társak egymás egyenlegét és költését nem látják. |
| **Cél** | közös munka, kreditkeret kezelése |
| **Jogalap (javaslat)** | szerződés teljesítése — 6. cikk (1) b) `[Szakértő: a vezetői kredit-rálátáshoz esetleg jogos érdek, munkáltatói kontextusban tájékoztatás]` |
| **Megőrzés (javaslat)** | a tagság / a fiók megszűnéséig; kilépéskor a közös mappába tett munkák 30 napig még láthatók a társaknak, a kilépő átadhatja a munkáit (a címzett saját példányt kap) |

### 2.6 Kapcsolatfelvétel, ajánlatkérés, tájékoztatás-kérés, ajándékkredit-jelentkezés
| | |
|---|---|
| **Adatok** | név, e-mail-cím, telefonszám, cég / iroda, javasolt visszahívási időpont, üzenet / megjegyzés |
| **Cél** | a megkeresés megválaszolása, visszahívás, ajánlat, ajándékkód kiküldése |
| **Jogalap (javaslat)** | az érintett kérésére a szerződés megkötését megelőző lépések — 6. cikk (1) b); `[vagy hozzájárulás — 6. cikk (1) a), szakértő döntse el]` |
| **Megőrzés (javaslat)** | `[KITÖLTENDŐ — pl. a megkeresés lezárásától számított 1 év]` |

### 2.7 Ötletláda
| | |
|---|---|
| **Adatok** | az ötlet szövege, név (nem kötelező — **nyilvánosan megjelenhet**), e-mail-cím (csak az adminisztrátorok látják) |
| **Cél** | fejlesztési javaslatok gyűjtése, nyilvános ötletlista |
| **Jogalap (javaslat)** | hozzájárulás — 6. cikk (1) a) |

### 2.8 Termékfejlesztési mérés a TWINX-en belül (saját rendszerünkben)
| | |
|---|---|
| **Adatok** | bejelentkezett felhasználónál: melyik modult nyitottad meg (naponta egyszer rögzítve), a modulon belüli lépések (űrlap elkezdése, futtatás indítása, sikeres / hibás befejezés, futási idő, letöltés, megosztás), az eszköz típusa (mobil / tablet / asztali — a böngésző azonosítójából, de magát az azonosítót nem tároljuk) |
| **Cél** | annak megértése, mely modulok működnek jól és hol akadnak el a felhasználók — a szolgáltatás javítása. Az elemzés **összesítve** történik. |
| **Jogalap (javaslat)** | jogos érdek — 6. cikk (1) f) `[Szakértő: érdekmérlegelési teszt szükséges]` |
| **Megőrzés (javaslat)** | `[KITÖLTENDŐ — pl. 24 hónap]` |
| **Megjegyzés** | Külső elemző eszközt erre nem használunk; IP-címet a TWINX nem rögzít. |

### 2.9 Önkéntes visszajelzés a modulokról  ← *(ME3e)*
| | |
|---|---|
| **Adatok** | csillagos értékelés (1–5), a választott ok(ok), rövid megjegyzés; „Mi hiányzik?" kérdésre adott válasz és megjegyzés, az eszköz típusa |
| **Szöveg a tájékoztatóba** | *„A TWINX-en belül önkéntesen adhatsz visszajelzést a modulokról (csillagos értékelés, rövid megjegyzés, hogy mi hiányzik). Ezeket a szolgáltatás fejlesztésére, összesítve használjuk fel; a válaszaidat bármikor kérheted törölni."* |
| **Mikor kérdezünk** | csillag: egy modul 3. használata után egyszer (ha bezárod, a 6.-nál még egyszer, utoljára); „Mi hiányzik?": ha egy modult többször megnyitottál, de nem használtad — modulonként egyszer |
| **Jogalap (javaslat)** | hozzájárulás — 6. cikk (1) a) (önkéntes válasz) `[vagy jogos érdek — szakértő]` |
| **Megőrzés (javaslat)** | `[KITÖLTENDŐ — pl. 24 hónap]` |

### 2.10 Google Ads összekapcsolás (ha használod)
| | |
|---|---|
| **Adatok** | a Google-fiókod e-mail-címe, a Google Ads ügyfélazonosító, a hozzáférési engedély (frissítő token) |
| **Cél** | a hirdetésszövegek feltöltése a saját Google Ads fiókodba |
| **Jogalap (javaslat)** | szerződés teljesítése / hozzájárulás (a Google engedélykérő ablakában) |
| **Megőrzés** | amíg a kapcsolatot meg nem szünteted |

### 2.11 Rendszerüzenetek e-mailben
| | |
|---|---|
| **Adatok** | e-mail-cím, név, az üzenet tartalma |
| **Mikor** | regisztráció megerősítése, e-mail-cím módosítása, ajándékkód, irodai értesítések (pl. kreditkérés) |
| **Jogalap (javaslat)** | szerződés teljesítése — 6. cikk (1) b) |

### 2.12 Hírlevél / marketing e-mail `[ha van]`
| | |
|---|---|
| **Adatok** | név, e-mail-cím |
| **Jogalap** | **kizárólag kifejezett hozzájárulás** — 6. cikk (1) a); bármikor leiratkozható |
| **Megjegyzés** | Kampányok a Smartlead / Brevo rendszerből (a TWINX alkalmazáson kívül). Az üdvözlő levelek sorozata előkészítés alatt. `[Szakértő: hozzájárulás-gyűjtés módja]` |

### 2.13 Sütik és weboldal-statisztika
Lásd a **4. pontot**.

---

## 3. Kik férnek hozzá az adatokhoz — adatfeldolgozók és címzettek

| Szolgáltató | Mire használjuk | Milyen adat jut el hozzá | Székhely / adattovábbítás |
|---|---|---|---|
| **Supabase** | adatbázis, bejelentkezés, fájltárolás | gyakorlatilag minden fenti adat | `[KITÖLTENDŐ — a projekt régiója (EU?) a Supabase felületén ellenőrizendő]` |
| **Vercel** | weboldal és szerveroldali feldolgozás (pl. PDF, videó készítése) | a feldolgozás alatt átmenő adatok, technikai naplók | USA `[DPF / SCC ellenőrizendő]` |
| **Resend** | e-mailek küldése | név, e-mail, az üzenet tartalma (értesítéseknél telefon, számlázási adat is) | USA `[DPF / SCC ellenőrizendő]` |
| **Google (Gemini API)** | képjavítás, látványterv, ingatlanfotók állapot-elemzése | feltöltött ingatlanfotók, utasítások | USA / EU `[ellenőrizendő]` |
| **Perplexity AI** | értékbecslés, telekelemzés, hirdetésszövegek és -ellenőrzés, kereső funkciók | a modulokba írt adatok (pl. ingatlan címe, jellemzői, hirdetés szövege) | USA `[ellenőrizendő]` |
| **fal.ai** | videóhoz mozgó képek, logó háttér-eltávolítása | ingatlanfotók, logó | USA `[ellenőrizendő]` |
| **Shotstack** | tartalék videó-előállítás (csak ha bekapcsoljuk) | fotók, a videó névjegye (név, telefon, e-mail) | Ausztrália `[ellenőrizendő]` |
| **Google (Analytics 4)** | weboldal-statisztika — **csak hozzájárulás után, csak a nyilvános oldalakon** | böngészési adatok, süti-azonosító | USA `[DPF]` |
| **Meta Platforms (Facebook Pixel, Conversions API)** | hirdetéseink eredményének mérése (pl. hány regisztráció jött egy kampányból) — **csak marketing-süti hozzájárulás után, csak a nyilvános oldalakon** | böngészési adatok, süti-azonosító (`_fbp`, `_fbc`), IP-cím, böngésző típusa; sikeres regisztrációnál az e-mail cím és a felhasználói azonosító **visszafejthetetlen (SHA-256) kódolással** | Írország / USA `[DPF — ellenőrizendő; közös adatkezelés a Metával: szakértő]` |
| **Google (Ads API, bejelentkezés)** | Google-bejelentkezés, Google Ads összekapcsolás | e-mail, Google-azonosítók, hirdetésszövegek | USA `[DPF]` |
| **Google Fonts / Fontshare** | betűtípusok megjelenítése az arculat-szerkesztőben | IP-cím (a böngésző letölti a betűtípust) | USA / India `[ellenőrizendő — érdemes saját tárhelyről kiszolgálni]` |
| **Stripe** | online kártyás fizetés (jelenleg **kikapcsolva**) | e-mail, felhasználói azonosító, a vásárlás adatai | USA / EU `[ellenőrizendő]` |
| **Smartlead, Brevo** | hírlevél-kampányok (alkalmazáson kívül) | név, e-mail | `[ellenőrizendő]` |
| **Könyvelő** | számlák könyvelése | számlázási adatok | `[KITÖLTENDŐ — könyvelő neve, címe]` |
| **Rackforest** | domain / DNS | — (személyes adat nem) | Magyarország |

`[Szakértő: minden adatfeldolgozóval adatfeldolgozási szerződés (DPA) szükséges; az EGT-n kívüli továbbításnál a megfelelő garancia (EU–USA adatvédelmi keret, általános szerződési feltételek) megnevezése.]`

---

## 4. Sütik és helyi tárolás

| Név | Típus | Cél | Időtartam | Hozzájárulás kell? |
|---|---|---|---|---|
| Supabase bejelentkezési sütik (`sb-…`) | feltétlenül szükséges | bejelentkezve tartás | a munkamenetig / `[ellenőrizendő]` | nem |
| `twx_office_view` | feltétlenül szükséges | irodai nézet (vezető / kolléga) | 8 óra | nem |
| `twx_view_as` | feltétlenül szükséges (csak adminnál) | előnézet | `[ellenőrizendő]` | nem |
| Google Analytics (`_ga`, `_ga_…`) | statisztikai | látogatottság mérése a nyilvános oldalakon | `[2 év — ellenőrizendő]` | **igen** — a süti-sávban külön „Statisztika" kapcsolóval (új látogatónál alapból bekapcsolva); a Google hirdetési célú tárolása soha |
| Meta Pixel (`_fbp`, `_fbc`) | marketing | hirdetéseink eredményének mérése a nyilvános oldalakon | `[3 hónap — ellenőrizendő]` | **igen** — a süti-sávban külön „Marketing" kapcsolóval (új látogatónál alapból bekapcsolva — lásd a szakértői megjegyzést) |
| `twx-consent-analytics`, `twx-consent-marketing` (helyi tárolás) | szükséges | a süti-döntéseid megjegyzése (statisztika, marketing) | amíg nem törlöd | nem |
| `twx-mv:…` (helyi tárolás) | szükséges / funkcionális | hogy a modul-megnyitást naponta csak egyszer jelezzük | 1 nap (a régieket töröljük) | `[szakértő]` |
| `twx:mem:…` (helyi tárolás) | funkcionális | a korábban beírt szövegek felajánlása az űrlapokon — csak a te böngésződben | 12 óra | `[szakértő]` |

A süti-beállításokat bármikor megváltoztathatod a lábléc **„Süti-beállítások"** linkjén.

`[Szakértő: a süti-sávban a Statisztika és a Marketing kapcsoló új látogatónál ALAPBÓL BEKAPCSOLT (üzemeltetői döntés, 2026-10-17); a mérés csak az „Elfogadom" kattintás után indul. Az EUB Planet49-ítélete (C-673/17) szerint az előre bejelölt hozzájárulás nem érvényes — ezt kérjük értékelni, és szükség esetén a sávot alapból kikapcsolt állapotra állítjuk.]`

---

## 5. Adatbiztonság
- Az adatbázisban sor-szintű hozzáférés-szabályozás (RLS) működik: mindenki csak a saját adatait éri el; az irodai / megosztott adatokhoz a szerver külön ellenőrzi a jogosultságot.
- Az adatkapcsolat titkosított (HTTPS). A jelszavakat nem tároljuk olvasható formában.
- Adminisztrátori hozzáférés csak kijelölt munkatársaknak. `[KITÖLTENDŐ — ki fér hozzá]`
- `[Szakértő / fejlesztő: lásd a „Megállapítások" pontot a nyilvános fájl-linkekről és a token-tárolásról.]`

---

## 6. Megőrzési idők — összefoglaló (JAVASLAT, véglegesítendő)

| Adatkör | Javasolt megőrzés |
|---|---|
| Fiók és a modulokban készült munkák | a fiók megszüntetéséig + `[X]` |
| Számlázási adatok, bizonylatok | `[8 év]` (számviteli törvény) |
| Megkeresések, ajánlatkérések | `[1 év]` a lezárástól |
| Termékfejlesztési mérés (megnyitás, események) | `[24 hónap]` |
| Visszajelzések (értékelés, „Mi hiányzik?") | `[24 hónap]` |
| Irodai üzenetek | a tagság / az iroda megszűnéséig |
| Technikai naplók (szolgáltatóknál) | a szolgáltató szerint `[ellenőrizendő]` |

---

## 7. A jogaid

- **Hozzáférés** — tájékoztatást kérhetsz arról, milyen adataidat kezeljük.
- **Helyesbítés** — a profilodban és a beállításokban magad is javíthatod; egyébként kérésre javítjuk.
- **Törlés** — kérheted adataid törlését. *Jelenleg a felületen a „Törlés" elrejtést jelent; a végleges törlést az **office@twinx.hu** címen kérheted.*
- **Korlátozás**, **tiltakozás** (különösen a jogos érdeken alapuló méréssel szemben), **adathordozhatóság**.
- **Hozzájárulás visszavonása** — bármikor, a visszavonás előtti kezelést nem érinti (pl. süti-beállítások, hírlevél-leiratkozás).
- Kérésedre `[30 napon / 1 hónapon]` belül válaszolunk.

Kapcsolat: **office@twinx.hu**

---

## 8. Jogorvoslat

Ha úgy érzed, megsértettük az adatvédelmi jogaidat, panaszt tehetsz a felügyeleti hatóságnál, vagy bírósághoz fordulhatsz.

**Nemzeti Adatvédelmi és Információszabadság Hatóság (NAIH)**
`[Szakértő: az elérhetőségeket a naih.hu-n ellenőrizni]`
- Cím: 1055 Budapest, Falk Miksa utca 9–11.
- E-mail: ugyfelszolgalat@naih.hu
- Telefon: +36 1 391 1400
- Web: https://naih.hu

---

## 9. A tájékoztató módosítása
A tájékoztatót a szolgáltatás változásával frissítjük; a lényeges változásokról e-mailben / a felületen értesítünk.
Hatályos: `[KITÖLTENDŐ — dátum]`

---
---

## Megállapítások a kódban (belső — NEM a tájékoztató része)

Ezeket a felmérés során találtam; a tájékoztató mellett a rendszerben is érdemes rendezni (prioritás szerint):

1. **Nincs elérhető tájékoztató és ÁSZF a felületen.** A regisztrációs ablakban nincs „A regisztrációval elfogadod az ÁSZF-et és az adatkezelési tájékoztatót" szöveg / link. → Az elfogadott tájékoztatóhoz `/adatkezeles` oldal + link a láblécekbe, a regisztrációhoz és a süti-sávba.
2. **Nincs fióktörlés funkció.** A végleges törlés ma kézzel, a Supabase felületén történik; a tárhelyen lévő fájlok ilyenkor is megmaradnak. → Folyamat kell a törlési kérésekre (legalább egy belső útmutató; később „Fiók törlése" kérés gomb), és döntés a fájlok törléséről.
3. **Nincs megőrzési idő / automatikus törlés** sehol (a „Törlés" = elrejtés szabály szándékos, de a tájékoztatóban vállalt határidőkhöz igazítani kell).
4. **Nyilvános fájl-linkek.** A feltöltött fotók és a kész anyagok a tárhelyen nyilvános URL-lel érhetők el (aki ismeri a linket, megnyithatja). → Ellenőrizni a tárhely beállítását; érzékenyebb anyagnál aláírt, lejáró linkek.
5. **Google Ads frissítő token** sima szövegként van az adatbázisban. → Titkosított tárolás javasolt.
6. **Törölt fiók után is megmaradó e-mail-címek** egyes naplókban (kreditadás-napló, megkeresések kezelője, ajándékkód-napló). → A tájékoztatóban jelezni, vagy megőrzési idő után anonimizálni.
7. **Külső betűtípus-szolgáltatók** (Google Fonts, Fontshare) a böngészőből — az arculat-szerkesztőben. → Saját tárhelyről kiszolgálva nem kerül IP-cím harmadik félhez.
8. **Supabase régió** — ellenőrizni, hogy EU-ban fut-e (a tájékoztatóba így kerül).
9. **Szakember-kereső kedvencek**: harmadik személyek (szakemberek) nyilvánosan elérhető adatai (név, telefon, e-mail) kerülnek mentésre. → A tájékoztatóban / ÁSZF-ben kezelni.
10. **Adatfeldolgozói szerződések (DPA)** megkötése / letöltése: Supabase, Vercel, Resend, Google, Perplexity, fal.ai, (Shotstack, Stripe).
