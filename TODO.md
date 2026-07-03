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
- [x] `dashboard/custom/` útvonalvédelem élesítése (szerepkör + `company_access`, RLS)
- [x] Privát → publikus modul: `services.status` flag (public/private) — beépítve

**6. fázis élesítése:**
- [x] `b2b.sql` (leads tábla) lefuttatva
- [x] `RESEND_API_KEY` + `LEADS_NOTIFY_EMAIL` beállítva (teszt: office@twinx.hu)
- [ ] Éles: `twinx.hu` domain hitelesítés a Resendben + `RESEND_FROM` a saját domainre

## 7. fázis — Dizájn fázis
- [ ] Végleges prémium arculat az egész platformra (Tailwind, animációk)
- [ ] Reszponzív finomítás + végső QA

## 8. fázis — Élesítés
- [ ] GitHub → Hostinger deploy
- [ ] `.env` környezeti változók beállítása éles környezetben
