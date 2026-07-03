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
- [ ] Supabase kliens bekötése (browser + server)
- [ ] Regisztráció (e-mail/jelszó): validáció → API → Auth (új fiók: 0 kredit)
- [ ] Belépés / kijelentkezés
- [ ] Védett route-ok (middleware a `dashboard`-ra)
- [ ] `dashboard/page.tsx`: kredit egyenlegek lekérése
- [ ] Legutóbbi 50 elem üres panele (`usage_history`, LIMIT 50)

## 3. fázis — Stripe + admin kredit kontroll
- [ ] Stripe Checkout Session (10-es fix csomag / modul)
- [ ] Stripe Webhook: sikeres fizetés → +10 kredit
- [ ] Kreditek NEM járnak le (nincs lejárati logika)
- [ ] Admin: manuális kredit hozzáadás fiókokhoz
- [ ] Backend logika: `admin` és `sales` megkerüli a kreditlevonást

## 4. fázis — Ingatlan Értékbecslő modul
- [ ] 4.1 Frontend űrlap: Város/Kerület, Négyzetméter, Szobák, Állapot — szigorú backend validáció
- [ ] 4.2 Prompt Template → Perplexity API (Sonar modell)
- [ ] 4.3 PDF generálás → Supabase Storage → 1 kredit levonás (kivéve admin/sales) → `usage_history`

## 5. fázis — Ingatlan Látványtervező modul
- [ ] 5.1 Drag-and-drop képfeltöltő + stílusválasztó (pl. Modern, Provence) + szabad szöveges mező
- [ ] 5.2 Fix angol promptsablon + negatív prompt összefűzése:
      - stílussal → fix stílus-referenciakép küldése (Google Studio / Nano Banana)
      - "csak felújítás" → referenciakép nélkül, Image-to-Image (falak nem változnak)
- [ ] 5.3 Kész kép + letöltés → 1 kredit levonás → `usage_history` (LIMIT 50 megjelenítés)

## 6. fázis — B2B ajánlatkérő + privát modulok
- [ ] Landing page B2B ajánlatkérő űrlap → Resend/SendGrid API (e-mail a vezetőségnek)
- [ ] `dashboard/custom/` útvonalvédelem élesítése (szerepkör + `company_access`)
- [ ] Privát → publikus modul: csak egy `services.status` flag váltása

## 7. fázis — Dizájn fázis
- [ ] Végleges prémium arculat az egész platformra (Tailwind, animációk)
- [ ] Reszponzív finomítás + végső QA

## 8. fázis — Élesítés
- [ ] GitHub → Hostinger deploy
- [ ] `.env` környezeti változók beállítása éles környezetben
