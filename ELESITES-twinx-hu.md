# TWINX élesítés — twinx.hu (Vercel)

Ez a lépésről-lépésre útmutató a twinx.hu élesítéséhez. A kód már Vercel-kész
(a PDF-generálás `@sparticuz/chromium`-ra vált Vercelen). A stack:

- **App**: Next.js → **Vercel** (GitHubról auto-deploy)
- **Háttér**: Supabase (adatbázis, bejelentkezés, fájltárhely)
- **Domain/DNS**: Rackforest (csak DNS-t állítunk, a domain marad ott)
- **Fizetés**: Stripe (élő mód)
- **Email**: Resend
- **AI**: Perplexity, Google AI Studio, Luma, Shotstack

---

## 1) Kód felküldése GitHubra

A saját termináldból, a projekt mappájában:

```
git push
```

Minden mai változtatás így felkerül a `TwinxAdmin/TWINX` repóba.

---

## 2) Vercel projekt létrehozása

1. Menj a vercel.com oldalra, **jelentkezz be GitHubbal**.
2. **Add New… → Project** → válaszd ki a `TWINX` repót → **Import**.
3. A Framework automatikusan **Next.js** lesz — ezt ne módosítsd.
4. Még **NE** kattints Deploy-t; előbb állítsd be a környezeti változókat (3. lépés).

---

## 3) Környezeti változók (Vercel → Settings → Environment Variables)

Mindet **Production** környezetre vedd fel. Az értékeket a megfelelő szolgáltató
felületéről másold.

| Változó | Mi ez / honnan | Példa érték |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | https://xxxx.supabase.co |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API → anon public | eyJ… |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API → service_role (TITKOS!) | eyJ… |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys (**live**) | sk_live_… |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook (6. lépésben jön létre) | whsec_… |
| `PERPLEXITY_API_KEY` | Perplexity fiók | pplx-… |
| `GOOGLE_AI_STUDIO_API_KEY` | Google AI Studio | AIza… |
| `LUMA_API_KEY` | Luma Labs | luma-… |
| `SHOTSTACK_API_KEY` | Shotstack | … |
| `RESEND_API_KEY` | Resend → API Keys | re_… |
| `RESEND_FROM` | Feladó cím (a twinx.hu domainről) | no-reply@twinx.hu |
| `LEADS_NOTIFY_EMAIL` | Ide jönnek a B2B/ötlet értesítők | pl. a te email-ed |
| `APP_URL` | Az éles domain (webhook-visszahívásokhoz!) | https://twinx.hu |
| `VIDEO_WEBHOOK_SECRET` | Tetszőleges hosszú titkos szöveg (te találod ki) | pl. 32 random karakter |
| `HUF_PER_USD` | Árfolyam a költségfigyelőhöz (opcionális) | 380 |

Opcionális finomhangolók (ha nem adod meg, van alapértelmezés): `PERPLEXITY_MODEL`,
`LUMA_MODEL`, `LUMA_DURATION`, `LUMA_RESOLUTION`, `SHOTSTACK_ENV`, `GOOGLE_IMAGE_MODEL`,
`FLYER_CREDITS`.

Ezután: **Deploy**. Kész deploy után kapsz egy `…vercel.app` ideiglenes címet —
ezen már tesztelhetsz, mielőtt a domaint rákötnéd.

---

## 4) Supabase — éles beállítások

Ugyanazt a Supabase projektet használjuk (benne a felhasználók/adatok).

**a) Hiányzó SQL-ek lefuttatása** (SQL Editor). Idempotensek, nyugodtan lefuttathatók:

- `prompts.sql` — a prompt-kezelő táblája (`ai_prompts`).
- `usage-credits.sql` — a `credits_charged` oszlop (modul-figyelőhöz).

**b) Auth URL-ek** (Authentication → URL Configuration):

- **Site URL**: `https://twinx.hu`
- **Redirect URLs** közé vedd fel: `https://twinx.hu/auth/callback` (és ha teszteled,
  a `…vercel.app/auth/callback`-et is).
- Ha Google-bejelentkezés is él: a Google Cloud console-ban a redirecthez add hozzá
  a Supabase callback URL-t (a provider beállításnál látszik).

**c) Storage**: ellenőrizd, hogy a bucketök megvannak (pl. `reports`, `flyers`,
látványterv-képek). Ha a dev-ben már működött, ez rendben van.

**d) Admin fiók**: legyen legalább egy `admin` szerepkörű felhasználó a `profiles`
táblában (SQL-lel: `update profiles set role='admin' where id='<user-uuid>';`).

---

## 5) Domain rákötése (twinx.hu)

1. Vercel → a projekt → **Settings → Domains → Add** → `twinx.hu` (és `www.twinx.hu`).
2. A Vercel megmutatja a szükséges DNS-rekordokat, jellemzően:
   - `A` rekord: `@` → `76.76.21.21`
   - `CNAME`: `www` → `cname.vercel-dns.com`
   (A pontos értékeket MINDIG a Vercel képernyőjéről vedd, ne innen.)
3. **Rackforest** DNS-kezelőjében vedd fel ezeket a rekordokat.
4. Várj a propagálásra (pár perc–pár óra). Az SSL-tanúsítványt a Vercel automatikusan
   kiállítja.

---

## 6) Stripe — élő mód

1. Stripe Dashboardon kapcsolj **Live mode**-ra (jobb felül).
2. **Developers → API keys** → másold az **élő** `sk_live_…` kulcsot a Vercel
   `STRIPE_SECRET_KEY` változójába.
3. **Developers → Webhooks → Add endpoint**:
   - URL: `https://twinx.hu/api/webhooks/stripe`
   - Esemény: `checkout.session.completed` (ez írja jóvá a kreditet).
   - Mentés után másold a **Signing secret** (`whsec_…`) értékét a Vercel
     `STRIPE_WEBHOOK_SECRET` változójába, majd **Redeploy**.

> Terméket/árat NEM kell felvenni a Stripe-ban: az app dinamikusan küldi az árat a
> csomag alapján.

---

## 7) Resend — email a twinx.hu-ról

1. Resend → **Domains → Add Domain** → `twinx.hu`.
2. A megadott DNS-rekordokat (SPF, DKIM) vedd fel a **Rackforest** DNS-ében.
3. Ha a domain „Verified", a `RESEND_FROM` legyen egy twinx.hu-s cím (pl.
   `no-reply@twinx.hu`).

---

## 8) Élesítés utáni gyorsteszt (a twinx.hu-n)

- [ ] Regisztráció + bejelentkezés (email megérkezik-e).
- [ ] Ingatlan értékbecslés → PDF legenerálódik és megnyílik a nézegetőben.
- [ ] Telek ellenőrzés (normál) → PDF.
- [ ] Látványtervező → kép generálódik (max 4 kép).
- [ ] Hirdetéskészítő → szöveg + végleges flyer (PDF/PNG).
- [ ] Videó → elindul, a webhookok visszahívnak (APP_URL helyes-e).
- [ ] Kredit vásárlás egy **valódi** kártyával (kis csomag) → a kredit jóváíródik
      (Stripe webhook működik-e).
- [ ] Admin: `/admin/analytics`, `/admin/prompts` elérhető adminként.

---

## Megjegyzések / nyitott pontok

- **Vercel csomag**: az AI-hívások + PDF hosszabbak lehetnek; a hosszú route-okra
  `maxDuration = 60` van állítva. Ha a Hobby (ingyenes) csomag időkorlátja kevés,
  a **Pro** csomag adja a nagyobb limitet. Élesítés után figyeld, nincs-e időtúllépés.
- **Videó kredit**: tudatosan a „min. 100% haszon" szabály alatt maradt (4 kép = 4
  kredit) — ha később emeljük, egy sorban állítható (`video.ts`).
- **Éles kulcsok**: a `service_role` és a `sk_live` kulcs szigorúan titkos — csak a
  Vercel env-ben legyenek, sose a kódban vagy gitben.
