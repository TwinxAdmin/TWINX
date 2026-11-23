# 20 – Havi plafon, használat-mérés és pluszcsomag (D53 terv)

Állapot: terv, döntések rögzítve 2026-11-23-án. Kódolás nincs, a CODE-prompt csak átadáskor készül.
Kapcsolódó: `14-adatmodell-terv.md` (`company_modules.is_api_costly`, `monthly_cap`, Aktiválás; az új oszlopok és táblák a `14` 2.3 és 2.7 szakaszában is szerepelnek), `19-dijak-es-fizetes-terv.md` (`company_payments`), `12-admin-terv.md`, `21-lezaras-es-lemondas-terv.md` (lemondás és lezárás hatása a foglalásokra). A migrációra a D51 szabályai érvényesek (additív, down szkript, admin-only bekapcsolás).

## 1. Döntések (Márk, 2026-11-23)

- **Mértékegység: forint, nettó önköltség.** A `monthly_cap` Ft-ban értendő; minden API-hívás a saját költségét Ft-ban naplózza (rögzített 380 Ft/USD árfolyam, szükség esetén frissítve).
- **Minden egyedi modul egyedi, ezért a havi díj egy megadott mennyiségre szól** (X darab kép / videó / kutatás stb.), és az ajánlatban rögzítjük. A mennyiség mögött a modul költség-kalkulációja áll (lásd 8. szakasz).
- **Ha a keret idő előtt elfogy, pluszcsomag vásárolható.** A pluszcsomag mérete és ára modulonként más, ezért **előre megtervezett**: az ajánlatban szerepel.
- **Elszámolás csak siker után** (a régi „keret csak siker után" elv). Hibánál a foglalás felszabadul.
- **Figyelmeztetés 80%-nál, kemény leállás 100%-nál.** A keretet az admin egy lépéssel emelheti, indoklással és naplóval.
- **Az értesítés Telegramra megy, a közös „Twinx agent" beszélgetésbe**, ahol Márk és Tibor is benne van.
- **Kalkuláció minden egyedi modulhoz** (a modul reális havi költsége): állandó kérés, a 8. szakasz szerint.

## 2. Folyamat

**Ajánlatkor (admin):** a modul-kalkuláció alapján az ajánlatban megjelenik: a havi díj, a benne foglalt mennyiség (X darab és az egység neve), a pluszcsomag mérete és ára. Az Aktiválásnál a rendszer a `monthly_cap` Ft-értékét kéri (kötelező, D44), és a foglalt mennyiséget mellé rögzíti.

**Használatkor (felhasználó):** minden API-költséges műveletnél a szerver a hívás előtt **lefoglalja** a becsült költséget. Ha belefér a keretbe, a hívás elindul. Siker után a foglalás **elszámolódik** a tényleges (vagy ha az nem ismert, a rögzített becsült) költséggel. Hibánál a foglalás **feloldódik**, és semmi nem számít.

**Keret elfogyása:**
- 80%-nál egyszeri Telegram-figyelmeztetés a közös beszélgetésbe.
- 100%-nál egyszeri Telegram-értesítés, és a modul költséges műveletei leállnak a hónap végéig vagy a keret emeléséig. A modul nem költséges részei (pl. már elkészült anyagok megnyitása) tovább működnek.
- Az ügyfél **számot nem lát**. Semleges szöveget kap (a végleges szöveg jóváhagyandó, `[KITÖLTENDŐ]`).

**Pluszcsomag:** az admin a modul „⋯" menüjében a „Pluszcsomag hozzáadása" műveletet futtatja. Egyetlen tranzakcióban létrejön a keret-kiegészítés **és** a hozzá tartozó fizetési tétel (`company_payments`, típus: `egyeb`, leírás: pluszcsomag, állapot Esedékes). A kiegészítés az adott hónapra érvényes, a fizetés követése a `19` szerint megy tovább. A kiegészítés **azonnal él**, a fizetést utólag követjük (Márk megerősítette). Ha később szigorítani kell (csak a „Fizetve" után él), az a `19` fizetési függvényéhez köthető.

**Lemondás (D54):** a lemondott modulnál a hatályos nap után a lefoglalt, el nem számolt foglalások feloldódnak, és új foglalás nem indulhat; a lezárt cég moduljánál sem. A már elszámolt használat és a naplók megmaradnak.

**Hónap fordulója:** a budapesti naptári hónap kezdetén a használat nullázódik (új időszak), a pluszcsomag csak abban a hónapban érvényes, amelyre szólt. A fel nem használt keret **nem vihető át** a következő hónapra (Márk megerősítette).

## 3. Adatmodell (additív)

**`company_modules` új oszlopok** (a meglévő `monthly_cap` jelentése: Ft, nettó önköltség, egész szám):
- `usage_unit_label` (text, null): az egység neve az admin felületen (pl. „kép", „videó").
- `included_units` (integer, null): a havi díjban foglalt mennyiség.
- `extra_pack_units` (integer, null), `extra_pack_cost_cap_ft` (integer, null): a pluszcsomag mennyisége és a hozzá tartozó keret-kiegészítés Ft-ban.
- `extra_pack_price_net` (integer, null): a pluszcsomag nettó ára az ügyfélnek.
- Aktiválásnál API-költséges modulnál kötelező: `monthly_cap`; a többi mező ajánlott.

**`module_usage_events`** (használati napló, csak hozzáfűzés):
id, company_module_id, user_id, operation_key (a modul regiszteréből), units (alapból 1), estimated_cost_ft, actual_cost_ft (null), status (`foglalt`, `elszamolt`, `feloldott`), period (`YYYY-MM`, budapesti idő szerint), request_key (egyedi, idempotencia: ugyanaz a kérés kétszer nem foglal), job_id (null), created_at, settled_at.

**`module_cap_adjustments`**: id, company_module_id, period, extra_cost_ft, extra_units, reason, payment_id (null), created_by, created_at. Csak hozzáfűzés; a hatékony havi keret = `monthly_cap` + az adott hónap kiegészítéseinek összege.

**`cap_notifications`**: id, company_module_id, period, threshold (80 vagy 100), sent_at. Egyedi: (company_module_id, period, threshold) → egy küszöb egy hónapban egyszer jelez. Pluszcsomag vagy keretemelés után az új keret szerinti küszöbök újra élnek (a rendszer a már kiküldött jelzéseket az új keretre újraértékeli, `[a CODE a legegyszerűbb helyes megoldást választja és jelzi]`).

A régi ingatlanos modulok pénztárcája és a `usage_history` érintetlen marad; az új napló csak az egyedi, API-költséges modulokra vonatkozik.

## 4. Függvények (security definer, csak service_role hívhatja)

- `usage_reserve(company_module_id, user_id, operation_key, estimated_cost_ft, request_key)`: **sorzárral** (`company_modules` sor `FOR UPDATE`) összeadja az adott hónap `foglalt` + `elszamolt` költségét, és ha a becsült költséggel együtt a hatékony havi keretben marad, rögzít egy `foglalt` sort és `ok`-t ad vissza; különben `elutasitva`-t, és jelzi, hogy a 100%-os értesítés esedékes. Ugyanazzal a `request_key`-jel kétszer nem foglal.
- `usage_settle(event_id, actual_cost_ft)`: `foglalt` → `elszamolt`, a tényleges költséggel. Ha a tényleges költség meghaladja a becslést és ezzel átlépi a keretet, az **egyszer** megengedett; a következő foglalás már elutasul.
- `usage_release(event_id)`: `foglalt` → `feloldott` (hibánál vagy megszakításnál).
- `usage_release_stale()`: az időkorlátnál régebbi, el nem számolt foglalásokat feloldja (a munka időkorlátját a CODE a modul feladatához igazítja). Rendszeresen fut.
- `cap_add_pack(company_module_id, period, extra_cost_ft, extra_units, price_net, reason, actor)`: a keret-kiegészítés és a fizetési tétel létrehozása **egy tranzakcióban**; naplóbejegyzés.
- `cap_set(company_module_id, new_cap_ft, reason, actor)`: a `monthly_cap` módosítása indoklással, naplózva.
- `cap_thresholds_due()`: azok a modulok, amelyek a hatékony keret 80%-át vagy 100%-át elérték, és az adott küszöbről még nem ment értesítés.

**Hibakezelés (kritikus):** ha a naplózás vagy a foglalás adatbázis-hibával megáll, a költséges API-hívás **nem indul el** (a rendszer a védelem javára dönt). Az ilyen eset az adminnak hibajelzést ad.

## 5. Értesítés

- A küszöb-ellenőrzés a foglalás/elszámolás után azonnal, valamint az ütemezett karbantartáskor is lefut.
- Telegram: sima szöveg, a közös „Twinx agent" beszélgetésbe (a csoport azonosítója szerveroldali környezeti változó, nem a kódban).
- Tartalom: cég neve, modul, küszöb (80% / 100%), felhasznált és keret Ft-ban (nettó önköltség), a hónap vége. Személyes adatot (felhasználó neve, e-mail) **nem** tartalmaz.
- Az admin felületen a modul sorában ugyanez jelzés látszik.
- Az adatkezelési tájékoztató (`17`) Telegram-átadásra vonatkozó jogász-ellenőrzése erre is érvényes.

## 6. Admin felület

- **Cég modul-sora (Egyedi modulok / Előfizetések):** sáv „felhasznált / keret" (Ft, nettó önköltség), a százalék, a hátralévő időszak; a foglalt mennyiség és az egység neve. Színjelzés 80% és 100% fölött. A sáv mérete fix, nem ugrál.
- **„⋯" menü:** Pluszcsomag hozzáadása, Keret módosítása (indoklással), Használat megtekintése (a hónap eseményei listában).
- **Hamarosan:** műveletenkénti bontás, havi összevetés, grafikon, CSV-riport.
- Az ügyfél és a cégvezető a használati adatot és a keretet nem látja (az RLS és az API sem engedi).

## 7. Biztonság és szabályok

- Új táblákra RLS: kliensről nincs olvasás/írás; minden művelet service_role függvényen át.
- Az árlista és a becsült költségek a szerveren (a modul regiszterében) vannak, a böngészőből nem módosíthatók.
- A foglalás elszámolása és az állapotváltás egy tranzakcióban; a használati napló csak hozzáfűzős.
- Titkos kulcs a böngészőben nincs; az API-kulcsok szerveroldaliak.

## 8. Modul-kalkuláció (állandó szabály)

Minden egyedi modulnál, amikor tervezzük vagy ajánlatot készítünk, Claude kalkulációt ad a **reális havi költségről**:
1. A modul műveletei és az egy műveletre jutó API-hívások (kép, videó, szöveg, kutatás).
2. A szolgáltatók **aktuális** árai (frissen utánanézve, forrással; az árak változnak, nem emlékezetből).
3. Árfolyam: 380 Ft/USD (jelezve, ha el kell térni).
4. Három forgatókönyv: alacsony, tipikus és magas havi használat; ráhagyás az újrapróbálásokra és a sikertelen hívásokra.
5. Egyéb költség: tárhely, e-mail, külső szolgáltatás, ha van.
6. Eredmény: reális havi önköltség, a javasolt `monthly_cap`, a havi díjban foglalt mennyiség, a pluszcsomag mérete és önköltsége.
7. A havi díjat és a pluszcsomag árát **Márk határozza meg**; a kalkuláció az alapot adja, nem árat dönt.
Ez az ajánlat-ellenőrző lista (D44) része; a mértékeket és küszöböket az első API-költséges modulnál töltjük ki `[KITÖLTENDŐ]`.

## 9. Ellenőrzési lista (a fejlesztés végére)

1. Két párhuzamos költséges kérés, amelyből csak egy fér a keretbe: pontosan egy indul el, a másik elutasul.
2. Ugyanaz a `request_key` kétszer: egy foglalás.
3. Hibás hívás: a foglalás feloldódik, a használat nem nő.
4. A tényleges költség túllépi a becslést: egyszer átengedett, a következő foglalás elutasul.
5. A küszöb-értesítés 80%-nál és 100%-nál havonta egyszer megy ki; új hónapban újra él; pluszcsomag után újraértékelődik.
6. Pluszcsomag: a keret-kiegészítés és a fizetési tétel egyszerre jön létre vagy egyik sem.
7. Hónap fordulóján (budapesti idő, nyári/téli váltás is) a használat nulláról indul; a pluszcsomag nem folyik át.
8. Elakadt (stale) foglalás feloldódik az időkorlát után.
9. Naplózási hiba esetén a költséges API-hívás nem indul el.
10. Cégvezetői és felhasználói fiókkal a keret és a használat nem látható; az RLS kliensről semmit nem enged.
11. A Telegram-üzenet nem tartalmaz személyes adatot; a csoportazonosító nincs a kódban.
12. A régi ingatlanos modulok pénztárcája és működése változatlan.
13. Lemondott vagy lezárt cég moduljánál a hatályos nap után nem indul új költséges művelet, és a függő foglalások feloldódnak (`21`).

## 10. Nyitott pontok

- ~~A fel nem használt keret nem vihető át~~ — eldöntve (Márk, 2026-11-23).
- ~~A pluszcsomag azonnal él, a fizetés utólag követett~~ — eldöntve (Márk, 2026-11-23).
- Az ügyfélnek mutatott szöveg a leállásnál (jóváhagyandó).
- A foglalás időkorlátja modulonként (a CODE a feladat hosszához igazítja).
- A modul-kalkuláció mintája (táblázat vagy szöveges lap) és a belső ajánlat-ellenőrző lista véglegesítése.
