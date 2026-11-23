# TWINX — ÁTADÁS a fejlesztési (Cowork) beszélgetésnek: az új vonal összefoglalója (D23–D57)

> **Mire való:** tájékoztatás, nem kódolási feladat. A fejlesztési beszélgetés megismeri, mi változik és miért, de **nem kezd el kódolni**, amíg Márk külön nem kéri. Márk egyes részeket maga fejleszthet vagy finomhangolhat.
> **Irányadó:** a részletes tervek (`claude/00`, `11`–`17`, `19`–`24`, `ai-ugynokseg/01`, `04`) **a D57-ig szinkronizáltak** (2026-11-23), és ütközésnél azok az irányadók; ez az összefoglaló áttekintés. Ha mégis eltérést találsz, kérdezz.
> **Frissítve:** 2026-11-23 (D57-ig).

---

## 1. Mi változik, egy bekezdésben

A TWINX **egyedi, cégre szabott modulok gyártója**, bármilyen cég számára. A kreditalapú eszköztár-modell megszűnik, a „kredit" szó kikerül a felületről. Az ingatlanos modulok **referenciák** (a GDN Mandala kollégái naponta használják), külön referencia-landingen mutatjuk be őket. Az út: **ingyenes felmérés (időpontfoglalás) → Cég létrehozása → egyedi modul fejlesztése → Aktiválás → Előfizetés → a cégvezető meghívja a kollégáit.** Árat nem közlünk, az ajánlat modulonként egyedi.

## 2. Teendők sorrendje (a CODE-promptokat Márk átadáskor kéri)

1. **Főoldal, új felső sáv, referencia-landing** (`11`).
2. **Foglalás és admin időpont-kezelés + e-mailek** (`15`, `16`). Előfeltétel az éles indításhoz: adatkezelési tájékoztató (`17`), Resend domain-hitelesítés.
3. **Új admin szerkezet, szerepkörök, kredit-kivezetés, láthatatlan plafon, nézet-váltó cég/felhasználó szerint, személyre szabott kezdőlap** (`12`).
4. **Adatmodell + előfizetés-kezelés 1. fázis + „Hozzáférések" + meghívás + Egyedi modulok lap és modul-regiszter** (`13`, `14`). Függés: a `companies.booking_id` a foglalás-táblára mutat, ezért a `15` táblái előbb vagy együtt jönnek.
5. **Ajánlat-, díj- és fizetés-követés + lejárati figyelmeztetés** (`19`).
6. **Havi plafon, használat-mérés, pluszcsomag** (`20`); az első API-költséges modulnál élesedik.
7. **Modul lemondása, cég lezárása, ügyféladat törlése/visszaadása** (`21`).
8. **Felhasználói szövegek** (`22`) és az **átadási bejegyzés** (`23`).
9. Később: Stripe-automatizmus és Számla Agent (2. fázis), az irodai fiók közös tere (3. fázis).

A migrációk sorrendje: `14` → `15` → `19` → `20` → `21` → `23`, mindegyik külön, ellenőrzött lépés (D51, lásd a 4. szakaszt).

## 3. Döntések területenként (röviden)

**Főoldal és navigáció (D34, D36–D38).** Rövid főoldal: hero „A te cégedre szabott modul.", Hogyan működik (3 lépés), Hol fut a modul (4 forma, az első „Ajánlott kezdés"), Irodai fiók sáv, referencia-előzetes, kapcsolatblokk, lábléc (office@twinx.hu). Felső sáv: „Ingyenes felmérés" kiemelt gomb; belépés után „Moduljaim" legördülő menü, az Irodai fiók mellett fix hely a későbbi értesítési jelzésnek. Referencia-landing: modulok munkafolyamat szerint csoportosítva; a **3D bejárás csak „Hamarosan" jelzéssel**, halványabb, nem kattintható kártyán; a Hirdetésből videó nem szerepel; nincs ár, kredit, kitalált szám vagy idézet. Tibi hitelesíti a csoportokat.

**Foglalás (D33, D37, D48; `15`, `16`).** Két lépés, fix doboz: időpont, utána adatok (kötelező: név, cég, e-mail, telefon, GDPR-pipa). Időpontok: heti sablon + „Sablon alkalmazása" (következő 4 hét konkrét sorai, soronként szerkeszthető); minden időpontnak gazdája van (Márk vagy Tibor); 45 perc alap; legkorábban 24 óra, legfeljebb 30 nap előre; Europe/Budapest. Egy e-mail címmel/telefonszámmal egy aktív foglalás; honeypot + sebességkorlát. Ha nincs időpont, visszahívási kérés. A visszaigazoló e-mailben „Lemondás" link (a megnyitás nem mond le, csak a gomb). A gazda az időpontban telefonon hív. Értesítés: e-mail + Telegram (egyszerű szöveg). Új táblák: `availability_templates`, `availability_slots`, `bookings`; a `leads` történeti marad.

**Admin (D40, D43–D45; `12`).** Menü: Foglalások, Felhasználók, Cégek (kibontható sor = áttekintő), Előfizetések, Pénzügy, Egyedi modulok (fejlesztés), Költségfigyelő, Eszközök (Promptok, Videólabor). Nézet-váltó cég/felhasználó szerint. Kikerül: kredit-napló, kredit-kérések, meghívók (/ingatlan kampány), „+" gomb, üdvözlő kredit, kreditvásárlás, a szó. A pénztár láthatatlanul marad. **Láthatatlan havi plafon** cégenként és modulonként (alapból üres; API-költséges moduloknál kötelező az Aktiválás előtt; értékek az első ilyen modulnál). **Modul-regiszter:** az egyedi modul a kódban él, rejtve marad, az admin „Aktiválás"-sal kapcsolja be a cégnek; állapotok: Felmérés → Ajánlat → Fejlesztés → Teszt → Átadva → Aktív (+ Szünetel, Lemondva).

**Szerepkörök (D45, D46).** Rendszerszinten csak `admin` és `user` (a `sales` megszűnik). **Admin:** fejleszt, tesztel, modulokat és weblapot kezel; több lehet (jelenleg 3 fiók: Márk két e-mail címmel és Tibi); admin jogot csak admin adhat, naplózva; az utolsó admin nem vehető le. **Cégvezető:** nem rendszerszerepkör, hanem **cégen belüli státusz, cégenként él**; több lehet, **mindegyik fizethet**; meghív, eltávolít, kinevez; **minden cégnek mindig van legalább egy**; az admin bárkit kinevezhet, a cégvezető a cég aktív tagját; mindenki csak a sajátját adhatja fel, másét csak az admin veheti el. **User:** a kapott modult használja.

**Hozzáférések és meghívás (D35, D41, D46; `13`).** A hozzáférés felhasználóhoz kötött. Egy közös „Hozzáférések" ablak, modulonként egy sorral („3 / 5 hely"). A meghívó lefoglalja a helyet elfogadásig vagy lejáratig (7 nap); visszavonható, újraküldhető. A cégvezető csak akkor foglal helyet, ha ő is használja („Használom én is"). Ha nincs fiókja a meghívottnak, ugyanazzal az e-mail címmel regisztrál. Eltávolításkor a hely azonnal felszabadul, a munkák a felhasználónál maradnak. A helyek számát csak az admin állítja. Az irodai fiók **opcionális közös tér**, nem ad modul-hozzáférést; a Cég és az irodai fiók két külön fogalom. Lejáratkor a modul senkinek sem elérhető.

**Adatmodell (D47; `14`).** Új, külön táblák, az `offices` érintetlen: `companies`, `company_members` (cégvezetői jelölővel), `company_modules` (állapot, hely-keret, érvényesség, plafon), `module_invitations` (hash-elt token), `module_access`, `access_audit_log` (csak hozzáfűzhető). Az egyedi modult szöveges regiszter-kulcs azonosítja. Minden írás szerveroldali függvényen megy át, egy tranzakcióban, csak `service_role` hívhatja; az utolsó cégvezetőt és adminot az adatbázis is védi. Az Ingatlan csomag hozzáférése marad a `company_access` + `services` táblán. A `sales` fiókok `user`-ek lesznek; a 33 mostani felhasználó háttérbe kerül, nem töröljük, nem kap céget.

**E-mailek (D49; `16`).** Végleges szövegek: meghívó, foglalás-visszaigazolás (időponttal és visszahívási kéréshez), lemondás-megerősítés, Telegram-értesítés. Tegező, rövid, „A TWINX csapata".

**Tesztelés és migráció (D51).** Külön tesztkörnyezet nincs (egy Supabase-projekt szolgálja a fejlesztést és az élőt). Ezért: csak additív, visszafordítható migráció; előtte mentés vagy időponthoz visszaállítás; ha a csomag engedi, előbb ideiglenes Supabase branch; minden migrációhoz visszacsináló (down) szkript; az új funkciók csak adminnak látszanak, amíg nincsenek leellenőrizve.

**Díjak és fizetés (D52; `19`).** Ajánlat-követés (`company_quotes`), külön fizetési napló (`company_payments`: fejlesztési díj, havi díj, egyéb; részletfizetés mérföldkővel), lejárati értesítések (`expiry_notifications`). Számlázó: Számlázz.hu (egyelőre kézi számla, a számlaszámot az admin rögzíti; a Számla Agent később). A „Fizetve" a havi díjnál egy tranzakcióban hosszabbítja a modul érvényességét. Lejárat előtt 3 és 1 nappal automatikus figyelmeztetés az adminnak (Telegram + admin jelzés). Új admin menüpont: Pénzügy; csak admin látja.

**Plafon és használat-mérés (D53; `20`).** A plafon forintban, nettó önköltségben (380 Ft/USD). A havi díj egy megadott mennyiségre szól; a pluszcsomag modulonként előre megtervezett (az ajánlatban). Foglalás a hívás előtt (sorzárral), elszámolás csak siker után, hibánál feloldás; ha a napló hibázik, a költséges hívás nem indul. 80%-nál figyelmeztetés, 100%-nál leállás; az értesítés a közös Telegram-beszélgetésbe megy (személyes adat nélkül). A fel nem használt keret nem vihető át; a pluszcsomag azonnal él. Az ügyfél számot nem lát. Új táblák: `module_usage_events`, `module_cap_adjustments`, `cap_notifications`. Minden egyedi modulhoz kalkulációt készítünk a reális havi költségről.

**Lemondás, lezárás és a modul megőrzése (D54; `21`).** A lemondást csak az admin rögzíti, a kifizetett időszak végével lép hatályba; a cég lezárása archiválás (a tagok hozzáférése megszűnik, a fiókjuk és munkáik megmaradnak, a számviteli adat megmarad). **A lefejlesztett modul (kód és regiszter-bejegyzés) soha nem törlődik**, a TWINX vagyona, és más cégnek is adható; a tulajdont és az újrahasznosítást a szerződés dönti el. Az ügyféladat törlése kétlépéses védelemmel és másik, kijelölt jóváhagyóval megy, a visszaadás (export) az adminnak elég; az admin a megőrzési határidőn belül visszaállíthatja a lemondott modult vagy a lezárt céget. Minden modulnál kötelező a törlési és exportálási leírás (`data_policy`), ez az Aktiválás új feltétele. Új táblák: `customer_data_requests`, `deletion_approvers`; új oszlopok a `companies` és a `company_modules` táblán.

**Felhasználói szövegek (D55; `22`).** Ha a modul nem elérhető (lejárt, lemondott vagy nem aktív), a felhasználó mindig ugyanazt a szöveget kapja, az ok nélkül; a cégvezető a hozzáférés megszűnésének dátumát látja. A meghívó-oldal hibás, lejárt, visszavont és elfogadott meghívóra ugyanazt mondja. Szövegek vannak a Besorolatlan kezdőlapra, a Regisztrációra, a cégvezetői megerősítésekre és hibákra. A kinevezett cégvezető értesítő levelet kap, az eltávolított kolléga nem.

**Átadási bejegyzés (D56; `23`).** Az Átadva állapotba csak átadási bejegyzéssel lehet lépni (az elfogadó neve a cég részéről, módja, ideje, mit kapott); csak hozzáfűzhető, csak admin látja (`module_handovers`). Az Aktiválás feltétele az érvényes bejegyzés. Az „átadáskor” fizetési tétel csak emlékeztetőt kap. Érdemi változásnál új bejegyzés kell (az utolsó érvényes számít), hibajavításnál nem. Az elfogadás feltételei a szerződésben dőlnek el.

**Ajánlat és kalkuláció (D57; `24`).** Belső dokumentum, nem fejlesztési feladat: a havi díj legalább 2× a tipikus havi önköltség és sosem kisebb a plafonnál (plusz egyéb havi költség); a pluszcsomag ára legalább 2× az önköltsége; a fejlesztési díj alsó határát a munkaóra, az óradíj és az AI- és eszközköltség adja, az árat Márk határozza meg; küldés előtt Márk és Tibor is jóváhagyja.

**Adatkezelés (D50; `17`).** Az adatkezelési tájékoztató vázlata jogi átnézésre; **a foglalás és a meghívás éles indítása előtt készen kell lennie.** A cég adatai (cégalapításra vár) hiányoznak. A cégek adataihoz adatfeldolgozói szerződés kell az NDA mellé.

## 4. Újabb szabályok (átvezetve a dokumentumokba, D57-ig)

- **Az Aktiválás csak akkor engedett, ha a cégnek van legalább egy aktív cégvezetője, és a modul regiszter-bejegyzésében szerepel a `data_policy` (D54), és a modulnak van érvényes átadási bejegyzése (D56).** Az első cégvezetőt az admin nevezi ki a Cégek lapon a regisztrált felhasználók közül (ha a foglaló e-mail címével még nincs fiók, előbb regisztrál ugyanazzal a címmel).
- Ha valaki utolsó modul-hozzáférését eltávolítják, **cég-tagja marad**. Ha a meghívó cégvezető később elveszíti a státuszát, **a kiküldött meghívója érvényes marad** a lejáratig.
- **Megerősítendő alapértelmezések:** a külön „meghívási jog" megszűnik; egy felhasználó több cégben is lehet; a meghívó 7 napig érvényes; ha az előfizetés az elfogadás után lejár, a hozzáférés nem aktiválódik.

## 5. Az éles rendszerről tudott tények

Supabase „Website Twinx" (`ucsxbtfbjhkxtkfebktm`): `profiles.role` = 3 admin, 2 sales, 33 user; `company_access` (0 sor) + `services` (1 sor: „Ingatlan") az ingatlan hozzáférés; `leads` 3 sor (történeti); `offices` 2 sor (irodai fiók); a pénztár- és használati táblák változatlanok. A `profiles_guard_role_trg` védi a szerepkört.

## 6. Szabályok, amik változatlanok

Szerveroldali védelem (RLS), böngészőben nincs titkos kulcs; stabil felület (nem ugráló dobozok, fix méretű váltós dobozok, „⋯" menü a műveleteknél, „Hamarosan" az el nem készült résznél); AI-képeken „Koncepcióterv"/vízjel; GDPR-hozzájárulás; pénzügyi és állapotváltási műveletek egy tranzakcióban; **nincs git push, csak ha Márk kéri**; ne találjunk ki számot, idézetet, árat.

## 7. Hogyan dolgozz ezzel

- Ez tájékoztatás: **ne kezdj kódolni, és ne módosíts semmit**, amíg Márk külön, konkrétan nem kéri.
- Ha Márk egy részt maga fejleszt, a megfelelő terv a specifikáció; kérdezd meg, melyik részt viszi ő, és melyiket kéri tőled.
- Eltérésnél a kód az irányadó a technikai tényekben, a döntésekben ez az összefoglaló és a tervek; ellentmondásnál kérdezz.
- Minden CODE-prompt felépítése: felhasználói folyamat → technikai részletek → ellenőrzési lépések.

## 8. Dokumentumok (a TWINX projektben)

`claude/00-iranyvaltas-D23.md` (mesterszöveg) · `11-fooldal-es-landing-terv.md` · `12-admin-terv.md` · `13-hozzaferesek-terv.md` · `14-adatmodell-terv.md` · `15-foglalas-terv.md` · `16-email-szovegek.md` · `17-adatkezelesi-tajekoztato-vazlat.md` · `19-dijak-es-fizetes-terv.md` · `20-plafon-es-hasznalat-terv.md` · `21-lezaras-es-lemondas-terv.md` · `22-felhasznaloi-szovegek.md` · `23-atadas-jovahagyasa-terv.md` · `24-ajanlat-ellenorzo-lista-es-kalkulacio.md` · `ai-ugynokseg/01-alap-es-szabalyok.md` (döntési napló) · `ai-ugynokseg/04-CLAUDE-fejlesztes.md` (fejlesztési tudásbázis) · `claude/TWINX-memoria-export-web_twinx.md` (a régi szál technikai tudása és buktatói).
