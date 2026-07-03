# CLAUDE.md — Twinx AI Portal fejlesztési szabályzat

Ez a fájl irányítja az AI-asszisztált fejlesztést ebben a repóban. Minden változtatás
az itt rögzített szabályok szerint készül. A részletes feladatlistát lásd: [TODO.md](./TODO.md).

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

### Dizájn stratégia: "Funkcionális UI / Wireframe first"
- A felület **maradjon minimális a 7. fázisig.** Cél a működő funkció, nem a szépség.
- A prémium arculatot **a legvégén** húzzuk rá, egyben.

## Üzleti szabályok

### Pay-As-You-Go kreditrendszer
- Fix áras csomagok.
- A megvásárolt **kreditek havonta NEM járnak le.**

### Adatmegőrzés
- A felhasználói előzményekben **maximum 50 elemet** listázunk.
- A tárhelyről **egyelőre semmit nem törlünk** (soft-listing, nem hard-delete).

### Jogosultságok
- Szerepkörök közül az **`admin`** és a **`sales`** prezentációs célból
  **ingyen, kreditlevonás nélkül** használhatják az AI API-kat.
- Minden más szerepkörnél a kreditlevonás normál módon érvényes.

## Munkamódszer az AI-asszisztensnek
1. Mindig a legkisebb értelmes lépést valósítsd meg (lásd Granuláris fejlesztés).
2. Ne vezess be külső automatizációs eszközt — csak natív API route.
3. Tartsd a Route Group struktúrát: `(public)`, `(auth)`, `dashboard`.
4. A UI maradjon wireframe szintű a 7. fázisig.
5. Minden üzleti szabálynál (kredit, jogosultság, adatmegőrzés) tartsd a fenti kereteket.
