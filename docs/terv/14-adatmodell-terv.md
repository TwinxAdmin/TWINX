# TWINX adatmodell — Cég, cég-tagság, modulok, hozzáférés, meghívó, napló (D47, kiegészítve D48–D56)

> **Státusz:** terv, 2026-11-23. A `12` és a `13` szabályait fordítja adatbázis-tervre; ebből készül a 3–4. CODE-prompt (amikor Márk átadja).
> **Döntések (D47, Márk 2026-11-23):** (1) **új, külön táblák, az `offices` érintetlen**; (2) az egyedi modult **szöveges regiszter-kulcs azonosítja a kódból**, nincs hozzá sor a `services` táblában; (3) **az Ingatlan csomag hozzáférése marad a `company_access` + `services`**, később külön döntés, hogy beolvasztjuk-e; (4) **a mostani 3 `admin` marad** (Márk két e-mail címmel és Tibi); (5) a mostani felhasználók **háttérbe kerülnek, nem töröljük őket**, és semmi nem épül rájuk.
> **Kiegészítések (D48–D53):** a foglalás táblái a `15`-ben, az ajánlat- és fizetési táblák a `19`-ben, a plafon- és használati táblák a `20`-ban, a lemondás, lezárás és ügyféladat-törlés táblái és oszlopai a `21`-ben, az átadási bejegyzés táblája a `23`-ban vannak; a 2.7 szakasz összefoglalja őket, és a migráció sorrendjét az 5. szakasz adja. Az **Aktiválás új feltételei:** legalább egy aktív cégvezető (D46 kiegészítés), és a modul regiszter-bejegyzésében szerepel a `data_policy` (D54; az API-végpont ellenőrzi), és a modulnak van érvényes átadási bejegyzése (D56). A migrációkra a **D51** szabályai érvényesek (additív, visszafordítható, mentés előtte, down szkript, admin-only bekapcsolás).
> **Projekt:** Supabase „Website Twinx" (`ucsxbtfbjhkxtkfebktm`). Az ügynökség adatbázisa (`twinx-agents`) külön marad.
> **Nyelv:** magyar; az állapotkódok ékezet nélküli, kisbetűs szövegek.

---

## 1. Az éles séma (2026-11-23-i állapot), ami érinti a tervet

- `profiles.role`: **3 admin, 2 sales, 33 user.** A `sales` megszűnik (D44). A szerepkört a `profiles_guard_role_trg` védi (csak szerveroldal módosíthatja).
- `company_access` (felhasználó × szolgáltatás, 0 sor) és `services` (1 sor: „Ingatlan", `real-estate`): az **Ingatlan csomag** hozzáférése. **Nem nyúlunk hozzá.** A neve megtévesztő, de nem Cég.
- `offices`, `office_members`, `office_*`: az irodai fiók (2 iroda). **Érintetlen.** A Cég és az irodai fiók két külön fogalom (D35).
- `leads` (3 sor): a régi kapcsolatfelvétel, történeti marad. Az új foglalás külön táblákat kap (külön téma, 2. CODE-prompt).
- `profiles.company`: szabad szöveg, **nem kapcsolat**; az új modell nem használja.
- Pénztár-táblák (`wallets`, `credit_*`, `usage_history`, `api_cost_logs`): érintetlenek, láthatatlanul működnek tovább.
- A „Besorolatlan" nem külön mező: **`role = user` és nincs aktív sora a `company_members` táblában.**

## 2. Táblák (mind a `public` sémában, mindegyiken RLS be van kapcsolva)

### 2.1 `companies` — a mi ügyfélnyilvántartásunk
| Oszlop | Típus | Megjegyzés |
|---|---|---|
| `id` | uuid, PK | |
| `name` | text, kötelező | a cég neve |
| `status` | text | `aktiv` · `szunetel` · `lezart` |
| `booking_id` | uuid, null | a foglalásra mutat, ha abból jött létre; **az FK a `bookings` táblával (`15`) együtt kerül be** (addig az oszlop FK nélkül, üresen marad) |
| `billing_name`, `billing_tax_number`, `billing_address`, `billing_email` | text, null | számlázási adatok (D52); a cégalapítás és a könyvelővel egyeztetett végleges mezőkör után töltendők; a fizetési tétel a rögzítéskor pillanatképet (`billing_snapshot`) menti belőlük |
| `closed_at`, `closed_reason`, `data_retention_until` | timestamptz / text / date, null | a lezárás ideje, indoka és az ügyféladat megőrzési határideje (D54; a határidő addig üres, amíg a napok száma nincs eldöntve) |
| `note` | text, null | **csak követési megjegyzés, titkos (NDA) ügyféladat nem** |
| `created_by` | uuid | az admin, aki létrehozta |
| `created_at`, `updated_at` | timestamptz | |

### 2.2 `company_members` — cég-tagság és a cégvezetői státusz (D46)
| Oszlop | Típus | Megjegyzés |
|---|---|---|
| `company_id` | uuid, FK `companies` | |
| `user_id` | uuid, FK `auth.users` | |
| `is_company_head` | boolean, alapból `false` | **ez a cégvezetői státusz, cégenként** |
| `status` | text | `aktiv` · `eltavolitva` |
| `joined_via` | text | `admin` · `invitation` |
| `joined_at`, `removed_at` | timestamptz | |

- **Elsődleges kulcs:** (`company_id`, `user_id`). Egy felhasználó több cégben is lehet (megerősítendő alapértelmezés).
- **Index:** részleges, az aktív cégvezetőkre (`company_id` ahol `is_company_head` és `status = 'aktiv'`).
- **Védelem az utolsó cégvezetőre (adatbázis-szinten is):** `BEFORE DELETE/UPDATE` trigger, amely megtagadja azt a törlést vagy módosítást, amely után egy `aktiv` státuszú cégnek nem maradna aktív cégvezetője. A trigger **átengedi,** ha a cég már nem létezik (cég törlésekor a kaszkád ne akadjon el), és ha a cég **lezárása** folyamatban van vagy már `lezart` (D54: különben a lezárás elakadna). Ez véd a felhasználó törlése ellen is: az admin hibaüzenetet kap, és előbb kinevez másik cégvezetőt.

### 2.3 `company_modules` — cég × egyedi modul (az Egyedi modulok lap és az előfizetés magja)
| Oszlop | Típus | Megjegyzés |
|---|---|---|
| `id` | uuid, PK | |
| `company_id` | uuid, FK `companies` | |
| `module_key` | text | **a kód regiszterének kulcsa** (pl. `szerzodes-ellenorzo`); nincs hozzá `services` sor |
| `state` | text | `felmeres` · `ajanlat` · `fejlesztes` · `teszt` · `atadva` · `aktiv` · `szunetel` · `lemondva` (D43) |
| `owner_admin_id` | uuid, null | a felelős admin (Márk vagy Tibi) |
| `seats` | integer, alapból 0, ≥ 0 | a hely-keret (az előfizetés), **csak admin állítja** |
| `valid_until` | date, null | az előfizetés érvényessége, csak admin állítja |
| `is_api_costly` | boolean | kép/videó/kutatás jellegű modul |
| `monthly_cap` | integer, null | a láthatatlan havi plafon, **forintban, nettó önköltségben** (D53); az értékét az első API-költséges modulnál, a modul-kalkulációval határozzuk meg |
| `usage_unit_label` | text, null | az egység neve az admin felületen (pl. „kép", „videó") (D53) |
| `included_units` | integer, null | a havi díjban foglalt mennyiség (D53) |
| `extra_pack_units`, `extra_pack_cost_cap_ft`, `extra_pack_price_net` | integer, null | a pluszcsomag mérete, a hozzá tartozó keret-kiegészítés (Ft) és a nettó ára (D53) |
| `cancel_requested_at`, `cancel_effective_on`, `cancel_reason` | timestamptz / date / text, null | a lemondás rögzítése és hatályos napja (alapból = `valid_until`); a `state` a hatályos napig `aktiv` marad (D54) |
| `activated_at`, `activated_by` | timestamptz, uuid | |
| `note` | text, null | követési megjegyzés, NDA-adat nem |
| `created_at`, `updated_at` | timestamptz | |

- **Egyedi:** (`company_id`, `module_key`).
- **Aktiválás (D43, D44), adatbázis-függvényben:** csak admin; az állapot `atadva`; az előfizetés érvényes (`valid_until` ≥ ma); **a modulnak van `ervenyes` átadási bejegyzése a `module_handovers` táblában** (D56; az `atadva` állapotba csak a `record_handover` léptethet); ha `is_api_costly`, a `monthly_cap` kötelezően ki van töltve; **a cégnek van legalább egy aktív cégvezetője** (`company_members`: `is_company_head` és `status = 'aktiv'`). **Azt, hogy a `module_key` szerepel-e a kód regiszterében, és hogy a bejegyzésben van-e `data_policy` (törlési és exportálási leírás), az API-végpont ellenőrzi** (az adatbázis nem látja a kódot).
- **Állapotváltás-napló:** minden állapotváltás a `access_audit_log`-ba kerül (lásd 2.6), dátummal; az Egyedi modulok lap kibontható sora ebből mutatja a történetet.

### 2.4 `module_invitations` — meghívók (D46)
| Oszlop | Típus | Megjegyzés |
|---|---|---|
| `id` | uuid, PK | |
| `company_id`, `module_key` | | FK a `company_modules` (`company_id`, `module_key`) párjára |
| `email` | text | kisbetűsítve, csak ellenőrzött formátumban |
| `token_hash` | text, egyedi | **a token hash-e**; a nyers token csak az e-mailben él, sehol nincs eltárolva |
| `invited_by` | uuid | a meghívó cégvezető |
| `status` | text | `meghivva` · `elfogadva` · `lejart` · `visszavonva` |
| `expires_at` | timestamptz | alapból 7 nap |
| `accepted_by`, `accepted_at` | uuid, timestamptz | |
| `last_sent_at`, `resend_count` | timestamptz, integer | az újraküldés korlátozásához |
| `created_at` | timestamptz | |

- **Egyedi, részleges:** (`company_id`, `module_key`, `email`) ahol `status = 'meghivva'` (egy címre egy nyitott meghívó).
- **A kliens nem olvashatja a `token_hash` oszlopot** (oszlop-jogosultság vagy nézet).
- **A lejárat nem függ időzített feladattól:** a hely-számítás az `expires_at > now()` feltételt használja, a `lejart` státuszt csak a rendrakás állítja be.

### 2.5 `module_access` — ki használhatja a modult (D46)
| Oszlop | Típus | Megjegyzés |
|---|---|---|
| `id` | uuid, PK | |
| `company_id`, `module_key` | | FK a `company_modules` párjára |
| `user_id` | uuid, FK `auth.users` | |
| `status` | text | `aktiv` · `eltavolitva` |
| `granted_via` | text | `invitation` · `head_self` („Használom én is") · `admin` |
| `invitation_id` | uuid, null | |
| `granted_at`, `removed_at`, `removed_by` | | |

- **Egyedi, részleges:** (`company_id`, `module_key`, `user_id`) ahol `status = 'aktiv'`.
- **Helyszámítás (egyetlen szabály, csak szerveroldali függvényben):**
  `foglalt = aktív module_access sorok + nem lejárt, meghivva státuszú meghívók`; **`foglalt ≤ seats`** mindig.
- **A modul tényleges elérhetősége egy felhasználónak** (a `user_has_module_access` függvény, ezt használja az RLS és az API is): van `aktiv` `module_access` sora, **és** aktív a cég-tagsága, **és** a `company_modules.state = 'aktiv'`, **és** `valid_until` ≥ ma. Lejáratkor ezért **mindenkitől egyszerre** megszűnik a hozzáférés, a sorok módosítása nélkül.

### 2.6 `access_audit_log` — naplózás (csak hozzáfűzhető)
| Oszlop | Típus | Megjegyzés |
|---|---|---|
| `id` | bigserial, PK | |
| `at` | timestamptz | |
| `actor_id` | uuid, null | ki végezte |
| `action` | text | lásd lent |
| `company_id`, `module_key` | null | |
| `target_user_id`, `target_email` | null | kit érint |
| `details` | jsonb | **sosem tartalmaz tokent vagy titkot** |

- **Események:** `meghivva`, `meghivo_ujrakuldve`, `meghivo_visszavonva`, `meghivo_lejart`, `meghivo_elfogadva`, `hozzaferes_megadva` (köztük „használom én is"), `hozzaferes_eltavolitva`, `cegvezeto_kinevezve`, `cegvezeto_lemondott`, `cegvezeto_elveve`, `helyek_modositva`, `ervenyesseg_modositva`, `modul_allapot_valtozott`, `modul_aktivalva`, `modul_kikapcsolva`, `admin_jog_adva`, `admin_jog_elveve`; a `21` új eseményei (D54): `modul_lemondva`, `modul_lemondas_hatalyba_lepett`, `ceg_lezarva`, `ceg_ujranyitva`, `modul_ujraaktivalva`, `ugyfeladat_torles_kerve`, `ugyfeladat_torles_jovahagyva`, `ugyfeladat_torles_elutasitva`, `ugyfeladat_torolve`, `ugyfeladat_visszaadva`, `ceg_veglegesen_torolve`; a `23` új eseményei (D56): `atadas_rogzitve`, `atadas_felulirva`, `atadas_visszavonva`.
- **Csak hozzáfűzhető:** nincs UPDATE és DELETE jogosultság, és egy trigger is megtiltja. Az adatvédelmi törlési kérések kezelése külön szabály (a `target_email` álnevesítése), lásd a 6. szakaszt.

### 2.7 További táblák (külön tervekben, additívak)

| Terv | Táblák | Megjegyzés |
|---|---|---|
| `15` (D48) | `availability_templates`, `availability_slots`, `bookings` | foglalás és időpontok; a `leads` érintetlen; `companies.booking_id` FK |
| `19` (D52) | `company_quotes`, `company_payments`, `expiry_notifications` | ajánlat, fizetési napló, lejárati értesítések; csak admin látja |
| `20` (D53) | `module_usage_events`, `module_cap_adjustments`, `cap_notifications` | használat-napló (foglalás/elszámolás), keret-kiegészítés (pluszcsomag), küszöb-értesítések |
| `21` (D54) | `customer_data_requests`, `deletion_approvers`; új oszlopok a `companies` és a `company_modules` táblán | az ügyféladat törlésének kérése és jóváhagyása, a kijelölt jóváhagyók listája; lemondás- és lezárás-mezők; csak admin látja |
| `23` (D56) | `module_handovers` | az átadási bejegyzés (elfogadó, mód, dátum, mit kapott); csak hozzáfűzés állapot-váltással; csak admin látja |

Mindegyik tábla ugyanazt a mintát követi: RLS be, **kliensről nincs írás**, minden művelet `security definer` függvényen át (csak `service_role`), állapotváltás és pénzügyi művelet egy tranzakcióban, naplózás.

## 3. Szerveroldali függvények (minden írás ezeken keresztül megy, egy tranzakcióban)

> **Minta:** `security definer`, rögzített `search_path`, **csak a `service_role` hívhatja** (nincs `anon`/`authenticated` végrehajtási jog). Az API-végpont a **munkamenetből** azonosítja a felhasználót, ellenőrzi a jogát, és a függvénynek **átadja az azonosítót** (`p_actor`). A felhasználó azonosítóját a böngészőből soha nem fogadjuk el.

| Függvény | Ki hívhatja | Mit ellenőriz (zárolással, egy tranzakcióban) |
|---|---|---|
| `create_invitation` | cégvezető (az adott cégben) | a hívó aktív cégvezető **ebben a cégben**; a modul `aktiv` és az előfizetés érvényes; a `company_modules` sor zárolása után `foglalt < seats`; küldési korlát; a token-hash beszúrása |
| `resend_invitation` | cégvezető | új token-hash, új lejárat, korlát (a régi link érvénytelen) |
| `revoke_invitation` | cégvezető | státusz `visszavonva`, a hely felszabadul |
| `accept_invitation` | a belépett meghívott (a végpont azonosítja) | token-hash egyezik; státusz `meghivva`, nem lejárt; **a felhasználó e-mail címe megerősített és megegyezik a meghívottéval**; a modul még `aktiv` és érvényes (különben a hozzáférés **nem** aktiválódik, hibakóddal); cég-tagság létrehozása (ha még nincs), `module_access` sor, a meghívó `elfogadva`; napló |
| `add_self_access` („Használom én is") | cégvezető | `foglalt < seats`, aktív modul; `granted_via = head_self` |
| `remove_access` | cégvezető (a cégében) vagy admin; a cégvezető a saját hozzáférését is megszüntetheti | státusz `eltavolitva`, **a hely azonnal felszabadul**; a munkák a felhasználónál maradnak |
| `appoint_head` | admin, vagy a cég cégvezetője | a célszemély a cég **aktív tagja**; napló; (értesítést az API küld) |
| `resign_head` | csak saját magára | a cég cégvezetőinek **zárolása**, és csak akkor engedett, ha marad másik aktív cégvezető |
| `admin_remove_head` | csak admin | ugyanaz a védelem: marad legalább egy cégvezető |
| `admin_set_seats`, `admin_set_valid_until`, `admin_set_module_state`, `activate_company_module`, `deactivate_company_module` | csak admin | a 2.3 szerinti feltételek (az Aktiválásnál az aktív cégvezető is); napló |
| `grant_admin_role`, `revoke_admin_role` | csak admin | az admin sorok zárolása; **az utolsó admin nem vehető le** (marad ≥ 1); napló. Kompatibilis a meglévő `profiles_guard_role_trg` védelemmel (ellenőrizendő a CODE-nak) |

A foglalás (`15`), a fizetés (`19`) és a plafon (`20`) függvényei ugyanezt a mintát követik, és a saját tervükben vannak felsorolva.

**Amit minden függvény elvégez:** naplósort ír (`access_audit_log`), és a hibát **kód + magyar üzenet** formában adja vissza (pl. `nincs_szabad_hely`, `utolso_cegvezeto`, `meghivo_lejart`, `modul_nem_aktiv`), hogy a felület érthető üzenetet mutasson.

## 4. Jogosultság (RLS) — összefoglaló

- **Írás: soha nem a böngészőből.** A táblákra nincs kliens-oldali INSERT/UPDATE/DELETE szabály; minden módosítás a 3. szakasz függvényein át megy.
- **`companies`:** az admin mindent; a cég aktív tagja a saját cégét olvashatja.
- **`company_members`:** az admin mindent; mindenki a saját sorát; a **cégvezető a cége összes sorát**.
- **`company_modules`:** az admin mindent; a cégvezető és a tag **csak a saját cége `aktiv` állapotú soraiban** (a fejlesztés alatti, nem aktivált modul **nem látható**, D44).
- **`module_invitations`:** az admin mindent; a cégvezető a saját cége meghívóit (a `token_hash` nélkül).
- **`module_access`:** az admin mindent; a felhasználó a saját sorait; a cégvezető a cége sorait.
- **A `19` és `20` táblái (ajánlat, fizetés, használat, keret):** csak az admin; a cégvezető és a felhasználó semmit nem lát (RLS és API is tiltja). A foglalás táblái (`15`) szintén csak adminnak olvashatók; a látogató csak az API-n át foglal.
- **`access_audit_log`:** az admin mindent; a cégvezető a **saját cége** sorait; mások semmit.
- **Az admin felület és a függvények az `admin` szerepkört szerveroldalon ellenőrzik** (D45). A cégvezetői státusz sosem emel admin joggá.
- **Admin előnézet (nézet-váltó):** a `resolveViewContext` a `user_has_module_access` függvényt használja a megjelenített felhasználóra, így az előnézet pontosan azt mutatja, amit ő látna; az előnézetben a beküldés blokkolt.

## 5. Átállítás (a bevezetés sorrendje; ez az ellenőrzési lépések alapja is)

1. **Csak új táblák és függvények** (additív migráció); a meglévő táblák nem módosulnak, kivéve a 3. lépést. Visszafordítható (a táblák elhagyhatók). **D51:** minden nagyobb migráció előtt mentés / időponthoz visszaállítás, ha a csomag engedi, előbb ideiglenes Supabase branchen kipróbálva; mindegyikhez down szkript; az új funkciók csak adminnak látszanak, amíg leellenőrizve nincsenek.
2. **Előbb csak olvasás:** a CODE megnézi, hol hivatkozik a kód és az RLS a `sales` szerepkörre.
3. **`sales` → `user`** a 2 érintett felhasználónál (a `profiles_guard_role_trg` szabályait betartva, szerveroldalon).
4. **A 3 admin marad** (Márk két fiókkal, Tibi). Az „utolsó admin" védelem ebből a háromból számol.
5. **A 33 mostani felhasználó nem kap céget:** „Besorolatlan"-ként a háttérben marad, semmi nem épül rájuk; törölni nem törlünk. Az ingatlan hozzáférésük és a pénztáruk változatlan.
6. **Az első cég és az első `company_modules` sor** az adminban jön létre, egy valódi foglalásból (D42); nincs próbaadat az éles rendszerben. Az első cégvezetőt az admin jelöli ki, mert az Aktiválás nélküle nem engedett.
7. **A migráció sorrendje:** (a) ez a terv (cég, tagság, modulok, hozzáférés, meghívó, napló); (b) foglalás (`15`); (c) ajánlat és fizetés (`19`); (d) plafon és használat (`20`); (e) lemondás, lezárás és ügyféladat-törlés (`21`); (f) átadási bejegyzés (`23`). Mindegyik külön, ellenőrzött lépés.

## 6. Ellenőrzési lépések (a CODE-prompt végére)

- **Párhuzamosság:** két egyszerre küldött meghívás az utolsó helyre → pontosan egy sikerül. Két cégvezető egyszerre mond le → pontosan egy sikerül. Két admin egyszerre veszi le egymást → pontosan egy sikerül.
- **Hely:** meghívás foglal; visszavonás, lejárat és eltávolítás azonnal felszabadít; a „Használom én is" is foglal.
- **Meghívó:** lejárt, visszavont, már elfogadott, hibás token és **más e-mail című** vagy **nem megerősített** fiók → elutasítás; az elfogadás után a link nem használható újra; **ugyanaz a válasz és levél regisztrált és nem regisztrált címre**.
- **Elérhetőség:** a modul nem `aktiv` vagy lejárt → a cég **minden** felhasználójától megszűnik a hozzáférés; az elfogadás utáni lejáratnál a hozzáférés nem aktiválódik.
- **Láthatóság (valódi felhasználói tokennel, nem admin kulccsal):** a cégvezető csak a saját cégét látja; a fejlesztés alatti modult nem; a `token_hash`-t nem; más cég napló-sorait nem; a sima user a cégvezetői adatokat nem.
- **Cégvezető:** nem nevezhető ki, aki nem aktív tag; a másét csak admin veheti el; az utolsó cégvezető felhasználójának törlése elutasított, érthető hibával.
- **Aktiválás:** cégvezető nélkül (nincs aktív cégvezető) az Aktiválás elutasított, érthető hibával; kinevezés után engedett.
- **Admin jog:** csak admin adhat; az utolsó nem vehető le; minden lépés a naplóban.
- **Napló:** minden esemény megjelenik; módosítani és törölni nem lehet; tokent nem tartalmaz.
- **Új táblák ellenőrzése:** a foglalás, a fizetés és a plafon saját ellenőrzési listái: `15`, 8. szakasz; `19`, 8. szakasz; `20`, 9. szakasz; `21`, 9. szakasz; `23`, 7. szakasz.
- **Meglévő működés:** az ingatlanos modulok, az irodai fiók, a pénztár és a Stripe-integráció változatlanul működnek.

## 7. Nyitott pontok

- **Megerősítendő alapértelmezések (D46-tal együtt):** egy felhasználó több cégben is lehet; a meghívó 7 napig érvényes; a külön meghívási jog megszűnik; az elfogadás utáni előfizetés-lejáratnál a hozzáférés nem aktiválódik.
- **Megerősítve (Márk, D47):** (a) ha egy felhasználó utolsó modul-hozzáférését is eltávolítják, **cég-tagja marad** (a cégvezető külön adhat újat); (b) ha a meghívó cégvezető később elveszíti a státuszát, **a már kiküldött meghívó érvényes marad** a lejáratig (a cégvezetők visszavonhatják).
- **A havi plafon értékei:** az első API-költséges modulnál, a modul-kalkulációval és az ajánlat-ellenőrző listával (D44, D53). A mértékegység eldőlt: forint, nettó önköltség.
- **Küldési korlát értéke** (meghívó/óra/cég) és az újraküldés korlátja.
- **E-mail küldési hiba:** javaslat: a meghívó létrejön és foglalja a helyet, a felületen „nem sikerült elküldeni, újraküldés" jelzés; a lejárat felszabadítja.
- **Adatvédelem:** a napló `target_email` mezőjének álnevesítése törlési kérésnél; megőrzési idő. Az adatkezelési tájékoztatóval együtt döntendő.
- ~~Foglalás-táblák~~ — kész: `15` (D48).
- ~~Cég lezárása és modul lemondása~~ — eldöntve (D54), terv: `21`; a kapcsolódó táblák és oszlopok a fenti 2.1, 2.2, 2.3, 2.6, 2.7 szakaszban. Hátravan: a megőrzési határidő napjai és a számviteli megőrzés (`17`, jogász).
- **Az Ingatlan csomag beolvasztása** az új modellbe: későbbi, külön döntés.
