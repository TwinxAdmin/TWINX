# TWINX főoldal és referencia-landing — terv (D34–D39, D46-ig frissítve)

> **Státusz:** elfogadott terv, 2026-11-23. Ebből készülnek a CODE-promptok (később, amikor Márk átadja).
> **Irányadó:** `claude/00-iranyvaltas-D23.md`. A döntések számozása a `claude/ai-ugynokseg/01-alap-es-szabalyok.md` naplójában folytatódik. Az admin és a szerepkörök részletes terve: `claude/12-admin-terv.md` (D40–D46); a „Hozzáférések" ablak, a meghívás és a cégvezetői szabályok: `claude/13-hozzaferesek-terv.md` (D46).
> **Nyelv:** magyar, tegező hangnem. Nincs ár, nincs „kredit\" szó, nincs kitalált szám vagy idézet.

---

## 1. Szerkezet (D34)

Két oldal:
1. **Főoldal (twinx.hu)**: rövid. Átadja a TWINX lényegét, kapcsolatot ad (időpontfoglalás), belépést és regisztrációt kínál, és egy gombbal átvisz a referenciákra.
2. **Referencia-landing**: az ingatlanos modulok bemutatása (a GDN Mandala Ingatlaniroda számára fejlesztve).

Elvetett változatok: egyoldalas mindent-tartalmazó főoldal (a referenciák nem férnek el); két bejárat („cég\" / „ingatlanos\"), mert visszahozná az eszköztár-érzetet.

## 2. Felső sáv (D36)

**Belépés előtt:** logó · Hogyan működik · Referenciák · Kapcsolat · **[Ingyenes felmérés]** (kiemelt gomb) · Belépés · Regisztráció (sima szöveglink).

**Belépés után:** logó · **Moduljaim** (legördülő menü, csak azok a modulok, amelyekhez a felhasználónak hozzáférése van) · Irodai fiók · Referenciák · Kapcsolat · **[Ingyenes felmérés]** · profil (kilépés; a „kredit\" nem jelenik meg).

- Üres „Moduljaim\": *„Itt jelennek meg az egyedi moduljaid.\"*
- Az „Irodai fiók\" mellett **fix hely a jelzésnek** (értesítési pötty): most nem világít, a közös tér funkcióival együtt épül. A hely foglalt, hogy később ne tolja el a sávot.
- Mobilon hamburger menü. A sáv szélessége nem ugrál.
- **A cégvezető** (D45, D46) a profil menüben vagy a modul oldalán eléri a **„Hozzáférések\"** ablakot (lásd 7. szakasz és `13`); a sima user ezt nem látja. **Az admin** a profil menüben eléri az admin felületet; másnak ilyen menüpont nincs.

## 3. Főoldal szekciók (D36)

1. **Felső sáv** (lásd fent).
2. **Hero:** cím: **„A te cégedre szabott modul.\"** Alcím: *„Profi felmérés után a TWINX a napi munkádhoz igazított eszközt épít.\"* Fő gomb: Ingyenes felmérés (a kapcsolatblokkhoz görget).
3. **Hogyan működik** (3 egyforma kártya):
   1. **Felmérünk.** Foglalsz egy ingyenes időpontot, és végigbeszéljük, hol megy el sok időd. Ha már van konkrét ötleted, azzal is jöhetsz.
   2. **Megépítjük.** A te folyamatodra szabott modult készítjük el, nem sablont. Az ajánlatot a felmérés után kapod.
   3. **Használod.** A modul ott fut, ahol neked a legjobb.
4. **Hol fut a modul** (4 fix méretű kártya; az első kiemelve „Ajánlott kezdés\" címkével, a többi egyforma):
   - **A TWINX oldalán** (Ajánlott kezdés): a kollégáid a saját fiókjukkal belépnek, és használják a modult, külön app vagy weblap nélkül.
   - **Saját app vagy oldal:** megépítjük neked, a te arculatoddal.
   - **A saját weboldaladba építve:** ha hozzáférést adsz, beépítjük.
   - **Ahol már dolgozol:** Telegramban, Slackben vagy Excelben.
5. **Irodai fiók sáv** (keskeny, külön; az irodai fiók **opcionális közös tér**, nem feltétele a modul használatának):
   - Cím: *Irodai fiók: közös tér, ha együtt dolgoztok.*
   - Szöveg: *Regisztrálj, hozz létre irodai fiókot, és hívd meg a kollégáidat egy közös térbe.*
   - **„Hamarosan\" címkével:** *Munka küldése egymásnak, tanácskérés, elkészült munkák átnézése.*
   - Kiegészítő sor: *Az egyedi modult nem kell irodai fiókhoz kötni: a hozzáférés a saját fiókodhoz tartozik.*
   - Gombok: Regisztráció, Belépés.
   - **Nem szerepel** a nyilvános szövegben: „a vezető látja a használatot\" (D35, a modulokra egyelőre nincs használati nézet).
6. **Referencia-előzetes:** fejléc: *Működő példa: egy ingatlaniroda napi eszközei.* Alatta: *Ingatlanra készült, de bármilyen területre építünk egyedi modult.* Három kártya: **Látványterv** (*Lakásfotóból felújítási koncepcióterv, 9 stílusban.*), **Hirdetés-ellenőrző** (*Bemásolod egy hirdetés linkjét: pontozza, megmondja, mi hiányzik, és újraírja a szöveget.*), **Értékbecslés** (*Ingatlanadatokból tájékoztató ársáv, egyoldalas PDF-ben.*). Gomb: **Referenciák megtekintése**.
7. **Kapcsolatblokk** (lásd 5. szakasz).
8. **Lábléc:** logó + egy mondat a TWINX-ről · linkek: Hogyan működik, Referenciák, Kapcsolat · Adatkezelési tájékoztató · **office@twinx.hu** · © TWINX.
   - Az Adatkezelési tájékoztató a cégalapításra vár; addig a link „Hamarosan\", **de a foglalási űrlap éles indítása előtt készen kell lennie** (GDPR).

## 4. Belépett felhasználó kezdőlapja (D36)

Személyre szabott kezdőlap (a nyilvános főoldal a logóra kattintva elérhető):
1. **Moduljaim:** fix méretű kártyák, csak azok a modulok, amelyekhez a felhasználónak hozzáférése van (egyedi modul: a cégvezető meghívása után; Ingatlan csomag: ha mi megadtuk a hozzáférést); a műveletek a „⋯\" menüben.
2. **Legutóbbi munkáim:** a legutóbbi néhány elkészült anyag a meglévő mappás könyvtárból / használati előzményekből. Üres állapot: *„Az elkészült munkáid itt jelennek meg.\"*
3. **Irodai fiók** parancsikon.
4. **Kapcsolatblokk,** előre kitöltött névvel és e-mail címmel.
5. **Üres állapot** (nincs egy modulja sem): *„Még nincs modulod. Foglalj ingyenes felmérést, és építünk egyet neked.\"* Alatta rögtön a foglalási blokk.
6. **Besorolatlan felhasználó** (D31): ugyanez az üres állapot; a háttérben mi soroljuk egy céghez.

**Nem része az első körnek:** a közös tér funkciói az irodai fiókban (munka küldése, tanácskérés, átnézés) és az értesítési pötty; ezek a 3. fázisban épülnek (lásd 7. szakasz).

## 5. Kapcsolatblokk (D33, D37)

**Két lépés, fix doboz mérettel, a lépések között nem ugrál:**
1. **Időpont:** nap és szabad időpont választása. Az admin (Foglalások lap) adja meg a szabad időpontokat és az elérhetőségeket.
2. **Adatok:** **kötelező** név, cég, e-mail, telefonszám (visszahívás); **opcionális** pár mondat arról, mit modernizálnának; **GDPR-hozzájárulás pipa** (kötelező a küldéshez).

- **Tartalék:** ha nincs szabad időpont: *„Jelenleg nincs szabad időpont, hagyd meg az adataidat, és visszahívunk.\"* Az adatlépés időpont nélkül is elküldhető.
- Belépett felhasználónál név és e-mail előre kitöltve.
- Tárolás: Supabase. Értesítés: e-mail (Resend, a twinx.hu domain hitelesítése kell) és Telegram, Márknak és Tibinek. Visszaigazoló e-mail az érdeklődőnek. Külső naptár nincs.
- A beérkezett foglalásból az adminban egy kattintással **Cég** hozható létre (D42).
- **Biztonság:** szerveroldali validáció; spam-védelem (rate limit vagy honeypot); a foglalt időpont tranzakcióban foglalódjon (nincs dupla foglalás); a szabad szöveg nem megbízható bemenet; a böngészőben nincs titkos kulcs.
- Mérés: `book_assessment` esemény (GA4).

## 6. Referencia-landing (D38)

Váz:
1. **Hero:** *A GDN Mandala kollégái naponta használják.* Egy sor arról, hogy az ingatlanos modulok a GDN Mandala Ingatlaniroda számára készültek. **Nincs mellette szám vagy idézet**, amíg valódi, a GDN által jóváhagyott adat nincs.
2. **Modulok, munkafolyamat szerint csoportosítva:**
   - **Az ingatlan bemutatása:** Képjavító, Látványterv, Hirdetéskép-készítő, Marketingvideó, és **3D bejárás („Hamarosan\" jelzéssel, külön, halványabb, nem kattintható kártyán)**.
   - **A hirdetés és az ár:** Hirdetés-ellenőrző, Értékbecslés.
   - **Az iroda és a háttér:** Szakember-kereső, Irodai fiók.
   - `[Tibi hitelesítse a csoportokat és a modulleírásokat, mielőtt éles lesz.]`
3. **Sáv:** *Ingatlanra készült, de bármilyen területre építünk egyedi modult.* Gomb: Ingyenes felmérés.
4. **Ingatlan csomag** egy diszkrét sorban (D30, D40): ár és kredit szó nélkül; *„Ingatlanosként a modulokat használhatod: a hozzáférésről egyeztetünk.\"* Önkiszolgáló vásárlás nincs, a hozzáférést mi adjuk.
5. **Kapcsolatblokk** (azonos a főoldalival).

**Szabályok a landingen:**
- Az **értékbecslés** mindig „tájékoztató ársáv\", sosem hivatalos értékbecslés.
- A **látványterv** képén rajta marad a „Koncepcióterv\" jelölés és a „Twinx AI látványterv\" vízjel; a szövegben jelezzük, hogy illusztráció.
- A **Hirdetésből videó** nem szerepel; a 3D bejárás kizárólag „Hamarosan\" jelzéssel.
- Nincs ár, nincs „kredit\", nincs kitalált szám vagy idézet.

## 7. Egyedi modul, szerepkörök, előfizetés és irodai fiók (D35 javítva, D39, D41–D46)

**Ügyfélút (D42):** Foglalás → Cég létrehozása → Egyedi modul fejlesztése → Aktiválás → Előfizetés → a cégvezető meghívja a kollégákat.

**Szerepek (D45, D46):**
- **Admin** (rendszerszint): fejleszt, tesztel, egyedi modulokat intéz, a weblapot kezeli; több admin lehet (Márk, később Tibi); admin jogot csak admin adhat, az admin felületen, naplózva; az utolsó admint senki nem veheti le.
- **Cégvezető** (cégen belüli státusz; rendszerszinten `user`): aki az egyedi modult rendelte, a cége ügyeit intézi. **A státusz cégenként él; több cégvezető lehet egy cégnél, és mindegyik fizethet** (nincs külön „fizető cégvezető\"). **Minden cégnek mindig van legalább egy cégvezetője.** Kinevezheti az admin, vagy másik cégvezető (a cég már aktív tagját); **mindenki csak a saját státuszát adhatja fel, másét csak az admin veheti el.** Admin felületet nem lát.
- **User:** a kapott modult használja egyedül vagy irodai fiókban; meghívni és fizetni nem tud. Cégvezetővé a fenti módon válhat.

**Fogalmak:**
- **Egyedi modul regiszter (D43):** a fejlesztés alatt álló modul a cég felhasználóinak és a cégvezetőnek sem látszik; az admin az **Aktiválás** gombbal kapcsolja be a cégnek, ha a kód az éles rendszeren van, az állapot Átadva, az előfizetés érvényes, és API-költséges modulnál be van állítva a havi plafon. Az aktiválás nem ad felhasználói hozzáférést.
- **Modul-hozzáférés:** a **felhasználóhoz tartozik**, nem az irodai fiókhoz. A cégvezető **e-mail címmel meghívja** a kollégát; a kolléga „Belépés\" gombos üzenetet kap, belép vagy regisztrál (ha még nincs fiókja, ugyanazzal az e-mail címmel kell regisztrálnia), és a modul egyből elérhető a „Moduljaim\" menüben. A felhasználó **egyedül dolgozik vele**, irodai fiók nélkül is. Ha kikerül egy irodai fiókból, a hozzáférése megmarad.
- **Hozzáférések ablak (a cégvezetőnek, a TWINX felületén; részletek: `13-hozzaferesek-terv.md`):** egy közös ablak, **modulonként egy sorral** (helyek: használt / összes, érvényesség); a kibontott sorban a meghívott és aktív kollégák állapottal, e-mail beírása a meghíváshoz, **eltávolítás**. **A meghívó lefoglalja a helyet** az elfogadásig vagy a lejáratig (javaslat: 7 nap), a cégvezető vissza is vonhatja. **A cégvezető csak akkor foglal helyet, ha ő is használja a modult** („Használom én is\"). **Eltávolításkor a hely azonnal felszabadul,** a hozzáférés megszűnik, a munkák a felhasználónál maradnak. Az ablak alján a **Cégvezetők** doboz: kinevezés a cég aktív tagjai közül, lemondás a saját státuszról (az utolsó cégvezető nem mondhat le). Az admin táblázatban a változás azonnal látszik.
- **Meghívás biztonsága:** egyszer használatos, lejár, a meghívott e-mail címhez kötött, hash-elt token; a helyek számát a szerver érvényesíti tranzakcióban; a meghívó e-mail minden címnek ugyanazt mondja (nem derül ki, hogy a cím regisztrált-e); minden lépés naplózott; a meghívón át regisztráló automatikusan a céghez kerül (részletek: `13`, 6. szakasz).
- **Lejárat:** ha a havidíj nem újul meg, a modul **senkinek sem elérhető**, azoknak sem, akik már kiléptek egy irodai fiókból.
- **Ingatlan csomag (GDN és minden ingatlanos):** a hozzáférést **csak mi adjuk** az adminban; a meghívási folyamat nem erre vonatkozik.
- **Irodai fiók = opcionális közös tér.** Ha a kollégák úgy döntenek, hogy együtt akarnak dolgozni, létrehoznak egy irodai fiókot, ahol egymásnak küldhetik a munkát, tanácsot kérhetnek, vagy megmutathatják az elkészült munkát átnézésre. Bárki létrehozhat irodai fiókot, a létrehozó az irodai fiók **adminja**: ő hívja meg és cseréli a tagokat a közös térben. Egy felhasználó több irodai fiókban is lehet. **Az irodai fiók nem feltétele a modul használatának**, és nem ő adja a modul-hozzáférést. **Az irodai fiók (felhasználói közös tér) és a Cég (a mi ügyfélnyilvántartásunk) két külön fogalom.**
- **Használati nézet (D35):** a modulokra egyelőre **nincs** „vezető látja a használatot\" nézet, és ezt a nyilvános szövegek nem említik. Az ingatlanos irodai fiókban a meglévő működés marad.
- **Árazás (D39):** mindig egyedi, a felmérés után; nincs fix árlista. Az API-költséges modulokra láthatatlan havi plafon (D40, D44).

**Három fázis:**
1. **Admin-oldali előfizetés-kezelés és a cégvezetői meghívás:** az adminban rögzítjük a cég előfizetését (modul, hány hely, érvényesség) és a cégvezetőket; a cégvezető meghív és eltávolít; a rendszer **szerveroldalon érvényesíti** a hozzáférést, a helyek számát és a lejáratot. A fizetést egyelőre kézzel (számla, átutalás vagy Stripe-link) intézzük.
2. **Stripe-előfizetés automatizmus:** a fizetés és a lejárat összekapcsolása. Az előfizetést **mi hozzuk létre** a cégnek egyedi összeggel (nincs önkiszolgáló előfizetés, mert az ár egyedi).
3. **Közös tér funkciói:** munka küldése egymásnak, tanácskérés, elkészült munka átnézésre; értesítési jelzés a felső sávban.

## 8. Nyitott pontok

- Adatkezelési tájékoztató (jogi szöveg, cégalapításra vár) — az űrlap éles indítása előtt kell; a meghívó e-mailek adatkezelését is érintse.
- Resend domain-hitelesítés (twinx.hu, DNS a Rackforestnél) — a foglalási, meghívó és értesítő levelekhez.
- Tibi hitelesítse a referencia-landing csoportjait és modulleírásait.
- Valódi, GDN által jóváhagyott mondat vagy mérhető adat a referenciához (opcionális, később).
- A főoldal képi anyaga (képernyőképek a referencia-modulokból; a látványtervnél jelölés).
- A meghívó e-mail végleges szövege; az adatmodell (Cég, Felhasználó, cég-tagság cégvezetői jelölővel, előfizetés/hely-keret, meghívó, modul-hozzáférés, modul-regiszter, napló).
- Belső ajánlat-ellenőrző lista az egyedi árazáshoz (költségtételek, API-önköltségvédelem) — Tibivel, nem sürgős.
- Megerősítendő alapértelmezések (D46): a külön meghívási jog megszűnik; egy felhasználó több cégben is lehet; a meghívó 7 napig érvényes.

## 9. CODE-sorrend

1. **Főoldal, felső sáv, referencia-landing** (statikus tartalom, a meglévő komponensekkel).
2. **Kapcsolatfelvétel és időpontfoglalás** (űrlap, admin Foglalások lap, értesítések).
3. **Új admin szerkezet, szerepkörök és kredit-kivezetés** (`12-admin-terv.md`): menü, nézet-váltó cég/felhasználó szerint, Cégek (kibontható sor), admin jog adása naplózva, láthatatlan plafon; személyre szabott kezdőlap.
4. **Előfizetés-kezelés 1. fázis, cégvezetői státusz és meghívás** (Előfizetések lap, „Hozzáférések\" ablak, cégvezetői kinevezés/lemondás, szerveroldali érvényesítés, naplózás; `13-hozzaferesek-terv.md`), valamint az **Egyedi modulok lap és modul-regiszter**.
5. Később: Stripe-automatizmus (2. fázis), a közös tér funkciói (3. fázis).
