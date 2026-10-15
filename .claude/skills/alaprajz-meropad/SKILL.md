---
name: alaprajz-meropad
description: A 3D-alaprajz modul mérőpadja — a tesztalaprajzokon lefuttatja a digitalizálást és a 3D-mérést, átfedő képet és táblázatot ad (helyiség rendben, nyílászáró, figyelmeztetés, idő, költség, 3D-eltérés mm). Használd MINDEN olyan változtatás után, ami a digitalizálást (src/lib/floorplan3d/digitize.ts, normalize.ts), a geometriát (geometry.ts) vagy a 3D-építést (scene.ts) érinti, és a prototípus-jelentéshez.
---

# Alaprajz-mérőpad (3D-modul)

## Mikor
- A digitalizáló promptja, a normalizálás, a geometria vagy a 3D-jelenetépítő megváltozott → előtte/utána mérés, hogy lássuk, javult vagy romlott.
- Új típusú valós alaprajz érkezett (pl. hirdetési lap, PDF) → felvenni a tesztkészletbe és lemérni.
- Prototípus-jelentés készül (idő, költség, pontosság).

## Lépések
1. **Olvasd el** a `docs/3d-modul/tanulsagok.md` legutóbbi mérését (ehhez hasonlítunk).
2. **Futtasd** (fizetős Gemini-hívás, képenként ~0,03–0,17 $ — szólj, ha sok képet futtatsz):
   ```bash
   node --env-file=.env.local scripts/floorplan3d-meropad.mjs
   ```
   Alapból a `docs/floorplan3d-teszt/*.png` képeket méri (a saját, jogtiszta tesztlakás). Valós alaprajzokat paraméterként adj át
   (pl. Márk feltöltéseit a `floorplans` tárhelyről letöltve) — **ezeket ne tedd gitbe** (harmadik fél anyaga).
3. **Nézd meg az átfedő képeket** (`.floorplan3d-meropad/<időbélyeg>/atfedes-*.png`): a terv körvonalai ráülnek-e a falakra,
   a nyílászárók a helyükön vannak-e. A szám önmagában nem elég — a szemrevételezés kötelező.
4. **Hasonlítsd** a táblázatot az előző méréshez. A modell futásonként szór (idő 17–95 mp, költség 0,03–0,17 $) → egy futásból ne vonj le
   következtetést kis különbségre; kétes esetben futtasd 2–3-szor.
5. **Írd be** a tanulságnaplóba dátummal: a táblázat + mi változott + mit tanultunk (működött / nem / hiba és megoldás).

## Mérőszámok
| Oszlop | Jelentés | Cél |
|---|---|---|
| Helyiség rendben | a számolt m² a megadotthoz ±5%-on belül (csoportos ellenőrzés nélkül) | méretvonalas rajzon minden helyiség |
| Nyílászáró | felismert ajtó + ablak | a tesztlakáson 11 |
| Figyelmeztetés | kilóg / ütközik / sarokhoz közel / túl magas | 0 (ütközés = tipikusan kétszer felvett ajtó) |
| Lépték | dimensions (méretvonal) / legend (táblázat-összeg) / areas / none | dimensions, ha van méretvonal |
| 3D max eltérés | a kész modellen sugárvetéssel mért tiszta méret vs. JSON | 0 mm; 30 mm = összeérő helyiségek közti vékony fal |

## Tesztkészlet
- `docs/floorplan3d-teszt/teszt-alaprajz-digitalis.png` — kitalált 2,5 szobás lakás; a valós méretei: `teszt-alaprajz.json`
  (újrarajzolás: `node scripts/floorplan3d-test-plan.mjs`).
- Valós (nem gitben): ingatlan.com Bíbor u. (méretvonalas), Lomb Corner (hirdetési, táblázatos, összevont sorokkal).
