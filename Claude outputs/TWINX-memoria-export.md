# TWINX projekt-memória export

Készült: 2026-11-04 — a **web_twinx** claude.ai projekt memóriájából.
Cél: beimportálni egy másik projekt (TWINX – fejlesztés/ötletelés) memóriájába.

## Hogyan importáld a cél-projektben
1. Nyiss egy új beszélgetést a **TWINX – fejlesztés/ötletelés** projektben.
2. Húzd be / csatold ezt a fájlt (vagy nyisd meg ott a web_twinx mappát, ahol ez a fájl van).
3. Írd azt: „Olvasd be ezt a TWINX-memória exportot, és mentsd el a projekt memóriájába."
   — ekkor minden lenti jegyzet újra létrejön a cél-projekt memóriájában.

Megjegyzés: a fiók-szintű (projekt nélküli) TWINX-jegyzetek és a profilod NEM ebben a fájlban
vannak — azokat a cél-projekt automatikusan látja, ha a memória-beállítása „összekapcsolt".
Ez a fájl a web_twinx projekthez KÖTÖTT 42 jegyzetet tartalmazza.

Minden szakasz egy memória-fájl. A `<<<FILE: ...>>>` sor a projekten belüli relatív útvonal,
alatta a teljes tartalom (frontmatter a `---` közt + törzs).

---

<<<FILE: ad-check-module.md>>>
---
name: ad-check-module
description: "Hirdetés-ellenőrző modul: link alapján elemzi egy meglévő hirdetés szövegét és újraírja"
sources: [cowork-import]
aliases: []
---

**Hirdetés-ellenőrző** (2026-07-29, SQL lefuttatva, működik). A partner bemásol egy nyilvános hirdetés-linket, választ hangnemet, és 1 kreditért kap: **0-100 pontot** négy szempontra (hiányzó infók / cím és első mondat / szerkezet / meggyőző erő), **mondatszintű átfogalmazásokat** (eredeti → javasolt → miért), **kiemelendő értékeket** mindegyikhez egy pipálható kérdéssel („van erről fotó?"), **pótlandó adatokat**, és a **teljes újraírt hirdetésszöveget**. PDF-be menthető.

**Jóváhagyott döntések:** a **fotókat NEM elemezzük** (csak felhívjuk a figyelmet, mihez kell kép); nincs piaci összevetés (későbbre); a hiányzó adatok az újraírt szövegben `[REZSI: …]` alakú kitöltendő helyként jelennek meg — SOHA nem találunk ki adatot; ha a link nem érhető el, a rendszer kéri a szöveg bemásolását és NEM von kreditet.

**Felépítés:** `lib/adcheck.ts` (kliens-biztos rész: hangnemek, típusok, parse) + `lib/adcheck-prompt.ts` (**csak szerveroldalról importálható** — különben a teljes prompt a böngésző bundle-jébe kerülne!). Prompt-modul kulcsa: `ad_check`, admin felületen szerkeszthető. API: `/api/real-estate/ad-check` (+ `/manage` a mappákhoz). Modell: `runSonar` — bemásolt szövegnél `disableSearch: true`.

**Minden elemzés kap egy főcímet** (`ad_checks.title`, a modell adja: „Település (kerület), utca — típus, méret") — ez látszik a könyvtárban, az ablakban, az előzményekben és a PDF-en, nem a nyers link.

**Prompt-injection védelem:** a modell `{"error":"unreachable"}` jelzését CSAK rövid (<200 karakter) válasznál fogadjuk el — különben egy manipulált oldal ingyen futtathatna elemzéseket.

Az eredmény nem az oldalon jelenik meg, hanem kártyáról nyíló ablakban — lásd [[library-folders-pattern]].

<<<FILE: admin-credit-tools.md>>>
---
name: admin-credit-tools
description: "Admin kredit-kezelés: adás a Felhasználók táblából, kredit-napló, sales kredit-kérés"
sources: [cowork-import]
aliases: []
---

**Szerepkörök (a CLAUDE.md ezt még ELAVULTAN írja le!):** csak az **admin** korlátlan (a `chargeCredit` átengedi, nincs levonás). A **sales FOGYASZTJA a keretét**, mint egy sima felhasználó — az admin adja neki a kreditet és tölti újra, így korlátozható. Az admin felület minden oldala `role === "admin"`-t követel, a sales oda nem lát be.

**Admin felület (2026-07-29 átrendezve):**
- A külön „Kredit kezelés" fül MEGSZŰNT. A kredit-adás a **Felhasználók** táblában van: a Kredit oszlop jobb szélén egy „+" gomb → felugró ablak (partner neve/cége/e-mailje, gyorsgombok 10/25/50/100, szabad mennyiség, opcionális indoklás).
- A **szerepkör** (admin/sales/felhasználó) is itt állítható, a Szerep oszlop legördülőjével (átkerült a Költségfigyelőből). A saját admin jogot a szerver nem engedi elvenni.
- **Kredit-napló** külön menüpont a felső sávban: ki kinek mikor mennyit adott és miért; kereshető. Tábla: `credit_grants` (credit-grants.sql), csak admin olvashatja.
- **Kredit-kérések** külön menüpont: a nem-admin felhasználó a **Beállításokban** kér keretet (mennyiség + indoklás, egyszerre EGY függő kérés), az adminok **e-mailt kapnak** (Resend, `CREDIT_NOTIFY_EMAIL` vagy `LEADS_NOTIFY_EMAIL`). Jóváhagyáskor a mennyiség felülírható; elutasításnál indoklás adható. Tábla: `credit_requests` (credit-requests.sql).

**Pénzügyi minta, amit MINDIG kövess (háromszor is előjött):** a kredit-jóváírás és az azt kísérő állapotváltás EGYETLEN adatbázis-tranzakcióban fusson egy `security definer` SQL függvényben — különben vagy dupla jóváírás lesz (két párhuzamos hívó), vagy elveszett kredit (lezárt állapot jóváírás nélkül). Meglévő függvények: `credit_purchase_apply` (Stripe), `credit_request_approve` (kredit-kérés), `video_clip_result` / `video_clips_init` / `video_job_claim_render` / `video_job_fail_once` (videó).

Lásd még: [[stripe-go-live]], [[credit-100-percent-profit-rule]].

<<<FILE: admin-view-as-preview.md>>>
---
name: admin-view-as-preview
description: "Admin „így látja a partner\" előnézet — cookie-alapú, csak lefelé válthat, beküldést blokkol"
sources: [cowork-import]
aliases: []
---

Az admin **kilépés nélkül átkapcsolhat felhasználói vagy sales nézetbe** (2026-08-19). A user kérése: „nem tudom mit kell javítani, ha nem látom, mit lát a partner" — és ne kelljen másik e-maillel belépni.

`src/lib/view-as.ts` → `resolveViewContext(realRole)` oldja fel a megjelenítendő szerepkört a `twx_view_as` httpOnly cookie-ból. **Biztonsági szabályok:** aki nem admin, annál a függvény a cookie beolvasása ELŐTT visszatér (hatástalan); a cookie whitelistje csak `user`/`sales`, `admin` értéket felvenni nem lehet → csak lefelé válthat, jogot soha nem ad. Az `/admin/*` oldalak, az admin API-k és `lib/credits.ts` továbbra is a VALÓDI DB-szerepkört nézik.

`ViewAsBar` lengő sáv a képernyő alján (Admin / Sales / Felhasználó), előnézetben bordó, „Vissza admin nézetbe" gombbal. A `dashboard/layout.tsx` a `view.canPreview`-ra köti (valódi jog), ezért nem lehet magát kizárni. Az `admin/layout.tsx` is kiteszi, ha bent maradt egy bekapcsolt előnézet.

**Fontos tanulság:** minden olyan API, ami a felület viselkedését vezérli, kövesse az előnézetet — különben hazudik. Ebbe belefutottunk: a `/api/me/billing-state` először a valódi (admin) szerepkört adta vissza, ezért sales előnézetben árakat mutatott a csomag-ablak.

A beküldést előnézetben blokkoljuk (`preview` prop → „Ez csak előnézet"): `CreditRequestPanel`, `BillingForm`, `PricingModal`. A modulok (értékbecslés, videó…) viszont előnézetben is VALÓDI generálást indítanak, adminként kreditlevonás nélkül — a megjelenés vizsgálatára jó, a kredit-viselkedésére nem.

Lásd még: [[credit-billing-flow]], [[admin-credit-tools]].

<<<FILE: areas/irodai-fiok-ujratervezes.md>>>
---
name: irodai-fiok-ujratervezes
description: Az Irodai TWINX fiók oldal átépítése két megjelenési terv (vezetői + kolléga nézet) alapján — Márk szabályai és a menet.
sources: [cowork]
aliases: [irodai felület, iroda dashboard]
---
- [stated] Két megjelenési tervet adott: twinx-irodai-fiok-vezetoi.html (létrehozó + vezetői jogúak) és twinx-irodai-fiok-kollega.html (meghívott kollégák); csak megjelenési tervezet, a nevek/számok mintaadatok.
- [stated] Arculat: sötét fejléc-sáv, világos tartalom, korall akcent, Space Grotesk címek.
- [stated] Menet: 1) felülvizsgálati táblázat (kód nélkül) → 2) fázisolt terv, döntési pontokkal, jóváhagyásra vár → 3) építés.
- [stated] Az első fázis a már működő adatra épül (elrendezés, egyenleg, tagok, keretkezelés); üzenetek, mappák, kedvencek utána.
- [stated] Ami még nincs kész, ne legyen kattintható álgomb: rejtve vagy „Hamarosan” címkével.
- [stated] Meglévő komponenseket használjon (SelectField, Toast, ModuleIntro, FolderLibrary, motion), ne párhuzamos megoldást.
- [stated] Kredit adása/visszavétele egy tranzakcióban, naplózva (ki, kinek, mennyit, mikor, megjegyzés), nem mehet negatívba; szerveroldali (RLS) védelem kell, nem csak felületi.
- [stated] Új csatlakozási kód generálásakor a régi azonnal legyen érvénytelen.
- [stated] Mobilon: a tagtáblázat görgethető dobozban, oszlopok egymás alatt.
- [stated] Döntések: keret-modell = foglalás; a vezető a kollégák munkáit címmel együtt látja; a vezető jogú tag látja az irodai egyenleget és a csatlakozási kódot, de nem tölthet fel, csak oszthat a kreditekből.
- [stated] Elfogyott irodai keretnél: „folytatás saját kreditből” lehetőség.
- [stated] „Mindenki” címzett egy gombnyomással kiválasztható legyen.
- [stated] A tervben szereplő minden rész látszódjon akkor is, ha még nincs munkafolyamat (pl. az üzenetek ablaka üresen is); a felület elsőre megnyitva is szépen nézzen ki.
- [stated] A blokkok ne ugráljanak, ha sok bennük a tartalom vagy megnyitnak valamit (pl. új mappa ne tolja le a kredit-mozgásokat).
- [stated] Kedvenc modulok felhasználónként; a kolléga-nézetben a ténylegesen létező modulok legyenek (a terv modullistája csak példa).

<<<FILE: areas/twinx-marketing-kulcsszavak.md>>>
---
name: twinx-marketing-kulcsszavak
description: TWINX egyedi modul — eltett marketing-kulcsszavak, amiket később máshova (landing, előny-sáv, hirdetés) be akar tenni
sources: [cowork]
aliases: [hero kulcsszavak, egyedi modul kulcsszavak]
---
- [stated] asked to remember: a hero-ikonok kulcsszavai későbbi felhasználásra, máshova beépítve
- [stated] „−10 óra / hét — kézi munka helyett”
- [stated] „Másodpercek alatt — kész anyag, 1 kattintás”
- [stated] „Hatékonyság ↑ — több munka, ugyanannyi idő”
- [stated] „A te vállalkozásodra szabva — a saját igényeidhez készül” (a „nem dobozos” nem tetszik neki: azt kell hangsúlyozni, hogy minden egyedi modul egy adott vállalkozáshoz és annak igényeihez készül)
- [stated] „Heti riport — magától elkészül”
- [stated] „Több idő az ügyfélre — kevesebb adminisztráció”

<<<FILE: areas/twinx-termekstrategia.md>>>
---
name: twinx-termekstrategia
description: TWINX termékirány és stratégiai döntések (piacok, modulok, következő nagy fejlesztések) — új modulok tervezésekor olvasd.
sources: [cowork]
---
- [stated] Az ingatlanpiac csak az induló kör; később sok más piaci szegmens cégeire fejlesztett modulok is elérhetők lesznek a TWINX-ben.
- [stated] A brainstormból az „Ingatlan-munkalap" (egy megbízás = egy hely, a modulok onnan dolgoznak) ötlet tetszett neki; később visszatérünk rá.
- [stated] A TWINX indulásra kész; a további, strukturált fejlesztést a Claude Code verzióban tervezi folytatni (a Cowork eddig jól működött).
- [stated] Sürgősebb: a Portál Központ (bejelentkezés utáni kezdőlap) újragondolása — most hiányzik a „WOW" hatás regisztráció/belépés után; ne a korábbi munkákra épüljön, hanem az érdeklődés felkeltésére.

<<<FILE: areas/twinx-video-engine.md>>>
---
name: twinx-video-engine
description: Saját TWINX videó-generáló motor a Shotstack kiváltására — célok, keretek, döntések.
sources: [cowork]
aliases: [saját videómotor, TWINX render engine, Shotstack kiváltása]
---
- [stated] Fő cél: a TWINX-nek legyen saját videó-generáló kódja, idővel le akar válni a Shotstackről.
- [stated] Saját gyártású sablonok kellenek, beleértve az áttűnéseket és a színeket, hogy később egyszerű legyen új sablont gyártani.
- [stated] A saját gyártás az admin oldalon fut/fejlődik; git push csak akkor, ha jól működik.
- [stated] A Shotstack addig marad, amíg a saját TWINX gyártás nem tökéletes.
- [stated] A localhost admin oldalon jelzést kér arról, hogy épp melyik rendszer (Shotstack vagy saját) működik.
- [stated] A saját motor elkészült és jóváhagyta („minden ami eddig készült jó"); élesbe kérte a twinx.hu-ra, a Shotstack nem törölve, csak tartalék vészhelyzetre.
- [stated] A motort (saját / Shotstack) az admin Videólaborban lehessen kiválasztani; az admin kezdőlapról a „Videómotor" jelzést kivetette.
- [stated] Shotstacket nem előfizetéssel, hanem 10 dolláros feltöltéssel használta.
- [stated] Sablonok: Aurora (Borostyán, Éjkék) és Skandi (Homok, Zsálya); a szerkesztőben sablonkártya + egymás alatti színvilág-gombok, nagy előnézet.
- [stated] Skandi: háztető-formájú nyitó- és zárópanel (csúcsa az ingatlanos fotójában, fotó nélkül is szép), egységes feliratdoboz-betű, 80 karakteres képfelirat, nagyobb betű a nyitó/záróképen.
- [stated] Új sablon fejlesztés alatt: „Prestige" (luxus) — csak localhoston, amíg nincs végleges verzió. Ingatlanos landing-ikonok, a szimbólumos áttűnésnél a B változatot választotta: a szimbólum belsejében a következő fotó („átlépés a következő szobába").
- [stated] Prestige áttűnése később filmburn lett (saját küldött klip, Screen mód, hang fele hangerőn; a perforáció fele lógjon a képbe); a felső ikonok díszként maradtak. 9:16-ban nagyobb betűket és feliratdobozt kért.
- [stated] 2026-10-06: a Prestige-et élesítésre engedte, és a motorkapcsoló (app-settings.sql) is mehet a Supabase-be.
- [stated] Mozgás-szabály a fotó fajtája szerint (a rendszer ismerje fel, milyen képet kapott): széles fotónál pásztázás (minél többet mutasson a lakásból), a videóval egyező 9:16-os fotónál be- és kizoomolás. Belenagyítás széles fotóba nem kell (hibaforrás, pl. csak az ágy sarka látszik).
- [stated] A „Teljes kép" módot (elmosott háttér) kipróbálta és elvetette — a pásztázás mutat többet.
- [stated] A zárókép: háttérben az 1. fotó, rajta réteg az adatokkal, az ingatlanos fotójával és az iroda logójával (ha az arculatban fel van töltve) — a Shotstack-zárókép mintájára kell megcsinálni.

<<<FILE: credit-100-percent-profit-rule.md>>>
---
name: credit-100-percent-profit-rule
description: Twinx árazási alapszabály — minden kreditet fogyasztó funkciónál kötelező a min. 100% haszon.
sources: [cowork-import]
aliases: []
---

**Kőbe vésett szabály (nem eltérhető):** a Twinx AI Portálon MINDEN kreditet fogyasztó
funkció (értékbecslő, látványtervező, videó és bármely jövőbeli modul) árazásánál
kötelező a **minimum 100% haszon**, azaz az **eladási ár ≥ 2× a nyers API-önköltség** —
és ennek a **legmélyebb kedvezményes szinten is** teljesülnie kell.

**Hogyan alkalmazd:** új funkció kredit-árát úgy állítsd be, hogy
`kredit_darab × (legmélyebb kedvezményes Ft/kredit) ≥ 2 × önköltség_Ft`.
Jelenlegi csomagok: induló 499 Ft/kredit, közepes (50 kr) 399 Ft, nagy (100 kr) 349 Ft
→ a kötelező ellenőrzés a **349 Ft/kredit**-nél történik. Árfolyam: [[fix 380 HUF/USD]].

Ha egy funkció a jelenlegi kredit-árán nem éri el a 100%-ot, EMELNI kell a kredit-árát
(nem a hasznot csökkenteni).

<<<FILE: credit-billing-flow.md>>>
---
name: credit-billing-flow
description: "Kredit-igénylés két ága — sales ingyen, sima felhasználónak számla; a kredit befizetés után jár"
sources: [cowork-import]
aliases: []
---

**Amíg a Stripe vásárlás nincs élesítve, MINDENKI az admintól igényel kreditet** (2026-08-19-i fejlesztés). Két ág, szerepkör szerint:

- **sales** → `billing_kind='free'`: szabad mennyiséget kér, INGYEN kapja, az admin egy kattintással jóváírja. Nincs számlázás.
- **user** → `billing_kind='invoice'`: FIX csomagot választ (`lib/packages.ts` — ugyanaz a forrás, amit majd a Stripe Checkout is használ), számlát állítunk ki, és a **kredit CSAK a befizetés rögzítésekor** íródik jóvá. A user döntése volt: befizetés után, nem kiállításkor.

Állapotgép a `credit_requests`-en: `invoice_status` = `none` (sales) | `to_issue` → `issued` (számlaszámmal) → `paid`. A `paid` átmenetet a **bővített `credit_request_approve` RPC** végzi, tehát a lezárás + jóváírás + napló + „befizetve" jelölés EGY tranzakció. A `credit_request_mark_issued` RPC csak státuszt lép, kreditet nem ad.

Számlázási adat a `profiles`-ban, **KÉT blokkban** (könyvelői előírás, 2026-08-19): a vásárló SAJÁT adatai mindig kötelezők (`billing_name/zip/city/address/country/email`), és ha bepipálja a „Cég vagy egyéni vállalkozás nevében vásárolok" mezőt (`billing_type='company'`), akkor a CÉG adatai is (`billing_company_name/zip/city/address/country` + `billing_tax_number`). A számla ilyenkor a cégre készül, a személy a kapcsolattartó. Nem-céges mentéskor a céges mezőket NULL-ra írjuk, hogy régi cégnév ne ragadjon bent. Az oszloplista egy helyen: `BILLING_COLUMNS`. Validáció **egy helyen**: `lib/billing.ts` → `validateBilling`. A `BillingForm` komponenst KÉT helyen használjuk ugyanúgy: a Beállítások oldalon kártyaként, és a kredit-igénylés felugró ablakában `embedded` módban. Hiányos adatnál a POST **428**-cal + `needsBilling:true`-val válaszol, és a panel ebből nyitja a kaput. A kérés beadásakor **pillanatképet** (`billing_snapshot` jsonb) mentünk, hogy egy későbbi adatmódosítás ne írja át a már kiállított számla adatait.

A user kérte, hogy a felugró ablak mondja ki: **induló, átmeneti időszak**, a bankkártyás fizetés hamarosan automatikus lesz, addig várni kell a jóváírásra.

Admin oldal (`/admin/credit-requests`): fülek *Számlázandó / Fizetésre vár / Sales keret / Lezárt*, másolható számlaadat-blokk (`billingCopyBlock`), CSV export a könyvelésnek (BOM-mal, hogy az Excel jó legyen az ékezetekkel). A számla kézzel készül a számlázó programban — a számlaszámot az admin visszaírja.

**Mellékesen javított biztonsági rés:** a `profile-company.sql` „profiles_update_own" policy-je MINDEN oszlopra vonatkozott, így a böngészőből a saját `role` is átírható lett volna `admin`-ra. A `credit-billing.sql` egy `profiles_guard_role` triggert tesz rá: a szerepkört csak `service_role` módosíthatja.

A csomag-ablak (`PricingModal`) is ezt a folyamatot indítja: amíg `CHECKOUT_ENABLED` (`NEXT_PUBLIC_CHECKOUT_ENABLED`) false, a „Vásárlás" gomb helyén halvány „Hamarosan" van, és alatta a Kredit igénylés blokk — a modál ugyanabban az ablakban vált igénylő nézetre. A `/api/checkout` végpont is 503-at ad, amíg a kapcsoló false. Sales-nek a modál automatikusan az igénylő nézeten nyílik, ár nélkül. Az állapotot a `/api/me/billing-state` adja, ami **követi az admin view-as előnézetet** (lásd [[admin-view-as-preview]]).

**Regisztrációkor 3 INGYENES próbakredit** (2026-08-19, a user döntése): a `welcome-credits.sql` bővíti a `handle_new_user` triggert (wallet + `credit_grants` napló-bejegyzés „rendszer" néven), és visszamenőleg is jóváír annak, akinek még nincs pénztárca sora. A konstans két helyen él: SQL-ben `v_welcome`, kódban `WELCOME_CREDITS` (`lib/onboarding.ts`) — együtt kell módosítani.

**Futtatandó SQL sorrendben: `credit-requests.sql` → `credit-billing.sql` → `credit-billing-company.sql` → `welcome-credits.sql`.**

Lásd még: [[stripe-go-live]], [[admin-credit-tools]], [[global-credit-wallet]], [[credit-100-percent-profit-rule]].

<<<FILE: dashboard-onboarding.md>>>
---
name: dashboard-onboarding
description: "Portál Központ vizuális nyitánya — próbakredit, első lépések, modul-vitrin rajzolt előnézetekkel"
sources: [cowork-import]
aliases: []
---

A Portál Központ (2026-08-19-ig) túl száraz volt: nagy fekete sávban egy `0`, három hosszú marketing-szöveg a landingről, és egy üres „Legutóbbi tevékenység". Egy új felhasználó első üzenete az volt, hogy fizessen.

**A végleges sorrend:** cím → fekete egyenleg-sáv → **`WelcomeHero`** → **„Folytasd, ahol abbahagytad"** → Kategóriák (legalulra).

`WelcomeHero` (`components/dashboard/WelcomeHero.tsx`, framer-motion) — a user kérésére RÖVID:
- Üdvözlés keresztnévvel (magyar névsorrend: a `full_name` UTOLSÓ szava), alatta a szlogen: „Egy helyen minden eszköz a gyorsabb, igényesebb mindennapi munkához." (AI szó NÉLKÜL, ez külön kérés volt.)
- Jobb oldalon a `Wordmark`, alatta a próbakredit-jelvény — csak ha még nincs egyetlen `usage_history` sora sem és az egyenleg ≤ `WELCOME_CREDITS`.
- Egy korábbi „Első lépések" csekklistát MEGÉPÍTETTÜNK, majd a user kérésére KIVETTÜK (túl sok volt). Ne javasoljuk újra.
- **Modul-vitrin** („Próbáld ki"): 4 csempe kredit-árral és várható idővel (`SHOWCASE` a `lib/onboarding.ts`-ben).

`RecentActivity` átalakult **„Folytasd, ahol abbahagytad"** sávvá: az első 4 munka nagy, bélyegképes kártyán (kép → valódi thumbnail, videó → sötét kártya lejátszó-jellel, PDF → korall jelzés), emberi időjelöléssel („ma", „3 napja"), a fejlécben a *Legtöbbet használt: X*. Az „Összes munkám (N)" gomb nyitja a régi listát; a lightbox mindkettőből ugyanaz. Ha nincs egy munka sem, a szekció **nem jelenik meg** (nincs üres doboz).

`components/dashboard/ModulePoster.tsx` — kódból rajzolt SVG előnézetek. Tanulságok: a képjavító csempéjén NE clipPath-tal vagy áttetsző fátyollal csináljuk az előtte/utána hatást (elcsúszik, és a sandbox rasztere sem tudja ellenőrizni) — két teljesen kirajzolt, egymás melletti fél-jelenet a megbízható, tompa-hideg vs. világos-meleg palettával. A hirdetés-csempe VALÓDI mintát mutat (`/flyer-samples/openhouse-1x1.png`).

Sandbox-ellenőrzés: az ImageMagick `convert` **figyelmen kívül hagyja** az `opacity` / `fill-opacity` attribútumot rect-en, és elrontja a `clipPath`-ot. SVG-t úgy érdemes ellenőrizni, hogy python-ból ÚJRA megírjuk ugyanazokkal a koordinátákkal, nem a JSX-et parse-oljuk.

**Következő körre felvetett, MÉG NEM megépített ötletek** (a user ötletelést kért, ezekből választ majd): élő „Most készül" kártya a futó videó/PRO-kutatás jobokból (`video_jobs`, `supplier_jobs`); havi számok (elkészült anyagok, elfogyott kredit); iparág-váltó, ami szűri a vitrint, a szöveges Kategóriák helyett; ⌘K parancssáv; hír-sor a fejlécben. Nyitott kérdés: generáljunk-e valódi előnézetet a videóhoz (első kocka) és a riporthoz (első oldal), vagy maradjon az ikonos kártya.

Lásd még: [[credit-billing-flow]], [[redesign-phase7]].

<<<FILE: embed-partner-integration-idea.md>>>
---
name: embed-partner-integration-idea
description: Jövőbeli irány — a TWINX funkciók (pl. ingatlan értékbecslés) beágyazása/kiajánlása külső partneroldalakra. MOST NEM AKTUÁLIS.
sources: [cowork-import]
aliases: []
---

2026-07-10: ötleteltünk arról, hogyan ágyazhatnák be más ingatlanos oldalak a TWINX funkcióit (pl. értékbecslés) a sajátjukba. A user szerint MOST NEM AKTUÁLIS — később térünk rá vissza.

Lehetőségek (áttekintés): (1) beágyazható widget (iframe/JS-snippet, domain-allowlisttel) — legkisebb belépési korlát; (2) publikus API API-kulccsal — natív integráció; (3) WordPress plugin — erős disztribúció; (4) teljes white-label portál (multi-tenant). Közös „vízvezeték": partners+api_keys tábla, partneronkénti mérés/számlázás (a meglévő költséglogolásra építve, a [[credit-100-percent-profit-rule]] betartásával), multi-tenancy + RLS, biztonság (böngészőben nincs titkos kulcs, csak publikus kulcs + domain-allowlist), jogi keret. Javasolt kezdés: widget + partner-kulcs/mérés réteg, mert erre a többi ráépül. Alapok, amik már megvannak: arculat-profilok (white-label alap), kredit + api_cost_logs (elszámolás alap), B2B-űrlap (partnerigény).

<<<FILE: flyer-generator-spec.md>>>
---
name: flyer-generator-spec
description: "A Hirdetéskészítő (flyer generátor) modul teljes specifikációja — moduláris, arculat-profilos, több layout, AI/manuális szöveg."
sources: [cowork-import]
aliases: []
---

2026-07-10-én véglegesített terv a **Hirdetéskészítő** modulhoz (a jelentés-PDF profi HTML→PDF motorja után, puppeteerrel).

**Felépítés — moduláris:** önálló, kategória-független modul egy sablon-regiszterrel. Indulás egy „Ingatlan" hirdetéssablon-családdal, de új kategóriák később csak új sablonnal bekapcsolhatók. Menüben ÖNÁLLÓ felső menüpont ÉS az Ingatlan kategória alatt is.

**Arculat-profilok (több / fiók):** egy céges belépést többen használhatnak, ezért `branding_profiles` tábla — több profil egy user alatt (pl. „Péter", „Andrea"), generáláskor kiválasztható. Mezők: label, display_name, title, phone, email, company, website, slogan, logo_url (Storage), accent_color, font, theme. Ezek globálisak, bármelyik jövőbeli sablonhoz.

**TWINX sablonok + testreszabás:** 4+ kész TWINX layout (NEM nulláról tervező). A partner ezeket szabhatja: akcentszín, betűtípus (pár választható), világos/sötét téma, szekciók ki/be, méret/formátum. A logó, elérhetőség, fotók, szöveg alapból a partneré.

**Formátumok:** A4 álló → PDF; social arányok (1:1, 4:3, 16:9, 9:16) → PNG kép (puppeteer screenshot a megfelelő px méretben); egyedi méret is.

**Adatforrás:** a partner VAGY a munkakönyvtárból választ (korábbi értékbecslés/telek/látványterv/videó az előzményekből → adatok+képek behúzása), VAGY sajátot tölt fel/ír be (ha nincs korábbi munkája nálunk). Mindkét út kell.

**Szöveg:** AI generálja a kiemeléseket+leírásokat (választható hangnem: tényszerű / marketinges / prémium) VAGY a partner maga írja — blokkonként.

**Kredit:** induláskor 0 (ingyenes), de a kredit-ár egyetlen konfigból bekapcsolható később (lásd [[credit-100-percent-profit-rule]] és [[global-credit-wallet]]).

**Render:** HTML/CSS sablon → PDF/PNG puppeteerrel (mint a jelentés-PDF, `report-pdf.ts` mintájára).

Fázisok: F1 arculat-profilok (tábla+CRUD+logó feltöltés+Arculatok oldal) → F2 hirdetés-adat (munkakönyvtár-választó + saját feltöltés/beírás) → F3 AI szöveg (hangnem/manuális) → F4 layoutok+render (PDF/PNG, méretek, szín/betű/téma/szekciók) → F5 menü+katalógus+activity+kredit-konfig.

**ÁLLAPOT (2026-07-10): F1–F5 KÉSZ és commitolva.** Fő fájlok: `branding.sql`+`lib/branding.ts`+`/api/branding` (profilok); `lib/flyer.ts` (FORMATS/TONES/LAYOUTS/FLYER_CREDITS=1); `/api/flyer/library|text|generate|accept`; `lib/flyer-template.ts`+`lib/flyer-render.ts` (HTML→PDF/PNG puppeteer, fit-to-page zsugorítás); `dashboard/flyer/page.tsx`. Folyamat: előnézet INGYENES+vízjeles (/generate) → Elfogadom 1 kredit → tiszta (/accept). Futtatandó Supabase-ben: `branding.sql`. **Jelenleg 2 layout** (classic, overlay) — a `FLYER_LAYOUTS` + a `buildFlyerHtml` isOverlay-ágának mintájára bővítendő továbbiakkal (NYITOTT feladat).

<<<FILE: flyer-render-approach.md>>>
---
name: flyer-render-approach
description: A hirdetéskészítő render-motorja (Satori) és a lépésenkénti varázsló, AI nélkül
sources: [cowork-import]
aliases: []
---

A **Hirdetéskészítő teljesen átépült (2026-07-27).** Két nagy döntés:

**1) NINCS AI a generálásban.** A user egyértelműen kérte: se Perplexity-alapú kép, se Nano Banana. Kipróbáltuk az AI-hátteret (Nano Banana komponál hátteret + mi írunk rá szöveget) — nem volt jó (az AI nem hagy pontos helyet, átrajzolja a fotókat). Kivéve. A **fotókat MI rendezzük** kódból egy sablonba, a feliratokat élesen írjuk rá. (Az AI szöveg-generáló GOMB az Adatok lépésben opcionálisan maradt — `/api/flyer/text`, csak segéd.)

**2) Render-motor: Satori (`next/og` ImageResponse), NEM html2canvas.** Ok: a html2canvas újra meg újra levágta a betűk alját (ő/ű ékezet, g/y nyúlvány) — motor-korlát, nem hangolás. A Satori pixelpontos, valódi TTF-fel. `next/og` BE VAN ÉPÍTVE a Next 15-be — nincs npm install, nincs API-költség (ingyenes, MIT).
- `src/app/api/flyer/render/route.ts` (runtime nodejs): multipart képek + mezők → `ImageResponse` PNG. Auth kell. Ingyenes (előnézet); watermark="1" a vízjelhez.
- `src/lib/flyer-satori.tsx`: `buildFlyerElement(opts, family)` — satori-kompatibilis JSX (React.createElement, csak flexbox, pixelek). Elrendezés: fejléc-sáv (cím+alcím) + „ELADÓ" jelvény (abszolút), nagy hero, chipek+ár-doboz sor, galéria (thumbs), ügynök-sáv (fotó+név+titulus+kontakt+logó).
- `src/lib/flyer-poster.ts`: a KÖZÖS logika — `FLYER_MOODS` (4 hangulat = színtéma: luxus/letisztult/meleg/kontrasztos), `FLYER_SIZES` (1:1, 9:16, 4:3), `buildTheme` (arculati színből paletta, garantált kontraszt), `truncate`. Tartalmaz még egy `buildPosterHtml` html2canvas-változatot is — TARTALÉK, jelenleg NEM hívjuk.
- `src/lib/google-font.ts`: `loadGoogleFont(family)` — a Google Fonts v1 CSS-ből RÉGI User-Agenttel (MSIE) tölti a **ttf/otf/woff** URL-t (a Satori woff2-t nem olvas!), 400+700 súly, memóriában cache-elve. Tartalék család: Montserrat. `googleFamilyOf(cssFamily)` a "'Open Sans',…"-ból "Open Sans"-t ad.

**Varázsló** (`src/components/flyer/AdWizard.tsx`): 5 lépéses felugró ablak — **Arculat → Képek → Adatok → Stílus → Előnézet**. Arculat OPCIONÁLIS (mentett profil VAGY egyszeri név+kontakt; `/api/flyer/accept` már nem követel profilId-t). Képek 1–4 (első a főkép), AssetTray + feltöltés. `buildBlob()` a képeket FormData-ban a `/api/flyer/render`-nek küldi, PNG-t kap. Elfogadás → `/api/flyer/accept` (kredit + tárolás). Indítóoldal: `src/app/dashboard/flyer/page.tsx`.

**Törölve** ezen az úton: az 5+premium sablonrendszer (`flyer-design.ts`, `flyer-templates.ts`), az AI-háttér (`flyer-compose.ts`, `flyer-zones.ts`, `flyer-overlay.ts`, `/api/flyer/compose`).

**NEM tesztelt élesben** (a sandbox nem tud build/network): a user deployol + próbál. Fő kockázat: a Google-font TTF-letöltés (ha woff2 jönne, a Satori elhasal → Montserrat tartalék). localhoston/deployon ellenőrizni kell. Nincs push a sandboxból (a user push-ol).

**Frissítés (2026-08-18): HÁROM választható sablon.** A user két Canva-szerű mintát küldött, azok alapján épült két új elrendezés. `flyer-poster.ts` → `FLYER_TEMPLATES` (`premium` | `openhouse` | `unit`), `getFlyerTemplate`, `templateUsesThumbLabels`. `buildFlyerElement` már csak DISZPÉCSER; a prémium törzse `buildPremiumElement`. Új fájlok: `flyer-satori-kit.tsx` (közös box/img/ikonok/compact/heroFill/factItems/fitFs), `flyer-satori-openhouse.tsx`, `flyer-satori-unit.tsx`. A varázsló 4. lépése „Sablon" (sablonválasztó + képfeliratok + méret) — a lépés-indexek 0–4 változatlanok.

Döntések, amiket a user hozott: **marad max 4 kép** (1 hero + 3 thumb, nem emeltünk limitet); **nincs dátum/nyílt nap mező** — a minta dátum-blokkjának helyére az ÁR + kulcsadat került; a képfeliratokat a **helyiség-felismerés tölti ki** (`/api/flyer/arrange` most `rooms`-ot is visszaad, az új sorrendben) és kézzel átírható; **nem vettünk fel új méretet**, mind a 3 sablon 1:1 / 9:16 / 4:3 méreten készül.

**Satori-tanulság: a `lineClamp` NEM vág** (a szöveg természetesen tördelődik tovább), ezért a hosszú szövegeket KARAKTERRE illesztjük: becsült sorhossz ≈ oszlopszélesség / (betűméret × 0,52), × a kiszámolt sorszám, majd `truncate`. Ezen felül minden fix magasságú blokk gyereke `flexShrink: 0` — különben a yoga összenyomja őket és a szövegek EGYMÁSRA csúsznak (ez okozta az első körben a túlcsordulást).

**Varázsló-sorrend (2026-08-19): Megjelenés → Arculat → Képek → Adatok → Előnézet.** A user kérése: a partner ELŐBB lássa, mibe vág bele. Az 1. lépésben a sablon ÉS a méret együtt van, és egy **kész minta-hirdetés** mutatja a választott sablon+méret kombinációt. A minták a `public/flyer-samples/<sablon>-<méret>.png` fájlok, amiket a `npm run flyer:samples` (scripts/build-flyer-samples.mjs) generál a VALÓDI Satori motorral — ezért mindig hűek. **Sablon-módosítás után újra kell futtatni!** A minta-fotók: `scripts/flyer-sample-photos/*.jpg` (PIL-lel rajzolt stilizált belső terek). A korábbi böngészőben rajzolt `TemplateMock` komponens emiatt törölve.

**Fix magazin-címbetű (2026-08-19):** a MAGAZIN sablon főcíme **Playfair Display** — ez FIX, nem az arculatból jön; minden más szöveg marad a partner betűjén. A Satori több családot is kap (külön `name`), a címre `fontFamily` kerül. **Magyar ékezet-védelem:** `supportsHungarian()` a google-font.ts-ben a TTF **cmap** táblájából tételesen ellenőrzi az ő ű Ő Ű + á é í ó ö ú ü betűket; ha hiányzik bármelyik, a cím visszaesik az arculati betűre (nem lesz üres négyzet). A serif verzál keskenyebb → a címméret-számítás `charW` 0,75 helyett **0,66** display-betűnél.

**Ár-formázás (2026-08-20 javítás):** a `formatPrice`/`parsePrice` a `flyer-poster.ts`-ben él, és MINDEN sablon ezt használja — a sablonokban NEM szabad újra hozzátoldani az „M Ft"-ot. A régi kód csak azt nézte, „szám-e" a beírás, ezért `63900000` → „63900000 M Ft" lett, `63 900 000` pedig (a szóközök miatt) semmilyen mintára nem illett, így **a Ft is lemaradt** — emiatt kellett a kollégának kézzel szóközölnie. Az új parser bármilyen elválasztóval megeszi a számot (szóköz, pont, vessző), eldönti a nagyságrendből, hogy millió (1000 alatt) vagy teljes forintösszeg, ezres tagolást tesz be, és mindig kiírja az egységet. A prémium pecsétnél a `parsePrice` külön adja a számot és az egységet (nagy szám + kis „Ft").

**Satori TUD SVG színátmenetet** (`<defs><linearGradient>` + `fill="url(#id)"`) — kipróbálva, működik. Az adatlap-sablon ívelt sávja ezzel lett alul teljesen fedő, fölfelé átlátszó, hogy ne takarja ki a főképet.

**Elrendezés-elv a szűk helyekre:** a blokkok magasságát KISZÁMOLJUK, és sorrendben foglalunk: fejléc → a leírás 2 soros minimuma → ikonos tényadatok → cím-sor → a maradék a leírásé. A tényadatok tehát előbbre valók a hosszú szövegnél (a user panasza: „sok infó elveszik"). Állóban (9:16) a képrács EGY sorban áll (két sorban csíkká laposodna), és a rács csak azt kapja meg, ami az áttekintés teljes tartalma után marad.

**Sablon-teszt sandboxban** (build/deploy nélkül): `npx tsc -p` egy temp tsconfig-gal `/tmp/ftout`-ba, majd node-script `Module._resolveFilename` patch-csel (`@/` → `/tmp/ftout/src`, `react` → projekt node_modules) + `next/dist/compiled/@vercel/og/index.node.js` `ImageResponse`-szal renderel PNG-t. Betű: `/usr/share/fonts/truetype/crosextra/Carlito-{Regular,Bold}.ttf`. A `sharp` NEM megy a sandboxban (platform mismatch) — próbaképeket python3 + PIL-lel csinálunk.

Lásd még: [[flyer-generator-spec]], [[twinx-deployment]], [[vercel-supabase-gotchas]].

<<<FILE: global-credit-wallet.md>>>
---
name: global-credit-wallet
description: "A kredit közös (globális) pénztárca, bármelyik modulban elkölthető — nem modulonkénti egyenleg."
sources: [cowork-import]
aliases: []
---

2026-07-04-én váltottunk: a kredit EGY közös egyenleg / felhasználó (`wallets` tábla, `wallet_add`/`wallet_deduct` — lásd `wallet.sql`), ami BÁRMELYIK modulban felhasználható. A korábbi modulonkénti `user_credits` (service_id-nként) modellt kivezettük (a tábla megmaradt adatmegőrzésre, de a kód már nem használja).

**Miért:** App Store-vízió — a felhasználó egyszer tölt fel egyenleget, és bármelyik appban/modulban költi. Nem logikus modulonként külön venni.

**How to apply:** Új kredites funkciónál `chargeCredit({userId, amount})` (nincs serviceId) és `wallet_add`/`wallet_deduct` RPC. A levont mennyiség tartsa a [[credit-100-percent-profit-rule]]-t (ár ≥ 2× önköltség a legmélyebb kedvezménynél). A `service_id` továbbra is megy az audit táblákba (usage_history, credit_purchases, video_jobs, cost_logs), de a kredit-műveletbe nem.

<<<FILE: google-analytics.md>>>
---
name: google-analytics
description: Google Analytics (GA4) beépítése a twinx.hu-ba — döntés és munkamód; olvasd, ha GA, mérés, süti-sáv vagy konverzió szóba kerül.
sources: [cowork]
---

- [stated] A GA-t mindenképp be akarja építeni a weblapba („később hasznos lehet”); 2026-09-28-án még nem hozott létre semmit hozzá (nincs GA4-fiók/tulajdon).
- [stated] 2026-09-28: létrehozta a GA4-fiókot/tulajdont + webes adatfolyamot (üzleti célok: potenciális ügyfelek szerzése + forgalom megismerése; adatmegőrzés 14 hó); mérési azonosító: G-MQJJZB8PWK.
- [stated] 2026-09-28: a GA-bekötés élesítve, Safariban látta a collect kérést a twinx.hu-n (működik). Következő: süti-sáv.
- [stated] Süti-sáv: jóváhagyta a lebegő kártyát (bal alul) két egyenrangú gombbal + lábléc „Süti-beállítások” linkkel („mehet így”); utána jön az /adatkezeles tájékoztató oldal, majd a konverziók (sign_up stb.).
- [stated] 2026-09-28: a süti-sáv élesben működik (3. lépés kész).
- [stated] asked to remember: a 4. lépés (/adatkezeles tájékoztató oldal) VÁR — a végleges cég még nem alakult meg; ha megalakul és minden céges adat megvan (cégnév/forma, székhely, cégjegyzékszám, adószám, adatvédelmi e-mail, élesben használt szolgáltatók), megadja, és akkor készül el az oldal.
- [stated] 5. lépés (konverziómérés) megrendelve („ezt csináljuk meg”); kérdezte, hogy a GA-adatok a TWINX admin felületén is láthatók-e, vagy csak a GA oldalán.
- [stated] 2026-09-28: a GA-ban kulcseseményként felvette a `sign_up` és `generate_lead` eseményt („Létrehozás kóddal”). Opcionális következő (6.) lépés: GA-adatok a TWINX adminban (GA Data API), ha már van pár napnyi adat.
- [stated] Munkamód ennél a feladatnál: lépésenként halad — mindig egy lépésről kér tanácsot és annak részletes kibontását, utána jön a következő.

Kapcsolódó: [[smartlead-levelsorozatok]]

<<<FILE: hospitality-module.md>>>
---
name: hospitality-module
description: "A Vendéglátás kategória és az első modul (Menü generátor, RAG) állapota"
sources: [cowork-import]
aliases: []
---

**Vendéglátás — az első nem-ingatlanos kategória (2026-07-17, localhoston, MÉG NINCS PUSHOLVA).** Az „Adatelemzés" kategória helyére került (slug `hospitality`, Elérhető), 2 modullal. Vezérelv: később bármely üzleti ág jöhet.

Első modul: **Menü generátor** (RAG — az AI csak a partner saját ételeiből válogat).
- **DB:** `restaurant_dishes` (user_id, name, description, category[check: eloetel/leves/foetel/koret/desszert/ital], cuisine_style, profit_margin[check: low/medium/high], image_url). RLS: csak saját sorok. SQL: `hospitality.sql` a repo gyökerében — **a usernek le kell futtatnia Supabase-ben** (dev+prod ugyanaz a projekt).
- **lib/hospitality.ts:** enum-listák, `validateDishInput`, `PREFERRED_MARGINS` (profit-cél → preferált marzsok rangsora), `composeMenuPrompt`, `MENU_DEFAULT_SEGMENTS`, `MENU_CREDITS`(1), `MENU_MIN_DISHES`(5).
- **Prompt:** a `PROMPT_MODULES`-ba felvett `menu_generator` modul (intro+task szegmens) — admin-szerkeszthető a `/admin/prompts`-on; `buildMenuPromptActive` a prompts.ts-ben. (A prompt tábla oszlopa `module`, NEM `service_name`.)
- **Kínálat kezelő UI:** `/dashboard/hospitality/inventory` + `/api/hospitality/dishes` CRUD (user client, RLS).
- **Menü generátor UI:** `/dashboard/hospitality/menu` + `POST /api/hospitality/menu`: profit-cél szerinti előszűrés `.in("profit_margin", PREFERRED_MARGINS[goal])` + JS rangsor (max 40 étel), `chargeCredit` (1, admin/sales bypass, hibánál `wallet_add` visszatérít), `runSonar(prompt, PERPLEXITY_MODEL)` szinkron, `usage_history` (feature_used="menu_generator", service_id null). Activity címke felvéve.

**Bővítések (2026-07-18, ÉLESBEN pusholva).** Az étel-adat és a generátor sokat bővült:
- **restaurant_dishes új oszlopok** (4 migráció-fájl a repo gyökerében, MIND lefuttatandó Supabase-ben): `hospitality.sql` (alaptábla), `hospitality-prices.sql` (`cost_price`, `sale_price`), `hospitality-optional-margin.sql` (profit_margin nullable), `hospitality-ingredients.sql` (`main_ingredients` szöveg). A user szerinte mind lefutott élesben.
- **Kínálat kezelő:** kategória-mappák (felugró ablak → étel-részlet szerkeszt/töröl), étel-szerkesztés **oldalt beúszó DishEditDrawer**-ben (nem a főoldalon), **ételfotó** drag&drop (Storage `reports` bucket, `dishes/…`), **konyhatípus** bővíthető legördülő + saját hozzáadás, **Fő alapanyagok** szabad mező, **Leírás** étlap-szerű (nem összetevő). **Árak KÖTELEZŐK** (validateDishInput), profitmarzs opcionális; magyarázó info-sáv. „Új étel felvitele" összecsukható sáv.
- **Menü generátor:** időtáv **1–7 nap**; **Fogások = konkrét struktúrák** (`COURSE_STRUCTURES`/`courseStructure`: 2 fogás leves+fő / előétel+fő / fő+desszert; 3 fogás elő+fő+desszert / leves+fő+desszert; vagy „nincs megkötve"); bővebb **tematika** (16), **célár = egy menü ára**, **változatosság**, **Profit-terv** (X menü→Y profit, menünkénti profitcél) — mind összecsukható legördülőkben. **Napi beosztás:** napok **kis kártyákban**, kattintásra **felugró animált ablak** → konyha + **fogásonként konkrét étel** (a napi konyhához ÉS a fogás-kategóriához szűrve; üres = Twinx dönt). **Profit-figyelmeztetés** generálás előtt (kliens, determinisztikus): napi max profit (fix ételek + legjobb fillerek) vs menünkénti célprofit; ha nem jön ki → koral info-box konkrét csere-javaslattal + reális cél; nem blokkol.
- A prompt (`composeMenuPrompt`) mindezt beépíti: nap-szám, fogás-struktúra (pontos), tematika, célár, változatosság, profit-terv, napi beosztás (konyha + kötelező ételek), instrukció; az ételek listája ár + darab-profit + alapanyagok.

**Árazás elemző (2026-07-18, commit 21a5949, localhoston — push a usernél).** Új modul a Vendéglátás dropdownban: `/dashboard/hospitality/pricing` (catalog.ts icon `pricing`). Determinisztikus, **ingyenes**, kliensoldali: a Kínálat kezelő árait elemzi — cél árrés csúszka (alap 65%), átlag árrés/darab-profit, veszteséges + cél alatti tételek javasolt árral, top profit/árrés listák, kategóriánkénti átlag árrés. Menu-engineering mátrixhoz eladási darabszám-adat kellene (nincs) — jövőbeli bővítés.

**Önköltség & profit modul (2026-07-18, commit b5db396, localhoston — push a usernél).** Külön nagy modul a Vendéglátás dropdownban: `/dashboard/hospitality/costing` (catalog.ts icon `cost`), 3 füllel. A **bevitel/mentés ingyen, a teljes riport kredites** (COSTING_CREDITS=1, admin/sales bypass).
- **ÚJ SQL: `hospitality-costing.sql` (repo gyökér) — LE KELL FUTTATNI Supabase-ben.** Két tábla: `restaurant_cost_profile` (1 sor/user: rent/wages/utilities/insurance/accounting/marketing/depreciation/bank_fees/other + `extra_items` jsonb, RLS own, upsert on user_id), `dish_sales_weekly` (user_id, dish_id, week_start date, qty, unique(user_id,dish_id,week_start), RLS own).
- **lib/costing.ts:** `CostProfile`+`COST_FIELDS`, `costProfileTotal`, `normalizeCostProfile`, `toAmount`; **`computeCosting(dishes, overhead, method)`** — étel-szintű alapanyagköltség + **rezsi-allokáció** (`method`: "revenue" árbevétel-arányos [alap] / "unit" darab-arányos): per étel teljes önköltség/adag, valós darab-profit/árrés, havi profit, fedezeti darabszám; étterem-totálok (árbevétel/alapanyag/nettó profit). `costingSummaryText` (AI-hoz), `COSTING_DEFAULT_SEGMENTS`, `composeCostingPrompt`.
- **Prompt:** `cost_analysis` modul a PROMPT_MODULES-ban (intro+task, admin-szerkeszthető), `buildCostingPromptActive`.
- **API:** `/api/hospitality/cost-profile` GET/POST (ingyen, upsert), `/api/hospitality/costing` POST (kredit + determinisztikus számítás + Perplexity AI-javaslat, árakat a DB-ből veszi, forgalmat a bodyból), `/api/hospitality/sales` GET/POST (ingyen, heti upsert).
- **Kiszállítói jutalék (Wolt/Foodora):** külön fix költség-sor `delivery_fees` (commit 48aa73b). Az SQL-ben `alter table ... add column if not exists delivery_fees` — a `hospitality-costing.sql` újrafuttatható.
- **UI — MOST 3 fül (commit 5ffaa42), az „eladás rögzítése" és a „riport" szétválasztva (user kérése: a rögzítés tárol, számot NEM mutat; a riport külön, on-demand):** (1) **Étteremszintű költség** — havi fix költség-profil; (2) **Eladások** — induló+záró dátum (nap VAGY időszak), kategória-mappák (DISH_CATEGORIES), mappánként „eladott adag" → **mentés a `dish_sales` táblába** (ingyen, delete+insert az adott (start,end)-re); „Rögzített időszakok" lista (kattintásra betölt szerkesztésre); profitot NEM mutat; (3) **Riport** — tetszőleges induló+záró dátum → a **tárolt `dish_sales`-ből aggregál** (period_start≥start ÉS period_end≤end), havi rezsit az időszakra arányosítja (`proratedOverhead = monthly*12*days/365`, `periodDays` inclusive), **„Riport lekérése (1 kredit)"** → eredmény-tábla + AI-szöveg + **letölthető márkázott PDF**. **Az allokáció-kapcsoló ELTÁVOLÍTVA — fixen árbevétel-arányos.**
- **ÚJ SQL: `hospitality-sales.sql` — LE KELL FUTTATNI Supabase-ben.** Létrehozza a `dish_sales` táblát (user_id, dish_id, period_start, period_end, qty, unique(user,dish,start,end), RLS own) ÉS `drop table if exists dish_sales_weekly cascade` (a régi, nem használt heti tábla). A `/api/hospitality/sales` route mostantól a `dish_sales`-t kezeli (GET összes; POST = delete az adott (start,end)-re + insert qty>0). A `/api/hospitality/costing` body most CSAK `{start, end}` — a forgalmat a tárolt eladásokból veszi, method fixen "revenue".
- **PDF-riport (commit a01fe98 + időszaki e742c67):** `generateCostingPdf({result, narrative, period})` a `lib/pdf.ts`-ben (pdf-lib, NotoSans magyar font az `assets/fonts/`-ból, Vercelen is megy). Márkázott sablon: koral fejléc-sáv, KPI-kártyák (Időszaki árbevétel / Alapanyag / Rávetített rezsi / Étterem időszaki profit — negatív pirossal), formázott táblázat (Étel/eladott/Önktg-adag/Profit-adag/Árrés/Időszaki/Fed.), AI-szekció, lábléc oldalszámmal. Storage `reports/costing/…`, publikus URL; usage_history.output_file_url = a PDF. Hibatűrő (PDF-hiba nem bukatja a riportot). Route body most: `{method, start, end, dishes:[{dish_id, qty}]}`.
- **Elfogadott irányelvek (user, 2026-07-18):** hibrid alapanyagköltség (opcionális tételes recept — MÉG NEM épült, most az összesített cost_price a bemenet), árbevétel-arányos allokáció, önköltség visszaírása a dish-be (MÉG NEM épült, tervezett), kredit CSAK a riportnál. „max később változtatunk."
- **Belső elnevezés-figyelmeztetés:** a `CostingResult`/`DishCosting` mezői még `monthly_qty`/`monthlyProfit` néven futnak, de SZEMANTIKAILAG időszaki értékek (a UI/PDF „időszaki"/„eladott adag" feliratokkal jelzi). Az API `qty`-t vár (a `monthly_qty` fallback marad).
- **`dish_sales_weekly` tábla MEGSZŰNT** (a `hospitality-sales.sql` dropolja); helyette `dish_sales` (időszak/nap-alapú) az eladás-napló.
- **Eladások fül UI = KOCKÁK + popup (commit 2d98e45):** kategória-kockák (grid) → kattintásra `EntryEditorModal` (framer-motion) az adott (start,end)-hez: kategória-tiles ↔ étellista váltás, „Mentés és vissza" (POST + delete/insert). „Eddigi rögzítéseid" = dátumos kockák (+ „Legutóbb: …" segítség) → kattintásra ugyanaz a modal az adott időszakhoz, teljesen szerkeszthető.
- **Egyszeri kiadások, SAJÁT időszakkal + arányos elosztás (commit 263915e majd 620fb4d):** tábla `restaurant_one_time_costs` — MOST `period_start`/`period_end` date (NEM `spent_on`; a `hospitality-onetime.sql` átmigrál a régiről DO-blokkban). **`hospitality-onetime.sql` ÚJRA LEFUTTATANDÓ.** Egy kiadás a saját [period_start,period_end] időszakára EGYENLETESEN oszlik el; a riport [start,end]-re az **átfedő napok arányát** számolja: `oneTimeShare = amount * overlapDays / totalDays` (`lib/costing.ts`: `oneTimeShare`, `oneTimeInRange`). API POST mezői: `{label, amount, period_start, period_end}`. UI (Étteremszintű költség fül alján): megnevezés + összeg + „Mikortól" + „Mennyi időre" preset (1 nap/1 hét/1 hónap/3/6/12 hónap/Egyedi → `OT_DURATIONS`, `isoAdd` UTC-biztos); mutatja a vonatkozó időszakot; lista a tartománnyal + törlés. costing route: `.lte("period_start", end).gte("period_end", start)` → `oneTimeInRange` → `overhead = proratedFix + oneTimeTotal`. PDF meta + AI-summary jelzi „(ebből egyszeri: X)". `generateCostingPdf`/`costingSummaryText` opcionális `oneTimeTotal` paraméter.
- **Hátralévő/tervezett:** tételes recept-építő (alapanyag×mennyiség×egységár) az alapanyag-rész pontosításához; kiszámolt teljes önköltség visszaírása `restaurant_dishes.cost_price`-ba (gombbal); **új „Követés" fül** (a user teljesen más funkcióra szánja — még nincs specifikálva).

**ÉTLAP / MENÜ kettébontott árazás (2026-07-20, commitok 559fc6a→ab1bb98).** Alapelv: ugyanaz az étel étlapról kis szériában készül (magasabb önköltség, SAJÁT eladási ára), menübe viszont nagy mennyiségben (alacsonyabb önköltség), és **a menünek van ára, nem az ételnek**.
- **ÚJ SQL: `hospitality-menu-pricing.sql` — LEFUTTATANDÓ.** `restaurant_dishes.menu_cost_price` (opcionális; üres = nem megy menübe); `restaurant_cost_profile.menu_price_2/menu_price_3` (a napi menük ára — NEM költség, a fix költség összegébe nem számít); `dish_sales.channel` ('etlap'|'menu', régi sorok étlaposak, unique mostantól `dish_sales_unique_entry` (user,dish,start,end,channel)); ÚJ `menu_sales` tábla (user, period_start/end, qty_2, qty_3, price_2/price_3 opcionális ár-felülírás, unique(user,start,end), RLS own).
- **Validáció:** `validateDishInput` — az ÉTLAP páros (cost+sale) és a MENÜ költség közül **legalább az egyik** kell (étlap félig kitöltve = hiba). Az árak már nem feltétlen kötelezők.
- **Kínálat kezelő + DishEditDrawer:** két külön keretes blokk — „Étlap (à la carte)" (előkészítési + eladási ár, darab-profit) és „Menü (napi menü)" (előállítási költség + megtakarítás az étlaposhoz képest).
- **Eladások fül:** ételenként KÉT mennyiség (étlapról / menüben), plusz külön **„Napi menük" kocka** → eladott 2 és 3 fogásos menük száma + opcionális ár-felülírás. Halk ellenőrzés: menü-adagok ≈ 2×qty2 + 3×qty3.
- **`computeCosting(dishes, menuSales, overhead)` ÚJ szerkezet** (`lib/costing.ts`): `CostingResult = { etlap: {dishes, revenue, ingredientCost, overhead, profit}, menu: {dishes, qty2, qty3, count, revenue, ingredientCost, overhead, profit, perMenuRevenue/Cost/Overhead/Profit}, totals }`. A rezsit ELŐBB a két csatorna közt osztja árbevétel-arányosan, az étlapon belül ételenként szintén. Az `AllocationMethod`/`DishCosting` típusok MEGSZŰNTEK.
- **Riport UI + PDF:** külön „Étlap" (ételenkénti tábla) és „Napi menük" szekció; utóbbiban kiemelt **„Egy menüre vetítve"** doboz: ár / előállítás / rezsi / **marad** — ez a user fő kérdése volt („2500-as menü előállítása mennyibe kerül").
- **Menü generátor átállt:** csak `menu_cost_price`-szal rendelkező ételeket kínál; a menü ára a profilból jön a fogásszám szerint; a profit-terv mostantól **költségplafont** ad (menü ára − menünkénti célprofit), a profit-figyelmeztetés és a csere-javaslat a LEGOLCSÓBB összeállítást keresi. `composeMenuPrompt` opts: `targetPrice` → **`menuPrice`**.
- **Árazás elemző:** Étlap/Menü kapcsoló; menü nézetben az étel a fix menü-ár hány %-át viszi el (állítható küszöb), tipikus 2/3 fogásos előállítási költség és „marad átlagosan”.

**Alapanyagok & receptek modul (2026-07-20, commitok 5d39f57→76a6a4d).** A partner nem tudja fejből, mennyibe kerül egy gulyás — ezért: alapanyag-árlista + adagonkénti recept → számított alapanyagköltség. **A user kikötése: KIZÁRÓLAG alapanyag számít, semmilyen más költség (rezsi, bér, csomagolás…) nem — azt a riport vetíti rá.** A Kínálat kezelő űrlapja szándékosan NEM bonyolódott: a kalkulátor egy apró link mögött, opcionális.
- **ÚJ SQL: `hospitality-recipes.sql` — LEFUTTATANDÓ.** `restaurant_ingredients` (name, unit 'kg'|'l'|'db', unit_price az ALAP-egységre, waste_pct hulladék%, unique(user,name), RLS own); `dish_recipe_items` (dish_id, ingredient_id, quantity, unit — a BEVITT egységben tárolva, RLS own).
- **`lib/recipes.ts`:** `INGREDIENT_UNITS`, `ENTRY_UNITS` (kg→g/dkg/kg, l→ml/dl/l, db→db) + `DEFAULT_ENTRY_UNIT`, `toBaseAmount`, `itemCost` (mennyiség × egységár × (1+hulladék%)), `recipeCost`, `validateIngredient`.
- **API:** `/api/hospitality/ingredients` GET/POST/PATCH/DELETE; `/api/hospitality/recipes` GET(?dish_id=) + POST (delete+insert ételenként). Ingyenes.
- **Új modul `/dashboard/hospitality/ingredients`** — a Vendéglátás dropdownban a **Kínálat kezelő és a Menü generátor KÖZÖTT** (a user kérése), ikon `recipe`. Tartalma: árlista (felvitel + soronkénti szerkesztés/törlés) és **„Ételek recept-önköltsége"** tábla: recept szerinti költség vs az ételnél tárolt étlap-/menü-ár, eltérés-jelzéssel (pirosan, ha a recept drágább) — ez mutatja meg, mely ételek önköltsége mozdult el alapanyag-áremelés után.
- **`RecipeCalculator` komponens** (`components/hospitality/`): felugró ablak az étel árazás-blokkjából („Nem tudod fejből? Számoljuk ki az alapanyagokból"), alapanyag+mennyiség+egység sorokkal, élő adag-költséggel; **„Beírom étlap-árnak" / „Beírom menü-költségnek"** gombok. Új ételnél a recept a dish POST után mentődik (kell az id), szerkesztésnél a PATCH után; a drawer nyitáskor betölti a meglévő receptet.
- **Menü-sorrend a dropdownban:** Kínálat kezelő → Alapanyagok & receptek → Menü generátor → Önköltség & profit → **Árazás elemző (legalul)**.

**Profit-terv — előretekintő szimuláció (2026-07-20, commitok c3a2e50, 1c8efde).** A user kifejezetten **kredit-termékként** kérte („amin mi tudunk kreditet keresni"). Koncepció: „mit adjak el jövő héten, hogy meglegyen az 1 millió?". **Először az Árazás elemzőbe szánta, majd ő maga tette át az Önköltség & profit modulba** (helyesen: ott vannak a rezsi/egyszeri adatok és az időszak-logika) → a modul 4. füle: **Profit-terv**.
- **NINCS új SQL** (a meglévő tábláktól függ).
- `lib/simulation.ts`: `computeSimulation({mode, dishes, menu, otherCosts, oneTimeIncome, target})` → `SimResult`. **Két mód:** `"dish"` = csak az ételek/menük árrése, `"full"` = + arányosított rezsi és egyszeri tételek. Számol: cél-rés (`gap`), **mix-skálázási faktor** (hányszorosára kell a mix), és **legjobb emelőkar** (legnagyobb darab-profitú étel + hány adaggal több kell). `simulationSummaryText`, `SIMULATION_CREDITS`(1), `SIMULATION_DEFAULT_SEGMENTS`, `composeSimulationPrompt`.
- **Prompt-modul:** `profit_plan` a PROMPT_MODULES-ban, `buildSimulationPromptActive`.
- **API `/api/hospitality/simulation`** (POST): kredit → ételárak DB-ből → (full módban) rezsi+egyszeri → `computeSimulation` → AI-értékelés → **PDF** (`generateSimulationPdf`, Storage `profit-plan/…`) → usage_history (`feature_used="profit_plan"`).
- **Menü-oldal tervezésnél:** nem tudjuk, mely ételek kerülnek a menükbe, ezért a **menünkénti előállítási költséget a kliens küldi**, az ételek `menu_cost_price` átlagából előre kitöltve (×2 / ×3), de felülírható.
- **UI (PlanTab):** időszak (alap: következő hét hétfő–vasárnap), cél-profit, mód-kapcsoló, kategória-kockák → felugró tervező ablak a darabszámokhoz + „Napi menük" kocka; eredmény-kártya cél-teljesüléssel és emelőkar-javaslattal; **PDF letöltés** (szerver) és **PNG letöltés** (html2canvas a `#plan-result` elemről).

**ADATFOLYAM-ELV (2026-07-20 átvizsgálás, commit 3470def) — ezt tartsuk meg:**
- **Élő (mindig újraszámolt):** a recept-önköltség (`recipeCost` az alapanyag-árlistából) és minden riport/terv, mert azok lekéréskor olvassák a DB-t. Nincs cache.
- **Pillanatkép (csak kézi frissítésre változik):** az étel tárolt `cost_price` / `menu_cost_price`. **A user kifejezett döntése:** ha az alapanyag drágul, a profit csökken, és a partner dönti el, emel-e árat vagy frissíti-e az önköltséget. Ehhez készült a `/api/hospitality/recipes/apply` (POST `{dish_ids, target:'etlap'|'menu'}`) — a SZERVER számolja újra a receptből, a kliens nem küld számot. UI: soronkénti „frissít"/„beírom" link + „Összes étlap-ár frissítése" sáv az Alapanyagok & receptek fülön. Tömeges frissítés csak étlap-árra megy (a menü-költség szándékosan lehet más).
- **Kiadott PDF-ek pillanatképek** — ez helyes, dokumentum ne változzon visszamenőleg.
- **Javított hiba:** a costing oldal `priced` szűrője (mindkét étlap-ár kell) miatt a **csak menü-költséggel** rendelkező étel nem jelent meg az Eladások fülön → menü-csatorna költsége alábecsült lett volna. Most külön `sellable` (étlap-pár VAGY menü-költség) megy a SalesTab/ReportTab felé, és a modalban csatornánként jelenik meg a mező („csak menüben" / „csak étlapon" címkével). A PlanTab továbbra is `priced`-et kap (tervezéshez eladási ár kell).

**Beszállító-kereső (2026-07-20, commitok a815425 → 160bab6) — kredit-termék.** Perplexity élő webes kutatás: alapanyag-termelők/nagykerek felkutatása. **ÖNÁLLÓ MENÜPONT: `/dashboard/hospitality/suppliers`** (ikon `supplier`), a dropdownban az Alapanyagok & receptek UTÁN. (Először az Alapanyagok oldal aljára került keretes blokként, de a user kérésére külön menüpont lett — a `SupplierFinder` komponens ezért már keret és belső infósáv nélküli, azt a ModuleIntro adja.)
- **ÚJ SQL: `hospitality-suppliers.sql` — LEFUTTATANDÓ.** `supplier_searches` (query/results/extras jsonb, raw, pdf_url, credits_charged, RLS own). A keresések azért mentődnek, mert **a visszanézés INGYENES**.
- **Kredit a TALÁLATSZÁM szerint** (user döntése): 3 találat = 1, 6 = 2, 9 = 3 kredit (`SUPPLIER_PLANS`, `creditsForCount`). **Ha nincs értékelhető találat, a kredit visszajár.**
- **Árat SZÁNDÉKOSAN nem kérünk/szűrünk** — a user döntése: „az majd a partner és a beszállító dolga megbeszélni". Helyette az AI megmondja, hol tájékozódhat piaci árakról (Nagybani Piac, AKI PÁIR).
- **Szűrők:** mit keres (alapanyag VAGY kategória — datalist a saját alapanyagokból + kategóriákból), megye + település, körzet (25/50/100/150 km vagy országos), beszállító-típusok (őstermelő/nagyker/nagybani/bio/feldolgozó), mennyiség-gyakoriság, egyedi igény.
- **A prompt tiltja a kitalált céget/elérhetőséget**, és minden találathoz forrás-URL-t kér; JSON-választ kérünk (`parseSupplierResponse` robusztus, körbeírt szövegből is kinyeri). Prompt-modul: `supplier_search`.
- **Elfogadott extra javaslatok (user: „Rendben elfogadom őket"):** (1) kész **megkereső üzenet** a PDF-ben és a UI-ban (másolás gombbal), (2) **kategóriára is kereshet**, nem csak egy alapanyagra, (3) **szezonalitási** megjegyzés.
- **PDF:** `generateSuppliersPdf` — TWINX fejléc, szezon/piac infódoboz, beszállító-kártyák (név, hely, távolság, kínálat, „miért illik", tel/e-mail/web, forrás), kész megkereső üzenet, tárgyalási tippek; lábléc: „az elérhetőségeket kérjük ellenőrizni".

**Saját DateField (2026-07-20, commit b330c9a):** a natív `<input type="date">` helyett `components/DateField.tsx` — magyar naptár, hétfővel kezdve, min/max korlát, „Ma" gomb, framer-motion popover. Mind a 8 dátummező erre váltott a costing oldalon.

Későbbi ötlet: **dizájnos menü-PDF** (saját referenciakép / TWINX sablon / saját arculat, ételfotókkal); menü mentése/export.

Lásd még: [[redesign-phase7]], [[twinx-deployment]].

<<<FILE: index.md>>>
---
name: "web_twinx"
description: web_twinx
---

<<<FILE: ingatlan-invite-plan.md>>>
---
name: ingatlan-invite-plan
description: "Az /ingatlan landing 10 kredites kampánya — admin-jóváhagyásos, egyszer használatos kód, ami 10-re egészít ki (sosem 13)."
sources: [cowork-import]
aliases: []
---

**MEGÉPÍTVE 2026-09-02-án.** SQL futtatandó: `ingatlan-invites.sql`.

Folyamat: landing jelentkezés → `ingatlan_invites` tábla (státusz: uj) → MINDEN admin kap
e-mailt (`profiles.role='admin'` címekre, nem csak `LEADS_NOTIFY_EMAIL`) → `/admin/meghivok`
oldalon „Elfogadom" → egyszer használatos kód (`TWX-XXXX-XXXX`) + automatikus levél a
jelentkezőnek `?kod=` linkkel → beváltás a regisztrációnál vagy a dashboardon.

**A „ne 13" kulcsa:** a beváltás nem hozzáad, hanem KIEGÉSZÍT: `topUpAmount()` =
`INVITE_TOTAL_CREDITS (10) − WELCOME_CREDITS (3)` = 7. Ha a regisztrációs keret változik,
az összeg automatikusan igazodik.

Szabályok egy helyen: `src/lib/invites.ts` (limit 50, összkredit 10, kódformátum, normalizálás).
Kemény limit: az 50. kiadott kód után a szerver nem enged többet (az admin lát egy X/50 számlálót).
**Lejárat nincs** — a kód addig érvényes, amíg be nem váltják; a kampány az 50. kód kiadásával zárul.

Védelem: a kód beváltása atomikus (feltételes UPDATE `redeemed_by is null`-ra), egy fiók egyszer
válthat be (`profiles.invite_code`), a tábla RLS-sel zárt (csak service_role API-n át érhető el),
és ugyanaz az e-mail nem tud több függő jelentkezést létrehozni.

Jelölés: `profiles.signup_source = 'ingatlan-landing'` + `profiles.invite_code`; a kredit-naplóban
külön soron „Ingatlanos ajándékcsomag".

Google-fiókkal belépők: a regisztrációs űrlapon nem tudnak kódot megadni, ezért a dashboardon van
egy „Van ajándékkódom" beváltó (ugyanaz a végpont).

Nyitott: éles próba (jelentkezés → elfogadás → levél → beváltás), és a
`handle_new_user()` három versengő definíciójának konszolidálása.

Kapcsolódó: [[credit-billing-flow]], [[admin-credit-tools]], [[dashboard-onboarding]]

<<<FILE: ingatlan-landing-hero.md>>>
---
name: ingatlan-landing-hero
description: "Az /ingatlan landing „Filmes hero\" — Higgsfield loop-videó (Cinema Studio v2, első=utolsó képkocka), IngatlanHero + IngatlanServiceTicker (váltakozó főcímek a jobb szélen), npm run ingatlan:hero."
sources: [cowork-import]
aliases: []
---

Az /ingatlan landing 2026-09-08-án az **„A — Filmes hero"**-t kapta: teljes szélességű sötét
nappali-jelenet bronz–korall fényhálóval, a szöveg+gomb a bal oszlopban (max 540–600 px).
A tartalom NEM változott.

**Videó — tanulságok (több próba után):**
- A ping-pong (előre+vissza) loopot a partner AZONNAL kiszúrta („látszik a ping-pong") — a
  visszafelé futó fény hamis. Az xfade-dissolve loopot is elvetette. Elvárás: a modell adja a
  loopot, utólag NEM módosítunk („first picture és last picture ugyanaz").
- Kling 3.0 azonos start/end képpel → gyakorlatilag állókép. A bevált: **cinematic_studio_video_v2,
  mode pro, sound off, speedramp linear, genre intimate, cfg 0.7, start_image = end_image = poszter**,
  „inga-szerű" dolly prompt (jobbra a kanapé körül, majd megállás nélkül vissza). Job
  3e369fa4-dc92-48ef-b3e3-f786085050d1 (1344×768, 15 kredit). A preset-notice-t
  `declined_preset_id`-vel kell elutasítani.
- Poszter: c0aecea1-7b09-41e9-84f2-618af7cee601; mobil 4:5: cb48fd55-64d1-4a8a-9d7e-d1ad9e376b80.

**Komponensek:**
- `src/components/IngatlanHero.tsx` — videó csak ≥1024px és nem reduce-motion; `?v=N`
  cache-busting (`VIDEO_VERSION`, új videónál növelni), `onPlaying` váltja be, `load()`+`play()`,
  visibilitychange-re újraindít.
- `src/components/IngatlanServiceTicker.tsx` — a korábbi mintakép HELYETT a 7 szolgáltatás
  főcíme váltakozik (APPS-ból), doboz nélkül, asztalon a SZEKCIÓ jobb széléhez abszolút
  rögzítve (nem a max-w konténerhez), hogy ne ütközzön a bal oszloppal; két sorba törhet.

**Beemelés:** `npm run ingatlan:hero` (`scripts/ingatlan-hero-fetch.mjs`) — csak átkódol
(1920×1080 H.264 CRF23 faststart), loop-trükk nincs. Új videónál: SOURCES.video csere +
`rm -f public/ingatlan/hero.mp4 .cache/ingatlan-hero/hero-src.mp4`. A sandboxból nem tölthető
le, a partner futtatja. Brief: `docs/ingatlan-hero-brief.md`.

Kapcsolódó: [[landing-hero-video]], [[ingatlan-invite-plan]]

<<<FILE: landing-hero-video.md>>>
---
name: landing-hero-video
description: A landing hero videó + bronz színhangolás állapota és a push előtti teendők
sources: [cowork-import]
aliases: []
---

A **landing hero** (twinx.hu főoldal, `src/app/(public)/page.tsx` MÉDIA-SLOT) mostantól a user **saját Kling 3.0 videóját** használja: `public/design/hero.mp4` (a régi `hero-bg.jpg` a poszter/fallback). A videó az arc körüli fátyol-szerű szövet folyamatos lengése + nyakon lecsorgó vízcseppek; H.264, 1080p, ~7 mp.

Színhangolás („bronz overlay", a user által jóváhagyott néz): a `<video>`-n `opacity:0.72` + `filter: contrast(1.08) saturate(1.05)`, fölötte egy blend-réteg `mixBlendMode:"overlay"`, `opacity:0.45`, `linear-gradient(120deg,#ef7a5a,#7a3a1e 45%,#12100e)`. A konténeren `isolation:isolate`, hogy a blend csak a videóra hasson. (Készült egy önálló színhangoló eszköz is: `outputs/twinx-szinhangolo.html`.)

**FONTOS munkamód (2026-07-17):** a user MOST CSAK localhoston dolgozik a landingen — **NINCS git push, amíg a landing nincs kész**. A commitok helyben mennek. Push előtti teendő: a **hero.mp4 (~8,6 MB) letömörítése** pár MB-ra (gyors főoldal-töltés). Nyitott finomítások: overlay erőssége (most 45%), blend `soft-light`-ra lágyítás opció, videó fényereje; plusz döntés, hogy mobilon videó vagy kép legyen.

Lásd még: [[twinx-deployment]].

<<<FILE: library-folders-pattern.md>>>
---
name: library-folders-pattern
description: A korábbi munkák egységes mappás könyvtár-mintája (FolderLibrary) minden modulban
sources: [cowork-import]
aliases: []
---

**Minden modul „korábbi munkái" ugyanazt a mintát követik**, közös komponenssel: `src/components/library/FolderLibrary.tsx`. Hónap szerinti AUTOMATIKUS mappák + a partner SAJÁT mappái; a mappára kattintva **ablak (modal)** nyílik a tartalommal; elemenként letöltés, áthelyezés (új mappa létrehozásával, ami rögtön oda is teszi az elemet) és végleges törlés.

Adatmodell modulonként: külön `*_folders` tábla (user_id + name, RLS „own") és a fő táblán `folder_id` (on delete set null). Eddig bekötve: **videó** (`video_folders`, video-library.sql), **hirdetés** (`flyer_folders`, flyer-library.sql — a hirdetések a `usage_history`-ban vannak), **hirdetés-ellenőrző** (`ad_check_folders`, ad-check.sql).

**Biztonsági tanulság (fontos!):** a `usage_history`-ra SZÁNDÉKOSAN nem adtunk user-oldali UPDATE/DELETE policy-t — a policy csak SORT szűr, OSZLOPOT nem, így a partner az anon kulccsal átírhatta volna a saját során a `credits_charged`-ot vagy törölhetett volna bármilyen előzményt. Helyette a szerver (service_role) végzi a műveletet, miután ellenőrizte a tulajdonjogot ÉS a típust; a fájltörlés csak a saját `<modul>/<user_id>/` útvonalról mehet. Ugyanezt a mintát kövesd új moduloknál.

Letöltésnél `toDownloadUrl()` + `download` attribútum kell, különben a böngésző elnavigál a fájlra ahelyett, hogy letöltené.

Lásd még: [[video-2-pipeline]], [[ad-check-module]].

<<<FILE: library-rename-move.md>>>
---
name: library-rename-move
description: "Az elkészült anyagok (értékbecslés, hirdetés, ad-check, videó, képek) átnevezhetők, és az áthelyezés az elem alatt kinyíló mappalistával megy."
sources: [cowork-import]
aliases: []
---

Minden saját gyártású anyag kap saját nevet, és az áthelyezés egységes: az elem alatt
kinyílik a modul mappalistája, egy kattintás = áthelyezés. A jelenlegi hely „jelenleg itt"
felirattal jelölve, új mappát innen NEM lehet létrehozni (az a könyvtár tetején van).
A név csak a felületen jelenik meg — a letöltött fájl neve nem változik (a partner döntése).

Hol tárolódik a név modulonként:
- hirdetés: `usage_history.input_data.title` (a PATCH /api/flyer/manage rég készen állt, csak nem hívta senki)
- videó: `video_jobs.title` (PATCH /api/real-estate/video/manage)
- hirdetés-ellenőrző: `ad_checks.title` (a PATCH-ba most került bele)
- értékbecslés: `usage_history.input_data.title` — SQL NEM kellett; a lista `historyTitle()`-je
  ezt preferálja a generált `reportTitle()` helyett
- képek: **`asset_item_names` új tábla** (user_id + url + name), mert a képek csak URL-ek.
  `asset-item-names.sql` — a partnernek le kell futtatnia. Amíg nincs meg, a lekérdezés
  hibázik, de a tálca többi része működik (a nevek üresek maradnak).

A közös `FolderLibrary` kapta az `onRenameItem` propot (5 felület használja), az `AssetTray`
saját átnevezés-panelt kapott + a képek alatt col-span-full kinyíló mappalistát.

Kapcsolódó: [[library-folders-pattern]], [[ad-check-module]], [[valuation-editor]]

<<<FILE: no-git-push-prompts.md>>>
---
name: no-git-push-prompts
description: "Ne írj git push parancsot minden fejlesztés végén — csak akkor, ha Márk kifejezetten kéri."
sources: [cowork-import]
aliases: []
---

Fejlesztés befejezése után NE zárjam a választ `git add / commit / push` paranccsal. Csak akkor adjam meg, ha Márk kifejezetten kéri.

**Miért:** ha minden lépés végén ott a push-parancs, azt az érzést kelti, hogy azonnal fel KELL tölteni. Valójában több fejlesztés után egyszerre is meg lehet tenni, és akkor is minden változás felmegy.

**Hogyan alkalmazzam:** a válasz az eredménnyel és a következő lépéssel záruljon. Ha valami tényleg csak deploy után ellenőrizhető (pl. a `sharp` csak élesben fut), azt említsem meg mondatban — de parancs nélkül.

Kapcsolódó: [[twinx-deployment]]

<<<FILE: photo-grade.md>>>
---
name: photo-grade
description: "Képjavító v3 — a Feljavítás EGY Nano Banana hívás az eredeti képen; a saját determinisztikus fotó-korrekció (photo-grade/photo-geometry) és a fal.ai KI lett véve a láncból."
sources: [cowork-import]
aliases: []
---

**2026-09-09-től a Képjavító lánca EGY lépés:** feltöltött kép + a mód promptja → Nano Banana → mentés. Ez igaz mindkét módra (Feljavítás, Rendrakás) és az ingyenes újragenerálásra is. A saját kódunk nem nyúl a képpixelekhez.

**Miért lett elvetve a korábbi, négylépcsős lánc** (saját fény-korrekció → geometria-egyenesítés → AI hangulat-szerkesztő → fal.ai felskálázó): az eredmény egyszer teljesen szétesett — vízszintes csíkokra tört, neonszínű kép. Négy egymásra épülő képfeldolgozó lépésnél nem lehet megmondani, melyik rontotta el, és minden újabb védőkorlát (drift-fék, warmth-guard, luminancia-CLAHE) csak tovább bonyolította. Márk döntése: egy motor, és ha valami nem tetszik, a PROMPTOT hangoljuk, nem a képfeldolgozást.

**Hogyan alkalmazzam:**

- `src/lib/photo-grade.ts` és `src/lib/photo-geometry.ts` megmarad, de NINCS bekötve (a fájlok fejlécében is ott a figyelmeztetés). Csak akkor kössem vissza, ha valódi képeken, lépésenként végigmérjük — és akkor is egyszerre csak egy lépést.
- A Feljavítás promptja: `ENHANCE_PROMPTS.feljavitas` — lágy, szórt „softbox" fény, nyitott árnyékok, visszafogott csúcsfény, enyhén meleg fehéregyensúly; tételes tiltólista, amiben a berendezésen túl a PERSPEKTÍVA és a KÉPKIVÁGÁS/arány is szerepel (különben az előtte-utána csúszka alatt elcsúszik a két kép).
- Az admin prompt-modul kulcsa `image_enhance_feljavitas_v2` — a régi kulcs (`image_enhance_feljavitas`) a fal.ai rövid kulcsszavas promptját tárolta, és egy mentett aktív verzió felülírta volna az újat.
- Költség: mindkét mód `googleImageCostUsd(képszám)`, `serviceName: "google-studio"`.

Kapcsolódó: [[rendrakas-noop]], [[credit-100-percent-profit-rule]]

<<<FILE: preferences.md>>>
---
name: preferences
description: How Márk wants Claude to respond in the TWINX project (language, format).
sources: [cowork]
---
- [stated] Wants explanations of fixes/changes written in Hungarian.
- [stated] Váltós felületeknél (fülek, módváltók, pl. „Kedvenc / Összes modul") a doboz mérete legyen FIX — módváltáskor ne változzon a magassága; ezt mindig figyeljem.
- [stated] A blokkok ne ugráljanak, ha sok bennük a tartalom vagy valamit megnyitnak; a felület üresen (munkafolyamat nélkül) is legyen teljes és szép.
- [stated] Munka-/fájlkártyákon ne legyenek sűrű ikongombok: a műveletek (letöltés, mappába/áthelyezés, átnevezés, törlés) egy „⋯" menüben legyenek; ezt később is tartsam, és az oldalon máshol is így kell.

<<<FILE: professional-finder.md>>>
---
name: professional-finder
description: Szakember-kereső modul (Perplexity) mindkét iparágban; következő lépés a szakmánkénti prompt+szempont modell.
sources: [cowork-import]
aliases: []
---

Szakember-kereső (Perplexity, a beszállító-kereső mintájára) elkészült és élesben van MINDKÉT iparágban, külön menüponttal: `/dashboard/hospitality/professionals` és `/dashboard/real-estate/professionals`.

Fájlok: `lib/professionals.ts` (szakma-listák, közös szűrők, `composeProfessionalPrompt`, parse), 2 admin-szerkeszthető prompt-modul (`professional_hospitality`, `professional_realestate` a `prompts.ts`-ben), API `/api/professionals` + `/api/professional-favorites`, `generateProfessionalsPdf` a `pdf.ts`-ben, közös `components/ProfessionalFinder.tsx` (iparág prop), `pro` ikon, katalógus-menüpontok. SQL már lefuttatva: `professional_searches` + `professional_favorites` (RLS). Kedvencek beszállító-szinten: egy-egy KONKRÉT szakembert csillaggal, szakma szerinti mappák.

**Szakmánkénti modell kész (2026-07-21):** minden vendéglátós szakmához saját `hint` + saját `PROFESSION_DETAILS` (részletes, dinamikus szűrőmezők) + „Saját szempont" (customCriteria). Közös mezők (terület, munkaviszony, díjazás szám+időszak) maradnak. A díjazásnál nincs „évi". Pro (mélykutatás) mód KIVÉVE — nem kellett.

**Kulcsdöntés (2026-07-21): finder/recruit szétválasztás.** A Perplexity nem tud megbízhatóan LinkedInről olvasni → egyéni alkalmazottakra (séf, szakács, cukrász, pincér…) csak álláshirdetéseket hoz, nem kész kontaktot. Ezért a szakember-kereső belépéskor KÉT FÜL: „Szakember-kereső" (csak online, nyilvános elérhetőségű szolgáltatók/cégek) és „Toborzás" (egyéni alkalmazottak — placeholder, később kidolgozzuk). Megvalósítás: `Profession.track: "finder"|"recruit"` a `professionals.ts`-ben; egyéni vendéglátós szakmák recruit-re jelölve (SEMMI nem törölve — bent maradnak toborzáshoz); `professionsForTrack()` helper; a kereső csak finder-szakmát listáz. Vendéglátás finder-szakmái: HACCP, könyvelő, konyhagép-szerviz, takarító/mosoda, marketinges. Ingatlan: minden finder (nincs Toborzás fül — `hasRecruit` alapján rejtve). Oldal-leírások (ModuleIntro) finomítva. tsc tiszta, commit `84e0093` — user push-olja. Következő: a Toborzás fül tényleges kidolgozása. Lásd [[select-field-standard]], [[hospitality-module]].

<<<FILE: redesign-phase7.md>>>
---
name: redesign-phase7
description: "A 7. fázis (prémium arculat) redesign állapota — komponensek, döntések, push-státusz"
sources: [cowork-import]
aliases: []
---

**7. fázis redesign (2026-07-17, localhoston, MÉG NINCS PUSHOLVA).** Irány: dark-bronze marad, letisztult teches, levegősebb, egységes koral akcent. A mostani 1.0 mentve: git tag `v1.0-landing` + branch `backup/v1.0-pre-redesign`.

Amit bevezettünk (kész):
- **Betű:** self-hosted **Space Grotesk** display (`--font-display`, next/font) a régi Clash Display CDN helyett; `.font-display` a címeken.
- **Framer Motion** (a user `npm install framer-motion`-nel telepítette; a sandbox nem tud csomagot telepíteni!).
- Közös komponensek: `components/motion/Reveal.tsx` (scroll-reveal), `motion/AnimatedNumber.tsx` (kredit felpörgés + villanás, `animateOnMount`), `motion/Skeleton.tsx` (+ `.twx-skeleton` CSS), `components/Toast.tsx` (`showToast(msg,type)`, `ToastProvider` a root layoutban), `components/ModuleIntro.tsx` (modul intro-fejléc), `components/ModuleIcon.tsx` (ikonkészlet), `components/MobileNav.tsx` (mobil hamburger drawer).
- **Navigáció** (`DashboardNav.tsx`) átépítve: gazdag legördülő sorok (ikon+cím+leírás) + mozgó kiemelés (`layoutId`). A `catalog.ts` ModuleLink kapott `desc`+`icon` mezőt.
- **Modul intro-fejlécek** minden modulban: flyer, valuation, land, visualization, VideoBuilder, branding, flyer/history.
- **Kredit-animáció** az AccountMenu-ben és a dashboardon.
- **Mobil:** dashboard fejléc `md:` töréspontokkal — desktop változatlan, mobilon MobileNav hamburger. Minden `prefers-reduced-motion`-barát.

Nyitott/hátra: a user végignézi localhoston; toast szélesebb bekötése (több űrlap sikere/hibája); a landing hero videó marad. **Push majd akkor**, ha a landing késznek nyilvánítva — akkor a hero.mp4 tömörítés is [[landing-hero-video]] szerint.

Lásd még: [[landing-hero-video]], [[twinx-deployment]].

<<<FILE: reklamvideo-anna.md>>>
---
name: reklamvideo-anna
description: "A TWINX 30 mp-es reklámvideó — „Anna és a hétfő\" történet, a bevált AI-gyártási recept és a teszt-kör tanulságai; a végleges gyártás később indul újra."
sources: [cowork-import]
aliases: []
---

**TESZT-KÖR LEZÁRVA 2026-09-09.** A partner megnézte, mit tud az AI-videó; jó indulás volt,
de a **végleges verziót később, profibban gyártjuk újra** — valószínűleg a képektől kezdve.
Teljes forgatókönyv, promptok, job-ID-k: `docs/reklamvideo-forgatokonyv.md`.

**A történet (ez marad):** Anna, ingatlanos, reggel a lassú kézi munkával küzd → kinéz az
ablakon, meglát egy TWINX hirdetőtáblát → visszaül, és pár perc alatt végez (pipák villannak
mellette) → becsukja a laptopot, kilép a napfénybe → TWINX logó + slogan. Érzelmi mag:
**visszakapott idő**. Nem felsorolás, a szolgáltatások nem látszanak konkrétan.

**A bevált recept:**
1. Karakter-biblia (3 állókép Annáról, rögzített ruha/haj) + helyszín-biblia (2 kép az
   irodáról és a kilátásról) — ezek referenciaként MINDEN videó-blokkhoz mennek, és a
   karakter- meg helyszín-leírás szó szerint azonos minden promptban.
2. Kevés, hosszú blokk (8–10 mp), nem sok apró snitt — így nem csúszik el az arc.
3. Felirat a táblán: üres kép → feliratos kép (nano_banana, jó magyar ékezetek) → videó
   `start_image` + `end_image` párral, közte madárraj „lapoz".
4. A laptop képernyője végig elfordítva.

**Modell:** a Seedance 2.5 Plus-előfizetést kér (starter csomagon tiltott, 52–72 kredit/8 mp).
Helyette **minimax_h3**: 2560×1440, ~2 kredit/mp, jó identitás-tartás; egyszerre csak 1–2 job
fusson (429 rate_limit), a karakter nélküli snitt `image_references` helyett `start_image`-dzsel megy.

Kapcsolódó: [[ingatlan-landing-hero]]

<<<FILE: rendrakas-noop.md>>>
---
name: rendrakas-noop
description: Rendrakás (Nano Banana) néha visszamásolja a képet — no-op felismerés + ingyenes újragenerálás
sources: [cowork-import]
aliases: []
---

A Képjavító **Rendrakás** módja (Nano Banana / Gemini 2.5 Flash Image, `lib/nanobanana.ts`) néha egy MAJDNEM AZONOS képet ad vissza — nem takarít. Két ok: (1) a `rendrakas` promptból hiányzott a „no-op = FAILURE" horgony (a `feljavitas` promptban ott volt); (2) EXTRÉM zsúfolt szobánál a modell egyetlen menetben nem tud ennyi holmit eltüntetni + a mögötte lévő felületet visszaépíteni, ezért „feladja". A `nanobanana.ts` csak akkor dob hibát, ha NINCS kép — egy visszamásolt képet sikerként fogad el.

**Javítás (2026-08-20):** (a) prompt-horgony a `ENHANCE_PROMPTS.rendrakas`-ba (image-enhance.ts) — „MUST produce a VISIBLY decluttered image…". (b) böngészőoldali no-op felismerés: `lib/image-diff.ts` `imageMeanDiff()` egy 40×40-es vászonra rajzolja az eredetit és a készet, luma-átlageltérést számol; `NOOP_DIFF_THRESHOLD = 0.02`. A jóváhagyó ablakban (image-enhance/page.tsx), CSAK rendrakásnál, ha alig változott és még nem volt ingyenes újragenerálás → sárga sáv + „Újragenerálás (ingyenes)" gomb, a MEGLÉVŐ ingyenes regenerate flow-ra kötve. CORS-hiba esetén `imageMeanDiff` null → nem jelez (nincs téves nyaggatás). A user döntése: „szóljon + ingyen újra", NEM automatikus retry (az minden no-opnál dupla API-költség lenne).

**Extrém zsúfoltság-jelzés (2026-08-20):** ingyenes böngészős heurisztika, `imageBusyness()` az `image-diff.ts`-ben — 40×40 szürkeárnyalatos szomszéd-gradiens átlaga (sok apró tárgy → sok él → magas). Kalibrálva valós fotókon: berendezett/tiszta ~0,01-0,02, normál ~0,03-0,045, EXTRÉM ~0,065-0,08 → `EXTREME_BUSYNESS_THRESHOLD = 0.065` (szándékosan magas, kevés téves riasztás). A feltöltő ablakban a kiválasztott képekre fut (`picks` object-URL jó, remote lib-kép CORS-null → kihagyva); ha bármelyik extrém → sárga figyelmeztető sor + a rendrakás az `extreme=1` flaggel megy. A route ilyenkor a `EXTREME_DECLUTTER_SUFFIX`-et fűzi a nano prompthoz (agresszívabb: padló/felületek előbb, „no-op = failure"). A user az INGYENES böngészős heurisztikát választotta a Gemini-vision helyett (nulla API-költség, néha téved — de csak puha figyelmeztetés). Csak `feljavitas`→false, `rendrakas`+extreme→true.

**BUKTATÓ:** a runtime prompt a DB-ből jön (`buildEnhancePromptActive` → `getActiveSegments("image_enhance_rendrakas").prompt ?? ENHANCE_PROMPTS`). Ha az adminban (/admin/prompts) van MENTETT rendrakás prompt, a kódbeli horgony NEM érvényesül — ott kézzel kell hozzátenni VAGY a mentést törölni/alaphelyzetbe állítani. A no-op felismerés ettől függetlenül működik.

Lásd még: [[flyer-render-approach]] (a „ne bízz a modellben, ellenőrizd a kimenetét" elv).

<<<FILE: select-field-standard.md>>>
---
name: select-field-standard
description: "Minden legördülő a saját SelectField komponenssel készül, nem natív <select>-tel."
sources: [cowork-import]
aliases: []
---

A felhasználó kérése: MINDEN legördülő mező (kategória, konyhatípus, stílus, formátum, hangnem, megye stb.) a saját elegáns `src/components/SelectField.tsx` komponenssel készüljön, ne natív `<select>`-tel. Ez a `DateField` naptár párja, azonos arculat.

**Why:** Egységes, prémium megjelenés (framer-motion popover, korall kiemelés + pipa, kereső 8+ opciónál, portál + fix pozíció, hogy drawer/modál `overflow`-ja ne vágja el). A natív `<select>` böngészőnként más és csúnya.

**How to apply:** Új mezőnél mindig `import SelectField from "@/components/SelectField"` és `options={[{value,label}]}` + `onChange={(v)=>...}` (a value-t adja, nem eventet). Placeholder/„— válassz —" opciót az options első elemeként is add meg. Lecserélve: vendéglátás (Kínálat kezelő, szerkesztő, menüs ételek, menü generátor, beszállító-kereső, önköltség, alapanyagok), ingatlan látványterv, hirdetéskészítő (flyer), arculat (branding). Lásd [[hospitality-module]].

<<<FILE: smartlead-levelsorozatok.md>>>
---
name: smartlead-levelsorozatok
description: A TWINX Smartlead levélsorozata (csak a meleg, meglévő partnereknek szóló 5 levél) — ha Márk „Smartlead levélsorozatokra" hivatkozik, ebből dolgozunk; hol van és hogyan épül.
sources: [cowork]
---

- [stated] asked to remember: ha a „Smartlead levélsorozatok"-ra hivatkozik, a 2026-09-28-án elkészült sorozatból dolgozunk (jóváhagyta: „Tetszik").
- [stated] Eredetileg meglévő partnerek + hideg lista is volt; 2026-09-30-án kérte: „a hideglistát töröljük" — a `hideg/` sorozat törölve (git-történetben megvan), csak a `meleg/` (képes TWINX-kártyás, meglévő partnereknek) maradt.
- [stated] Az 5 témára és a hozzájuk készült 1080×1080 FB-posztokra kell építeni: 1. Elindult a TWINX, 2. Értékbecslés, 3. Videókészítés, 4. Hirdetés ellenőrzés, 5. Ajándék 10 kredit.
- [stated] asked to remember: helye a repóban `marketing/email/` — `content.py` (szövegek, WARM lista), `build.py` (generátor, `python3 marketing/email/build.py`), `meleg/` (NN-téma.html + .txt), `SEQUENCE.md` (tárgyak A/B, előnézet, időzítés), `README.md` (Smartlead-beállítás), `elonezet.html` (gitignore-olt előnézet); képek: `public/marketing/email/01..05-*.jpg` (twinx.hu-ról töltődnek, élesítve 2026-09-28).
- [stated] asked to remember: formátum — táblázatos, inline CSS, 600 px, tegező hangnem, `{{first_name}}`, a leiratkozás helye `%unsubscribe-text%`, minden CTA a twinx.hu/ingatlan oldalra UTM-mel (utm_source=smartlead, utm_campaign=twinx-meleg); Smartleadben az „Optimize Email Delivery" legyen kikapcsolva.
- [stated] 2026-09-30: a leveleket munkatárs(ak)nak adja át külön-külön — kért levelenkénti átadási ZIP-eket (Smartlead: `marketing/email/atadas-smartlead/`, ZIP-ek `TWINX-smartlead-hirlevel-…` — átnevezve, mert az `atadas` név nem volt egyértelmű), és mivel a kiküldéshez Brevót is igénybe vehetnek, Brevo-változatú ZIP-eket is (`marketing/email/atadas-brevo/`); ezeket ő maga továbbítja.
- [stated] asked to remember: a munkatársaknak szóló kiküldési útmutató (Smartlead + Brevo) PDF-et 2026-09-30-án kiküldte a kollégáknak, és elmentette; ha változtatni kell, ebből dolgozunk: `marketing/email/TWINX-hirlevel-kikuldesi-utmutato.pdf`, forrása `marketing/email/utmutato_pdf.py` (a tárgyakat/időzítést a content.py-ból veszi; a build.py is legenerálja, és a „mind-az-5” ZIP-ekbe is bekerül).

Kapcsolódó: [[ingatlan-landing-hero]], [[reklamvideo-anna]], [[google-analytics]]

<<<FILE: stripe-go-live.md>>>
---
name: stripe-go-live
description: "Stripe fizetés állapota, az élesítés blokkolói és az értékesítés indulási terve (2026-07-29)"
sources: [cowork-import]
aliases: []
---

**Az értékesítés 2026. július 31-én (péntek) indul, de EGYELŐRE NEM Stripe-pal.** Az első partnerek **adminként kapnak krediteket**; ha pozitív a visszajelzés, akkor alapítja meg Márk a céget, és utána jön az éles fizetés. Tehát a Stripe élesítése NEM sürgős — de a kód készen áll rá.

**Kód-állapot (2026-07-29, SQL LEFUTTATVA):** a webhook meg van erősítve. A kredit jóváírása EGYETLEN tranzakcióban megy a `credit_purchase_apply(p_session_id)` SQL-függvénnyel (megjelölés + wallet együtt) → sem dupla jóváírás, sem „fizetett-de-nincs-kredit" nem lehet. Kezelve: halasztott fizetés (`checkout.session.async_payment_succeeded`), hiányos metadata és jóváírási hiba 500-zal (látszik a Stripe felületén, a Stripe 3 napig újraküld). Új oszlopok: `credit_purchases.credited_at`, `.livemode`. Checkout: ár-kerekítés, `customer_email`, try/catch.

**MÉG HÁTRA VAN az éles fizetéshez:**
1. **Számlázás — ez a fő blokkoló.** A Stripe NEM állít ki magyar áfás számlát és NEM jelent a NAV Online Számlába. 2026. július 1. ÓTA kötelező az e-számla belföldi B2B-nél (a partnerek ingatlanirodák = B2B). Kell egy magyar számlázó a webhookból hívva: Billingo (modern REST API, API-kiegészítő előfizetés kell) vagy Számlázz.hu (Számla Agent; a könyvelők ezt ismerik). Döntés a könyvelővel.
2. **ÁFA / árazás:** a 2 490 / 11 205 / 19 920 Ft bruttó vagy nettó? 27% áfa. Számlázási név/cím/adószám bekérése a checkoutban (`billing_address_collection`, `tax_id_collection`) — még NINCS bekötve.
3. **Visszatérítés:** `charge.refunded` NINCS kezelve → refund után a kredit a partnernél marad.
4. **Stripe fiók élesítése:** cégadatok + adószám + bankszámla, 1-7 munkanap. Cégalapítás után indítható.
5. Éles kulcsok a Vercelre (`sk_live_` + az ÉLES webhook végpont SAJÁT titka) → redeploy → valódi kisösszegű tesztvásárlás, ellenőrizve hogy a `credit_purchases` sorban van `credited_at`.

Lásd még: [[twinx-deployment]], [[credit-100-percent-profit-rule]], [[vercel-supabase-gotchas]].

<<<FILE: supplier-finder-pro.md>>>
---
name: supplier-finder-pro
description: "Beszállító-kereső bővített szűrők + PRO (mély kutatás) async mód; itt működik a Perplexity deep research, amit a szakember-keresőből kivettünk."
sources: [cowork-import]
aliases: []
---

A vendéglátós Beszállító-kereső (`SupplierFinder.tsx`, `lib/suppliers.ts`, `/api/hospitality/suppliers`) 2026-07-25-én bővült:

**Új strukturált szűrők** (a Perplexity-promptba tagoltan beépülve, `composeSupplierPrompt`): tanúsítvány-chipek (BIO, HACCP, GLOBALG.A.P.…), eredet (magyar/helyi/import), szállítási mód + minimum rendelés, feldolgozottság (nyers/előkészített/fagyasztott) + szezon, rangsorolási prioritás (default: megbízhatóság), gyakori igény-chipek (számlaképes, halasztott fizetés…), és „saját szempont" szabad mező → chipek. A régi egyetlen „Egyedi igény" szabadmező helyett.

**PRO (mély kutatás) mód** — a szakember-keresőből korábban kivett Pro itt ÚJRA él, ASZINKRON módon (ezért nem bukik el a Vercelen): `sonar-deep-research`, dupla kredit. Minta: a `land` modul async pattern-je. Új: `supplier_jobs` tábla (`hospitality-supplier-jobs.sql` — FUTTATANDÓ Supabase-ben), `/api/hospitality/suppliers/status` route (poll + finalize, versenyhelyzet-védelemmel), `lib/supplier-finalize.ts` közös finalize (parse→PDF→mentés) a szinkron és async ágnak. A kliens 3-4 mp-enként pollingozza; arany PRO kapcsoló + állapotszöveg. Üres találat / hiba → kredit visszajár.

Localhoston kész, tsc tiszta, commit `26f889b`, **push + a supplier_jobs SQL még hátra**. Lásd [[professional-finder]] (ott a Pro-t adat-elérhetőség miatt vettük ki, nem a Vercel miatt).

<<<FILE: twinx-deployment.md>>>
---
name: twinx-deployment
description: "A TWINX AI Portal élesítési állapota, env változói és a nyitott élesítési tételek (twinx.hu, Vercel, Supabase)"
sources: [cowork-import]
aliases: []
---

A TWINX AI Portal ÉLESBEN fut a **twinx.hu**-n (2026 júliusban élesítve).

- **App-hoszting: Vercel** (GitHub `TwinxAdmin/TWINX`, `main` ág, auto-deploy push-ra). A user a saját VS Code termináljából pushol; a sandboxból a push tiltott.
- **Háttér: Supabase** (projekt: `ucsxbtfbjhkxtkfebktm.supabase.co`). Auth, Postgres+RLS, Storage.
- **Domain/DNS: Rackforest** → a DNS a Vercelre mutat.
- **Next.js 15.3.8** (2026-07-29-én emelve 15.3.6-ról a CVE-2025-55184 / CVE-2025-55183 React Server Components sebezhetőségek miatt).

---

**ENV-ÁLLAPOT a Vercelen (2026-07-29, ellenőrizve):** minden kulcs fent van Production (és jellemzően Preview) környezetben: `FAL_KEY`, `SHOTSTACK_API_KEY`, `SHOTSTACK_ENV`, `VIDEO_WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL`, `PERPLEXITY_API_KEY`, `GOOGLE_AI_STUDIO_API_KEY`, `RESEND_API_KEY`, `LEADS_NOTIFY_EMAIL`, `STRIPE_*`, `SUPABASE_*`.

**Vercel-tanulságok ebből a körből:**
- A `NEXT_PUBLIC_*` változókra **Sensitive-et TILOS** tenni, és a Sensitive utólag NEM kapcsolható ki — törölni és újra felvenni kell.
- Szerkesztéskor a Vercel elveszítheti a Production pipát — mentés után MINDIG ellenőrizd a sor alatti környezet-címkét.
- Env-változtatás után **kötelező a Redeploy**.
- Az `APP_URL` nevű változó a kódban NINCS használva (a kód `NEXT_PUBLIC_SITE_URL` / `SITE_URL` nevet olvas).
- A build ártalmatlan figyelmeztetést ad a Supabase + Edge Runtime miatt a middleware-ben — nem kell javítani.

---

**MEGOLDVA 2026-07-30: a videó modul ÉLESBEN MŰKÖDIK, vízjel nélkül.** A Shotstack fiók Pay-As-You-Go, 10 kredittel indult (1 kredit = 1 perc render; egy 25-30 mp-es videó ≈ 1 kredit). A production kulcs + `SHOTSTACK_ENV=v1` a Vercelen; a **localhoston SZÁNDÉKOSAN marad a sandbox kulcs + `SHOTSTACK_ENV=stage`**, hogy a fejlesztés ne fogyassza a fizetős keretet (ott vízjeles a videó — ez normális).

*Két buktató, ami időt vitt el:* (1) a sandbox és a production kulcs NEM cserélhető össze — a hibaüzenet mindkét irányban 403, és pontosan megmondja, melyik kulcs melyik végponthoz nem való; (2) a Vercelen az env értékek a DEPLOYHOZ kötődnek, ezért minden változtatás után kötelező a Redeploy. Plusz: a videó 1-3 percig készül, érdemes kivárni, mielőtt hibát keresünk.

**NYITOTT (2026-07-30):**

1. **Élesben még nem tesztelt:** Képjavító (fal), PRO videó, Hirdetés-ellenőrző.
2. A fal.ai KÜLÖN fizetős — a PRO videó ott fogyaszt, nem a Shotstacknél.
3. A PRO videó AI-promptjai (napszakváltás) még finomításra várnak — lásd [[video-2-pipeline]].

Lásd még: [[vercel-supabase-gotchas]], [[video-2-pipeline]], [[stripe-go-live]], [[ad-check-module]].

<<<FILE: udvozlo-levelsorozat.md>>>
---
name: udvozlo-levelsorozat
description: Automatikus üdvözlő levélsorozat az új TWINX-regisztrálóknak (saját, beépített megoldás) + Resend domain-hitelesítés — állapot, döntések, nyitott lépések; olvasd, ha az onboarding-levelek, a Resend, a feladó vagy a twinx.hu DNS szóba kerül.
sources: [cowork]
---

## Döntések (2026-09-30)
- [stated] A regisztrálóknak üdvözlő hírlevél megy, a SAJÁT, beépített megoldással (A) — nem Brevo-automatizmussal.
- [stated] Az admin és sales kollégák egy KÜLÖN „Marketing” menüpontban lássák (a „Tartalom” mellett, nem a dashboardon szembejövően): áttekintő számok + felhasználónkénti státusz is.
- [stated] A 3 levél szövege jó („jók lesznek a levelek”): 0. nap üdvözlés + kreditek; +3 nap értékbecslés-útmutató (csak aki még nem használt kreditet); +7 nap 3 tipp + csomagok.

## Állapot
- [stated] asked to remember: KÉSZ az 1. lépés — `src/lib/onboarding-emails.ts` (ONBOARDING_STEPS + renderOnboardingEmail), tsc/lint tiszta; még nincs git-pusholva.
- [stated] asked to remember: HÁTRALÉVŐ lépések: 2) SQL: onboarding-napló tábla + leiratkozás mező; 3) küldő API route (Resend, List-Unsubscribe fejléc, opt-out és kredit-feltétel); 4) Vercel cron (vercel.json, titkos kulcs); 5) leiratkozás oldal; 6) admin „Marketing” menü + nézet (admin+sales); 7) ellenőrzés + tesztküldés.

## ELŐFELTÉTEL — Resend domain (FÉLBEHAGYVA, később folytatjuk)
- [stated] asked to remember: a Resendben (fiók: „twinx”) a twinx.hu-t hozzáadta, régió Ireland (eu-west-1); a DNS-rekordok MÉG NINCSENEK beírva a Rackforestnél, a domain még nem Verified. „Enable Receiving” maradjon kikapcsolva.
- [stated] asked to remember: beírandó rekordok a Rackforest DNS-be (értékek teljes hosszban a Resendből másolva): TXT `resend._domainkey` (DKIM, p=MIGfMA…wIDAQAB); CNAME `rsend` → rsend-eu….mta.net; CNAME `send` → send.for….mta.net. Utána Resend → „Verify DNS Records”.
- [stated] asked to remember: a twinx.hu DNS a Rackforestnél (cns1/cns2.rackforest.com); levelezés Google Workspace (MX: smtp.google.com); DMARC már van (`v=DMARC1; p=none`) — újat nem kell; a gyökér SPF-ből (`v=spf1 +a +mx +ip4:193.39.12.5 ~all`) hiányzik az `include:_spf.google.com` — ezt később érdemes rendbe tenni (Resendtől független).
- [stated] asked to remember: a Vercelben ellenőrizni kell a `RESEND_FROM`-ot (javasolt: `Kovács Márk | TWINX <hello@twinx.hu>`) és a `RESEND_REPLY_TO`-t; hitelesített domain nélkül a mostani rendszerlevelek (pl. ajándékkód) valószínűleg nem jutnak el a partnerekhez.

Kapcsolódó: [[smartlead-levelsorozatok]], [[google-analytics]], [[twinx-deployment]]

<<<FILE: valuation-editor.md>>>
---
name: valuation-editor
description: "Szerkeszthető ingatlan-értékbecslés: prémium előnézet, böngészőoldali A4 PDF, lokációs prémium korrekció"
sources: [cowork-import]
aliases: []
---

Az **ingatlan-értékbecslés** modul 2026-08-03-tól szerkeszthető: az AI riportja
szakaszokra bomlik, a partner átírja/elrejti/mozgatja a szakaszokat egy prémium
(sötét bronz fejléc + ár-kártyák) A4-előnézetben, és abból készül a PDF.

**Kulcsdöntések, amiket nem szabad visszacsinálni:**

- A **PDF a BÖNGÉSZŐBEN** készül (`src/lib/report-pdf-client.ts`, html2canvas + jsPDF),
  DOM-alapú A4-lapozással. Ok: a Vercelen nincs használható szerver-Chromium
  (lásd [[vercel-supabase-gotchas]]), a régi pdf-lib fallback pedig csúnya. Így a
  PDF pontosan az, amit az előnézet mutat. Ugyanaz a minta, mint a hirdetésnél
  ([[flyer-render-approach]]).
- A `/api/real-estate/valuation` route **már nem készít PDF-et**; a friss riportot
  `usage_history.output_text`-be írja és visszaadja a sor `id`-jét. A szerkesztő
  a megnyitás után ~0,8 mp-cel **automatikusan** elmenti az első PDF-et, hogy az
  előzményben mindig legyen letölthető dokumentum.
- A mentett riport **JSON** az `output_text`-ben (`{"twinxReport":1,...}`), nem
  markdown. Ok: a "## cím" alapú visszaolvasás összeolvasztotta a szakaszokat, ha a
  partner kettőspontot vagy üres címet írt. A friss AI-válasz még sima szöveg —
  a parser mindkettőt kezeli.
- A feltöltési méretkorlát **2,9 MB** nyers PDF (a base64 ~1,37×, a Vercel limit 4,5 MB);
  nagyobbnál kisebb felbontással újrarenderel.
- **Lokációs prémium korrekció**: a partner állítja be (Átlagos 0% / Népszerű 5-12% /
  Kiemelten prémium 12-25%, csúszkával 5-25%). A kötelező utasítás a KÓDBÓL generált
  adatblokkban is benne van, mert az `ai_prompts` tábla aktív prompt-szegmensei
  felülírhatják az intro/task szövegét.

**Futtatandó SQL:** `valuation-editor.sql` (usage_history + `output_text`, `edited_at`).
A generálás enélkül elhasal az insertnél! Plusz `valuation-library.sql` a mappákhoz
(`valuation_folders` tábla + `usage_history.valuation_folder_id` oszlop — KÜLÖN oszlop,
mert a `folder_id` már a hirdetés-mappákhoz [flyer_folders] van kötve).

**Könyvtár (2026-08):** a becslések a közös `FolderLibrary` komponenssel jelennek meg
(hónap- és saját mappák, ablakos megnyitás), mint a videó/hirdetés ([[library-folders-pattern]]).
API: `/api/real-estate/valuation/manage` (POST mappa, PUT átnevezés, PATCH áthelyezés,
DELETE mappa/elem). A FolderLibrary mostantól tud mappát ÁTNEVEZNI és TÖRÖLNI is
(`onRenameFolder`/`onDeleteFolder` opcionális propok — a többi modul nem törik).

**Biztonság:** a `usage_history`-ra szándékosan NINCS user-oldali UPDATE (az RLS sorokat
szűr, nem oszlopokat) — a mentést a szerver végzi tulajdonos-ellenőrzéssel. A history
lekérdezésben KELL a `.eq("user_id", user.id)`, mert az RLS az adminnak minden sort átenged.

Lásd még: [[twinx-deployment]], [[library-folders-pattern]].

<<<FILE: valuation-engine.md>>>
---
name: valuation-engine
description: "Comp-alapú, hangolható értékbecslő motor v2 (2026-09-09): comp-normalizálás állapot szerint, helyiség/év/fűtés korrekciók, bővített állapot-skála, fix −15% átlagon aluli lokáció, egyoldalas arculatos PDF."
sources: [cowork-import]
aliases: []
---

Az értékbecslés szórásának megoldása: a Perplexity CSAK comp-adatot ad (JSON), a végső SZÁMOT a saját determinisztikus motor adja → futások konzisztensek.

**Fájlok:** `lib/valuation-engine.ts` (tiszta motor), `lib/valuation-engine-server.ts` (config-betöltő, comps-prompt, `buildSubject`, cache), `lib/valuation.ts` (űrlap-mezők, prompt adat-blokk, `parseRooms/formatRooms`, `parseBaths/formatBaths`, lokáció). Admin: `/admin/valuation-engine` + `ValuationEngineAdmin.tsx`. SQL: `valuation-engine.sql`.

## Motor v2 — 2026-09-09 fejlesztések

**Állapot-skála kibővítve** (`ConditionKey`): `bontando −30 · felujitando −18 · kozepes 0 · jo +6 · ujszeru +14 · premium +24`. Korábban −12…+10 volt, a prémium alig kapott többet a közepesnél. **Hibajavítás:** a `conditionKey()` a „felúj" töredékre illesztett, ezért az „Újszerű (pár éve épült/**felújított**)" felújítandónak számított (−12% felár helyett). Most sorrend: bontandó/szerkezetkész → felújítandó (pontos szóalak) → prémium/kiváló/kulcsrakész → újszerű/felújított → jó → közepes.

**Comp-normalizálás** (`adjust.normalize_comps_by_condition`, default true): minden comp nm-árát visszaszámoljuk „közepes" állapotra (`ár / (1+pct/100)`), a mediánt EBBŐL képezzük. Enélkül felújítandó comp-halmaznál a prémium subject is alulárazott maradt. A comp-prompt kötelezően kéri a `condition`, `bathrooms`, `year` mezőt és VEGYES állapotú találatokat.

**Új korrekciók a `Subject`-ben** (rooms, halfRooms, bathrooms, separateWcs, balconyM2, buildYear, heatingKey): extra fürdő +3%/db, külön WC +1,5%/db, szoba-sűrűség ±4% (25 m²/szoba elvárás, fél szoba fél súllyal, ±0,7 küszöb), nagy terasz +3% ≥15 nm, építés éve (2010+ +5 / 1980 előtt −4), fűtés (hőszivattyú/padlófűtés +4, konvektor/elektromos −4, átalány távfűtés −3). Mind az adminból hangolható. Próba: közepes 68,4 M → prémium 84,8 M → prémium+extrák 99,3 M (ugyanazon comp-okból).

**Lokáció:** új „Átlagon aluli" kategória **fix −15%** (nem csúszkás, `parseLocationPremium` kikényszeríti); Népszerű 5–12, Kiemelten prémium 12–25 csúszkás maradt. Prompt-szöveg „Lokációs korrekció", negatívnál értékcsökkentő szorzó.

**Űrlap:** helyiségek egy blokkban 4 `NumberStepper`-rel (szoba, fél szoba, fürdő, külön WC) — a mentett érték szöveg marad („3 + 1 fél szoba", „2 fürdőszoba + 1 külön WC"); erkély pipa mellett méret-mező (`erkelyMeret`), fix 44 px sáv; építés éve az emelet mellé; házközponti fűtés opciók.

**Élesítés-buktató:** a DB-ben mentett aktív config a RÉGI condition-értékeket felülírja az új defaultokra (mergeConfig: default ← DB). Deploy után Admin → „Visszaállítás alapértékre", vagy `jsonb_set(params,'{adjust,condition}', …)` az aktív soron.

**Egyoldalas arculatos PDF** (`lib/valuation-onepager.ts`, `components/valuation/OnePagerPaper.tsx`, `singlePageToPdfBlob`): a ValuationEditor „Egyoldalas lap" nézete; arculat-profil választó, fotó-választó (a becsléshez feltöltöttek közül, „Kép nélkül" is), egy ár + sáv-grafikon + adatok + max 4 indoklás; fejléc: logó vagy „INGATLAN / Értékbecslés", jobbra név/titulus/cég + ikonos elérhetőség-blokk; lábléc CSAK jogi kitétel + TWINX-jelzés (ügynök-adat nincs lent). Vázlat: `docs/egyoldalas-ertekbecsles-elonezet-v3.html`.

**Indító ablak (2026-09-09 du.):** az „Értékbecslés indítása" gomb validál, majd `ValuationStartModal` nyílik: arculat-választó (üres = TWINX alapstílus) + max 2 fotó (a már feltöltöttekből vagy új fájl). A választás a `ValuationInput.brandingProfileId` / `pagePhotos` mezőkbe kerül (route tölti fel a képeket a `reports` bucket `valuation-photos/` útjára), az előzményből újranyitva is ugyanaz a lap. A fotók a lap ALJÁN, egymás mellett; az ár mellett soha nincs kép. PARTNERNEK CSAK az egyoldalas lap látszik (`staff` prop: admin/sales kapja a „Részletes riport" fület). Hibajavítás: a status route eddig a JOB id-t adta vissza → a szerkesztő mentése „Nem található" hibát dobott; most `valuation_jobs.history_id` (SQL: `valuation-jobs-history.sql`). Arculat: `branding_profiles` RLS admin-kivétel megszüntetve (`branding-own-only.sql`) — az admin sem látja a partnerek arculatát.

**„Miért ennyi az ár?" — 5–7 egysoros indoklás (2026-09-09):** NEM az AI riport szövegéből vágunk (az hol üres, hol többsoros, belelógott a fotókba), hanem a motor auditjából (`buildReasons` a `valuation-onepager.ts`-ben) sablonokkal, súlyozott jelölt-készletből. Sorrend: állapot → lokáció → helyiségek → korszerűség → emelet/lift → comp-szám/időszak/fajlagos ár. Tartalék ág (nincs audit): űrlap-adatból, százalék nélkül; végső tartalék 5 általános, mindig igaz sor → SOHA nem marad üres. Hossz: sablon max 66 karakter + a komponens `nowrap`+ellipszis, fix 20 px sormagasság, a fotósáv külön flex-sávban. Az auditot a `valuation_jobs.audit` és a `usage_history.valuation_audit` szállítja a kliensre (status + history route).

**Sáv és fajlagos ár NEM szövegből (2026-09-09):** a tartalék (AI-írta) riportnál a `firstValue()` egy mondattöredéket emelt ki értéksávként — így került a lapra az „A HORGONY" felirat (a „horgony" a keresési prompt szakszava: a mikrolokáció referencia nm-ára). Javítás: `looksLikeMoney()` szűrő (4+ jegyű összeg vagy „12,5 M Ft" alak kell), a sáv forrás-sorrendje audit `lowHuf/highHuf` → riport-szöveg → ár ±4% (100 e Ft-ra kerekítve); a fajlagos ár riportból, különben ár ÷ alapterület. Így a mini grafikon MINDIG megjelenik, félreolvasott szöveg soha.

**Az indoklás NEM ismételheti a bal oldali táblát:** a tartalék sablonok az adat helyett az ÁRHATÁST mondják („Kulcsrakész: a vevőnek nincs felújítási költsége — felár", „Elavult fűtés — a korszerűsítés költsége árcsökkentő", „Felső szint lift nélkül — szűkebb vevőkör"). Plusz szó-átfedés szűrő (`isEcho`, >70% egyezés a `facts` sorokkal → kidobjuk). A motoros ág az állapotnál kiírja az összehasonlítási alapot is („…a környék átlagához").

**Comp-cache buktató:** `compsCacheKey` = település|utca|méret|típus, 3 napig él. Ugyanarra az ingatlanra a 2. futástól a GYORS ág fut (nincs Perplexity-hívás) — ez külön kódág, minden új mezőt oda IS be kell kötni (ezen bukott el elsőre az arculat és a lap-fotók átadása).

## Korábbi tanulságok (2026-08)

Fallback-szórás gyökéroka: kerület-szűrés pontos stringre (`districtNum()` fuzzy javította) + comp-cache 3 nap. Fejléc-ár rekonciliáció (`reconcileHeadline`, 2% tűrés, csak friss generálásnál). „Hálózati hiba"+kreditveszés: közös ~55 mp időkeret + kredit CSAK siker után (`chargeCredit` a generálás után) — ezt a mintát a többi AI-modulra is át kell vinni.

**Nyitott:** 2–3 valós ingatlanon érdemes ellenőrizni az új szorzókat; a −7% tranzakciós diszkont hangolása.

<<<FILE: vercel-supabase-gotchas.md>>>
---
name: vercel-supabase-gotchas
description: "Kemény leckék a TWINX Vercel+Supabase élesítéséből (env, build, méret-limit)"
sources: [cowork-import]
aliases: []
---

A TWINX Vercel+Supabase élesítés során bejött buktatók — ezekre figyelj:

- **NEXT_PUBLIC_ env NE legyen „Sensitive"** a Vercelen. A böngészőbe kerülő értékeket a Vercel „Sensitive" jelölésnél nem építi be rendesen a kliens-bundle-be → „No API key found" / üres érték. A `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` sima változó legyen; a `service_role` maradhat Sensitive.
- **Env-változtatás után KELL Redeploy** — a futó deploy nem kapja meg automatikusan az új env-et (sem szerver, sem böngésző oldalon).
- **Supabase URL pontos legyen** (`https://…supabase.co`, záró perjel/szóköz nélkül), különben „Invalid path specified in request URL". A kódba be van építve a záró perjel levágása (`src/lib/supabase/env.ts`).
- **Vercel serverless ~4,5 MB kérés-limit**: nagy fotó feltöltése elhal. Megoldás: kliensoldali képtömörítés feltöltés előtt (`src/lib/image-compress.ts`), bekötve látvány/videó/hirdetés feltöltéshez.
- **Szerveroldali Chromium (@sparticuz/chromium) a Vercelen NEM működik** (`libnss3.so: cannot open shared object file`), sem fájl-bevonással, sem 132-es verzióval, sem remote-pack letöltéssel. Feladtuk. Lásd [[flyer-render-approach]].
- **Build-buktatók**: ESLint kikapcsolva a buildnél (`next.config` `eslint.ignoreDuringBuilds`); Stripe-kliens lazy Proxy (ne kelljen kulcs build-időben); a főoldal `force-dynamic` (ne prerendereljen Supabase-t env nélkül).

Lásd még: [[twinx-deployment]].

<<<FILE: video-2-pipeline.md>>>
---
name: video-2-pipeline
description: "A Videó 2.0 hibrid pipeline felépítése, döntései és teszt-állapota"
sources: [cowork-import]
aliases: []
---

**Videó 2.0 megépítve (2026-07-28), ÉLES TESZT MÉG NEM VOLT.** A régi Luma+Shotstack lánc lecserélve; `lib/luma.ts` és `VideoBuilder.tsx` törölve, a luma webhook is.

**Jóváhagyott spec:** 5 lépéses varázsló (Arculat → Képek 4-5 → Adatok → Beállítás → Generálás); NINCS előnézet — a kész videó azonnal Storage-ba + `video_jobs.output_url` + usage_history; hang CSAK zene (nincs narráció); feliratok: Satori nyitókártya (cím+lokáció+ár-pecsét) és zárókártya (körök: fotó+logó, név, telefon, e-mail/web) + a fotók ALSÓ felirat-sávja fotónként váltakozó adatokkal (`captionForPhoto`); csak 1:1 és 9:16; hibrid: **Alap** = minden fotó Shotstack Ken Burns (zoomIn/out/slide váltakozva), **PRO** = az 1. fotó fal.ai image-to-video AI-klip (env `FAL_I2V_MODEL`, alap kling-video v1.6 standard). Árazás KÉSŐBB — env `VIDEO_CREDITS_ALAP` (5) / `VIDEO_CREDITS_PRO` (10), teszt admin fiókkal (bypass).

**Lánc:** POST `/api/real-estate/video` → kredit → job (`video_jobs`, +`package`,`meta` oszlopok: `video-v2.sql` FUTTATANDÓ!) → fotók + Satori PNG-k a `reports` bucketbe (`video-src/`, `video-frames/`) → zene `music/{stílus}/` gyökérből (`pickMusic`; a régi bin-mappák nem kellenek; 1 teszt-zene: `music/elegans/looking-for by jsquared Artlist.mp3`, Artlist) → Alap: Shotstack render callbackkel; PRO: fal queue webhook `/api/webhooks/fal?job=&token=` → az indítja a Shotstack-et → `/api/webhooks/shotstack?job=&token=` letölti az mp4-et, SAJÁT Storage-ba menti (`video/{user}/{job}.mp4`), history-t ír. Hibánál MINDEN ponton auto-refund (`wallet_add`). Kliens 3 mp-enként pollozza a `/api/real-estate/video/[id]`-t.

**Fontos env/infra a teszthez:** `SHOTSTACK_API_KEY` + `SHOTSTACK_ENV` (stage = teszt, vízjeles; élesben `v1`!), `FAL_KEY` (megvan), `VIDEO_WEBHOOK_SECRET`, `NEXT_PUBLIC_SITE_URL` vagy SITE_URL (webhook URL-hez; localhoston a webhook NEM jön vissza — élesben kell tesztelni!). Shotstack callback payload: `{status: "done"|"failed", url}`; fal webhook: `{request_id, status: "OK", payload: {video: {url}}}` — élesben igazolandó mezőnevek.

Git tag: `video-2-alap`. Lásd még: [[twinx-deployment]], [[flyer-render-approach]] (Satori/betűtöltés közös).

---

**FRISSÍTÉS 2026-07-29.**

*Feliratok átrendezve:* 1. kép város+irányár, 2. kép pontos cím (fent) + emelet (lent), 3. kép méret+szobaszám, 4. kép fürdő/wc. Műszaki állapot és szerkezet KIVÉVE a videóból (a varázslóból is). A felirat kétsoros, dinamikus betűmérettel (nincs túllógás), az alsó sor félkövér és nagy.

*Videó-könyvtár:* hónap szerinti automatikus mappák + saját mappák (`video_folders`), videónként letöltés / áthelyezés / VÉGLEGES törlés (tárhelyről is). Cím = ingatlan címe (`video_jobs.title`), előkép = a nyitókártya (`poster_url`). SQL: `video-library.sql`.

*PRO átépítve:* már NEM csak az 1. fotó, hanem MINDEN fotó kap AI-klipet, napszak-ívvel. ~1,2-1,5 USD önköltség, a 10 kredit így is tartja a [[credit-100-percent-profit-rule]]-t. Párhuzamos fal-beküldés, klipenkénti webhook (`?clip=N`). Egy hibás klip esetén az a snitt Ken Burns fotóra esik vissza; csak ha MIND bukik, akkor jár vissza a kredit. SQL: `video-pro-clips.sql` (atomi `video_clip_result` / `video_clips_init`, `video_job_claim_render`, `video_job_fail_once` + `refunded_at`).

*Tanulság — drága hiba volt:* a `video_clips_init` összefésülésben a jsonb `||` JOBB oldala nyer; először fordítva írtam, ezért az üres helyfoglaló felülírta a fal requestId-ket → a klipek elkészültek és ki lettek számlázva, de az eredmény sosem jutott vissza, a job örökre „készül" maradt. Javítva. Azóta: a beküldés után ELLENŐRIZZÜK, hogy az azonosítók elmentődtek, a néma `catch`-ek helyett látható diagnosztika megy a státusz-válaszba (`debug`: falDetail, clips, shotstackStatus, hibák), és 25 perc után automatikus időtúllépés + kredit-visszatérítés (`VIDEO_TIMEOUT_MINUTES`).

*NYITOTT (2026-07-29):* a PRO AI-promptok még NEM jók — a napszakváltás nem elég erős/hihető. A prompt-logika a `lib/fal.ts`-ben: `LIGHT_ARC` (napszak-ív, a snitt fő eseménye), `CAMERA_MOVES` (snittenként más kameramozgás), `VIDEO_NEGATIVE_PROMPT` (emberek + ablak felé menő kamera + statikus fény tiltva). A user szerint „majd megbeszéljük" — ezen még pontosítani kell.

<<<FILE: video-color-variants.md>>>
---
name: video-color-variants
description: "A Modern Sárga videósablon szín-variánsai (korall, krémfehér) — nem JSON-másolás, hanem futásidejű színcsere + átszínezett overlay-grafikák."
sources: [cowork-import]
aliases: []
---

**PARKOLÓPÁLYÁN 2026-08-28 óta.** `COLOR_VARIANTS_ENABLED = false` a video-color.ts-ben →
csak a Modern Sárga választható. Ok: a sablon áttűnés-grafikái beégetett sötét törlőelemek,
ezért az új szín csak korlátozottan tud érvényesülni; a partner új SABLONOKAT hoz be helyette,
nem a mostani színét módosítjuk. A gépezet (variánsok, script, feltöltött grafikák, URL-térkép)
érintetlenül megvan, egy `true` visszakapcsolja.

A Modern Sárga sablon két új színt kap (korall #ef7a5a, krémfehér #f4efe7) — a dizájn,
elrendezés, időzítés és áttűnés VÁLTOZATLAN. A sablon-JSON-t NEM duplikáljuk: marad a
2 fájl (9:16, 1:1), és `src/lib/video-color.ts` → `applyColorVariant()` cseréli render
előtt (a) a 4 rich-text betűszínt, (b) az átmenet-grafikák URL-jét.

**Miért kellett külön overlay-kezelés:** a sárga „ékek" és a záró kártya grafikája nem hex
a JSON-ban, hanem 4 egyedi, átlátszó `.webm` a Shotstack szerverén (5 klipben). Ezeket
egyszer át kell színezni és a saját tárhelyre tenni.

**Egyszeri lépés (a felhasználó futtatja):** `npm run video:overlays` → letölt, ffmpeg-gel
átszínez, feltölt a Supabase `video-assets` bucketbe, és kiírja a
`src/lib/video-json/overlay-colors.json` URL-térképet. **2026-08-27-én lefutott, a korall és
krém overlay-ek fent vannak.** Amíg a térkép üres, csak a sárga választható
(`colorVariantReady`), a route pedig 422-vel elutasít. ffmpeg nincs a gépen — a script az
npm-es `ffmpeg-static`/`ffprobe-static` binárist használja.

**Buktató, amibe belefutottunk:** a WebM alfa külön rétegben ül, ezért az ffprobe „yuv420p"-t
mond és a beépített dekóder eldobja. Minden olvasásnál `-c:v libvpx-vp9` kell, és az
átlátszóságot dekódolt képkockából kell ellenőrizni, nem a konténer címkéjéből.

**Varázsló:** a Sablon lépés három kis NÉGYZET csempe (Modern Sárga / Modern Korall /
Modern Krém), egy kattintás = sablon + szín; a méretválasztó közös, alatta.

**Hátra van:** éles próbavideó mindhárom színnel, majd push (2026-08-27-én még nincs pusholva).

Átszínezés két módban: ha a grafika egyszínű (≥90% sárga pixel) → pontos `lutrgb` színcsere
(alfa marad, márkaszín pixelre pontos, ellenőrizve); különben árnyalattartó `hue` forgatás.
A sandboxban a libvpx nem tudott alfás VP9/VP8-at kódolni, ezért a script VP9 → VP8 →
ProRes 4444 (.mov) sorrendben próbálkozik, és ellenőrzi, hogy maradt-e alfa.

**ÚJRAINDÍTVA 2026-10-01:** a sablon-bővítéshez az „A) rétegre bontás és újrafestés a jelenlegi animációkból" utat választotta (az Aurora sablon maga változatlan marad).
Elemzés (VS1): a 4 overlay-ben NINCS sárga — a sárga csak a JSON-szövegekben van. Az áttűnések 3 tónusból állnak: mély indigó alap ~#110420 (részben ~53% átlátszó sávként), meleg borostyán fény ~#A17A3E, semleges szürke fény (záró kártya). Ezért bukott a hue-forgatás. Új módszer: 3-pontos paletta-leképezés (indigó→alap, borostyán→kiemelés, szürke→semleges), alfa érintetlen — próbán (éjkék+arany, erdőzöld+krém, grafit+réz) jól működött; ez affin RGB-transzformáció, ffmpeg-ben is megoldható.

Kapcsolódó: [[video-2-pipeline]], [[video-wizard-redesign]], [[twinx-deployment]]

<<<FILE: video-wizard-redesign.md>>>
---
name: video-wizard-redesign
description: "Videó szerkesztő újraterv (Modern Sárga) — nyitó összefoglaló, 4 feliratos kép, fotó nélküli színes zárókép, Arculat lépés kivéve"
sources: [cowork-import]
aliases: []
---

A videó-generátor (csak Modern Sárga sablon aktív) szerkesztőjének kért újratervezése. Megbeszélve 2026-08-26, ÉPÍTÉS MÉG NEM kezdődött el — ez a jóváhagyott spec a folytatáshoz. Kapcsolódik: [[video-2-pipeline]].

**Folyamat / szerkesztő:**
- Az **Arculat lépést KI kell venni** a láncból.
- 5 kép feltöltés, a **sorrend megadható**.
- **Nyitókép (1. kép):** háttér a feltöltött 1. fotó, rajta összefoglaló az ingatlanról. A szerkesztőben **NAGYOBB**, kiemelt, a hozzá tartozó szövegmezőkkel — hangsúlyozva, hogy ezzel indul a videó. Megjelenő adatok: **ár, elhelyezkedés, méret + szobaszám, ingatlan típusa**.
- **2–5. kép:** a szerkesztőben **kisebbek**, mindegyikhez opcionális, **max karakterszámú** felirat.
- **Zárókép:** NINCS feltöltött háttérfotó — a **sablon egyszínű háttere**, rajta az **ingatlan fő adatai** + az **ingatlanos elérhetősége** (név, telefon, e-mail).
- Az **elérhetőség**: kézzel megadható VAGY egy **legördülő**, ami a felhasználó korábbi arculati profiljaiból ismeri fel és emeli át az adatokat.
- A **fő adatokat egyszer** kell megadni → a nyitó- ÉS a záróképen is megjelenik.

**Technikai teendő (render oldal):** a Modern Sárga Shotstack-JSON-t módosítani kell — az **ár rákerüljön a nyitó (intro) összefoglalóra**, és a **zárókártya háttere egyszínű legyen** (ne fotó). A korábban épített „záró kép feltöltés háttérnek" logikát ehhez vissza kell fordítani. A képenkénti felirat-overlay (contentImageWindows + video-merge) marad.

**Státusz:** a mostani kódban a záró kép feltölthető háttérként van (satori + json), ez NEM ez a spec — a folytatásnál át kell építeni. localhoston, nincs élesítve.

<<<FILE: visualization-watermark.md>>>
---
name: visualization-watermark
description: "A látványtervekre a saját rendszerünk teszi rá a „Twinx AI látványterv\" vízjelet — sharp + Satori, közvetlenül a Storage-feltöltés előtt."
sources: [cowork-import]
aliases: []
---

Minden LÁTVÁNYTERV jobb alsó sarkába kis, fehéres-szürke, 55%-ban átlátszó felirat kerül:
**„Twinx AI látványterv"**. Nem a prompt kéri az AI-tól (az képenként máshova tenné, hibás
szöveggel), hanem a `src/lib/watermark.ts` — a szöveg, méret, szín, átlátszóság mind ott,
egy helyen. CSAK a látványtervre vonatkozik; a képjavító és a többi modul érintetlen.

Hol fut: `api/real-estate/visualization/route.ts`, közvetlenül a Storage-feltöltés ELŐTT —
így nincs olyan út (előnézet, letöltés, könyvtár, hirdetés, videó), ahol jelöletlen kép
kikerülne. Ha a vízjelezés hibázik, az EREDETI kép megy fel (a kredit már levonva, a
generálás emiatt soha ne bukjon el).

Technika: a feliratot Satorival (next/og, beágyazott Manrope) rajzoljuk átlátszó PNG-be —
így nem függünk a szerver betűkészletétől —, majd `sharp`-pal komponáljuk a képre, és
**JPEG**-ként mentjük (a PNG tízszeres tárhelyet vinne, a Supabase-kvóta miatt ez számít).
A `sharp` a Next tranzitív függősége volt, most explicit is szerepel a package.json-ban.

Betűméret a kép szélességének 2,2%-a (min. 18 px), margó 2,5% — így minden képméretnél
arányos. A régi, korábban készült látványtervek NEM kapnak visszamenőleg vízjelet.

Kapcsolódó: [[twinx-deployment]], [[library-rename-move]]
