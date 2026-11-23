# TWINX admin felület — terv (D40–D56)

> **Státusz:** elfogadott terv, 2026-11-23. A megjelenés (arculat, komponensek) **marad**, a szerkezet és a tartalom változik.
> **Felülírja:** a D30 vásárlásos felét, a D31 admin-vonatkozásait és a D35 „hozzáférés cseréje nálunk történik" pontját. A D44 „csak Márk lehet admin" pontját a D45 felülírja; a „fizető cégvezető" és a külön „meghívási jog" pontot a D46. Az átvezetés a `00`, `01`, `04`, `05`, `11` dokumentumokba megtörtént; a D47–D54 (adatmodell, foglalás, e-mailek, díjak és fizetés, plafon, lemondás és lezárás) kiegészítései ebben a dokumentumban szerepelnek.
> **Részletek:** a „Hozzáférések" ablak, a meghívás és a cégvezetői szabályok: `claude/13-hozzaferesek-terv.md`; az adatmodell: `14`; a Foglalások lap: `15`; az e-mail szövegek: `16`; az ajánlat, a fizetés és a lejárati figyelmeztetés: `19`; a plafon és a használat: `20`; a modul lemondása, a cég lezárása és az ügyféladat törlése: `21`; az átadási bejegyzés: `23`.
> **Nyelv:** magyar. Nincs „kredit" szó a felületen.

---

## 1. Menüsor (D40)

1. **Foglalások** (D33, D48): két fül: **Beérkezett** (érdeklődők: név, cég, e-mail, telefon, leírás, állapot, időpont vagy visszahívási kérés) és **Időpontok** (heti sablon, szabad időpontok, gazda: Márk vagy Tibor). Egy foglalásból egy kattintással **Cég** hozható létre; a létrehozás után az admin kijelöli az **első cégvezetőt** (lásd Aktiválás, 6. szakasz). Részletek: `15`.
2. **Felhasználók:** regisztráció ideje, melyik céghez tartozik, a szerepe. Az új regisztráló **„Besorolatlan"**, amíg mi be nem soroljuk. Meghívón keresztül regisztráló automatikusan a meghívó cégéhez kerül. Itt adható és vehető el az **admin jog** (2. szakasz).
3. **Cégek:** lista; a **kibontható sor** az áttekintő ablak: a cég megrendelt modulai, helyek (használt/összes), lejárat, a kollégák listája állapottal (meghívva / aktív), a cégvezetők jelölve, az API-költséges moduloknál a havi használat sávja (D53). A cég oldalán **Ajánlatok** és **Fizetések** fül (D52). A cég és a modul sorának **„⋯" menüje** (D54): Lemondás rögzítése, Cég lezárása, Újranyitás, Ügyféladatok visszaadása, Ügyféladatok törlésének kérése, Végleges törlés (csak fizetési tétel nélküli cégnél). A lezárt cég alapból rejtve, szűrővel előhozható. A függő törlési kérések **Jóváhagyások** jelzése fix helyen jelenik meg, a jóváhagyók listáját (`deletion_approvers`) az admin kezeli. Részletek: `21`.
4. **Előfizetések:** kezelés és lejárat (modul, hány hely, érvényesség, fizetés állapota). A helyek számát csak az admin állítja. A 3 és 1 nap múlva lejáró modulok színes jelzést kapnak (D52).
5. **Pénzügy** (D52): összesítő lista a cégeken át, fülek: *Esedékes / Kiszámlázva / Fizetve / Lejáró modulok*; CSV-export a könyvelőnek. Csak admin látja. Részletek: `19`.
6. **Egyedi modulok (fejlesztés):** a fejlesztés követése és az elkészült modul aktiválása (lásd 6. szakasz).
7. **Költségfigyelő** (marad).
8. **Eszközök:** Promptok, Videólabor (a meglévő ingatlanos modulokat vezérlik; nem törlődnek).

**Nézet-váltó (admin előnézet):** a megjelenés marad, de a váltás **szerepkör helyett cég (és felhasználó)** szerint történik: „így látja a weblapot X cég / Y felhasználó". Csak admin látja, csak lefelé válthat, jogot nem ad (a régi biztonsági szabályok érvényesek). **Az előnézetnek követnie kell az új jogosultságokat** (különben „hazudik"), és az előnézetben a beküldés blokkolt.

## 2. Szerepkörök (D45, D46)

**Három szerep van, két különböző szinten:**

| | Szint | Mit tehet | Mit nem | Ki adja |
|---|---|---|---|---|
| **Admin** | rendszer (`profiles.role = admin`) | A teljes TWINX: admin felület, fejlesztés, tesztelés, egyedi modulok, cégek, előfizetések, weblap | – | Csak admin adhat admin jogot |
| **Cégvezető** | cégen belüli státusz (a felhasználó és a cég kapcsolatán) | Rendel, fizet, a cége ügyeit intézi: „Hozzáférések" (meghív, eltávolít), kinevez másik cégvezetőt | Admin felületet nem lát, más cég adatát nem, a készülő modult nem | Admin jelöli ki, vagy másik cégvezető nevezi ki (a cég aktív tagját) |
| **User** | rendszer (`profiles.role = user`) | Használja a kapott modult egyedül vagy irodai fiókban | Meghívni, fizetni nem tud | Meghívással a cégvezetőtől, vagy besorolással az admintól |

**Szabályok:**
- **Rendszerszerepkör csak kettő van: `admin` és `user`.** A `sales` szerepkör megszűnik. A **cégvezető nem rendszerszerepkör**, hanem **cégen belüli státusz**: rendszerszinten a cégvezető `user`, és a státusz sosem ad admin jogot. Ugyanaz az ember két cégnél is lehet cégvezető, vagy az egyiknél cégvezető, a másiknál sima user.
- **Admin:** aki úgy dolgozik, mint Márk: fejleszt, tesztel, egyedi modulokat intéz, a weblapot kezeli. **Több admin lehet** (Márk, később Tibi). **Admin jogot csak admin adhat**, kizárólag az admin felületen (Felhasználók), szerveroldali ellenőrzéssel, **naplózva** (ki, kinek, mikor, adta vagy elvette). A szerepkört továbbra is csak szerveroldal módosíthatja (`profiles_guard_role`, `service_role`); böngészőből nem. **Az utolsó admint senki nem veheti le** (a rendszer ezt szerveroldalon tiltja), így nem lehet mindenkit kizárni.
- **Cégvezető (D46):**
  - **A státusz cégenként él**; a cég minden moduljára érvényes. **Több cégvezető lehet egy cégnél, és mindegyik fizethet.** Nincs külön „fizető cégvezető" és nincs külön „meghívási jog".
  - **Minden cégnek mindig van legalább egy cégvezetője.** Az utolsót nem lehet feladni vagy levenni (szerveroldali tiltás, tranzakcióban).
  - **Kinevezés:** az admin bárkit kinevezhet; a cégvezető a **cég már aktív tagját** nevezheti ki (a kinevezett jogai bővülnek). A kinevezés naplózott, a kinevezett értesítést kap.
  - **Lemondás/levétel:** mindenki csak a **saját** státuszát adhatja fel; **másét elvenni csak az admin tudja**.
  - Ő a saját cége felületének az adminja: a „Hozzáférések" ablakot látja és használja (részletek: `13-hozzaferesek-terv.md`).
  - **Nem látja a készülő dolgokat:** a Fejlesztés / Teszt állapotú és a még nem aktivált modult nem látja; az Egyedi modulok lap tartalma neki nem elérhető. Csak az aktivált modult látja.
- **User:** a kapott modult használja. Cégvezetővé a fent leírt módon válhat.
- **Az admin felület és az admin API-k szerveroldalon csak `admin` szerepkörnek elérhetők.** A cégvezetői státusz sosem nyit admin jogot.

## 3. Ami kikerül (kredit-kivezetés az adminból, D40)

Kikerül a felületről: **Kredit-napló**, **Kredit-kérések**, **Meghívók** (/ingatlan ajándékkód-kampány), a Felhasználók táblában a **kredit „+" gomb és oszlop**, az üdvözlő kredit, a Stripe-alapú kreditvásárlás a felhasználói felületen, a „kredit" szó mindenhol.

Technikailag marad (láthatatlanul): a pénztárca-tábla és a naplózás, amíg az ingatlanos modulok működése ezt használja; a „keret csak siker után fogy" és az „egy tranzakcióban" szabály érvényes marad.

## 4. Költségvédelem: láthatatlan havi plafon (D40, D44)

- **Cégenként és modulonként** egy opcionális **havi használati plafon** a Cég oldalon, **alapból üres** (nincs korlát).
- Nem kredit, nem látszik a felhasználónak. **A plafon forintban, nettó önköltségben értendő** (D53). **80%-nál figyelmeztetés, 100%-nál kemény leállás** (a modul nem költséges részei működnek tovább); az értesítés Telegramon megy a közös Twinx agent beszélgetésbe. Az ügyfél semleges üzenetet kap, számot nem lát (a szöveg jóváhagyandó). Az admin a keretet emelheti (indoklással), vagy **pluszcsomagot** adhat hozzá a „⋯" menüből.
- **API-költséges moduloknál (kép, videó, kutatás) a plafon beállítása kötelező, mielőtt a cég használatba veszi:** az Aktiválás (6. szakasz) ilyen modulnál csak beállított plafonnal engedett.
- **A mértékegység eldőlt (Ft); az értékeket nem most rögzítjük:** az első ilyen modulnál, a modul-kalkulációval és a belső ajánlat-ellenőrző listával együtt határozzuk meg (D44, D53).
- Részletek (foglalás-elszámolás, pluszcsomag, hónapváltás, értesítés): `20`.

## 5. Hozzáférés és meghívás (D41, D46; a részletek a `13`-ban)

- **A modul-hozzáférés a felhasználóhoz kötött.** A cég **az előfizetésen keresztül** jogosult a modulra (modul, helyek száma, érvényesség); a helyeket a kollégák töltik be. A helyek számát csak az admin állítja.
- **Meghívni a cég cégvezetői hívhatnak.** A cégvezető csak akkor foglal helyet, ha ő is használja a modult.
- **A meghívó lefoglalja a helyet** az elfogadásig vagy lejáratig (7 nap); a cégvezető vissza is vonhatja.
- **Meghívás (a cégvezető ablaka, „Hozzáférések" a TWINX-en, modulonként egy sorral):** helyek (használt/összes), meghívott és aktív kollégák, e-mail cím beírása → a kolléga üzenetet kap **„Belépés" gombbal**; ha még nincs fiókja, regisztrálnia kell ugyanazzal a címmel, ha van, egyből eléri a modult a „Moduljaim" menüben. Az admin táblázatban ez azonnal látszik.
- **Eltávolítás:** a cégvezető maga eltávolíthat kollégát; a hely azonnal felszabadul, a hozzáférés megszűnik, a munkái nála maradnak. Minden lépés naplózott (ki, kit, mikor).
- **GDN és minden ingatlanos (az Ingatlan csomag):** hozzáférést **csak mi adunk** az adminban; **nincs önkiszolgáló vásárlás** (D44).
- Az **irodai fiók** ettől független, opcionális közös tér (D35); nem ad modul-hozzáférést.

**Biztonsági követelmények** (összefoglaló; a teljes lista és az állapotgép a `13-hozzaferesek-terv.md` 6–7. szakaszában): egyszer használatos, lejáró, e-mailhez kötött, hash-elt token; a helyek számát a szerver érvényesíti tranzakcióban; megerősített e-mail cím az elfogadáshoz; minden művelet az adott cég cégvezetőjére ellenőrizve; az utolsó cégvezetőt nem lehet levenni; napló; meghívó-küldési korlát.

## 6. Egyedi modulok (fejlesztés) lap és modul-regiszter (D43)

**Modul-regiszter (A változat):** minden egyedi modul **a kódban él** (a Claude Code készíti el és kerül az éles rendszerre), egy regiszter-bejegyzéssel (kulcs, név, ikon, útvonal; D54: `origin`, `reuse`, `catalog_status`, `data_policy`), és **rejtve marad**, amíg nincs bekapcsolva. Az adminban az **Aktiválás** egy cég számára kapcsolja be. Elvetett változat: az admin tölti fel és telepíti a modult (plugin-rendszer: nagy fejlesztés és biztonsági kockázat).

**Állapotok:** **Felmérés → Ajánlat → Fejlesztés → Teszt → Átadva → Aktív**; mellék-állapotok: **Szünetel**, **Lemondva**. (D54: a lemondás rögzítésekor a modul `aktiv` marad a hatályos napig, utána lesz `lemondva`; a modul kódja és regiszter-bejegyzése lemondás után is megmarad.)
- **Átadva:** a cégnek bemutattuk, jóváhagyta. (D56: csak **átadási bejegyzéssel** lehet ide lépni: ki fogadta el, hogyan, mikor, mit kapott meg; csak admin látja; részletek: `23`.)
- **Aktív:** be van kapcsolva a cégnek, érvényes előfizetéssel.

**Lap tartalma:**
- Lista: modul neve, cég, állapot, felelős (egy admin: Márk vagy Tibi), utolsó módosítás, hivatkozás a foglalásra.
- Kibontható sor: megjegyzések, az állapotváltások története (dátummal), a regiszter-kulcs, az Aktiválás / Kikapcsolás gomb.

**Az Aktiválás szabályai:**
- Csak admin végezheti.
- Csak akkor engedett, ha (1) a modul szerepel a regiszterben (a kód az éles rendszeren van), (2) az állapot **Átadva**, (3) a cég előfizetése érvényes, (4) API-költséges modulnál be van állítva a havi plafon (D44), (5) **a cégnek van legalább egy aktív cégvezetője** (az admin jelöli ki a Cég oldalán), (6) **a modulnak van érvényes átadási bejegyzése** (D56), és (7) **a modul regiszter-bejegyzésében szerepel a `data_policy`:** a modul törlési és exportálási leírása, vagy a kijelentés, hogy nem tárol ügyféladatot (D54).
- Az aktiválás **nem ad felhasználói hozzáférést**: a cégvezető hívja be a kollégákat (5. szakasz).
- A fejlesztés alatt álló modul a cég felhasználóinak nem látszik.

**Adat:** a lap csak követési adatot tárol, ügyfél titkos adatot (NDA) nem.

## 7. Nyitott pontok

- Lemondás és lezárás (D54): a megőrzési határidő napjai, a számviteli megőrzés, a hozzáférés megszűnésekor mutatott szöveg, a Modul-katalógus nézet (Hamarosan); lásd `21`, 10. szakasz.
- A cég-tagság, előfizetés/hely-keret, meghívó, modul-hozzáférés és napló részletes adatmodellje (a CODE előtt; előzetes: `13`, 8. szakasz).
- A plafon konkrét értékei: az első API-költséges modulnál, a modul-kalkulációval és az ajánlat-ellenőrző listával (D44, D53).
- A pénzügyi nézetek későbbi bővítése: cégvezetői „Számláim" nézet, Stripe és Számla Agent bekötése (Hamarosan; `19`).
- Megerősítendő alapértelmezések: a külön meghívási jog megszűnik; egy felhasználó több cégben is lehet; a meghívó 7 napig érvényes.
- Később: lesz-e a cégvezető saját-cég felületén több funkció a hozzáférés-kezelésen túl (pl. használati nézet)? Egyelőre nincs (D35).
