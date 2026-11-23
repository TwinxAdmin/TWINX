# 21 – Modul lemondása, cég lezárása és a modul megőrzése (D54 terv)

Állapot: terv, 2026-11-23. Kódolás nincs, a CODE-prompt csak átadáskor készül.
Kapcsolódó: `14-adatmodell-terv.md` (`companies`, `company_modules`, `company_members`, `access_audit_log`), `19-dijak-es-fizetes-terv.md` (fizetési tételek), `20-plafon-es-hasznalat-terv.md` (foglalások), `17-adatkezelesi-tajekoztato-vazlat.md` (megőrzés, törlés), `12-admin-terv.md` (modul-regiszter).

## 1. Döntések (Márk, 2026-11-23)

- **Lemondás hatálya: a kifizetett időszak végéig.** A modul a `valid_until` napjáig működik, utána a meglévő lejárati szabály zár le mindent.
- **A lemondást csak az admin rögzítheti** az első fázisban (az ügyfél e-mailben vagy telefonon jelzi). A cégvezetői „Lemondás kérése" gomb később, **Hamarosan** jelzéssel.
- **Cég lezárása: archiválás adatminimalizálással,** nem törlés.
- **Alapelv: a lefejlesztett modul soha nem vész el a rendszerünkből.** Lehet, hogy később mi magunk találunk egy modult és azt értékesítjük, vagy egy cég megmondja, mit fejlesszünk neki (lásd 2. szakasz).
- **A modul tulajdonjogát és az újrahasznosíthatóságot a szerződés dönti el** (Márk döntése); a rendszerben a regiszter `reuse` jelölése tükrözi a szerződést.
- **Az ügyféladat megőrzése és törlése:** Márk elfogadta a javaslatot (archiválás; az ügyféladat törlése vagy visszaadása az NDA és az adatfeldolgozói szerződés szerinti határidőn belül). A határidő napjainak száma `[KITÖLTENDŐ]` az NDA-sablonnal együtt.
- **Újraaktiválás:** az admin visszaállíthatja a lemondott modult vagy a lezárt céget a megőrzési határidőn belül, az Aktiválás szabályaival (Márk elfogadta).
- **Kézi törlés: kétlépéses védelem + admin jóváhagyás** (Márk döntése): a törlést az egyik admin kéri, egy **másik admin fiók hagyja jóvá** (5. szakasz).
- **Modulonként kötelező törlési és exportálási leírás** (Márk elfogadta): az Aktiválás feltétele (6. és 7. szakasz).

## 2. A modul megőrzése (alapelv)

Három külön réteg van, és csak a második és harmadik szűnhet meg egy lemondáskor vagy lezáráskor:

| Réteg | Mi ez | Lemondáskor / lezáráskor |
|---|---|---|
| **1. A modul maga** | a kód (a repóban) és a **regiszter-bejegyzés** | **soha nem törlődik.** A modul az adott cégtől „visszavonódik", de a kód és a regiszter megmarad. |
| **2. A cég hozzárendelése** | a `company_modules` sor (állapot, helyek, érvényesség) | lemondott állapotba kerül, a sor és a története megmarad (archívum) |
| **3. Az ügyfél adata** | az ügyfél feltöltött anyaga, a nála futó modul kimenetei, a cég-specifikus beállítás | törlés vagy visszaadás a megőrzési határidő szerint (NDA, adatfeldolgozói szerződés) |

**Szabály a CODE-nak:**
- Lemondás vagy lezárás **soha nem töröl kódot, regiszter-bejegyzést vagy modul-konfigurációt**; csak a cég-hozzárendelést és az ügyféladatot érinti.
- A kód **nem tartalmazhat cég-specifikus titkot vagy adatot**: a cég-specifikus beállítás az adatbázisban él, a `company_id`-hoz kötve, így a modul általánosítható és másik cégnek is adható. Egy cég titkos üzleti szabálya, promptja vagy adata sem kerülhet a közös kódba; ami mégis cég-specifikus, azt a regiszterben jelölni kell.
- Egy modul **több cégnek is adható** (a `company_modules` egyedisége a `company_id` + `module_key` párra szól, így ez már most működik).

**A regiszter bővítése (a kódban, nem adatbázis-migráció):** minden bejegyzéshez
- `data_policy` (**kötelező az Aktiváláshoz**): `stores_customer_data` (igen/nem); ha igen, az **exportálás** és a **törlés** leírása és a hozzájuk tartozó szerveroldali művelet (mely táblák, mely tárhely-mappák, milyen formátumban jön az export); ha a modul nem tárol ügyféladatot, ezt kifejezetten ki kell mondani;
- `origin`: `ugyfel_megrendeles` (a cég mondta meg, mit fejlesszünk) vagy `sajat_otlet` (mi találtuk, és mi értékesítjük);
- `reuse`: `ujrahasznosithato` · `csak_az_ugyfelnek` · `ugyfel_engedelyevel`;
- `catalog_status`: `fejlesztes_alatt` · `ertekesitheto` · `archivalt` (az `archivalt` modul nem rendelhető új cégnek, de a kód megmarad, és újra előhozható).

**Újrahasznosítás ellenőrzése (mielőtt egy ügyfélre készült modult másnak is adunk):** (1) a szerződés engedi-e (tulajdon, kizárólagosság); (2) nincs-e benne az ügyfél titkos adata vagy szabálya; (3) általánosítva van-e (a cég-specifikus rész a konfigurációba került); (4) kell-e az ügyfél engedélye.

**Modul-katalógus az adminban (Hamarosan):** minden modul egy helyen (eredet, állapot, mely cégeknél fut). Az első fázisban az Egyedi modulok lap és a regiszter elég.

**Jogi pont (döntve: a szerződés dönti el; a sablon még nyitott):** egy ügyfél megrendelésére készült modul **kinek a vagyona**, mikor adható másnak, és megőrizhetjük-e archív másolatként, azt a szerződés határozza meg; **modulonként** más lehet. A regiszter `reuse` jelölését a szerződés szerint kell kitölteni, és az ajánlat-ellenőrző listának tartalmaznia kell a kérdést. Az ügyfél titkos adata és üzleti szabálya semmilyen esetben nem kerül újrahasznosításra. Javaslat a sablonhoz (a jogász véleményezi): a TWINX marad a kód tulajdonosa, az ügyfél használati jogot kap; kizárólagosság csak kifejezett megállapodással és külön áron. `[JOGÁSZ: szerződés- és ajánlat-sablon]`

## 3. Modul lemondása (a cég marad)

**Folyamat:** az admin a Cég oldalán a modul „⋯" menüjében a **Lemondás rögzítése** műveletet futtatja: megadja a dátumot (alapból a `valid_until`, a kifizetett időszak vége) és az indokot.

**Állapot:**
- A lemondás rögzítésekor a `company_modules.state` **nem változik azonnal:** a modul `aktiv` marad a hatályos napig, mert a hozzáférést az érvényesség dátuma szabja meg (D47: a lejárat nem függ időzített feladattól).
- Új mezők: `cancel_requested_at`, `cancel_effective_on` (alapból = `valid_until`), `cancel_reason`.
- A hatályos nap után a rendrakás `lemondva` állapotra állítja a modult; a hozzáférés ekkor már a dátum miatt megszűnt.

**A lemondás rögzítésének pillanatában:**
- Új meghívó nem küldhető, új „Használom én is" nem adható (a függvények ellenőrzik a `cancel_requested_at` mezőt).
- A **nyitott meghívók visszavonódnak**, a helyek felszabadulnak.
- A meglévő hozzáférések a hatályos napig működnek, utána megszűnnek.
- A lejárati figyelmeztetés (3 és 1 nap) a lemondott modulról **nem** megy ki.
- Havi díj **új tétel nem keletkezik**; a „Fizetve" a lemondott modulnál nem hosszabbít érvényességet.
- A használati keretben a lefoglalt, el nem számolt foglalások a hatályos nap után feloldódnak; új foglalás a hatályos nap után nem indulhat.
- A **nyitott (Esedékes / Kiszámlázva) fizetési tételek nem törlődnek maguktól:** az admin dönt (behajtja, vagy indoklással törli).
- Visszatérítés nincs automatikusan; ha lesz, kézi tétel a `19` szerint.

**Naplózás:** `modul_lemondva` (ki, mikor, hatályos nap, indok), `modul_lemondas_hatalyba_lepett`.

## 4. Cég lezárása (archiválás)

**Előfeltétel:** a cég minden modulja `lemondva` állapotban van (vagy az admin kifejezetten **azonnali lezárást** választ indoklással és megerősítéssel; ilyenkor a megmaradt kifizetett időszak elvész, erre a felület figyelmeztet).

**Lezáráskor (egy tranzakcióban):**
- `companies.status` → `lezart`; `closed_at`, `closed_reason`, `data_retention_until` (a megőrzési határidő; amíg nincs eldöntve, üresen marad, és az admin felületen jelzi).
- A tagok `company_members` sora `eltavolitva` lesz, a felhasználók **„Besorolatlan"** állapotba kerülnek. A felhasználó fiókját **nem töröljük**, a saját munkái nála maradnak (D46).
- Minden nyitott meghívó visszavonódik; minden hozzáférés megszűnik.
- Az utolsó cégvezetőt védő adatbázis-trigger **lezárt (vagy lezáródó) cégnél átengedi** a státuszváltást (különben a lezárás elakadna).
- A cég és a modul-hozzárendelések sorai **megmaradnak** (archívum), a fizetési és számviteli adatok (tételek, számlaszámok) **megmaradnak**; a megőrzési időt a könyvelő és a jogász adja meg `[ELLENŐRIZENDŐ]`.
- A nyitott fizetési tételek a Pénzügy listában **„Lezárt cég nyitott tétele"** címkét kapnak.
- Az audit napló bejegyzései megmaradnak; a személyes adatok (e-mail) a megőrzési határidő után **álnevesíthetők** (lásd `17`).

**Naplózás:** `ceg_lezarva`, `ceg_ujranyitva`.

**Tesztadat:** olyan cég, amelynek nincs fizetési tétele (pl. próbafoglalásból jött), az admin által **véglegesen törölhető** (megerősítéssel, naplóval); fizetési tétellel rendelkező cég csak archiválható.

## 5. Az ügyféladat törlése vagy visszaadása

**Első fázis: kézi művelet az adminban, jóváhagyással.** Az automatikus törlés a megőrzési határidő lejártakor **Hamarosan** (visszafordíthatatlan művelet, ezért emberi döntés marad).

**Visszaadás (export):** az admin végzi, a modul regiszter-leírása szerint, naplózva (`ugyfeladat_visszaadva`). Nem visszafordíthatatlan, ezért jóváhagyás nem kell. A formátum és az átadás módja modulonként más `[KITÖLTENDŐ modulonként]`.

**Törlés (kétlépéses védelem + jóváhagyás):**
1. **Kérés (admin A):** csak **lezárt** cégre. A gomb csak akkor aktív, ha a megőrzési határidő lejárt, vagy az admin indoklással a határidő előtt kéri (az ügyfél írásbeli kérésére). A kérésnél: (a) be kell írni a cég nevét; (b) be kell jelölni: „a megőrzési határidő lejárt, vagy az ügyfél írásban jóváhagyta; a visszaadás megtörtént vagy nem kell"; (c) indoklás. A kérés **nem töröl semmit**, csak státuszt kap (`kerve`).
2. **Jóváhagyás (admin B, nem a kérő fiók):** a jóváhagyó látja a kérés indokát, a cég nevét és **modulonkénti összefoglalót a törlendő adatról** (a regiszter `data_policy` alapján), és külön megerősíti. A kérő a saját kérését nem hagyhatja jóvá.
3. **Végrehajtás:** a jóváhagyás után a szerver modulonként lefuttatja a törlési műveletet (az adatbázisban nem fut kód a regiszterből, ezért az API végzi), és a végén lezárja a kérést. A törlés **idempotens és újrapróbálható** (ha egy modul törlése megáll, a kérés `reszben_vegrehajtva` marad, és újraindítható). A végén naplóbejegyzés összefoglalóval (mit töröltünk, mit nem).
4. **Értesítés:** a kérésről, a jóváhagyásról és a végrehajtásról Telegram-üzenet megy a közös beszélgetésbe (sima szöveg, személyes adat nélkül: cég neve, művelet, ki kérte / hagyta jóvá).

- A törlés **csak a 3. réteget** érinti (az ügyfél adata és kimenetei, a cég-specifikus beállítás); a modul kódjához, a regiszterhez és a számviteli adathoz nem nyúl.
- **A „másik admin fiók" szabály:** technikailag azt ellenőrzi, hogy a jóváhagyó azonosító különbözik a kérőétől. Mivel Márk két e-mail címmel két admin fiókot használ, a szabály szándéka szerint a **másik személy (Tibor)** hagyja jóvá; a felület ezt jelzi („a jóváhagyás célja a négy szem elv"). **Döntve (Márk, 2026-11-23): kijelölt jóváhagyók listája,** alapból Radics Tibor; a lista az adminban kezelhető (csak admin módosíthatja, naplózva), és a jóváhagyó mindig különbözik a kérőtől.
- **Mentések:** a Supabase biztonsági mentéseiben a törölt adat a mentés lejártáig még létezhet; ezt az adatkezelési tájékoztatóban (`17`) jelezni kell, és a jogásznak ellenőriznie kell.
- A törlés és a visszaadás határideje az NDA-ban és az adatfeldolgozói szerződésben szerepel `[JOGÁSZ]`.

## 6. Újraaktiválás (döntve)

- Az admin a **lemondott modult** vagy a **lezárt céget** a megőrzési határidőn belül visszaállíthatja. A modul az Aktiválás szabályain újra átmegy (állapot Átadva, érvényes előfizetés [új fizetés vagy ajánlat], aktív cégvezető, API-költséges modulnál plafon, **és a regiszterben szerepel a `data_policy`**).
- A tagokat **újra meg kell hívni**, automatikusan nem kapnak vissza hozzáférést. A visszaadott vagy törölt ügyféladat nem áll vissza.
- A határidő után, vagy ha az ügyféladatot már töröltük, a cég új cégként indul (az archívum megmarad); a törölt adat nem állítható vissza.
- A visszaállítás naplózott (`ceg_ujranyitva`, `modul_ujraaktivalva`).

## 7. Adatmodell (additív, D51 szerint)

- `companies`: új oszlopok `closed_at` (timestamptz, null), `closed_reason` (text, null), `data_retention_until` (date, null). A `status` értékei változatlanok (`aktiv`, `szunetel`, `lezart`).
- `company_modules`: új oszlopok `cancel_requested_at` (timestamptz, null), `cancel_effective_on` (date, null), `cancel_reason` (text, null).
- **Új tábla `customer_data_requests`** (csak hozzáfűzés a naplózás miatt, állapot-váltással): id, company_id, mode (`torles`), status (`kerve` · `jovahagyva` · `elutasitva` · `visszavonva` · `reszben_vegrehajtva` · `vegrehajtva`), reason, requested_by, requested_at, approved_by, approved_at, rejected_reason, executed_at, result_summary (jsonb: modulonként mit töröltünk és mit nem; **nem tartalmaz ügyféladatot**).
- `access_audit_log` új események: `modul_lemondva`, `modul_lemondas_hatalyba_lepett`, `ceg_lezarva`, `ceg_ujranyitva`, `modul_ujraaktivalva`, `ugyfeladat_torles_kerve`, `ugyfeladat_torles_jovahagyva`, `ugyfeladat_torles_elutasitva`, `ugyfeladat_torolve`, `ugyfeladat_visszaadva`, `ceg_veglegesen_torolve`.
- A modul-regiszter bővítése a kódban (2. szakasz), adatbázis-változás nélkül.

**Függvények (security definer, csak service_role, egy tranzakcióban, naplóval):**
- `cancel_company_module(company_module_id, effective_on, reason, actor)`: admin; rögzít, visszavonja a nyitott meghívókat, felszabadítja a helyeket.
- `finalize_cancelled_modules()`: rendrakás; a hatályos nap után `lemondva` állapotra állít, feloldja a le nem zárt foglalásokat. A hozzáférés nem ettől függ.
- `close_company(company_id, reason, force, actor)`: admin; előfeltétel-ellenőrzés (minden modul `lemondva`, vagy `force` indoklással), a 4. szakasz szerint.
- `reopen_company_module(company_module_id, actor)` és `reopen_company(company_id, actor)`: admin; az Aktiválás szabályaival. **Az `activate_company_module` új feltétele:** a modul regiszter-bejegyzésében szerepel a `data_policy` (ezt az API-végpont ellenőrzi, mint a regiszter-bejegyzés meglétét).
- `request_customer_data_deletion(company_id, reason, confirm_name, actor)`: admin; csak lezárt cégre, a határidő-feltétellel (vagy indoklással a határidő előtt); létrehozza a `kerve` kérést.
- Új tábla `deletion_approvers` (user_id, added_by, added_at, active); csak admin kezeli, naplózva.
- `approve_customer_data_deletion(request_id, actor)` és `reject_customer_data_deletion(request_id, reason, actor)`: admin; **a jóváhagyó szerepel a `deletion_approvers` listában, és nem lehet a kérő**; a státusz `jovahagyva` / `elutasitva`.
- `complete_customer_data_deletion(request_id, result_summary, partial)`: a szerver hívja a modulonkénti törlés után; `vegrehajtva` vagy `reszben_vegrehajtva`.
- `record_customer_data_export(company_id, module_key, actor)`: az exportálás naplózása.
- `delete_company_permanently(company_id, actor)`: admin; csak ha nincs fizetési tétel.

## 8. Admin felület

- **Cég oldala, „⋯" menü:** Modul lemondása (a modul soránál), Cég lezárása, Újranyitás, Ügyféladatok visszaadása, Ügyféladatok törlésének kérése, Végleges törlés (csak fizetési tétel nélküli cégnél).
- **Jóváhagyások** (az admin felületen, pl. az Eszközök vagy a Cégek lapon egy fix helyű jelzéssel): a függő törlési kérések listája jóváhagyás és elutasítás gombbal; a kérő a sajátját nem hagyhatja jóvá.
- Állapotcímkék: „Lemondva [hatályos nap]", „Lezárt cég"; a lemondott modul sora halványabb, de olvasható; a doboz mérete nem változik.
- A lezárt cég a listában alapból rejtve, szűrővel előhozható (nem ugrál a lista).
- **Hamarosan:** cégvezetői „Lemondás kérése" gomb; automatikus törlés a megőrzési határidő után; Modul-katalógus nézet.
- A cégvezető és a felhasználó a lemondásról és a lezárásról **csak a hozzáférés megszűnését** látja (a szöveg jóváhagyandó, `[KITÖLTENDŐ]`); belső indokot, pénzügyi adatot nem.

## 9. Ellenőrzési lista (a fejlesztés végére)

1. Lemondás rögzítése után a modul a `valid_until` napig működik, utána minden felhasználótól megszűnik; a sorok módosítása nélkül.
2. A lemondás pillanatában a nyitott meghívók visszavonódnak, a helyek felszabadulnak; új meghívó és „Használom én is" elutasított.
3. Lemondott modulnál: nincs lejárati figyelmeztetés, a „Fizetve" nem hosszabbít, új havi tétel nem keletkezik.
4. A lefoglalt, el nem számolt használati foglalások a hatályos nap után feloldódnak; új foglalás nem indul.
5. Lezárás: ha van nem lemondott modul, `force` nélkül elutasított; `force`-szal indoklás kell, és a felület figyelmeztet.
6. Lezáráskor a tagok eltávolítódnak, a felhasználók „Besorolatlan" állapotba kerülnek, a fiókjuk és a munkáik megmaradnak; az utolsó cégvezetőt védő trigger nem akadályozza a lezárást, de normál (nem lezárási) úton továbbra is véd.
7. **A modul kódja és regiszter-bejegyzése lemondás és lezárás után is megvan;** ugyanaz a modul egy másik cégnek rendelhető.
8. Fizetési tétellel rendelkező cég nem törölhető véglegesen; a nyitott tétel „Lezárt cég nyitott tétele" címkét kap.
9. Az ügyféladat törlése a kódhoz, a regiszterhez és a számviteli adathoz nem nyúl; naplózott és kétlépéses.
9/a. Törlés kérése csak lezárt cégre engedett; a cég nevének beírása és a jelölőnégyzet nélkül a gomb inaktív; a kérés önmagában nem töröl.
9/b. A kérő a saját kérését nem hagyhatja jóvá (a másik admin fiók igen); jóváhagyás nélkül nem fut le semmi; elutasított kérés nem hajtható végre.
9/c. Ha egy modul törlése megáll, a kérés `reszben_vegrehajtva` marad, újraindítható, és a már törölt részek nem okoznak hibát (idempotens).
9/d. **Aktiválás `data_policy` nélkül elutasított;** a „nem tárol ügyféladatot" kijelentés is megfelel.
9/e. A Telegram-üzenet a kérésről és a jóváhagyásról nem tartalmaz személyes adatot.
10. Újraaktiválás: az Aktiválás szabályai újra érvényesek; a tagok nem kapnak vissza automatikusan hozzáférést.
11. Cégvezetői és felhasználói fiókkal a lemondási indok és a pénzügyi adat nem látható.
12. A régi ingatlanos modulok, az irodai fiók és a pénztár változatlanul működnek.

## 10. Nyitott pontok

- **A lezárt cég ügyféladatainak megőrzési határideje** (napok száma): az NDA-val és az adatfeldolgozói szerződéssel együtt. `[KITÖLTENDŐ]`
- **Tulajdon és kizárólagosság:** a szerződés dönti el (döntve); a szerződés- és ajánlat-sablon még hiányzik. `[JOGÁSZ + Márk]`
- A számviteli megőrzési idő pontos értéke. `[KÖNYVELŐ/JOGÁSZ]`
- A visszaadás formája modulonként.
- A felhasználónak mutatott szöveg a hozzáférés megszűnésekor.
- ~~Kijelölt jóváhagyók listája~~ — eldöntve: kijelölt lista, alapból Tibor.
- A mentések és a törlés kapcsolata az adatkezelési tájékoztatóban. `[JOGÁSZ]`
- ~~Az újraaktiválás és a kézi törlés szabálya~~ — eldöntve (Márk, 2026-11-23).
