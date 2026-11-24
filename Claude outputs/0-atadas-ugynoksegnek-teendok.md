# Átadás az ügynökség-beszélgetésnek – mit kell tenned (Márk)

## 1. A tervek bemásolása
- Csomagold ki a zip-et. A `terv` mappát **egészben** másold az ügynökség repójába `docs/terv/` néven (ne csak a fájlokat: az `ai-ugynokseg` almappa is kell).
- Benne van: 00, ai-ugynokseg/01, 02, 03, 04, 05, 06, 07, 08, 09, 10, **11 (új: a következő feladatok sorrendben)**, a 11–26 (a főmappában), VALTOZASOK.md, VISSZAJELZES.md (sablon), README.md.
- A 03, 06, 07, 08 történeti és a szünetelő partner ág anyaga (a fejlécük jelzi, mi érvénytelen).
- Nincs benne: a régi memória-export (a modulok korábbi részletei; kérésre küldöm, ha az ügynökségnek kell).

## 2. A beszélgetés indítása
- Nyiss új beszélgetést az ügynökség repójában, és másold be az `1-ugynokseg-atado-uzenet.txt` tartalmát (teljes szöveg).
- A beszélgetés ne kezdjen kódolni, amíg te külön nem kéred (az üzenet is ezt mondja).

## 3. Console ellenőrzőlista (D60) – ezt te csinálod a Console-ban
- [ ] Új Workspace: `twinx-agents`.
- [ ] A Workspace havi költséglimitje: 20 USD (később felülvizsgáljuk).
- [ ] Új API-kulcs csak ebben a Workspace-ben; a kulcs neve legyen beszédes (pl. `twinx-agents-laptop`).
- [ ] A kulcs csak a laptop környezeti változójába vagy a `.env` fájlba kerül; a `.env` a `.gitignore`-ban legyen; a kulcsot nem másolod chatbe.
- [ ] Az automatikus újratöltés ki van kapcsolva (nálad ez már így van).
- [ ] Nézd meg a számlázási beállításoknál, van-e figyelmeztetés alacsony egyenlegnél, és ha van, kapcsold be.
- [ ] Naptári emlékeztető a hónap elejére: egyenleg ellenőrzése.

## 4. Az indulási kapu
- Az API-bekötés és az éles indítás előtt egyeztetsz Tiborral (`01`, 3. szakasz). Ha ez még nem történt meg, az ügynökség beszélgetés a bekötést és az éles indítást ne végezze el, amíg nem jelzed.

## 4/b. Parkolt (D61)
- Az ügynökség munkájának megtekintése a twinx.hu adminban: most Telegram + Supabase felülete. Az előfeltételek (nyilvános/privat mezők szétválasztása, csak olvasható DB-szerepkör) benne vannak az átadó üzenetben.

## 5. A sorrend (ahogy a `02` 10. szakasza és a D59 mondja; részletesen: `ai-ugynokseg/11`)
- A weboldal újraépítése a **fejlesztési beszélgetésben** (Claude Code) készül, a `docs/terv/` tervei szerint; nem az ügynökségre vár.
- Az ügynökség ettől függetlenül épül: a `02` 10. szakaszának fázisai (az alapok és a csupasz hurok megvannak; következik a 2. fázis: intake + hibakeresés). A webfejlesztő alügynök a 6. fázisban kerül sorra.
- Lépés végén `VISSZAJELZES.md` bejegyzés; visszamásolod a tervező projektbe, és az új exportot kapod.
