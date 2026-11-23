# TWINX foglalás és időpont-kezelés — terv (D48)

> **Státusz:** terv, 2026-11-23. A `11` (kapcsolatblokk, D33, D37) és a `12` (Foglalások lap) részletes kidolgozása; ebből készül a 2. CODE-prompt (amikor Márk átadja).
> **Döntések (D48, Márk 2026-11-23):** (1) a szabad időpontokat **hibrid módon** adjuk meg: heti sablon + „Sablon alkalmazása" gomb, ami a következő 4 hétre konkrét időpont-sorokat hoz létre, soronként törölhetők és bővíthetők; (2) **minden időpontnak gazdája van** (Márk vagy Tibor), a látogató egy közös listából választ és látja a nevet; (3) **a visszaigazoló e-mailben „Lemondás" link van**, a lemondás felszabadítja az időpontot; (4) az alábbi alapértelmezéseket Márk elfogadta: 45 perces alap időtartam, legkorábban 24 órával előre és legfeljebb 30 napra előre foglalható, időzóna Europe/Budapest, egy e-mail címmel vagy telefonszámmal egyszerre egy aktív foglalás, honeypot + sebességkorlát, nincs e-mail-megerősítés, a „nincs szabad időpont" ág ugyanabba a táblába kerül, állapotok: Új → Egyeztetve → Megtartva → Céggé alakítva vagy Elvetve (+ Lemondva), a GDPR-hozzájárulás időpontja és szövegverziója tárolt, a `leads` tábla történeti marad.
> **Kiegészítés (2026-11-23):** az e-mail- és Telegram-szövegek **végleges, jóváhagyott változata a `16-email-szovegek.md`** (D49); a 2. és 6. szakasz csak a szerkezetet adja, ütközésnél a `16` az irányadó. Az első cégvezető kérdését Márk **megerősítette** (9. szakasz). A migrációra a D51 szabályai érvényesek (additív, down szkript, admin-only bekapcsolás; lásd `14`, 5. szakasz).
> **Projekt:** Supabase „Website Twinx". **Nyelv:** magyar; az állapotkódok ékezet nélküli, kisbetűs szövegek.

---

## 1. A látogató útja (a kapcsolatblokk, fix méretű doboz, nem ugrál)

**1. lépés — Időpont**
- Nap-választó (a következő 30 nap, csak azok a napok aktívak, ahol van szabad időpont) és alatta a szabad időpontok listája: **idő · hossz · gazda neve** („Márk" / „Tibor"). A lista a dobozon belül görgethető.
- Csak a legkorábban 24 óra múlva kezdődő időpontok látszanak.
- Ha nincs szabad időpont: *„Jelenleg nincs szabad időpont, hagyd meg az adataidat, és visszahívunk."* Az adatlépés ekkor is elküldhető (**visszahívási kérés**, időpont nélkül).

**2. lépés — Adatok**
- **Kötelező:** név, cég, e-mail, telefonszám, **GDPR-hozzájárulás pipa**. **Opcionális:** pár mondat arról, mit modernizálnának (legfeljebb ~1000 karakter).
- Belépett felhasználónál a név és az e-mail előre kitöltve (szerkeszthető).
- A kiválasztott időpont összefoglalója látszik (nap, idő, gazda), és egy **„Időpont módosítása"** link visszavisz az 1. lépésre.

**Visszaigazolás (a doboz ugyanakkora marad):** *„Köszönjük! [nap, idő] időpontban [gazda neve] hív telefonon. A részleteket e-mailben küldtük."* Visszahívási kérésnél: *„Köszönjük! Hamarosan visszahívunk."*

**Hibák, érthetően:**
- *Az időpont közben elkelt:* „Ezt az időpontot közben valaki lefoglalta. Válassz másikat." (a lista frissül, az adatok megmaradnak)
- *Már van aktív foglalás ezzel az e-mail címmel vagy telefonszámmal:* „Ezzel az e-mail címmel vagy telefonszámmal már van aktív foglalás. Módosítani a visszaigazoló levél lemondási linkjével tudod, vagy írj nekünk: office@twinx.hu." (Ez elárulja annak, aki ismeri a címet, hogy van foglalása; kis kockázat, a használhatóság miatt vállaljuk.)
- *Túl sok kérés (sebességkorlát):* „Most nem sikerült. Próbáld meg később, vagy írj nekünk: office@twinx.hu."

**A felmérés módja (alapértelmezés, megerősítendő):** a gazda **az időpontban telefonon hívja** a látogatót (ezért kötelező a telefonszám). Ha később videóhívás is lesz, az külön döntés.

## 2. A visszaigazoló e-mail és a lemondás

- **Küldő:** „A TWINX csapata" (Resend; a twinx.hu domain hitelesítése kell). **Tárgy:** *„Foglalásodat rögzítettük — [nap, idő]"*
- **Tartalom:** a végleges szöveg a `16` 2. pontjában van (időpont, gazda, telefonszám, **„Lemondás" gomb**, office@twinx.hu, adatkezelési tájékoztató linkje `[amint kész, vázlat: 17]`). Nincs benne ár, „kredit".
- **Lemondás oldal:** a link egy oldalra visz, amely **megmutatja a foglalást, és egy „Lemondom" gombot** ad. **A link megnyitása önmagában nem mond le semmit** (a levelező- és biztonsági programok előre megnyitják a linkeket); a lemondás csak a gombra kattintva (POST) történik.
- **A token** hosszú, véletlen, az adatbázisban **hash-elve** tárolt, egyszer használatos, az időpont kezdetéig érvényes; hibás vagy lejárt token esetén általános üzenet.
- A lemondás után az időpont újra **szabad** (ha még a jövőben van és nem törölt), a foglalás állapota **Lemondva**, a gazdák értesítést kapnak.

## 3. Adatmodell (új táblák; a `leads` és minden meglévő tábla érintetlen)

> Mind a `public` sémában, **mindegyiken RLS be van kapcsolva, kliens-oldali írás nincs**; minden módosítás szerveroldali függvényen (csak a `service_role` hívhatja) vagy API-végponton megy át, a 14-es terv mintája szerint.

### 3.1 `availability_templates` — heti sablon (gazdánként)
`id`, `host_id` (admin felhasználó), `weekday` (1–7), `start_time`, `end_time` (helyi idő, Europe/Budapest), `slot_minutes` (alapból 45), `active`, `created_at`.

### 3.2 `availability_slots` — konkrét időpontok
| Oszlop | Megjegyzés |
|---|---|
| `id` | uuid, PK |
| `host_id` | az admin, aki az időpont gazdája |
| `starts_at` | timestamptz |
| `duration_min` | alapból 45, időpontonként állítható |
| `status` | `szabad` · `foglalt` · `torolve` |
| `template_id` | null, ha kézzel vették fel |
| `created_by`, `created_at` | |

- **Egyedi:** (`host_id`, `starts_at`). **Átfedés tiltása:** ugyanannak a gazdának két, nem törölt időpontja nem fedheti egymást (kizáró megszorítás időtartományra).
- **Sablon alkalmazása:** a függvény a helyi (budapesti) időben számol, így a nyári/téli időszámítás váltásakor is 9:00 marad 9:00 (nem csúszik egy órát); **ismételhető** (a már létező időpontot nem duplázza, az átfedőt kihagyja); a következő 4 hétre dolgozik; a már lefoglalt időpontokhoz nem nyúl.

### 3.3 `bookings` — foglalások és visszahívási kérések
| Oszlop | Megjegyzés |
|---|---|
| `id` | uuid, PK |
| `kind` | `idopont` · `visszahivas` |
| `slot_id` | null (visszahívásnál); az időponthoz kötött aktív foglalás egyedi |
| `host_id` | az időpont gazdája (másolat; visszahívásnál null) |
| `name`, `company_name`, `email` (kisbetűs), `phone` (normalizált), `message` | a látogató adatai; a `message` **külső, nem megbízható bemenet** |
| `status` | `uj` · `egyeztetve` · `megtartva` · `cegge_alakitva` · `elvetve` · `lemondva` |
| `user_id` | null; a belépett felhasználó (szerveroldalon azonosítva) |
| `company_id` | null; kitöltődik a Céggé alakításkor |
| `source` | `fooldal` · `referencia` · `kezdolap` |
| `gdpr_consent_at`, `consent_version` | a hozzájárulás időpontja és a szöveg verziója |
| `cancel_token_hash` | a lemondási token hash-e |
| `canceled_at`, `canceled_by` | `latogato` · `admin` |
| `visitor_mail_sent_at`, `admin_notified_at` | az értesítések állapota (hiba esetén üres marad) |
| `admin_note`, `handled_by` | belső jegyzet; ki kezelte |
| `created_at`, `updated_at` | |

- **Aktív foglalás:** `status` ∈ (`uj`, `egyeztetve`). **Egyedi, részleges:** a kisbetűs e-mail címre és a normalizált telefonszámra, ahol a foglalás aktív. A telefonszám normalizálása (`+36 20 …`, `0620 …`, `06 20 …` ugyanaz) szerveroldalon történik.
- **Kapcsolat a Céggel (a 14-es tervből):** a `companies.booking_id` egy külső kulcs a `bookings.id`-ra; a foglalás-tábla létrehozásával együtt kerül be.
- A `leads` tábla (3 sor) **nem módosul és nem használt tovább**.

## 4. Szerveroldali függvények

| Függvény | Ki hívhatja | Mit ellenőriz (egy tranzakcióban) |
|---|---|---|
| `create_booking` | a nyilvános API-végpont | az időpont zárolása; státusza `szabad`; legkorábban 24 óra múlva kezdődik és legfeljebb 30 napra van; nincs aktív foglalás ugyanazzal az e-mail címmel vagy telefonszámmal; a bejegyzés beszúrása, az időpont `foglalt`-ra váltása; hibakód: `idopont_elkelt`, `mar_van_foglalas`, `ervenytelen_idopont`. **Visszahívásnál** (`slot_id` üres) csak az aktív foglalás ellenőrzés fut. |
| `cancel_booking_by_token` | a nyilvános lemondási végpont | a token-hash egyezik; a foglalás aktív; az időpont még nem kezdődött el; az időpont szabaddá válik; a token érvénytelenné válik |
| `admin_cancel_booking` | admin | mint fent, `canceled_by = admin`; a látogató e-mailt kap |
| `admin_set_booking_status` | admin | az állapotgép szerint (Új → Egyeztetve → Megtartva → Céggé alakítva / Elvetve); napló |
| `admin_apply_templates` | admin | a 3.2 szerinti, ismételhető generálás |
| `admin_add_slot`, `admin_delete_slot` | admin | átfedés tiltása; **lefoglalt időpont törlése előbb a foglalás lemondását kéri megerősítéssel** (a látogató értesítést kap) |
| `admin_create_company_from_booking` | admin | új `companies` sor a foglalás adataival (név, `booking_id`), a foglalás `cegge_alakitva`; naplózás a `access_audit_log`-ba |

- **A nyilvános lista** (szabad időpontok) egy szerveroldali végponton át érkezik, és **csak** az idő, a hossz és a gazda **megjelenített nevét** adja ki; azonosítót, e-mail címet, vagy a foglaltakat nem.
- **Az értesítés nem veszélyeztetheti a foglalást:** a foglalás előbb mentődik, az e-mailek és a Telegram-üzenet utána mennek; a hiba a `*_sent_at` mezők üresen maradásával látszik az admin listán (újraküldés gombbal).

## 5. Az admin „Foglalások" lap

**Két fül, fix méretű dobozban (a lap nem ugrál):**

**A) Beérkezett**
- Lista: állapotcímke · időpont (vagy „visszahívás") · gazda · név · cég · telefon · e-mail · a leírás eleje. Szűrők: állapot, „csak az enyém" (alapból be). Az **Új** foglalások felül, kiemelve; a „Foglalások" menüponton **fix helyű jelzés** mutatja az új foglalások számát (nem tolja el a menüt).
- Kibontható sor: a teljes leírás (**szövegként, nem futtatható tartalomként** megjelenítve), belső jegyzet, a foglalás története, a figyelmeztetés, ha az értesítés nem ment ki.
- **„⋯" menü soronként:** Állapot módosítása, Jegyzet, Lemondás (admin), **Céggé alakítás** (egy kattintás; D42), Értesítés újraküldése.

**B) Időpontok**
- **Gazda-váltó** (Márk / Tibor / mindenki), a következő 4 hét heti nézetben vagy listában; az időpont-sorok állapottal (szabad / foglalt: név / törölve).
- **Heti sablon:** napok és időintervallumok gazdánként (hossz alapból 45 perc), **„Sablon alkalmazása"** gomb (a következő 4 hétre); egy sor kézzel hozzáadható vagy törölhető.
- **„Hamarosan":** emlékeztető e-mail a látogatónak az időpont előtt (nincs az első körben).

## 6. Értesítések

- **A látogatónak:** visszaigazoló e-mail (2. szakasz) az időpontos foglalásnál; visszahívási kérésnél rövid visszaigazolás időpont nélkül; lemondáskor megerősítés.
- **Márknak és Tibinek (D33):** e-mail és **Telegram**. A címzettek és a Telegram-csatorna beállítása az `app_settings` táblában vagy a szerver környezeti változóiban él; **a Telegram-bot kulcsa csak szerveroldali titok, a böngészőben nincs.** A Telegram-üzenet **egyszerű szöveg** (nincs formázott/HTML mód), a látogató szabad szövege kurtítva kerül bele, hogy ne lehessen belőle üzenetet manipulálni.
- Új foglalásról, lemondásról és (a gazdának) a közelgő időpontról szól az értesítés. A Telegram-szöveg formája: `16`, 5. pont.

## 7. Biztonság és adatvédelem

- **Szerveroldali validáció:** kötelező mezők, e-mail és telefon formátum, a szöveg hossza; a kliens adatát semmire nem használjuk bizalommal (a `user_id` a munkamenetből jön, nem a kérésből).
- **Spam-védelem:** honeypot mező és sebességkorlát (IP és e-mail szerint); az e-mail címet nem erősítik meg, ezért egy hamis foglalás ideiglenesen foglalhat egy időpontot: a korlát, az „egy aktív foglalás címenként" szabály és az admin lemondási lehetősége ezt fékezi. Ha visszaélés lesz, CAPTCHA (pl. Cloudflare Turnstile) kerül be.
- **Szabad szöveg = külső bemenet:** sosem fut le belőle semmi, nem kerül automatikusan sehova (sem az ügynökök memóriájába), a felületen szövegként jelenik meg.
- **RLS:** a táblákat csak az `admin` szerepkör olvassa; a látogató és a sima felhasználó közvetlenül semmit; a `cancel_token_hash` kliens felé sosem megy ki.
- **GDPR:** a hozzájárulás kötelező, időpontját és szövegverzióját tároljuk; **az adatkezelési tájékoztató a foglalás éles indítása előtt készen kell legyen** (kapu). Megőrzési idő és törlés (pl. a Céggé nem alakított, elvetett foglalások): az adatkezelési tájékoztatóval együtt döntjük el.
- **Mérés:** a `book_assessment` esemény (GA4) csak a szerver által visszaigazolt sikeres foglalás után lő.

## 8. Ellenőrzési lépések (a CODE-prompt végére)

- **Versenyhelyzet:** két látogató egyszerre foglalja ugyanazt az időpontot → pontosan egy sikerül, a másik érthető üzenetet kap, és az adatai megmaradnak.
- **Határok:** a 24 órán belüli és a 30 napnál későbbi időpont nem foglalható (a határon is); a múltbeli nem látszik.
- **Időszámítás:** a sablon-alkalmazás márciusi és októberi óraátállításnál is a helyes helyi időre ad időpontot; az átfedő időpont nem jön létre; az ismételt alkalmazás nem duplázza az időpontokat.
- **Egy aktív foglalás:** ugyanaz az e-mail kis- és nagybetűvel, ugyanaz a telefonszám különböző formátumban (`+36 20…`, `0620…`) → elutasítva; lemondás után újra foglalhat.
- **Lemondás:** a link megnyitása (GET) nem mond le semmit; a gomb (POST) egyszer működik; a második próba, a hibás és a lejárt token általános üzenetet ad; lemondás után az időpont újra foglalható.
- **Admin:** lefoglalt időpont törlése a foglalás lemondását kéri megerősítéssel, és értesíti a látogatót; az admin-művelet nem admin felhasználóval elutasított.
- **Visszahívási kérés:** időpont nélkül létrejön, az „egy aktív foglalás" szabály rá is érvényes.
- **Értesítés:** az e-mail vagy a Telegram hibája nem veszíti el a foglalást; az admin listán látszik a hiba, az újraküldés működik; a Telegram-üzenet a kártékony szöveget (HTML, link, hosszú karakterlánc) is egyszerű szövegként kezeli.
- **RLS (valódi tokennel):** névtelen és sima felhasználó nem olvas semmit a három táblából; a nyilvános időpont-lista nem ad ki azonosítót vagy e-mail címet; a `cancel_token_hash` nem érhető el.
- **Felület:** a doboz mérete a két lépés, a hibaüzenetek, a visszaigazolás és a „nincs szabad időpont" állapot között nem változik; mobilon is használható; az admin lap fix méretű, az új-jelző nem tolja el a menüt.
- **Meglévő működés:** a `leads` tábla, az ingatlanos modulok, az irodai fiók és a pénztár nem változik.

## 9. Nyitott pontok

- **Az első cégvezető kinevezése — eldöntve (Márk megerősítette).** A Céggé alakításkor a cégnek még nincs cégvezetője, és a kapcsolattartó nem biztos, hogy már regisztrált. Az admin a Céggé alakítás után a „Cégek" lapon kinevezi cégvezetőnek a regisztrált felhasználót (ha a foglaló e-mail címével még nincs fiók, előbb regisztrál, ugyanazzal a címmel). **Az Aktiválás csak akkor engedett, ha a cégnek van legalább egy aktív cégvezetője;** a szabály átvezetve a `12`, `13`, `14` és `01` dokumentumba.
- **A felmérés módja:** a gazda az időpontban telefonon hív (alapértelmezés); videóhívás később.
- **Küldési és sebességkorlát értékei** (kérés/óra/IP); CAPTCHA, ha visszaélés lesz.
- **Emlékeztető e-mail** az időpont előtt (később).
- **Megőrzési idő és törlés** a foglalási adatokra (az adatkezelési tájékoztatóval együtt).
- **A Telegram-csatorna és az e-mail címzettek** pontos beállítása (az `app_settings` vagy környezeti változó).
- **Resend domain-hitelesítés** és az **adatkezelési tájékoztató** (vázlat: `17`; jogász és cégadatok hiányoznak): kapu a foglalás éles indítása előtt.
- **A Telegram-csatorna:** a Foglalások és a plafon-értesítések (D53) is a közös Twinx agent beszélgetésbe mehetnek; a csoportazonosító szerveroldali környezeti változó.
