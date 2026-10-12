# TODO.md — Twinx AI Portal (Master Brief)

Fázisokra bontott feladatlista. A szabályokat lásd: [CLAUDE.md](./CLAUDE.md).
**Alapelv:** granuláris haladás (Űrlap validáció → API bekötés → Adatbázis mentés),
wireframe-first UI a 7. fázisig. Egy működő fázis után → push GitHub-ra.

## 1. fázis — Alapprojekt + adatbázis
- [x] Next.js projekt (App Router, TypeScript, Tailwind CSS)
- [x] Route Group mappaszerkezet: `(public)`, `(auth)`, `dashboard` + modul almappák
- [x] `20260703105450_schema.sql` — táblák (profiles, services, company_access, user_credits, usage_history)
- [x] `profiles` auto-trigger (`handle_new_user`) + RLS policy-k
- [x] `.env.local.example` sablon
- [ ] `npm install` lokálisan, `npm run dev` ellenőrzés
- [ ] `20260703105450_schema.sql` lefuttatása a Supabase SQL Editorban

## 2. fázis — Supabase Auth + Dashboard alap
- [x] Supabase kliens bekötése (browser + server)
- [x] Regisztráció (e-mail/jelszó): validáció → API → Auth (új fiók: 0 kredit)
- [x] Belépés / kijelentkezés
- [x] Védett route-ok (middleware a `dashboard`-ra)
- [x] `dashboard/page.tsx`: kredit egyenlegek lekérése
- [x] Legutóbbi 50 elem üres panele (`usage_history`, LIMIT 50)

## 3. fázis — Stripe + admin kredit kontroll
- [x] Stripe Checkout Session (10-es fix csomag / modul)
- [x] Stripe Webhook: sikeres fizetés → +10 kredit
- [x] Kreditek NEM járnak le (nincs lejárati logika)
- [x] Admin: manuális kredit hozzáadás fiókokhoz (`/api/admin/credits`)
- [x] Backend logika: `admin` és `sales` megkerüli a kreditlevonást (`chargeCredit`)

## 4. fázis — Ingatlan Értékbecslő modul
- [x] 4.1 Frontend űrlap: **14 mező** (partner eszköze), datalist-javaslatok, 12 kötelező + 2 opcionális
- [x] 4.2 **Partner bevált Perplexity-promptja** (Sonar) beépítve — *kulcs + billing kell az élesítéshez*
- [x] 4.3 PDF generálás → Supabase Storage → 1 kredit levonás (kivéve admin/sales) → `usage_history` — *kód kész*

**4. fázis élesítése (teszthez):**
- [ ] `npm install` (pdf-lib, fontkit)
- [ ] `PERPLEXITY_API_KEY` a `.env.local`-ba
- [ ] `assets/fonts/NotoSans-Regular.ttf` betűtípus hozzáadása (magyar ékezetek a PDF-ben)
- [ ] Supabase Storage: publikus `reports` bucket létrehozása
- [ ] dev szerver újraindítása

## 5. fázis — Ingatlan Látványtervező modul
- [x] 5.1 Drag-and-drop képfeltöltő (max. 8 kép/ingatlan) + stílusválasztó + szabad szöveg
- [x] 5.2 Fix angol promptsablon + negatív prompt (stílussal / csak felújítás) — Nano Banana hívás
- [x] 5.3 Köteg generálás → Storage → 1 kredit CSAK ha mind sikerül (különben visszatérítés) → 1 `usage_history` sor
- [x] Üzleti szabály: 1 ingatlan = 1 kredit, max. 8 kép

**Későbbre (a partner anyagai után):**
- [ ] Képenkénti (helységenkénti) konfiguráció: helységtípus + saját változók (konyha, nappali, terasz…)
- [ ] Stílus-referenciaképek bekötése (Google Drive anyagok)
- [ ] Prompt-finomhangolás

**5. fázis élesítése (teszthez):**
- [ ] `GOOGLE_AI_STUDIO_API_KEY` a `.env.local`-ba
- [ ] Supabase Storage: publikus `reports` bucket (ha még nincs a 4-esből)

## 6. fázis — B2B ajánlatkérő + privát modulok
- [x] Landing page B2B ajánlatkérő űrlap → Resend API (lead mentés + e-mail a vezetőségnek)
- [x] Egyedi modul igénylése: kötelező telefonszám + opcionális „Mikor kereshetünk?” (`20261007093627_custom-module-request.sql`, leads.phone / callback_time)
- [x] „Mi az egyedi modul?” — TELJES OLDALAS ismertető a TWINX-en belül: `/dashboard/egyedi-modul`
  (menü, Saját moduljaim oldal és az igénylő ablak linkje ide visz; a felső TWINX menüsor megmarad)
- [ ] ELTÉVE KÉSŐBBRE: ugyanez önálló, kiküldhető landingként már kész: `/egyedi-modul`
  (közös tartalom: `src/components/custom-module/CustomModuleShowcase.tsx`; jelenleg sehonnan nem linkeljük —
  kampánynál ezt a címet kell kiküldeni)
- [x] Egyedi modul árazása (DÖNTÉS): egyszeri fejlesztési díj + használat KREDITBEN (egy elvégzett munka = X kredit, az árajánlatban rögzítve).
  Teendő a modul élesítésekor: a modul futtatása kreditet vonjon le (admin/sales továbbra is ingyen, CLAUDE.md szerint).
- [ ] ELTÉVE KÉSŐBBRE — kulcsszavak máshova (a hero-ikonok szövegei, kódban: `HERO_KEYWORDS`, src/components/custom-module/HeroScene.tsx):
  „−10 óra / hét — kézi munka helyett” · „Másodpercek alatt — kész anyag, 1 kattintás” · „Hatékonyság ↑ — több munka, ugyanannyi idő” ·
  „A te vállalkozásodra szabva — a saját igényeidhez készül” · „Heti riport — magától elkészül” · „Több idő az ügyfélre — kevesebb adminisztráció”
- [x] `dashboard/custom/` útvonalvédelem élesítése (szerepkör + `company_access`, RLS)
- [x] Privát → publikus modul: `services.status` flag (public/private) — beépítve

**6. fázis élesítése:**
- [x] `20260703142923_b2b.sql` (leads tábla) lefuttatva
- [x] `RESEND_API_KEY` + `LEADS_NOTIFY_EMAIL` beállítva (teszt: office@twinx.hu)
- [ ] Éles: `twinx.hu` domain hitelesítés a Resendben + `RESEND_FROM` a saját domainre

## 6.5. fázis — Admin API Költségfigyelő & Riasztórendszer (LEGFŐBB PRIORITÁS)
Cél: lássuk a valós AI-önköltséget vs. Stripe bevétel (profitmarzs), és védjük a
rendszert az API egyenleg-hibáktól. Döntések: külön `api_cost_logs` tábla (a userek
elől TELJESEN rejtve, admin-only RLS), dashboard CSAK admin, riasztás emailben (Resend).
- [x] 6.5.1 Külön `api_cost_logs` tábla admin-only RLS-sel (`20260704081614_metrics.sql`)
- [x] 6.5.2 Backend hívások költség-logolása (config-vezérelt egységárak, `costs.ts` + `logCost`)
- [x] 6.5.3 Védett `/api/admin/metrics` endpoint (admin-only) + webhook `amount_huf` (bevétel)
- [x] 6.5.4 Admin Dashboard UI (`/admin/analytics`) — bevétel vs. költség, profitmarzs, funkció/API-bontás
- [ ] 6.5.5 Globális hibakezelő + admin email riasztás egyenleg-hibára — **PARKOLVA (nem prioritás)**
- *Döntve: költség-egységárak configból; bevétel a `credit_purchases.amount_huf`-ból; fix 380 HUF/USD.*

## 6.6. fázis — Prémium Hibrid AI Videó Pipeline (Luma Labs + Shotstack)
Cél: 3-8 képből (látványtervek VAGY feltöltött eredeti fotók) mozgó, zenés, prémium
marketing videó. Vágómotor: **Shotstack** (hosted API), aszinkron **webhook**-alapú lánc.
Döntések: real-estate **feature** (kredit a meglévő poolból, képszám szerint 2-6),
zene **stílus-alapú** (random szám a `music/{stílus}/`-ból), formátumot a user választ
(9:16 / 1:1 / 16:9). Kulcsok (Luma, Shotstack) + teszt: később (webhookhoz tunnel/deploy).
- [x] 6.6.1 Config + `video_jobs` tábla (`20260704092435_video.sql`)
- [x] 6.6.2 Luma kliens + submit endpoint (job, kredit képszám szerint, Luma indítás) + státusz endpoint
- [x] 6.6.3 Luma webhook: kész snittek mentése Storage-ba, job-állapot
- [x] 6.6.4 Shotstack render (áttűnés + random zene + formátum) + Shotstack webhook → végleges videó, history, költséglogolás, refund
- [x] 6.6.5 UI: forrásválasztó (előzmény/feltöltés), formátum + zene, kredit, folyamatjelző, eredmény
- **Kredit-tábla (config):** 3 kép→2 · 4→3 · 5→3 · 6→4 · 7→5 · 8→6 kredit
- **Zene:** `music/{stílus}/{hossz-bin}/*.mp3` — stílusok: elegans, porgos, nyugodt, cinematic, vidam; binek: `rovid` (3-4 kép), `kozepes` (5-6), `hosszu` (7-8)

**6.6 élesítése (teszthez):**
- [ ] `LUMA_API_KEY` + `SHOTSTACK_API_KEY` + `APP_URL` (publikus/tunnel) + `VIDEO_WEBHOOK_SECRET` a `.env.local`-ba
- [ ] Publikus `music` bucket + jogtiszta MP3-ak `{stílus}/{hossz-bin}/` mappákba
- [ ] `20260704092435_video.sql` lefuttatva (megvan)
- [ ] Webhook-teszthez ngrok tunnel (vagy éles deploy)

## 6.7. fázis — Irodai TWINX fiók (TERV, még nincs fejlesztve)
Cél: egy irodában ne kelljen mindenkinek külön kreditet vásárolni. Modell: közös irodai egyenleg + tagonkénti keret.
- Menüpont fent az „Arculatom" mellett: „Irodai fiók".
- 1) Igénylés: a leendő vezető előbb a TWINX-től kér engedélyt (rövid magyarázó: mi az irodai fiók) → admin jóváhagyja.
- 2) Vezető megnyitja az irodát (név, céges számlázási adatok) → csatlakozás kóddal (e-mail-meghívó elengedve).
- 3) Csatlakozás: külön fül „Csatlakozás kóddal" → kód beírása után azonnal látja az iroda moduljait (egyedi modulokat is).
- 4) Vásárlás csak a vezetőnél; a kredit az iroda egyenlegére megy.
- 5) Alkalmazott NEM látja az iroda egyenlegét, csak a saját felhasználható keretét; ha elfogy → „Kredit kérése a vezetőtől".
- 6) Vezető: tagok, keretek, kérések jóváhagyása, ki mire költött (havi bontás); tag eltávolítása → maradék keret vissza az irodához.
- Szabályok: kredit csak irodán belül mozog, nem váltható vissza, nem jár le; admin/sales továbbra is ingyen; több iroda is lehet (IR9).
- DÖNTÉSEK (2026-10): a tag SAJÁT kreditje megmarad, és bármikor vásárolhat magának is (nem zárjuk irodai burokba).
  Kóddal csatlakozás AZONNALI, de csak regisztrált felhasználónak. Új tag keretje: 0.
- Jogosultságok tagonként (csak a vezető állíthatja):
  • „Kioszthat kreditet" (vezető-helyettes: más tagoknak adhat irodai keretet; a vezető csak vásárol)
  • „Korlátlan" (bizalmi kolléga: kérés nélkül költhet az iroda egyenlegéből)
  • alap tag: csak a saját keretéből költ, elfogyáskor kér.
- Munkamód-váltó gomb (fejléc): „Privát" ↔ „Irodai" — egyértelmű, melyik kreditből dolgozik a felhasználó.
  Irodai módban: irodai keret; privát módban: saját egyenleg. A munka a mód szerint privát vagy irodai lesz.
- Megosztás CSAK tudatosan (nem kerül minden automatikusan a közösbe):
  • bármely munka (privát is) egy kattintással megosztható az irodában („Megosztás az irodával")
  • közös IRODAI MAPPÁK: létrehozás, munkák behúzása (drag & drop, a meglévő FolderLibrary/AssetTray mintájára)
  • mappánkénti hozzáférés: ki lát rá (pl. csak 2 kolléga, vagy az egész iroda)
  • a mappa tagjai SZERKESZTHETIK a benne lévő munkákat (pl. értékbecslés szövegének javítása)
    javaslat: módosítási napló + előző változat visszaállítása; „X épp szerkeszti" zár; törölni csak a készítő/vezető tud;
    ha a javítás kreditbe kerül (pl. újragenerálás), a javító AKTUÁLIS módja szerinti keretből von le
  • mappát a létrehozója és a vezető kezeli (tagok, törlés); megosztás = hivatkozás (nem másolat), visszavonható
  • kilépéskor: irodai módban készült munka az irodánál marad; megosztott privát munka kikerül (előtte figyelmeztetés a vezetőnek)
- LÁTHATÓSÁG (DÖNTÉS, felülírja a korábbi „vezetői rálátás" opciót — nincs választás az igényléskor):
  • a munkák MINDIG a készítőjüknél maradnak; másik tag — a létrehozó is — csak a közös irodai mappákba tett munkát látja
  • a létrehozó / kiosztó a KREDITHASZNÁLATOT látja: ki, melyik modulban, mennyit (munkák tartalma nélkül)
  • ok: az irodai fiókot nem csak vezető nyithatja — pl. 3 kolléga egy közös munkára; ott senki ne lásson rá a másik munkáira
  • (az office_requests.leader_view / offices.leader_view oszlop maradhat, nem használjuk)
- Egyedi modul: az irodához tartozik, futtatása az iroda egyenlegéből (a tag keretéből) von le.
- ▶ INNEN FOLYTATJUK (2026-10-07): IR1–IR6b + IR5 élesben (20261007123743_office.sql, 20261007130334_office-topup.sql, 20261007130712_office-mode.sql lefuttatva).
  ✔ Az irodai fiók KÉSZ (IR1–IR8; IR4b e-mail-meghívó elengedve). 2026-10-08
- Fejlesztés mikrolépésekben:
  - [x] IR1 — SQL alap: `20261007123743_office.sql` (office_requests, offices, office_members, office_ledger + RLS + office_add/allocate/deduct)
  - [x] IR2 — Igénylés: /dashboard/iroda (magyarázó + igénylő űrlap + „Csatlakozás kóddal" fül váz) → /api/office/request → office_requests; admin: /admin/irodak (jóváhagyás/elutasítás)
  - [x] IR3 — Iroda megnyitása (jóváhagyás után, /api/office POST) + csatlakozási kód (TWX-XXXXXX) + saját iroda panel (OfficePanel)
  - [x] IR4a — Csatlakozás kóddal (/api/office/join, azonnali, 0 keret)
  - [x] IR9 — Több irodai fiók egy felhasználónak (létrehozás + csatlakozás) + váltás köztük (kredit-sáv irodaválasztó, Irodai fiók oldalon váltó); kiválasztott iroda + mód: user_office_context — `20261008083230_office-multi.sql`
  - Irodai felület átépítése (terv: twinx-irodai-fiok-vezetoi / -kollega):
    - [x] IF1.1 — Foglalásos keret + védő triggerek + vezető olvashatja az egyenleget/kódot — `20261008104953_office-reserve.sql` (lefuttatva)
    - [x] IF1.2 — Szerver: hibakódok magyarul, megjegyzés a kiosztásnál, szabad részből költés ellenőrzése; API: /api/office/overview, /api/office/works/list, /api/office/ledger
    - [x] IF1.3 — Vezetői nézet (fejléc-sáv, kód, KPI, tagtábla, keret-panel, kredit-mozgások) — OfficeManagerView, OfficeMemberTable, OfficeLedgerCard
    - [x] IF1.4 — Kolléga-nézet (OfficeMemberView: KPI, Miből fizetek, Munkáim, Feladataim [Hamarosan], mappák, Keretem változásai, modulok) + „Iroda: Vezető | Kolléga" előnézet a jobb alsó váltón
    - [x] IF2 — Elfogyott irodai keret → „Folytatás saját kreditből?" (OfficeFallbackProvider + lib/credit-response.ts + payFrom a chargeCredit-ben, 16 modul)
    - [x] IF3 — Üzenetek és feladatok (`20261008104955_office-messages.sql`, /api/office/messages, OfficeMessagesRow, OfficeTasksCard, fejléc-jelzés)
    - [~] IF4 — Kedvenc modulok (kész: 20261008104954_module-favorites.sql, /api/module-favorites, OfficeModuleShelf a vezetői nézet alján) + mappa „új" jelzés (hátra van)
  - [x] Kredit-sáv (CreditDock) alul középen, FIX méretű; nézetváltó a bal alsó sarokban
  - [—] IR4b — E-mail-meghívó: ELENGEDVE (döntés 2026-10-08) — a kóddal csatlakozás a legegyszerűbb, elég.
  - [x] IR6a — Taglista + keretkiosztás (+/−) + jogosultságok (Kioszthat / Korlátlan) + tag eltávolítása + kód újragenerálása
    (/api/office/members, PATCH /api/office; OfficeMembers komponens)
  - [x] IR6b — Irodai egyenleg feltöltése: létrehozó megrendel (számlás folyamat, credit_requests.office_id) + admin közvetlen jóváírás (/admin/irodak) — `20261007130334_office-topup.sql`
  - [x] IR6c — „Kredit kérése a vezetőtől" (+e-mail a létrehozónak, jóváhagyás/elutasítás) + kredithasználat-kimutatás (havi, kollégánként és modulonként) — `20261008080622_office-credit-requests.sql`
  - [x] IR5 — Munkamód-váltó (fejléc, /api/office/mode) + levonás a közös chargeCredit-ben (office_deduct) + refundCredit (oda vissza, ahonnan vontunk) — `20261007130712_office-mode.sql`
  - [x] IR7 — Irodai munka jelölése (usage_history.office_id, trigger) + közös mappák (egész iroda / kiválasztott tagok) + „Megosztás az irodával" a Korábbi munkákban + mappa tartalma (megnyitás, kivétel); kilépéskor a privát megosztások kikerülnek — `20261008081024_office-folders.sql`
  - [x] IR8 — Közös mappában lévő értékbecslés szerkesztése a mappa tagjainak (valuation/save jogosultság) + módosítási napló + visszaállítás + „épp szerkeszti" zár (10 perc) — `20261008081511_office-work-edit.sql`. Más munkatípus (kép/videó) nem szöveges → csak megnyitás/letöltés.

## 7. fázis — Dizájn fázis
- [ ] Végleges prémium arculat az egész platformra (Tailwind, animációk)
- [ ] Reszponzív finomítás + végső QA

## 8. fázis — Élesítés
- [ ] GitHub → Hostinger deploy
- [ ] `.env` környezeti változók beállítása éles környezetben

---

## ▶ INNEN FOLYTATJUK — Claude Code (2026-10-12)
A fejlesztés a Cowork után Claude Code-ban folytatódik. Minden SQL eddig lefuttatva (Márk, 2026-10-12).

### Kész az utolsó Cowork-körben
- [x] Korábbi munkák fájlkezelő: saját mappák (`20261008121637_work-folders.sql`), típus szerinti bontás, irodai mappák, drag & drop
- [x] „⋯" menü minden munkakártyán (ActionMenu) + kinyíló „Áthelyezés" almenü, több mappa
- [x] Törlés = elrejtés (`20261008121638_usage-history-hidden.sql`, `20261008121639_library-hidden.sql`) + „Elrejtett munkák" nézet
- [x] Modulkönyvtárakból is: Korábbi munkák saját mappái + közös irodai mappák
- [x] Közös WorkViewer (videó az ablakban), munkák automatikus neve (videó: ingatlan címe; képjavítás: mód + idő)
- [x] Nézetváltó: Iroda — Vezető / Kolléga / **Ki** (mintha nem lenne irodai tagság)

### Következő lépések (javasolt sorrend)
1. [x] **Rendrakás:** a 79 `.sql` fájl a `supabase/` alá került (2026-10-12): 77 migráció
       `supabase/migrations/<időbélyeg>_<nev>.sql`, `supabase/seed.sql`, `supabase/one-off/`;
       hivatkozások frissítve, leírás: `supabase/README.md`.
2. [—] **Portál Központ új nyitóoldal** — ELENGEDVE egyelőre (2026-10-12, később visszatérünk).
       Látványterv: `design/portal-kozpont-latvanyterv.html`.
3. [ ] **Üdvözlő levelek** OB2–OB7: napló SQL + leiratkozás mező → küldő route (Resend) → Vercel cron → leiratkozás oldal → admin nézet → teszt.
4. [ ] IF4 vége: közös mappák „új" jelzése (amit a tag még nem nézett meg).
5. [ ] Később: iparág-független „Ügy / Munkalap" (egy megbízás = egy hely, a modulok onnan dolgoznak) — terv előbb.
6. [ ] Alap végponttól-végpontig tesztek (Playwright): belépés, egy modul futtatása, kreditlevonás.


### Irodai fiók — apróságok (2026-10-12)
- [x] „Kredit kiosztása" gomb + ablak a vezetői fejlécben (több kolléga egyszerre, csak adás); visszavétel CSAK a létrehozó (szerver + felület)
- [x] „Munkáim" kártya a vezetői nézetben is (közös `OfficeMyWorks` komponens)

## KM — Közös munkatér (az irodai fiók második formája)
Látványterv (jóváhagyva 2026-10-12): `design/kozos-munkater-latvanyterv.html`.
Döntések:
- Az igénylés első lépése egy döntés: **Iroda vezetővel** (mostani, jóváhagyással) vagy **Közös munkatér**.
- Közös munkatér: NINCS admin-jóváhagyás, azonnal létrejön; nem kell telefonszám; 2–5 társ; mindenki „Társ" (egyenrangú).
- Kredit: mindenki CSAK a saját kreditjéből; nincs közös egyenleg, nincs „Miből fizetek?" kapcsoló.
  Bármelyik társ ADHAT a saját kreditjéből egy másik társnak; visszavétel NINCS. A társak egymás egyenlegét/költését nem látják, csak a saját átadásaikat.
- Kód: egy ÁLLANDÓ csatlakozási kód, nincs csere. (Vezetős iroda: egy kód mindenkinek — ma is így —, a csere csak biztonsági célú.)
- Kilépés: önkéntes; a közös mappákba tett munkák 30 napig olvashatók, utána kikerülnek. Előtte átadás: pipálós lista a SAJÁT munkákról +
  pipálós lista a társakról; minden kipipált társ SAJÁT PÉLDÁNYT kap (új usage_history sor, ugyanaz a fájl; tárhelyről semmi nem törlődik).
- Üzenetek: ugyanaz az üzenetsor, mint az irodánál (üzenet / feladat / kész munka, munka- és mappacsatolás), KREDITKÉRÉS NÉLKÜL;
  a munkák „⋯" menüjében és a WorkViewerben új pont: „Üzenet ehhez a munkához".
- Az oldal alján a Kedvenc modulok sáv (ugyanaz, mint az irodánál).
- „Mi az irodai fiók?" oldal: rövid szekció a két formáról + 2 új GYIK.
- Technika: ugyanaz az `offices` tábla, új `kind` oszlop (`office` / `team`); a felület és a szerveroldali jogosultság ágazik el.

Mikrolépések (sorrendben):
- [x] KM1 — SQL (`20261012105023_team-workspace.sql`, lefuttatva 2026-10-12): `offices.kind` + max. 5 tag (trigger) + kredit-átadás (`team_wallet_transfer` + `office_transfers` napló) + 30 napos olvashatóság (`office_folder_items.expires_at`) + munka-átadás (`team_handover_works` + `office_work_handovers`) + kilépés (`team_leave`)
- [x] KM2 — Igénylő űrlap (2026-10-12, Márk tesztje hátra): típusválasztó kártyák (validáció), közös munkatérnél név + létszám, nincs telefon
- [x] KM3 — Azonnali létrehozás (+ levonás-védelem: team → mindig saját kredit; mód-váltó, csatlakozás, kódcsere tiltva; átmeneti nézet a KM5-ig) (API: típus=team → rögtön offices sor + állandó kód; jóváhagyás nélkül)
- [x] KM4 — Admin (fülek: Irodák / Közös munkaterek; team-nél nincs egyenleg-jóváírás, szerveren is tiltva + irodai feltöltés-kérés tiltva): típus-címke az irodák listáján (a közös munkaterek külön fülön, csak megtekintés)
- [x] KM5 — Társ nézet (2026-10-12, Márk tesztje hátra; üzenetek a KM7-ben, Kilépés gomb „Hamarosan” a KM8-ig) (OfficeTeamView): fejléc (türkiz), KPI-k, Munkáim, Társak, közös mappák, Kredit-átadások, alul Kedvenc modulok (OfficeModuleShelf, látványterv nélkül); jogosultságok a szerveren (`kind` szerinti ágak)
- [x] KM6 — „Kredit adása társnak" ablak (POST/GET /api/office/transfers, TeamTransferDialog) (saját pénztárcából, megerősítéssel) + napló
- [x] KM7 — Üzenetek a munkatérben (2026-10-12; OFFICE_COMPOSE_EVENT; a ⋯ menü és a nézegető gombja az irodai nézetekben is működik) (kreditkérés nélkül) + „Üzenet ehhez a munkához" a ⋯ menüben és a WorkViewerben
- [x] KM8 — Kilépés ablak (2026-10-12; POST /api/office/leave, TeamLeaveDialog; lejárt elemek kiszűrve mindenhol, a kilépett társ munkája csak olvasható): munkák + társak kipipálása → átadás (saját példány) → kilépés; 30 napos olvashatóság
- [x] KM9 — „Mi az irodai fiók?" oldal (2026-10-12; „Két forma” szekció ?forma= előválasztással, 2 új GYIK, CTA-k): két forma szekció + GYIK
- [x] KM8b — Gazdaváltás kilépéskor: a legrégebbi megmaradt társ lesz a gazda (`20261012180016_team-owner-handover.sql`, lefuttatva 2026-10-12)
- [x] KM8c — Értesítés munka-átadáskor: címzettenként egy „Kész munka” üzenet a munkatérben, az első átadott munka csatolva (POST /api/office/leave)
- [~] KM10 — Teszt (2026-10-12: létrehozás, csatlakozás, saját kreditből fizetés OK — a teljes tesztet ELÖLRŐL kezdjük, teszt-munkatér: „KM10 teszt”, TWX-6ETXHE): két teszt-felhasználóval végig (létrehozás, csatlakozás, átadás, üzenet, kilépés)

## MH — Admin: Modul-használat (Felhasználók oldal 2. füle)
Látványterv (jóváhagyva 2026-10-12): `design/admin-modul-hasznalat-latvanyterv.html`.
Döntések: minden futtatás számít · „Admin és sales is” kapcsoló (alapból KI) · megnyitás-mérés saját naplóval,
fejenként naponta EGYSZER modulonként · irodai fiókok és közös munkaterek külön (kétállású váltó) · új regisztrálók sáv
· felhasználónként TOP 5 modul + részletes felugró ablak · fix méretű ablakok · nincs pénzügy · CSV KÉSŐBB.
Modul-kulcs: a modul útvonala (katalógus `href`); a futtatásnál `FEATURE_TO_HREF` fordít.
- [x] MH1 — SQL: `module_views` (felhasználó × modul × nap, csak a szerver ír) — `20261012183311_module-views.sql`, lefuttatva 2026-10-12
- [x] MH2 — Mérés: `POST /api/track/module-view` + `ModuleViewTracker` a dashboard layoutban (napi egyszer) — 2026-10-12
- [x] MH3 — Admin API: `/api/admin/module-usage` (időszak / forrás / mód / admin+sales szűrő; ?user= és ?office= részletek) — `lib/module-usage.ts`, 2026-10-12
- [x] MH4 — Fül + szűrősáv + KPI-k + Új regisztrálók sáv (`ModuleUsageView`, /admin/users?tab=hasznalat) — 2026-10-12, Márk nézze meg
- [x] MH5 — Modul-rangsor (megnyitás → futtatás, visszatérő, változás, kedvenc, jelzések) + modul részletei ablak (`?module=`) — 2026-10-12
- [x] MH6 — Felhasználók és kedvenc moduljaik (TOP 5) + részletes felhasználói ablak (`UserModuleTable`) — 2026-10-12
- [x] MH7 — Irodák és munkaterek (váltó) + iroda részletei ablak (`OfficeUsageCard`) — 2026-10-12
- [ ] MH8 — (később) CSV-letöltés
