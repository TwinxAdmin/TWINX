# TODO.md — Twinx AI Portal (Master Brief)

Fázisokra bontott feladatlista. A szabályokat lásd: [CLAUDE.md](./CLAUDE.md).
**Alapelv:** granuláris haladás (Űrlap validáció → API bekötés → Adatbázis mentés),
wireframe-first UI a 7. fázisig. Egy működő fázis után → push GitHub-ra.

## 1. fázis — Alapprojekt + adatbázis
- [x] Next.js projekt (App Router, TypeScript, Tailwind CSS)
- [x] Route Group mappaszerkezet: `(public)`, `(auth)`, `dashboard` + modul almappák
- [x] `schema.sql` — táblák (profiles, services, company_access, user_credits, usage_history)
- [x] `profiles` auto-trigger (`handle_new_user`) + RLS policy-k
- [x] `.env.local.example` sablon
- [ ] `npm install` lokálisan, `npm run dev` ellenőrzés
- [ ] `schema.sql` lefuttatása a Supabase SQL Editorban

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
- [x] Egyedi modul igénylése: kötelező telefonszám + opcionális „Mikor kereshetünk?” (`custom-module-request.sql`, leads.phone / callback_time)
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
- [x] `b2b.sql` (leads tábla) lefuttatva
- [x] `RESEND_API_KEY` + `LEADS_NOTIFY_EMAIL` beállítva (teszt: office@twinx.hu)
- [ ] Éles: `twinx.hu` domain hitelesítés a Resendben + `RESEND_FROM` a saját domainre

## 6.5. fázis — Admin API Költségfigyelő & Riasztórendszer (LEGFŐBB PRIORITÁS)
Cél: lássuk a valós AI-önköltséget vs. Stripe bevétel (profitmarzs), és védjük a
rendszert az API egyenleg-hibáktól. Döntések: külön `api_cost_logs` tábla (a userek
elől TELJESEN rejtve, admin-only RLS), dashboard CSAK admin, riasztás emailben (Resend).
- [x] 6.5.1 Külön `api_cost_logs` tábla admin-only RLS-sel (`metrics.sql`)
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
- [x] 6.6.1 Config + `video_jobs` tábla (`video.sql`)
- [x] 6.6.2 Luma kliens + submit endpoint (job, kredit képszám szerint, Luma indítás) + státusz endpoint
- [x] 6.6.3 Luma webhook: kész snittek mentése Storage-ba, job-állapot
- [x] 6.6.4 Shotstack render (áttűnés + random zene + formátum) + Shotstack webhook → végleges videó, history, költséglogolás, refund
- [x] 6.6.5 UI: forrásválasztó (előzmény/feltöltés), formátum + zene, kredit, folyamatjelző, eredmény
- **Kredit-tábla (config):** 3 kép→2 · 4→3 · 5→3 · 6→4 · 7→5 · 8→6 kredit
- **Zene:** `music/{stílus}/{hossz-bin}/*.mp3` — stílusok: elegans, porgos, nyugodt, cinematic, vidam; binek: `rovid` (3-4 kép), `kozepes` (5-6), `hosszu` (7-8)

**6.6 élesítése (teszthez):**
- [ ] `LUMA_API_KEY` + `SHOTSTACK_API_KEY` + `APP_URL` (publikus/tunnel) + `VIDEO_WEBHOOK_SECRET` a `.env.local`-ba
- [ ] Publikus `music` bucket + jogtiszta MP3-ak `{stílus}/{hossz-bin}/` mappákba
- [ ] `video.sql` lefuttatva (megvan)
- [ ] Webhook-teszthez ngrok tunnel (vagy éles deploy)

## 6.7. fázis — Irodai TWINX fiók (TERV, még nincs fejlesztve)
Cél: egy irodában ne kelljen mindenkinek külön kreditet vásárolni. Modell: közös irodai egyenleg + tagonkénti keret.
- Menüpont fent az „Arculatom" mellett: „Irodai fiók".
- 1) Igénylés: a leendő vezető előbb a TWINX-től kér engedélyt (rövid magyarázó: mi az irodai fiók) → admin jóváhagyja.
- 2) Vezető megnyitja az irodát (név, céges számlázási adatok) → meghívás e-mailben ÉS/VAGY csatlakozási kóddal.
- 3) Csatlakozás: külön fül „Csatlakozás kóddal" → kód beírása után azonnal látja az iroda moduljait (egyedi modulokat is).
- 4) Vásárlás csak a vezetőnél; a kredit az iroda egyenlegére megy.
- 5) Alkalmazott NEM látja az iroda egyenlegét, csak a saját felhasználható keretét; ha elfogy → „Kredit kérése a vezetőtől".
- 6) Vezető: tagok, keretek, kérések jóváhagyása, ki mire költött (havi bontás); tag eltávolítása → maradék keret vissza az irodához.
- Szabályok: kredit csak irodán belül mozog, nem váltható vissza, nem jár le; admin/sales továbbra is ingyen; egy user = egy iroda.
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
- Fejlesztés mikrolépésekben:
  - [x] IR1 — SQL alap: `office.sql` (office_requests, offices, office_members, office_ledger + RLS + office_add/allocate/deduct)
  - [x] IR2 — Igénylés: /dashboard/iroda (magyarázó + igénylő űrlap + „Csatlakozás kóddal" fül váz) → /api/office/request → office_requests; admin: /admin/irodak (jóváhagyás/elutasítás)
  - [x] IR3 — Iroda megnyitása (jóváhagyás után, /api/office POST) + csatlakozási kód (TWX-XXXXXX) + saját iroda panel (OfficePanel)
  - [x] IR4a — Csatlakozás kóddal (/api/office/join, azonnali, 0 keret)
  - [ ] IR4b — E-mail-meghívó
  - [x] IR6a — Taglista + keretkiosztás (+/−) + jogosultságok (Kioszthat / Korlátlan) + tag eltávolítása + kód újragenerálása
    (/api/office/members, PATCH /api/office; OfficeMembers komponens)
  - [x] IR6b — Irodai egyenleg feltöltése: létrehozó megrendel (számlás folyamat, credit_requests.office_id) + admin közvetlen jóváírás (/admin/irodak) — `office-topup.sql`
  - [ ] IR6c — „Kredit kérése a vezetőtől" (tag) + kredithasználat-áttekintő (ki, melyik modul, mennyi)
  - [x] IR5 — Munkamód-váltó (fejléc, /api/office/mode) + levonás a közös chargeCredit-ben (office_deduct) + refundCredit (oda vissza, ahonnan vontunk) — `office-mode.sql`
  - [ ] IR7 — Irodai mappák + megosztás + mappánkénti hozzáférés
  - [ ] IR8 — Szerkesztés módosítási naplóval + „épp szerkeszti" zár

## 7. fázis — Dizájn fázis
- [ ] Végleges prémium arculat az egész platformra (Tailwind, animációk)
- [ ] Reszponzív finomítás + végső QA

## 8. fázis — Élesítés
- [ ] GitHub → Hostinger deploy
- [ ] `.env` környezeti változók beállítása éles környezetben
