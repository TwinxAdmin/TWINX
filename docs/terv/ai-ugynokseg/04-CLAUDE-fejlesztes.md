# CLAUDE.md — TWINX tudásbázis (fejlesztés)

> Ez a fájl a TWINX **fejlesztési tudásbázisa**: mit kell tudni a rendszerről, hogyan épül, és mit soha.
> Ebből dolgozik a Claude Code és az AI ügynökség minden fejlesztő ügynöke.
> Nyelv: **magyarul** dolgozunk. Frissítve: 2026-11-23 (irányváltás, D23–D57).
>
> **IRÁNYVÁLTÁS (D23):** a TWINX mostantól **egyedi, cégre szabott modulok gyártója** bármilyen cég számára. A kreditalapú eszköztár-modell megszűnik. A hivatalos leírás: `claude/00-iranyvaltas-D23.md`. A főoldal részletes terve: `claude/11-fooldal-es-landing-terv.md`. Az admin, a szerepkörök és a modul-regiszter terve: `claude/12-admin-terv.md`. A „Hozzáférések" ablak, a meghívás és a cégvezetői szabályok terve: `claude/13-hozzaferesek-terv.md`. Az adatmodell: `claude/14-adatmodell-terv.md`; a foglalás: `claude/15-foglalas-terv.md`; a jóváhagyott e-mail szövegek: `claude/16-email-szovegek.md`; az adatkezelési tájékoztató vázlata: `claude/17-adatkezelesi-tajekoztato-vazlat.md`; a díjak és a fizetés: `claude/19-dijak-es-fizetes-terv.md`; a plafon és a használat: `claude/20-plafon-es-hasznalat-terv.md`; a lemondás, a lezárás és a modul megőrzése: `claude/21-lezaras-es-lemondas-terv.md`; a felhasználói szövegek: `claude/22-felhasznaloi-szovegek.md`; az átadási bejegyzés: `claude/23-atadas-jovahagyasa-terv.md`; a belső ajánlat-ellenőrző lista és kalkuláció: `claude/24-ajanlat-ellenorzo-lista-es-kalkulacio.md`. Ez a fájl az új irányt tükrözi; ahol régi (kredites) mintát említ, ott ezt külön jelöli.
>
> **Hatókör:** ez a *mit kell tudni a TWINX-ről* dokumentum. Az AI ügynökség *felépítése* külön dokumentum
> (lásd a 9. szakaszt). A marketing részletesen Tibi marketinges fájljában van.
> Ha ez a fájl és a kód eltér, **a kód az irányadó**, és ezt a fájlt kell javítani.

---

## 1. Mi a TWINX (D23)

- **Egyedi, cégre szabott modulok gyártója.** Nem sablonos oldalt építünk, hanem olyan modulokat és funkciókat, amelyek konkrét üzleti folyamatokat gyorsítanak. A kollégák (Márk, Tibi) felmérik egy cég napi működését, vagy a cég konkrét ötlettel jön, és erre építünk modult.
- **Célcsoport:** bármilyen cég. A meglévő ingatlanos modulokat a GDN Mandala Ingatlaniroda kollégáival fejlesztettük, ők naponta használják; ezek **referenciák** (külön referencia-landingen mutatjuk be őket, D34, D38), és „Ingatlan csomagként" egy kalap alá kerülnek (D24, D30).
- **Megrendelés:** ingyenes felmérés és beszélgetés Márkkal vagy Tibivel; időpontot foglal a cég a kapcsolatfelvételi blokkban (D26, D33, D37). Árat a weboldalon nem közlünk.
- **Ügyfélút (D42):** Foglalás → Cég létrehozása → Egyedi modul fejlesztése → Aktiválás → Előfizetés → a cégvezető meghívja a kollégákat.
- **Hol fut az egyedi modul (D27), a cég választ:**
  1. a **TWINX oldalán**: a kollégák a saját fiókjukkal belépnek, és használják a modult (ezt ajánljuk elsősorban, „Ajánlott kezdés");
  2. **saját app vagy oldal**, amit a cégnek fejlesztünk;
  3. **beépítés a cég saját oldalába**, ha hozzáférést adnak;
  4. **meglévő csatornában**: Telegram, Slack vagy Excel.
  Mindegyiknek külön fejlesztési díja és havi előfizetése van, modulfüggő és **egyedi** (D39): nincs fix árlista.
- **Fizetés (D32, D39, D46):** a Stripe marad. Az egyedi moduloknál később havi előfizetés megy rajta; az előfizetést **mi hozzuk létre** a cégnek egyedi összeggel, és **bármelyik cégvezető fizethet** (nincs külön „fizető cégvezető"). A fizetési mód ugyanaz, a struktúra más.
- **Hozzáférés, cégvezető és irodai fiók (D25, D28, D35, D41, D45, D46; részletek: `claude/13-hozzaferesek-terv.md`):**
  - A modul-hozzáférés **felhasználóhoz kötött**. A felhasználó a saját fiókjában („Moduljaim") használja, **egyedül dolgozik vele**; irodai fiók nem kell hozzá. Ha kikerül egy irodai fiókból, a hozzáférése megmarad.
  - A **cégvezető** a felhasználó és a cég kapcsolatán élő státusz (**cégenként él**, a cég minden moduljára érvényes), **több cégvezető lehet egy cégnél, és mindegyik fizethet**. **Minden cégnek mindig van legalább egy cégvezetője.** Kinevezheti az **admin**, vagy másik **cégvezető** (a cég már **aktív tagját**); **mindenki csak a saját státuszát adhatja fel, másét elvenni csak az admin tud.** A cégvezetők **meghívhatnak** kollégát e-mail címmel („Belépés" gombos meghívó; ha még nincs fiókja, ugyanazzal a címmel kell regisztrálnia; ha már van, egyből eléri a modult), a meghívott automatikusan a céghez kerül. **A meghívó lefoglalja a helyet** az elfogadásig vagy lejáratig. A cégvezető csak akkor foglal helyet, ha ő is használja a modult. A cégvezető **maga is eltávolíthat** kollégát (a hely azonnal felszabadul, a hozzáférés megszűnik, a munkái a felhasználónál maradnak). A helyek számát (az előfizetés kerete) csak az admin állítja. Az **ingatlan hozzáférést** (GDN és minden ingatlanos) csak mi adjuk.
  - Lejáratkor a modul **senkinek sem elérhető**.
  - Az **irodai fiók opcionális közös tér**: ha a kollégák együtt akarnak dolgozni, ott küldhetik egymásnak a munkát, kérhetnek tanácsot, mutathatják meg az elkészült munkát átnézésre. A létrehozó az irodai fiók adminja (ő kezeli a közös tér tagságát); egy felhasználó több irodai fiókban is lehet. Nem feltétele a modul használatának, és nem ő ad hozzáférést. **Az irodai fiók (közös tér) és a Cég (a mi ügyfélnyilvántartásunk) két külön fogalom.**
  - Titoktartási szerződés (NDA) kell az ügyféladatokhoz; a sablon még nincs meg.
- **Élesben fut a twinx.hu-n:** a meglévő modulok, a Stripe-integráció (eddig még senki nem fizetett, ezért nincs mit migrálni), átlagosan ~40 mp alatt kész anyag. A „kredit" mint ajánlat és mint felületi elem megszűnik; a pénztárca **láthatatlanul** marad (D30, D40), lásd 5–6. szakasz.
- **Regisztrált (kredites) felhasználók (D31):** háttérbe kerülnek; az új regisztráló „Besorolatlan", amíg egy céghez nem soroljuk.
- Hibrid jövőkép: a gyors, pár kattintásos modulok mellé később ügynök-segített szolgáltatás jön a bevált ügynökökből.

## 2. Kik vagyunk és a szerepek

- **Kovács Márk:** társalapító, fejlesztő („vibe coder"), termékfelelős. Nincs informatikai végzettsége; AI-segített fejlesztéssel épít, ő specifikál, irányít és hagy jóvá. Erős AI kép/videó és vágás (DaVinci) tudás.
- **Radics Tibor (Tibi):** társalapító, a GDN Mandala Ingatlaniroda tulajdonosa; ingatlanos szakértelem és kapcsolatok. Ő viszi a marketingkampányt, és Márk mellett ő tartja az ingyenes felméréseket és a teszteléseket. A felmérő kollégák köre később bővíthető. Admin jogot kap (D45).
- **Szerepek a rendszerben (D45, D46; részletek: `claude/12-admin-terv.md`, `claude/13-hozzaferesek-terv.md`):**
  - **Rendszerszerepkör csak kettő:** `admin` és `user`. A `sales` szerepkör megszűnt.
  - **Admin:** fejleszt, tesztel, egyedi modulokat intéz, a weblapot kezeli; **több admin lehet**. **Admin jogot csak admin adhat**, kizárólag az admin felületen, szerveroldali ellenőrzéssel, **naplózva** (ki, kinek, mikor, adta vagy elvette); **az utolsó admint senki nem veheti le** (szerveroldali tiltás). A szerepkört csak szerveroldal módosíthatja (`profiles_guard_role`, `service_role`).
  - **Cégvezető:** **nem rendszerszerepkör, hanem cégen belüli státusz** (cég-tagság: a felhasználó és a cég kapcsolatán egy jelölő). Rendszerszinten `user`; a státusz **sosem ad admin jogot**, és **cégenként él** (ugyanaz az ember az egyik cégnél cégvezető, a másiknál sima user lehet; a cég minden moduljára érvényes). **Nincs külön „fizető cégvezető" és nincs külön „meghívási jog"**: a cégvezető meghívhat, eltávolíthat, fizethet és kinevezhet másik cégvezetőt. **Az utolsó cégvezető nem adhatja fel és nem vehető el** (szerveroldali tiltás, tranzakcióban). A kinevezés csak a cég aktív tagjára szólhat; a lemondás és a levétel szabálya: saját státuszt bárki feladhat, másét csak az admin veheti el.
  - **User:** a kapott modult használja; a meghívást a cégvezetőtől kapja, vagy az admin sorolja be. Meghívni és fizetni nem tud.
  - Külön fogalom az **irodai fiók adminja** (a létrehozó): ő csak az irodai fiók közös terének tagságát kezeli, a modul-hozzáférést nem.
- **Admin nézet-váltó (D40):** a „így látja a partner" előnézet **szerepkör helyett cég (és felhasználó) szerint** vált; csak admin, csak lefelé, jogot nem ad; az előnézetnek követnie kell az új jogosultságokat, és a beküldés blokkolt.

## 3. Hogyan dolgozz velem — alapelvek

- **Magyarul** magyarázd el a javításokat és változásokat.
- **Spec a kód előtt:** előbb a termék és a felhasználói folyamat, aztán a technika. Ötletelés után **explicit döntés-megerősítés**, csak utána építés.
- **Opciók + ajánlás:** érdemi döntésnél 2-3 út, ajánlással; várd meg a döntésemet.
- **Ne fejlessz, amíg nem kértem.** Ha bizonytalan a feladat, kérdezz. A tervezés a projektben történik, a módosítást én adom át, amikor eljön az ideje.
- **Ne zárd a válaszokat `git add/commit/push` paranccsal**, csak ha kifejezetten kérem. Ha valami csak deploy után ellenőrizhető, mondatban jelezd.
- **Vendor-függetlenség:** a külső API-k cserélhetők legyenek (config/adapter), egy modul álljon meg a lábán önmagában is.
- **Költség előre modellezve**, mielőtt architektúrát vagy árat rögzítünk.
- **Jóváhagyási kapu:** main-be push, deploy, prod DB-írás/-migráció csak a jóváhagyásommal.

## 4. Stack és üzemeltetés

- **Next.js 15** (App Router), **Vercel** hosting és backend: minden szerveroldali logika Next.js API route-ban fut (`src/app/api/**`). GitHub `TwinxAdmin/TWINX`, `main` ág, push → automatikus Vercel deploy. A pusht Márk végzi a saját gépéről.
- **Supabase:** Postgres + RLS, Auth, Storage (pl. `reports` bucket). Egy projekt szolgálja ki a fejlesztést és az élest is, ezért a migráció óvatosan megy (**D51**): csak additív, visszafordítható migráció; előtte mentés vagy időponthoz visszaállítás; ha a csomag engedi, előbb ideiglenes Supabase branch; mindegyikhez visszacsináló (down) szkript; az új funkciók csak adminnak látszanak, amíg nincsenek leellenőrizve. Külön tesztkörnyezet nincs.
- **Rackforest:** csak domain/DNS. Levelezés: Google Workspace. Közös cím: **office@twinx.hu**.
- **Külső szolgáltatók:** Google/Gemini (Nano Banana: képjavítás, látványterv), Perplexity (`runSonar`: szöveg, értékbecslés comp-adatai, kutató modulok), fal.ai (AI videóklipek), Shotstack (tartalék videómotor; a saját motor az elsődleges), Stripe (fizetés), Resend (rendszerlevelek, **a foglalási visszaigazoló, a meghívó és az értesítő levelek is**), Számlázz.hu (számlázás: egyelőre kézzel, később Számla Agent; D52), Brevo/Smartlead (hírlevél), Google Analytics 4 (`G-MQJJZB8PWK`, süti-sávval). **Telegram bot:** a foglalási értesítés (D33) és a plafon-, lejárati értesítések (D52, D53) a közös Twinx agent beszélgetésbe mennek, sima szövegként, személyes adat nélkül.
- **Render:** Satori (`next/og`) a hirdetésképhez és a feliratokhoz; böngészőoldali PDF (html2canvas + jsPDF) az értékbecsléshez; `pdf-lib` a vendéglátós riportokhoz.
- **Promptok:** az admin felületen (**Eszközök → Promptok**, `/admin/prompts`) szerkeszthetők, és **a DB-ben mentett aktív prompt felülírja a kódbelit**. Prompt-változtatásnál ezt mindig nézd meg.

## 5. Modulok (állapot: 2026-11, referenciák) és az admin

Az alábbi ingatlanos modulok **referenciák** (D23, D24), és „Ingatlan csomagként" kezeljük őket. **Hozzáférés (D30, D40, D44):** a GDN kollégák használják; a hozzáférést **csak mi adjuk** az adminban **minden ingatlanosnak**, **nincs önkiszolgáló vásárlás**. A pénztárca technikailag **láthatatlanul** marad; a felületen nincs „kredit" szó, napló, kérés, „+" gomb. A költséget **láthatatlan havi használati plafon** védi (cégenként és modulonként, alapból üres; API-költséges moduloknál kötelező beállítani, mielőtt a cég használatba veszi).

**Ingatlan (élő):**
- **Látványterv:** lakásfotóból felújítási koncepcióterv, 9 stílus, „Koncepcióterv" jelölés + „Twinx AI látványterv" vízjel (`lib/watermark.ts`, a Storage-feltöltés előtt).
- **Képjavító:** Feljavítás / Rendrakás, egyetlen Nano Banana hívás. Rendrakásnál no-op felismerés és ingyenes újragenerálás.
- **Hirdetéskép-készítő:** AI nélküli kódos elrendezés (Satori), 3 sablon, 1:1 / 9:16 / 4:3, előnézet ingyen.
- **Hirdetés-ellenőrző:** link → pontozás, átfogalmazás, újraírt szöveg; adatot soha nem talál ki.
- **Értékbecslés:** a Perplexity csak comp-adatot ad, a **számot a saját determinisztikus motor** számolja (`lib/valuation-engine.ts`, adminból hangolható). Tájékoztató ársáv, egyoldalas arculatos PDF.
- **Marketingvideó (9:16 / 1:1):** saját videómotor (Aurora, Skandi, Prestige sablon), a Shotstack csak tartalék; a motor az admin Videólaborban váltható.
- **Szakember-kereső.**
- **Irodai fiók:** közös irodai keret, vezetői és kollégai nézet (az ingatlanos működés **marad, ahogy van**). **Új szerep (D28, D35):** opcionális közös tér az egyedi modulokat használó kollégáknak (munka küldése, tanácskérés, átnézés); ez a 3. fázisban épül. Az egyedi modulokra egyelőre **nincs** „vezető látja a használatot" nézet.

**Vendéglátás (rejtett, D18):** Kínálat kezelő, Alapanyagok & receptek, Menü generátor, Beszállító-kereső (PRO mély kutatással), Önköltség & profit (riport + Profit-terv), Árazás elemző, Szakember-kereső. A kód megvan, a felületen nem látszik; új fejlesztés nem megy rá.

**Közös (a kódban él):** globális pénztárca (láthatatlan), mappás könyvtár minden modulban (`FolderLibrary`), arculat-profilok (`branding_profiles`), admin előnézet, használati napló (technikai), üdvözlő jóváírás és /ingatlan ajándékkód-kampány (a felületről kikerülnek, D40; a kampány átalakítása a D31 szerint külön döntés).

**Fejlesztés alatt / tervezve:** Prémium 3D bejárás (alaprajzból bejárható lakás, three.js; a referencia-landingen csak „Hamarosan" jelzéssel jelenik meg, D38), „Hirdetésből videó" (hirdetés-link → videó, Kling + saját feliratok + saját zenetár; nem jelenik meg), Portál Központ „WOW" kezdőlap (a D36 személyre szabott kezdőlap váltja), **egyedi céges modulok** (ez lett a fő irány).

### Az admin felület szerkezete (D40, D45, D46; részletek: `claude/12-admin-terv.md`)

A megjelenés (arculat, komponensek) marad. Menü: **Foglalások · Felhasználók · Cégek · Előfizetések · Pénzügy · Egyedi modulok (fejlesztés) · Költségfigyelő · Eszközök (Promptok, Videólabor)**. Az admin felületre és az admin API-kra szerveroldalon csak `admin` szerepkör léphet be.
- **Foglalások:** szabad időpontok és elérhetőségek; beérkezett érdeklődők; foglalásból egy kattintással Cég (D42).
- **Felhasználók:** regisztráció ideje, melyik céghez tartozik, szerepe; az új regisztráló „Besorolatlan" (D31). Itt adható/vehető el az admin jog (naplózva, az utolsó admin védelmével).
- **Cégek:** lista; a **kibontható sor** az áttekintő (megrendelt modulok, helyek használt/összes, lejárat, kollégák állapottal, cégvezetők jelölve). Itt állítja az admin a cégvezetőket is (kinevezés, levétel; az utolsót nem lehet).
- **Előfizetések:** modul, hány hely, érvényesség, fizetés állapota; a 3 és 1 nap múlva lejáró modulok jelölve (D52). A helyek számát csak az admin állítja.
- **Pénzügy (D52):** ajánlatok és fizetési tételek cégenként (a cég oldalán Ajánlatok és Fizetések fül), összesítő lista (Esedékes / Kiszámlázva / Fizetve / Lejáró modulok), CSV-export a könyvelőnek; csak admin látja. Terv: `19`.
- **Egyedi modulok (fejlesztés):** a modul-regiszter és a fejlesztés követése (lásd lent).
- **Költségfigyelő:** marad. **Eszközök:** a meglévő ingatlanos modulokat vezérlik; nem törlődnek.
- **Kikerül a felületről (D40):** Kredit-napló, Kredit-kérések, Meghívók (/ingatlan kampány), a Felhasználók táblában a kredit „+" és oszlop, az üdvözlő kredit, a kreditvásárlás, a „kredit" szó.

### Egyedi modulok lap és modul-regiszter (D43, D44)

- Minden egyedi modul **a kódban él** (a Claude Code készíti), egy **regiszter-bejegyzéssel** (kulcs, név, ikon, útvonal), és **rejtve marad**, amíg az admin **Aktiválás** gombbal be nem kapcsolja egy cég számára. **Elvetve:** admin által feltöltött/telepített modul (plugin-rendszer).
- **Állapotok:** Felmérés → Ajánlat → Fejlesztés → Teszt → Átadva → Aktív; mellék-állapotok: Szünetel, Lemondva. Az állapotváltások története dátummal tárolt.
- **Aktiválás szabályai:** csak admin; csak ha (1) a modul szerepel a regiszterben (a kód az éles rendszeren van), (2) az állapot Átadva (csak átadási bejegyzéssel lehet ide lépni: `record_handover`; D56), (3) a cég előfizetése érvényes, (4) API-költséges modulnál be van állítva a havi plafon, (5) a cégnek van legalább egy aktív cégvezetője, (6) a modul regiszter-bejegyzésében szerepel a `data_policy` (törlési és exportálási leírás, vagy a kijelentés, hogy nem tárol ügyféladatot; D54), (7) a modulnak van érvényes átadási bejegyzése (D56). **Az aktiválás nem ad felhasználói hozzáférést**: a cégvezető hívja be a kollégákat.
- A fejlesztés alatt álló modul a cég felhasználóinak és a cégvezetőnek sem látszik. A lap **csak követési adatot** tárol, ügyfél titkos (NDA) adatot nem.

**Új fejlesztési feladatok (D23–D57, a sorrend kötött; részletes tervek: `claude/11-fooldal-es-landing-terv.md`, `claude/12-admin-terv.md`, `claude/13-hozzaferesek-terv.md`, `claude/14-adatmodell-terv.md`, `claude/15-foglalas-terv.md`, `claude/16-email-szovegek.md`, `claude/19-dijak-es-fizetes-terv.md`, `claude/20-plafon-es-hasznalat-terv.md`, `claude/21-lezaras-es-lemondas-terv.md`, `claude/22-felhasznaloi-szovegek.md`, `claude/23-atadas-jovahagyasa-terv.md`):**
1. **Rövid főoldal és referencia-landing (D34, D36, D38):**
   - Főoldal: hero („A te cégedre szabott modul."), Hogyan működik (3 lépés), Hol fut a modul (4 kártya, az első „Ajánlott kezdés"), Irodai fiók sáv („közös tér, ha együtt dolgoztok"), referencia-előzetes (3 kártya), kapcsolatblokk, lábléc (office@twinx.hu).
   - Referencia-landing: a modulok munkafolyamat szerint csoportosítva; a 3D bejárás „Hamarosan" jelzéssel, külön, halványabb, nem kattintható kártyán; Ingatlan csomag egy diszkrét sorban, ár és kredit szó nélkül.
2. **Új felső sáv (D36):** belépés előtt: logó · Hogyan működik · Referenciák · Kapcsolat · [Ingyenes felmérés] kiemelt gomb · Belépés · Regisztráció. Belépés után: logó · **Moduljaim** legördülő menü · Irodai fiók · Referenciák · Kapcsolat · [Ingyenes felmérés] · profil. Az Irodai fiók mellett fix hely a későbbi értesítési jelzésnek (most nem világít). Mobilon hamburger menü.
3. **Kapcsolatfelvétel és időpontfoglalás (D33, D37, D48; részletes terv: `15`, szövegek: `16`):**
   - Admin (Foglalások lap): a szabad időpontok és az elérhetőségek megadása.
   - Űrlap, **két lépésben, fix doboz mérettel:** 1. időpont; 2. adatok: **kötelező** név, cég, e-mail, telefonszám; **opcionális** pár mondat arról, mit modernizálnának; GDPR-hozzájárulás pipa.
   - Ha nincs szabad időpont: „Jelenleg nincs szabad időpont, hagyd meg az adataidat, és visszahívunk." Az adatlépés ekkor is elküldhető.
   - Tárolás Supabase-ben; értesítés e-mailben (Resend) és Telegramon Márknak és Tibinek; visszaigazoló az érdeklődőnek. Belépett felhasználónál név és e-mail előre kitöltve; belépés előtt és után is elérhető. Külső naptár egyelőre nincs.
   - **D48:** hibrid szabad-időpont kezelés (heti sablon, 4 hétre generálva, budapesti időben, óraátállításnál is helyes, ismételhető); minden időpontnak gazdája van (Márk vagy Tibor); 45 perc, 24 óra és 30 nap közötti foglalható ablak; egy aktív foglalás e-mail címenként és telefonszámonként; lemondás link a levélben, de **csak POST-gombbal mond le** (a GET soha); visszahívási kérés időpont nélkül; honeypot és sebességkorlát; a GA4 `book_assessment` csak szerver által visszaigazolt foglalás után. A Foglalások lap két füllel (Beérkezett, Időpontok).
4. **Új admin, szerepkörök és kredit-kivezetés (D40, D45, D46):** a fenti menüszerkezet; a nézet-váltó cég/felhasználó szerint; a Cégek kibontható sora; a `sales` szerepkör megszüntetése; **szerepmodell:** `admin`/`user` rendszerszinten, a cégvezető cégen belüli státusz (cégenként él, több is lehet, mindegyik fizethet, mindig legalább egy), admin jog adása naplózva és utolsó admin védelemmel; a láthatatlan havi plafon cégenként és modulonként (alapból üres; elérésekor a modul érthető üzenetet ad, az admin értesítést kap); minden kredit-elem eltávolítása a felületről. Nincs adatmigráció, mert fizetés még nem volt.
5. **Személyre szabott kezdőlap belépés után (D36):** Moduljaim (fix méretű kártyák, „⋯" menü), Legutóbbi munkáim (a meglévő mappás könyvtárból / előzményekből), Irodai fiók parancsikon, kapcsolatblokk; üres állapotban foglalási felhívás.
6. **Előfizetés-kezelés, cégvezetői státusz és meghívás, 1. fázis (D35, D39, D41, D45, D46; teljes terv: `13-hozzaferesek-terv.md`):**
   - Admin: a Cég oldalon a **cégvezető(k)** kijelölése/levétele (az utolsót nem lehet levenni); az Előfizetések lapon modul, helyek száma, érvényesség.
   - Cégvezetői felület: **„Hozzáférések"** ablak (egy közös ablak, modulonként egy sor: helyek használt/összes; meghívott és aktív kollégák állapottal; e-mail megadása; visszavonás, újraküldés, eltávolítás; „Használom én is" gomb; a cég szintjén a Cégvezetők doboz: kinevezés a cég aktív tagjai közül megerősítéssel, lemondás a saját státuszról).
   - Biztonság (kötelező): a meghívó **egyszer használatos, lejár (javaslat: 7 nap), a meghívott e-mail címhez kötött, hash-elt token**; elfogadni csak a **megerősített, egyező e-mail című** belépett felhasználó tud; **a meghívó levél és az oldal minden címnek ugyanazt mondja** (nem derül ki, hogy a cím regisztrált-e); **a meghívó lefoglalja a helyet** az elfogadásig/lejáratig; a **helyek számát a szerver érvényesíti tranzakcióban** (két gyors meghívás se léphesse túl a limitet); a meghívott csak azt a modult kapja, amire a meghívó szólt, és csak a meghívó cégén belül; a meghívón át regisztráló automatikusan a céghez kerül, a sima regisztráló „Besorolatlan"; lejáratkor a cég minden felhasználójától megszűnik a hozzáférés (szerveroldali ellenőrzés + RLS); **meghívó-küldési korlát**; a meghívók, hozzáférések és cégvezetői változások naplója (ki, kit, melyik cég és modul, mikor) csak adminnak és a saját cég cégvezetőinek olvasható; **a cégvezetői státuszt minden műveletnél az adott cégre kell ellenőrizni**; **az utolsó cégvezető nem adható fel és nem vehető el, a kinevezés csak a cég aktív tagjára szólhat** (tranzakcióban).
   - Fizetés egyelőre kézzel (D52). Az ingatlan hozzáférést csak mi adjuk. Az adatmodell kész (`14`, D47), a meghívó e-mail végleges szövege kész (`16`, D49).
   - **Adatmodell (D47):** új, külön táblák (`companies`, `company_members`, `company_modules`, `module_invitations`, `module_access`, `access_audit_log`); az `offices` és az Ingatlan csomag (`company_access` + `services`) érintetlen; minden írás `security definer` függvényen, csak `service_role`; az Aktiválás cégvezető nélkül nem engedett.
7. **Egyedi modulok lap és modul-regiszter (D43):** a regiszter a kódban, az Egyedi modulok lap az adminban (lista, állapot, felelős admin, kibontható sor, állapotváltás-történet, Aktiválás/Kikapcsolás a fenti szabályokkal).
8. **Ajánlat-, díj- és fizetés-követés (D52, `19`):** `company_quotes`, `company_payments`, `expiry_notifications`; az ajánlat elfogadása és a fizetési tételek létrehozása egy tranzakcióban; a „Fizetve" a havi díjnál egy tranzakcióban hosszabbítja a modul érvényességét; részletfizetés mérföldkővel; a számlaszámot az admin írja vissza a Számlázz.hu-ból; lejárati figyelmeztetés 3 és 1 nappal (naponta futó ellenőrzés, Telegram és admin jelzés); csak admin látja.
9. **Havi plafon és használat-mérés (D53, `20`):** forint, nettó önköltség; foglalás a hívás előtt (sorzárral), elszámolás csak siker után, hibánál feloldás; ha a napló hibázik, a költséges hívás nem indul el; 80%-nál figyelmeztetés, 100%-nál leállás (Telegram a közös beszélgetésbe); pluszcsomag a keret-kiegészítéssel és a fizetési tétellel egy tranzakcióban; a fel nem használt keret nem vihető át; az ügyfél számot nem lát.
10. **Előfizetés, 2. fázis:** Stripe-előfizetés automatizmus (egyedi összeggel, mi hozzuk létre; fizetés ↔ lejárat összekötése, egy tranzakcióban kezelt állapotváltással).
11. **Irodai fiók közös tere, 3. fázis (D35):** munka küldése egymásnak, tanácskérés, elkészült munka átnézésre; értesítési jelzés a felső sávban. Az egyedi modulok futtatása a felhasználó saját fiókjában ettől független.
12. **Modul lemondása, cég lezárása, ügyféladat törlése/visszaadása (D54, `21`):** a lemondás a kifizetett időszak végén lép hatályba (`cancel_requested_at`, `cancel_effective_on`), rögzítéskor a nyitott meghívók visszavonódnak; a cég lezárása archiválás (`status = lezart`, a tagok eltávolítva, a fiókok és munkák megmaradnak, számviteli adat megmarad; az utolsó cégvezetőt védő trigger a lezárásnál átenged); **a modul kódja és regiszter-bejegyzése soha nem törlődik**, a regiszter új mezői: `origin`, `reuse`, `catalog_status`, `data_policy`; az ügyféladat törlése kétlépéses védelemmel és jóváhagyással (`customer_data_requests`, `deletion_approvers`; a jóváhagyó nem lehet a kérő), idempotens és újrapróbálható; visszaadás (export) az adminnak elég; újraaktiválás a megőrzési határidőn belül; minden írás szerveroldali függvényen, naplóval. Új tábla/oszlop és függvény a `14` és a `21` szerint; additív migráció (D51).
13. **Felhasználói szövegek (D55, `22`):** központi szövegfájl, kulcsokkal; a „modul nem elérhető” felhasználói szöveg **egyetlen kulcs** (lejárt, lemondott és nem aktív modulra ugyanaz; a felület semmivel nem különbözteti meg az okot); a meghívó-oldal hibás, lejárt, visszavont és elfogadott meghívóra ugyanazt mondja; a hibakódok (`utolso_cegvezeto`, `nincs_szabad_hely`, `meghivo_lejart`, `modul_nem_aktiv`) a megadott magyar szövegre képződnek le; a kinevezett cégvezető értesítő levelet kap (a kinevezés sikere után, küldési hiba nem akasztja meg), az eltávolított kolléga nem.
14. **Átadási bejegyzés (D56, `23`):** új tábla `module_handovers` (csak hozzáfűzés, állapot-váltással, csak admin látja); `record_handover` egy tranzakcióban állítja Átadva állapotba a modult és rögzíti az elfogadót (név, mód, dátum, mit kapott); az `admin_set_module_state` közvetlenül nem állíthat Átadva állapotot (`atadas_bejegyzes_kell`); az `activate_company_module` érvényes bejegyzést kér; új átadás felülírja az előzőt (az megmarad), visszavonás csak Átadva állapotban; az „átadáskor” fizetési tétel állapota nem változik, csak emlékeztető jelenik meg.
15. **Az ajánlat-ellenőrző lista és a kalkuláció (D57, `24`) nem fejlesztési feladat:** belső dokumentum; a havi díj ≥ max(2× tipikus önköltség; plafon + egyéb havi költség), a pluszcsomag ára ≥ 2× önköltség.

> A modulok és árak részletes, naprakész leírása a kódban és a `TWINX-memoria-export-web_twinx.md`-ben van (9. szakasz). Az ottani kredites árak történetiek.

## 6. Kőbe vésett minták

- **[ÁTALAKUL — D30, D40] Pénztárca = láthatatlan használati keret** (`wallets`, `wallet_add`/`wallet_deduct`, `chargeCredit({userId, amount})`). Technikailag változatlan, amíg az ingatlanos modulok működése erre épül; a felületen nincs kredit, napló, kérés, „+" gomb. Új funkció az egyedi moduloknál nem erre épül, hanem fejlesztési díjra és havi előfizetésre (D32, D35, D39), a költséget a **láthatatlan havi plafon** védi.
- **Keret csak siker után** vonódik le, hibánál automatikusan visszajár. (Érvényes marad.)
- **Pénzügyi művelet és állapotváltás egy tranzakcióban:** jóváírás + állapotváltás egyetlen `security definer` SQL-függvényben (pl. `credit_purchase_apply`, `credit_request_approve`), különben dupla jóváírás vagy elveszett összeg lesz. Ez a minta **érvényes marad** minden jövőbeli fizetési, előfizetési és **meghívási** műveletre is (a helyek számának ellenőrzése és a meghívás elfogadása egy tranzakcióban; ugyanígy a visszavonás, az eltávolítás, a lejárat, a cégvezetői kinevezés és lemondás).
- **API-költség védelme (a régi „minimum 100% haszon" helyett, D23, D39, D40, D44):** a kreditárazási szabály érvénytelen, és az egyedi modulok ára mindig egyedi. De az API-költséges funkcióknál (kép, videó, kutatás) az önköltséget tudnunk és védenünk kell: **láthatatlan havi plafon** cégenként és modulonként (kötelezően beállítandó, mielőtt a cég használatba veszi; az Aktiválás nélküle nem engedett), vagy az előfizetésbe építés. **A mértékegység forint, nettó önköltség (D53);** a havi díj egy megadott mennyiségre szól, a pluszcsomag modulonként előre megtervezett. Az értékeket az első ilyen modulnál, a modul-kalkulációval és a belső ajánlat-ellenőrző listával együtt határozzuk meg `[KITÖLTENDŐ]`. Részletek: `claude/20-plafon-es-hasznalat-terv.md`.
- **Async job a hosszú munkákhoz** (videó, PRO kutatás, értékbecslés): job-sor Supabase-ben, a kliens pollingoz. A webhookot aláírással/titokkal ellenőrizd.
- **RLS sort szűr, oszlopot nem:** a `usage_history`-ra nincs felhasználói UPDATE/DELETE; az ilyen műveletet a szerver végzi tulajdonos-ellenőrzéssel. A szerepkört csak `service_role` módosíthatja (`profiles_guard_role`). **Új (D25, D30, D35, D41, D43, D45, D46):** a modul-jogosultságot, az előfizetés érvényességét, a helyek számát, a meghívást, a cégvezetői státuszt, az admin jogot és a modul aktiválását is szerveroldalon és RLS-sel kell kikényszeríteni, nem csak a felületen elrejteni. A hozzáférés a **felhasználóhoz** kötött, nem az irodai fiók tagságához: az irodai fiókból való kilépés nem vonhatja vissza, és az irodai fiók admin sem adhat/vonhat meg modul-hozzáférést. Meghívni, fizetni és kinevezni a cég cégvezetői tudnak, **csak a saját cégükben**; az Aktiválás, a helyek számának állítása, mások cégvezetői státuszának elvétele és az admin jog adása csak admin. **A cégvezetői státusz cégenként él, és sosem lehet admin joggá emelni.**
- **Admin jog adása (D45):** kizárólag szerveroldali admin-végpont, amely ellenőrzi, hogy a hívó admin; naplóz (ki, kinek, mikor, adta/elvette); **nem engedi levenni az utolsó admint** (a számolás és a módosítás egy tranzakcióban, hogy két párhuzamos kérés se hagyja nulla adminnal a rendszert). **Ugyanez a minta az utolsó cégvezetőre (D46):** a lemondás és a levétel egy tranzakcióban számolja meg a cég cégvezetőit.
- **Admin előnézet (nézet-váltó):** minden viselkedést vezérlő API-nak követnie kell az előnézetet (`twx_view_as` süti, `resolveViewContext`, csak lefelé váltás); az előnézetben a beküldés blokkolt, és jogot nem ad.
- **Pénzügyi adat és számlázás (D52):** a fizetési, ajánlati és számlázási adat csak adminnak látható (RLS és API is); a számlázási adatokról a fizetési tétel pillanatképet őriz; a számlaszám egyedi; a „Fizetve" és a lejárat-hosszabbítás egy tranzakció; a titkos kulcsok (Számlázz.hu, Stripe) csak szerveroldalon.
- **Használat-mérés (D53):** minden API-költséges műveletnél a foglalás-elszámolás-feloldás minta; a becslés szerveroldali árlistából jön, a böngészőből nem módosítható; a napló csak hozzáfűzhető.
- **Foglalási űrlap (D33, D37, D48):** az űrlap szabad szöveges mezője **külső, nem megbízható bemenet**: sosem fut le belőle semmi, nem kerül automatikusan sehova. Szerveroldali validáció (kötelező mezők, e-mail és telefon formátum), spam-védelem (rate limit vagy honeypot), a foglalt időpont tranzakcióban foglalódjon (dupla foglalás ellen). A böngészőben nincs titkos kulcs.
- **Ügyféladat (D28, D43):** egy ügyfél adata és a nála futó modul csak az ő fiókjából érhető el (a hozzáféréssel rendelkező felhasználóknak), más felhasználó nem láthatja. Az Egyedi modulok lap csak követési adatot tárol. Az NDA szabályai még készülnek.
- **Modul megőrzése és ügyféladat-törlés (D54):** a modul kódja és regiszter-bejegyzése TWINX-vagyon, lemondás és lezárás **soha nem törli**; a kódban nincs cég-specifikus titok vagy adat (a konfiguráció a `company_id`-hoz kötve az adatbázisban él); az ügyféladat törlése csak a harmadik réteget (ügyfél adata és kimenetei) érinti, kétlépéses védelemmel és másik jóváhagyóval; minden modulnak kötelező a törlési és exportálási leírása (`data_policy`). A Supabase mentésekben a törölt adat a mentés lejártáig még létezhet (jogász).
- **Felhasználói szöveg és hibaüzenet (D55):** a felhasználó sosem látja a modul elérhetetlenségének okát; nincs ár, „kredit”, belső azonosító vagy más cég adata a szövegben; a meghívó-oldal nem árulja el a meghívott e-mail címét és azt, hogy egy cím regisztrált-e.
- **Átadási bejegyzés (D56):** az Átadva állapotba csak a `record_handover` léptethet; a bejegyzés nem módosítható és nem törölhető (csak állapotot vált); szövegmezőibe ügyfél titkos adata nem kerülhet.
- **Ne bízz a modell kimenetében, ellenőrizd:** adatot soha ne találjon ki; a manipulált bemenet ne futtathasson ingyen (prompt-injection védelem).

## 7. Felület-szabályok

- Legördülő mező mindig a saját `SelectField`, dátum a saját `DateField`.
- Váltós felületeknél (fülek, módváltók) **fix dobozméret**, a blokkok ne ugráljanak.
- A felület üresen is legyen teljes és szép, üres doboz ne maradjon.
- Munkakártyákon a műveletek (letöltés, áthelyezés, átnevezés, törlés) egy **„⋯" menüben**, ne sűrű ikongombokban. Ugyanez az admin táblák soraira is.
- Ami még nincs kész, ne legyen kattintható álgomb: rejtve vagy „Hamarosan" címkével (pl. a 3D bejárás kártya a referencia-landingen: halványabb, nem kattintható; az irodai fiók közös terének funkciói a főoldali sávban).
- Meglévő komponenseket használj (`Toast`, `ModuleIntro`, `FolderLibrary`, framer-motion), ne párhuzamos megoldást.
- **Személyre szabott felület (D25, D36):** a belépett felhasználó csak azt a felső sávot és modult lássa, amihez joga van; a hiányzó rész ne hagyjon üres dobozt. Üres „Moduljaim" menü: „Itt jelennek meg az egyedi moduljaid."
- **Kapcsolatblokk (D33, D37):** a főoldalon és belépés után is elérhető; a két lépés doboza ugyanakkora, a „nincs szabad időpont" állapot is teljes, szép felület legyen.
- **Felső sáv (D36):** a sáv szélessége nem ugrál; az Irodai fiók mellett fix hely a jelzésnek akkor is, ha az még nem világít. Az admin felület elérése csak adminnak jelenik meg a profil menüben.
- **Admin (D40):** a megjelenés marad; a Cégek kibontható sora nem ugrálhat (fix magasságú tartalom vagy sima animáció).
- **„Hozzáférések" ablak (D46):** fix méretű doboz; a modulsorok kibonthatók, egyszerre egy van nyitva, a lista a dobozon belül görgethető; a helyszámláló („3 / 5 hely") és a meghívó mező állapota (inaktív, ha nincs szabad hely) nem ugrálhat; a műveletek a „⋯" menüben; üres állapotok teljesek (lásd `13`, 3. szakasz).

## 8. „Soha ne" és buktatók

- **Külső automatizáció (Make/Zapier) tilos.** Minden szerveroldali logika natív API route-ban fut.
- **A main-be nincs közvetlen push;** prod-migráció csak jóváhagyással, legyen visszafordítható.
- Az **értékbecslés számát nem az LLM adja**, hanem a motor. A **videót nem vágja szabadkézzel LLM**, csak sablon + szabály.
- **Vercel:** `NEXT_PUBLIC_*` változó ne legyen „Sensitive"; env-változtatás után kötelező a Redeploy; ~4,5 MB kéréslimit (kliensoldali képtömörítés kell); szerveroldali Chromium nem működik.
- **Supabase URL** záró perjel nélkül, különben „Invalid path specified in request URL".
- **Satori:** woff2 betűt nem olvas (ttf/otf kell); a `lineClamp` nem vág, a szöveget karakterre kell illeszteni; a fix magasságú blokkok gyereke `flexShrink: 0`.
- A comp-cache külön, gyors kódág az értékbecslésben: új mezőt oda is be kell kötni.
- **Regisztráció:** a user törlését az `offices.owner_id` RESTRICT akadályozza (ismert hiba, javítandó), előbb az irodát kell törölni. Az új irodai fiók modellnél (D35: több iroda, a létrehozó az admin, tagcsere) és a Cég/cégvezető/meghívás modellnél (D41, D45, D46) ezt át kell gondolni.
- **Meghívó e-mail:** a cégvezető által megadott cím külső bemenet; a meghívó token ne legyen kitalálható, egyszer használatos és lejár; ne szivárogjon ki, hogy egy cím regisztrált-e (a levél, az oldal és a válasz minden címnél ugyanaz legyen). Az elfogadás csak megerősített, egyező e-mail címmel engedett.
- **Resend:** a foglalási és a meghívó levelekhez a twinx.hu domain hitelesítése kell (DNS-rekordok a Rackforestnél); amíg nincs kész, a levél nem megy ki megbízhatóan.
- **Adatkezelési tájékoztató:** a foglalási űrlap és a meghívó e-mailek éles indítása előtt készen kell lennie (GDPR); a lábléc linkje addig „Hamarosan". A vázlat kész (`17`, D50); jogászi ellenőrzés és a cég adatai kellenek hozzá.

## 9. Kapcsolódó dokumentumok (a TWINX projektben)

- **`claude/00-iranyvaltas-D23.md`:** az új irány hivatalos leírása és a bemásolható szöveg. **Mindig ez az irányadó.**
- **`claude/11-fooldal-es-landing-terv.md`:** a főoldal, a belépett kezdőlap, a kapcsolatblokk, a referencia-landing és az előfizetés/irodai fiók modelljének terve (D34–D39, D46-ig frissítve). **Webes módosításnál ebből dolgozz.**
- **`claude/12-admin-terv.md`:** az admin szerkezete, a szerepkörök, az Egyedi modulok lap és a modul-regiszter (D40–D56-ig frissítve). **Admin-módosításnál ebből dolgozz.**
- **`claude/13-hozzaferesek-terv.md`:** a „Hozzáférések" ablak, a meghívás folyamata és e-mailje, a cégvezetői szabályok, a biztonsági követelmények és az állapotgép (D46). **Meghívás, hozzáférés és cégvezetői státusz fejlesztésénél ebből dolgozz.**
- **`claude/14-adatmodell-terv.md`:** táblák, függvények, RLS, átállítás, ellenőrzési lépések (D47, kiegészítve D48–D56). **Adatbázis-módosításnál ebből dolgozz.**
- **`claude/15-foglalas-terv.md`:** időpontfoglalás, Foglalások lap, értesítések (D48). **`claude/16-email-szovegek.md`:** jóváhagyott e-mail- és Telegram-szövegek (D49).
- **`claude/17-adatkezelesi-tajekoztato-vazlat.md`:** adatkezelési tájékoztató vázlata és jogász-ellenőrzési lista (D50).
- **`claude/19-dijak-es-fizetes-terv.md`:** ajánlat, fizetési napló, számlázás, lejárati figyelmeztetés (D51–D52). **`claude/20-plafon-es-hasznalat-terv.md`:** plafon, használat-mérés, pluszcsomag, modul-kalkuláció (D53). **`claude/21-lezaras-es-lemondas-terv.md`:** modul lemondása, cég lezárása, ügyféladat törlése/visszaadása, a modul megőrzése, újraaktiválás (D54).
- **`claude/21-lezaras-es-lemondas-terv.md`:** modul lemondása, cég lezárása, ügyféladat törlése/visszaadása, a modul megőrzése (D54). **`claude/22-felhasznaloi-szovegek.md`:** felhasználói szövegek és a kinevezési levél (D55). **`claude/23-atadas-jovahagyasa-terv.md`:** az átadási bejegyzés (D56). **`claude/24-ajanlat-ellenorzo-lista-es-kalkulacio.md`:** belső ajánlat-ellenőrző lista és kalkuláció sablon (D57; belső, nem fejlesztési feladat).
- **`claude/18-atadas-fejlesztesi-beszelgetesnek.md`:** áttekintő átadó-dokumentum a fejlesztési beszélgetésnek.
- **`claude/TWINX-memoria-export-web_twinx.md`:** a régi fejlesztési szál 41 jegyzete (régi irány; a technikai tudás és a buktatók érvényesek). Modul-specek, videómotor, értékbecslő motor, Stripe, deploy, buktatók. **Konkrét modulon dolgozva először ezt olvasd.**
- **`claude/ai-ugynokseg/01-alap-es-szabalyok.md`:** az AI ügynökség célja, szabályai, döntési naplója (D01–D57).
- **`claude/ai-ugynokseg/02-keretrendszer-spec.md`:** az ügynökség felépítése és építési sorrendje.
- **`claude/ai-ugynokseg/03-dontesi-lap.md`:** a Tibivel közös nyitott döntések (történeti).
- **`claude/ai-ugynokseg/05-CLAUDE-marketing.md`:** a TWINX marketing tudásbázisa (Tibinek).
- **`claude/ai-ugynokseg/06`–`09`:** az ügynökség partner ága — **háttérbe került (D23)**; a fejlécük jelzi, mi érvénytelen.
- **`claude/ai-ugynokseg/10-fejlesztoi-ag-alugynokok.md`:** a fejlesztői ág 6 alügynöke.

## 10. Hogyan bővítsd ezt a fájlt

- Új bevált minta vagy buktató → a 6. vagy 8. szakaszba, rövid, konkrét sorként.
- Új vagy megszűnt modul → az 5. szakasz.
- Ha egy szakasz túl nagy lesz, emeld ki külön fájlba, és itt hagyj hivatkozást.
