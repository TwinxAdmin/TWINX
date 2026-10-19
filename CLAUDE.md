# CLAUDE.md — Twinx AI Portal fejlesztési szabályzat

Ez a fájl irányítja az AI-asszisztált fejlesztést ebben a repóban. Minden változtatás
az itt rögzített szabályok szerint készül. A részletes feladatlistát lásd: [TODO.md](./TODO.md).
A saját videómotor aktuális állapota és a folytatás: [docs/video-motor-allapot.md](./docs/video-motor-allapot.md).

## Technológiai stack

- **Next.js** — App Router, TypeScript, Tailwind CSS.
- **Supabase** — Auth, Database, Storage.
- **API réteg** — kizárólag natív Next.js API route-ok.

### Szigorú tilalom
- **Külső automatizáció TILOS.** Nincs Make.com, Zapier vagy hasonló. Minden
  szerveroldali logika natív Next.js API route-ban (`app/api/.../route.ts`) fut.

## Alaparchitektúra

### Single-Domain koncepció
Minden egyetlen domain alatt fut, Next.js **Route Groups** használatával:

- `(public)` — publikus, nyilvános oldalak
- `(auth)` — bejelentkezés / regisztráció
- `dashboard` — bejelentkezett felhasználói felület

### Granuláris fejlesztés
- **Tilos komplex funkciókat egyszerre megírni.** Szigorúan mikrolépésekben haladunk.
- A kötelező sorrend minden funkciónál: **Űrlap validáció → API bekötés → Adatbázis mentés.**
- Egy PR / egy lépés = egy jól körülhatárolt mikrofeladat.

### Dizájn stratégia
- A prémium arculat (sötét bronz + krém, korall kiemelés, Manrope címek) **már élesben van** —
  minden új felület ehhez igazodjon (lásd lent: UI-szabályok). A korábbi „wireframe first" elv lezárult.

## Üzleti szabályok

### Pay-As-You-Go kreditrendszer
- Fix áras csomagok.
- A megvásárolt **kreditek havonta NEM járnak le.**

### Adatmegőrzés
- A felhasználói előzményekben **maximum 50 elemet** listázunk.
- **Lomtár (2026-10-20, Márk döntése):** a felületen a „Törlés" a lomtárba tesz (`hidden_at`: usage_history,
  video_jobs, ad_checks); a „Korábbi munkák → Lomtár" nézetből visszaállítható. `WORKS_TRASH_DAYS` (alap 30) nap
  után a napi ütemezett takarítás (Vercel Cron → `/api/cron/purge-trash`) **véglegesen törli** a munkát és a fájljait
  a Storage-ból; a Lomtárból kézzel is véglegesen törölhető. Közös logika: `src/lib/works-trash.ts` — fájlt csak akkor
  törlünk, ha másik munka már nem hivatkozik rá, és csak a tulajdonos saját mappájából. A kredit nem jár vissza.

### Jogosultságok
- Szerepkörök közül az **`admin`** és a **`sales`** prezentációs célból
  **ingyen, kreditlevonás nélkül** használhatják az AI API-kat.
- Minden más szerepkörnél a kreditlevonás normál módon érvényes.

## Kommunikáció és együttműködés (Márk kérése)
- **Magyarul** válaszolj és magyarázz; a kódkommentek is magyarok (a meglévő stílusban).
- **Git:** commitot, `git push`-t, ágváltást vagy bármilyen visszafordíthatatlan git-műveletet
  **csak kifejezett kérésre** végezz (vagy adj meg parancsként). Kérésre pontos, bemásolható parancsot adj.
- **SQL / migráció:** az adatbázist Márk futtatja a Supabase SQL Editorban. Minden új SQL-t
  **a válaszban is másold be teljes egészében**, és mondd meg, melyik fájlban van. Az SQL legyen
  újrafuttatható (`if not exists`, `drop … if exists`). Ha a kód egy még le nem futtatott oszlopra
  épül, legyen tartalék ága (a felület ne törjön el), és a hibaüzenet nevezze meg a migrációt.
  Új SQL helye: `supabase/migrations/<ÉÉÉÉHHNNÓÓPPMM>_<nev>.sql`; a kódban csak a rövid fájlnévvel
  hivatkozunk rá. Lefuttatás után kerüljön be a `supabase/README.md` táblázatába.
- **Nagyobb változtatás előtt:** röviden vázold a tervet (mikrolépésekre bontva) és kérdezz rá,
  ha a döntés üzleti vagy UX-ízlés kérdése. Látványtervet kérésre HTML-mintában a `design/` mappába készíts.
- A végén **röviden** foglald össze magyarul, mi változott és mit kell Márknak tennie (SQL, teszt).

## UI-szabályok (kötelezőek minden új vagy módosított felületen)
- **Fix méret, nincs ugrálás:** váltók, fülek, módváltók és kártyák mérete NEM változhat tartalomváltáskor;
  sok tartalomnál a blokkon BELÜL görgess, a további részleteket felugró ablakba / menübe tedd.
- **Üres állapot is szép:** minden tervezett blokk akkor is látszik, ha még nincs adat — gondos üres állapottal.
- **Nincs ál-gomb:** ami nem működik, az ne látszódjon kattinthatónak; vagy rejtsd el, vagy „Hamarosan" címke.
  Ha egy művelet az adott elemnél nem érhető el, a gomb halványan, magyarázó tooltippel maradjon a helyén.
- **Kártyákon nincs sűrű ikonsor:** a munka/fájl műveletei (Letöltés, Áthelyezés, Átnevezés, Törlés…)
  egyetlen **„⋯" menüben** vannak (jobb klikkre is) — közös komponens: `src/components/ui/ActionMenu.tsx`.
  Az „Áthelyezés" almenü a fő menü MELLETT nyílik, és kattintás után nyitva marad (több mappa is választható).
- **Munkák megtekintése** a közös nézegetőben (`src/components/works/WorkViewer.tsx`) — új lapon nem nyitunk meg munkát.
- **Legördülők és dátumválasztók:** a TWINX-stílusú `SelectField` / `DateField` (sötét felületen `tone="dark"`), natív `<select>` nem.
- Egy irodai / megosztási felületnél mindig gondold végig a **jogosultságot** szerveroldalon is (RLS + API-ellenőrzés).

## Ellenőrzés minden lépés után
- `npx tsc --noEmit` és `npx eslint <érintett fájlok>` legyen hibamentes (a már meglévő, nem érintett hibákat jelezd, ne javítsd kérés nélkül).
- Ha futtatható: `npm run build`, és a felületet nézd meg a fejlesztői szerveren (`npm run dev`).

## Munkamódszer az AI-asszisztensnek
1. Mindig a legkisebb értelmes lépést valósítsd meg (lásd Granuláris fejlesztés).
2. Ne vezess be külső automatizációs eszközt — csak natív API route.
3. Tartsd a Route Group struktúrát: `(public)`, `(auth)`, `dashboard`.
4. Új felület a meglévő arculathoz és a fenti UI-szabályokhoz igazodik.
5. Minden üzleti szabálynál (kredit, jogosultság, adatmegőrzés) tartsd a fenti kereteket.
6. Hosszabb távú irány: a TWINX az ingatlanpiaccal indul, de később más iparágak moduljai is jönnek —
   új közös rétegeket (mappák, munkák, „ügyek") iparág-függetlenül tervezz, a felület szövegei maradjanak iparág-specifikusak.
