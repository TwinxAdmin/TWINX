# 23 – Az Átadva-állapot jóváhagyási nyoma: átadási bejegyzés (D56 terv)

Állapot: terv, **döntések rögzítve** 2026-11-23-án. Kódolás nincs, a CODE-prompt csak átadáskor készül.
Kapcsolódó: `12-admin-terv.md` (Egyedi modulok lap, Aktiválás), `14-adatmodell-terv.md` (`company_modules`, `access_audit_log`), `19-dijak-es-fizetes-terv.md` (az „átadáskor" mérföldkő), `21-lezaras-es-lemondas-terv.md` (újraaktiválás). A migrációra a D51 szabályai érvényesek (additív, down szkript, admin-only bekapcsolás).

## 1. Döntések (Márk, 2026-11-23)

- **Átadási bejegyzés az adminban** (A változat): az Átadva állapotba lépéskor kötelező egy rövid adatlap: ki fogadta el a cég részéről, hogyan, mikor, és mit kapott meg. A bejegyzés csak hozzáfűzhető, csak admin látja.
- **Az „átadáskor" fizetési mérföldkő csak emlékeztető.** Az átadás nem változtat automatikusan pénzügyi tételt; az admin kézzel állítja (a D52 szellemében).
- **Új átadás érdemi változásnál:** az admin új átadási bejegyzést rögzít, az **utolsó érvényes számít**, a régi megmarad. **Hibajavításnál nem kell új bejegyzés.**
- **Az elfogadás feltételei a szerződésben dőlnek el** (elfogadási kritériumok, hibajavítási időszak, hallgatólagos elfogadás szabálya); a rendszer csak a tényt rögzíti. Ez a szerződés- és ajánlat-sablon jogász-pontja `[JOGÁSZ]`.
- **Későbbre (Hamarosan):** cégvezetői „Átvettem" gomb a rendszerben (előbb egy külön átadási előnézet kell, mert a cégvezető a készülő modult nem látja, D44); bizonyíték (e-mail, PDF) feltöltése az átadáshoz.

## 2. Folyamat (admin szemszögéből)

1. A modul **Teszt** állapotú, a cégnek bemutattuk, és megkaptuk az elfogadást (e-mailben, telefonon, személyesen vagy videóhíváson).
2. Az Egyedi modulok lapon a modul kibontható sorában, a „⋯" menüben: **Átadás rögzítése**. Kitöltendő:
   - **Elfogadó neve** (a cég részéről; kötelező), szerepe (pl. cégvezető; opcionális);
   - **Hogyan fogadta el:** e-mail · telefon · személyesen · videóhívás · egyéb (kötelező);
   - **Mikor fogadta el** (dátum; kötelező, nem lehet jövőbeli);
   - **Mit kapott meg:** a modul rövid leírása, a verzió vagy címke (kötelező);
   - **Megjegyzés** (opcionális).
3. A mentéssel **egyetlen tranzakcióban** a modul állapota **Átadva** lesz, és a bejegyzés érvényes.
4. A rendszer emlékeztetőt mutat, ha van a modulhoz **„átadáskor" mérföldkő tétel**, amely még nincs kiszámlázva (vagy ha az előleg nincs kifizetve): „Az átadáskor esedékes tétel még nincs kiszámlázva." A tétel állapota nem változik.
5. Az **Aktiválás** (`12`) csak érvényes átadási bejegyzéssel engedett.
6. **Érdemi változás után:** az admin a „⋯" menüben **Új átadás rögzítése** műveletet futtatja (ugyanaz az adatlap). Az előző érvényes bejegyzés **Felülírt** lesz, de megmarad. Az aktív modul állapota nem változik. Hibajavításnál nincs új bejegyzés.
7. **Hibás bejegyzés:** csak **Átadva** állapotú (még nem aktivált) modulnál vonható vissza indoklással; a modul ekkor **Teszt** állapotba lép vissza. Aktív modulnál előbb Kikapcsolás kell, vagy új bejegyzés írja felül.

## 3. Adatmodell (új tábla, additív)

**`module_handovers`** (csak hozzáfűzés, állapot-váltással):

| Oszlop | Típus | Megjegyzés |
|---|---|---|
| `id` | uuid, PK | |
| `company_module_id` | uuid, FK `company_modules` | |
| `status` | text | `ervenyes` · `felulirva` · `visszavonva` |
| `accepted_by_name` | text, kötelező | az elfogadó a cég részéről (hosszkorlát) |
| `accepted_by_role` | text, null | pl. „cégvezető" |
| `accepted_by_user_id` | uuid, null | ha az elfogadónak van TWINX fiókja |
| `accepted_via` | text | `email` · `telefon` · `szemelyesen` · `videohivas` · `egyeb` |
| `accepted_on` | date, kötelező | az elfogadás napja, nem jövőbeli |
| `delivered_summary` | text, kötelező | mit kapott meg: leírás, verzió vagy címke |
| `note` | text, null | |
| `recorded_by` | uuid | az admin |
| `recorded_at` | timestamptz | |
| `superseded_by` | uuid, null | az új bejegyzés azonosítója |
| `revoked_by`, `revoked_at`, `revoked_reason` | uuid / timestamptz / text, null | |

- **Egyedi, részleges:** `company_module_id`, ahol `status = 'ervenyes'` (egy modulnak egyszerre legfeljebb egy érvényes bejegyzése van).
- **Csak követési adat:** a szöveges mezőkbe ügyfél titkos (NDA) adata nem kerülhet (D43); a felület ezt jelzi az adatlap alatt.
- **RLS:** kliensről nincs olvasás és írás; csak admin, szerveroldali függvényen át. A cégvezető és a felhasználó nem látja.
- A `company_modules` táblán **nincs új oszlop**: az érvényes bejegyzés a `module_handovers`-ből olvasható.

**`access_audit_log` új események:** `atadas_rogzitve`, `atadas_felulirva`, `atadas_visszavonva` (ki, mikor, melyik modul; az elfogadó nevét a napló `details` mezője nem tartalmazza, az a bejegyzésben van).

## 4. Függvények (security definer, csak service_role, egy tranzakcióban, naplóval)

- `record_handover(company_module_id, accepted_by_name, accepted_by_role, accepted_via, accepted_on, delivered_summary, note, actor)`: csak admin. Ellenőrzi: a modul állapota `teszt` (első átadás) vagy `atadva`/`aktiv` (új átadás); a kötelező mezők; a dátum nem jövőbeli. Első átadásnál a modul állapota `atadva` lesz; új átadásnál az előző `ervenyes` bejegyzés `felulirva` lesz (`superseded_by` az újra mutat), az állapot nem változik. A válasz tartalmazza az emlékeztető adatait (nyitott „átadáskor" és előleg tételek).
- `revoke_handover(handover_id, reason, actor)`: csak admin; csak `atadva` állapotú modulnál; a bejegyzés `visszavonva`, a modul `teszt` állapotba lép.
- **Az `admin_set_module_state` nem állíthatja közvetlenül `atadva` állapotra a modult** (hibakóddal: `atadas_bejegyzes_kell`); csak a `record_handover` léptetheti.
- **Az `activate_company_module` új feltétele:** a modulnak van `ervenyes` átadási bejegyzése (az eddigi feltételek mellé).
- Az adatbázis a hibát kód + magyar üzenet formában adja vissza (pl. `atadas_bejegyzes_kell`, `nincs_ervenyes_atadas`, `datum_jovobeli`).

## 5. Admin felület

- **Egyedi modulok lap, kibontható sor:** új **Átadás** szakasz: az érvényes bejegyzés (elfogadó neve, mód, dátum, mit kapott), alatta a korábbi bejegyzések listája (Felülírt, Visszavont) állapotcímkével. A szakasz mérete fix, nem ugrál; ha nincs bejegyzés: „Még nincs átadás rögzítve."
- **„⋯" menü a modulon:** Átadás rögzítése (Teszt állapotban), Új átadás rögzítése (Átadva és Aktív állapotban), Átadás visszavonása (csak Átadva állapotban).
- **Adatlap (felugró):** a 2. szakasz mezői; fix méretű; a mentés gomb inaktív, amíg a kötelező mező hiányzik.
- **Emlékeztető:** a mentés után a modul sorában és a Pénzügy listán „Átadáskor esedékes tétel kiszámlázásra vár" jelzés, amíg a tétel nincs kiszámlázva.
- **Hamarosan:** cégvezetői „Átvettem" gomb átadási előnézettel; bizonyíték feltöltése.
- A cégvezető és a felhasználó az átadási bejegyzést **nem látja**.

## 6. Kapcsolat a többi tervvel

- **`12`:** az Átadva állapot jelentése kiegészül az átadási bejegyzéssel; az Aktiválás hetedik feltétele az érvényes átadási bejegyzés.
- **`14`:** új tábla a 2.7 szakaszban; az Aktiválás feltétele bővül; új naplóesemények; a migráció sorrendje: `14` → `15` → `19` → `20` → `21` → `23`.
- **`19`:** az „átadáskor" mérföldkő csak emlékeztetőt kap az átadásnál, az állapota kézzel változik.
- **`21`:** lemondáskor és lezáráskor az átadási bejegyzések megmaradnak (archívum). Újraaktiváláskor az érvényes bejegyzés érvényes marad; ha a modul közben érdemben változott, az admin új átadást rögzít.

## 7. Ellenőrzési lista (a fejlesztés végére)

1. Teszt állapotú modul csak az Átadás rögzítésével lép Átadva állapotba; közvetlen állapotváltás elutasított (`atadas_bejegyzes_kell`).
2. Hiányzó kötelező mezővel vagy jövőbeli dátummal a mentés elutasított, érthető üzenettel; semmi nem jön létre.
3. A bejegyzés és az állapotváltás egy tranzakció: hiba esetén egyik sem történik meg.
4. Aktiválás érvényes átadási bejegyzés nélkül elutasított; bejegyzéssel (és az eddigi feltételekkel) engedett.
5. Új átadás: az előző bejegyzés Felülírt lesz és megmarad; az aktív modul állapota nem változik; egyszerre csak egy érvényes bejegyzés van.
6. Visszavonás csak Átadva állapotú modulnál megy; a modul Teszt állapotba lép; aktív modulnál elutasított.
7. Az „átadáskor" tétel állapota az átadástól nem változik; az emlékeztető megjelenik és eltűnik a kiszámlázás után.
8. Cégvezetői és felhasználói fiókkal az átadási bejegyzés nem látható (API 403, RLS üres).
9. A bejegyzések nem törölhetők és nem módosíthatók (csak állapotváltás); a napló nem tartalmaz ügyféladatot.
10. Lemondás és lezárás után a bejegyzések megmaradnak; a dobozok mérete nem változik.

## 8. Nyitott pontok

- Az elfogadás feltételei (kritériumok, hibajavítási időszak, hallgatólagos elfogadás) a szerződés- és ajánlat-sablonban. `[JOGÁSZ + Márk]`
- Az átadási előnézet és a cégvezetői „Átvettem" gomb tervezése (Hamarosan).
- A bizonyíték-feltöltés tárolási és adatkezelési szabálya (Hamarosan).
- Mit számít „érdemi változásnak" (új funkció, módosított üzleti szabály) a hibajavítással szemben: az admin döntése, a belső ajánlat-ellenőrző lista része lehet.
