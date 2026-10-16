---
name: alaprajz-teszt
description: A 3D-alaprajz modul gépi tesztjei (ingyenes, AI-hívás nélkül) — a megadott projekteken ellenőrzi a bejárást (kezdőpont, minden helyiség elérhető, ajtón / átjárón át lehet menni, ablakon nem, a kész modell méretpontossága) és a szerkesztő-műveleteket (falhúzás szomszéddal, sarokpont beszúrás / törlés oda-vissza, illesztés, típusváltás, mentés). Használd MINDEN olyan változtatás után, ami a geometriát (geometry.ts), a 3D-építést (scene.ts), a bejárást (walk.ts), a szerkesztő-műveleteket (edit.ts), a tervszerkezetet (plan.ts) vagy a berendezést (furniture.ts, builder.ts) érinti — commit / push előtt.
---

# Alaprajz-teszt (3D-modul, gépi tesztek)

## Mikor
- Változott a `src/lib/floorplan3d/` geometria-, 3D-, bejárás-, szerkesztő-, terv- vagy berendezés-kódja → commit / push ELŐTT.
- Új típusú alaprajzzal hiba jött elő → a projektet felvenni a tesztkészletbe (lásd lent), és a hibát először itt kell látni pirosban.
- A digitalizálás (digitize.ts, normalize.ts) változásához a FIZETŐS `alaprajz-meropad` skill kell; ez a teszt csak a már mentett terveken fut.

## Lépések
1. **Futtasd** (ingyenes, kb. 30–60 mp; a projekteket a Supabase-ből olvassa service role-lal):
   ```bash
   node --env-file=.env.local scripts/floorplan3d-tests/run.mjs 561d6d0b-a992-48db-8d30-36265e82104f 4b9dadbb-c679-4dec-8e75-d3fcbc2c9513
   ```
   A futtató a lib fájlokat ideiglenes mappába (`.fp-test/`) másolja, lefordítja és lefuttatja a két sablont
   (`walk-check.ts.tpl`, `edit-check.ts.tpl` — azért `.tpl`, hogy a projekt `tsc`-je ne fordítsa őket). Kilépési kód 0 = minden rendben.
2. **Olvasd a kimenetet:**
   - `walk-check`: `kezdés szabad` · `elérhetetlen: nincs` · `nyílászárók N/N` · `max. mérési eltérés` (0 mm; 30 mm = összeérő
     helyiségek közé épített vékony válaszfal, ez a 4b9dadbb-n elfogadott).
   - `edit-check`: `szerkesztő-műveletek: X ellenőrzés, 0 hiba` — hibánál az első 15 kiírva (pl. „nyílászáró helye beszúrás után …").
3. **Hibánál** ne a tesztet lazítsd: előbb derítsd ki, a kód hibás-e (pl. egy 30 cm-es falcsonk lóg az ajtóba, a nyitott ajtólap
   elzár egy helyiséget). A teszt csak akkor módosítható, ha bizonyítottan a teszt feltételezése rossz (pl. 53 cm mély francia
   erkélyen 60 cm-ről indult) — ezt a sablonban kommentben indokold.
4. **Írd be** a tanulságnaplóba (`docs/3d-modul/tanulsagok.md`), ha a teszt valódi hibát fogott: mi volt, mi lett a megoldás.

## Tesztkészlet (projekt-azonosítók)
| Projekt | Mi ez | Mire jó |
|---|---|---|
| `561d6d0b-a992-48db-8d30-36265e82104f` | Tábornok 27. (valós, jóváhagyott, kézzel javított) | ferde fal, francia erkély, loggia, kétszárnyú üvegajtó, egyterű konyha–nappali, oszlop |
| `4b9dadbb-c679-4dec-8e75-d3fcbc2c9513` | régi tesztlakás (jóváhagyott, berendezett) | ablakok, terasz, sok ajtó, összeérő helyiségek (30 mm) |

- Csak **jóváhagyott, kézzel javított** tervet vegyél fel: a nyers digitalizálás hibái (fantomajtó, rossz körvonal) nem a kód hibái.
  (Pl. a `be63ef8c…` — a Tábornok javítatlan piszkozata — szándékosan nincs a listában.)
- Új projekt felvétele: add hozzá a fenti parancshoz és ehhez a táblázathoz, egy mondattal, hogy mit fed le.
- A valós alaprajz KÉPE harmadik fél anyaga: soha ne kerüljön gitbe (a mérőpadhoz: `.floorplan3d-meropad/valos/`, gitignore).

## Mit fed le (és mit nem)
- Lefedi: falszeletek (szemközti nyitott határ, falcsatlakozás, ferde fal), ajtólap-ütközők, becsukott ajtók, oszlopok, útkeresés,
  kezdőpont, sugárvetéses méretmérés; az `edit.ts` minden művelete és a `sanitizePlan` (mentés) az új mezőkkel.
- Nem fedi le: a felületet (React) és a böngészős 3D-t — azokat a fejlesztői szerveren, a beépített böngészőpanelben kell nézni
  (szélesebb nézethez a böngészőpanel emulált mérete: 1100 × 860, hogy a képernyőkép olvasható maradjon).
