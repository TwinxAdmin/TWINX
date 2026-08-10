# TWINX — Comp-alapú, hangolható Értékbecslő motor (fejlesztési spec)

> Állapot: **TERV / SPEC** — még nincs kód. Célja, hogy átnézd, és csak jóváhagyás után építjük.

## 1. Cél

- Ha 5 lekérés fut ugyanarra az ingatlanra, mind az 5 legyen **reális** és **egymáshoz hasonló** (ne legyen „négy jó + egy 15 M-mal olcsóbb”).
- A **számítást ne az AI végezze szabad szövegben**, hanem a saját, determinisztikus motorunk.
- A motor „gondolkodását” az **adminból, gombokkal, verziózva** tudjuk hangolni — kód-módosítás és redeploy nélkül.
- Minden becsléshez tartozzon **átlátható levezetés** (audit): melyik comp-ot használta, melyiket dobta ki és miért, melyik korrekció mennyit módosított.

## 2. Architektúra — három réteg

1. **Retrieval (Perplexity):** CSAK adatot gyűjt — hasonló ingatlanok listája az adott és környező utcákban, strukturált JSON-ban. Nem ad árbecslést.
2. **Számoló motor (saját kód):** a comp-listából determinisztikusan számol a config szerint.
3. **Riport + audit:** a végső ár + a teljes levezetés; a riport-szöveget írhatja az AI, de a SZÁMOT a motor adja.

## 3. Retrieval — a Perplexitytől kért JSON

A prompt feladata: „keress N hasonló, eladó/eladott ingatlant a megadott környéken, és CSAK ezt a JSON-t add vissza”. Semmi végár, semmi „szerintem”.

```json
{
  "comps": [
    {
      "address": "Budapest XIII., Visegrádi utca 12.",
      "district": "XIII",
      "size_m2": 58,
      "price_huf": 88000000,
      "price_per_m2": 1517241,
      "rooms": "2",
      "condition": "jó",
      "floor": "2. emelet",
      "listing_date": "2025-06",
      "url": "https://...",
      "distance_note": "azonos utca"
    }
  ],
  "notes": "hány valódi találat volt, mennyire kellett tágítani a kört"
}
```

A promptban élő, hangolható szűrők: azonos kerület / utca-kör, méret ±X%, ingatlantípus-egyezés, hirdetés-frissesség. Ez a réteg a meglévő `ai_prompts` verziózóban él (mint most a valuation prompt).

## 4. A számoló motor lépései (determinisztikus)

1. **Normalizálás:** ha hiányzik, `price_per_m2 = price / size`; a hiányos/0 értékű comp kiesik.
2. **Kemény szűrés** a config szerint: méret-tűrés, típus, kerület/kör, frissesség.
3. **Outlier-kiszűrés:** a medián Ft/m² körüli ±X% sávon kívüli comp-ok elhagyása (vagy IQR/MAD módszer); marad legalább `min_kept` darab.
4. **Központi Ft/m²:** a megmaradt comp-ok **mediánja** (vagy méret-közelség szerint súlyozott átlag).
5. **Nyers érték** = központi Ft/m² × az ingatlan mérete.
6. **Korrekciók (szorzók):** állapot, emelet/lift, lokációs prémium, (opcionális) fotó-alapú ±5%.
7. **Realitás-küszöb** (budapesti Ft/m² minimum), **hirdetési→tranzakciós diszkont**, **±sáv plafon**.
8. **Kerekítés** a beállított lépcsőre.
9. **Audit-objektum** összeállítása (lásd 7. pont).

Determinisztikus: ugyanaz a comp-halmaz → ugyanaz a szám. Az 5 futás azért konvergál, mert (a) a számolás fix, (b) a medián + trimmelés kivédi az egy kilógó comp-ot, (c) opcionálisan a comp-halmazt címre pár napig gyorsítótárazzuk.

## 5. Hangolható gombok (a teljes config, alapértékekkel)

| Csoport | Gomb | Mit befolyásol | Alapérték | Tartomány |
|---|---|---|---|---|
| Comp-szűrés | Méret-tűrés | mekkora eltérésű méret még beszámít | ±20% | 5–50% |
| Comp-szűrés | Max hirdetés-kor | ennél régebbi hirdetést nem használ | 6 hó | 1–24 hó |
| Comp-szűrés | Csak azonos kerület | kerületen kívülit kizár | be | be/ki |
| Comp-szűrés | Min. comp-szám | ennyi alatt tágít vagy figyelmeztet | 5 | 3–15 |
| Outlier | Módszer | medián-sáv / IQR / MAD | medián-sáv | — |
| Outlier | Sáv | a medián ±ennyi %-án kívülit dobja | ±25% | 10–50% |
| Outlier | Min. megmaradó | ennyinél kevesebbre nem trimmel | 4 | 3–10 |
| Központi érték | Módszer | medián / méret-súlyozott | medián | — |
| Korrekció | Állapot: felújítandó | szorzó | −12% | −30…0% |
| Korrekció | Állapot: közepes | szorzó | 0% | −10…+10% |
| Korrekció | Állapot: jó | szorzó | +4% | 0…+15% |
| Korrekció | Állapot: újszerű | szorzó | +10% | 0…+25% |
| Korrekció | Emelet/lift | pl. földszint, magas emelet lift nélkül | −3%…+2% | −10…+10% |
| Korrekció | Lokációs prémium | mikro-lokáció felár/diszkont | 0% | −15…+15% |
| Realitás | BP Ft/m² minimum | budapesti alsó realitás-küszöb | 1 000 000 | 0–3 000 000 |
| Realitás | Hirdetési→tranzakciós | alku-diszkont a hirdetési árhoz | −7% | −15…0% |
| Realitás | Korrekciós plafon | a korrekciók max hatása | ±5% | 0–15% |
| Kerekítés | Lépcső | végár kerekítése | 100 000 Ft | 10 000–500 000 |
| Cache | Comp-gyorsítótár | címre ennyi napig újrahasznál | 3 nap | 0–14 nap |

*(Az értékek példák; ezekkel indulunk, és te finomítod.)*

## 6. Admin felület — „Értékbecslő motor” (átlátható, egyértelmű)

Új admin-oldal (`/admin/valuation-engine`). Felépítés:

- **Kártyás szekciók** a fenti csoportok szerint: Comp-szűrés · Outlier · Központi érték · Korrekciók · Realitás & kerekítés · Cache.
- **Minden gomb mellett:** rövid, egymondatos magyarázat („mit csinál”), a beviteli mező (szám / % / kapcsoló / legördülő), és az **alapérték jelölése** (pl. „alap: 20%”).
- **Verziózás** — pont mint a promptoknál: `Mentés új verzióként` · `Aktiválás` · `Vissza az alapértékre` · verzió-lista dátummal és megjegyzéssel.
- **Száraz próba (dry-run):** beillesztesz egy korábbi becslés comp-listáját (vagy egy minta-JSON-t), és a jelenlegi gombokkal **azonnal látod, mi jönne ki + a teljes levezetés — mentés/deploy nélkül.** Így vakon sose kell tuningolni.

## 7. Levezetés-nézet (audit) — a becslés mellett

- **Használt comp-ok táblázata:** cím, méret, Ft/m², súly, BENN/KI + ok (pl. „kiugró: medián +38%”).
- Központi Ft/m², nyers érték.
- **Korrekciók lépésről lépésre:** melyik mennyit módosított (Ft-ban és %-ban).
- Realitás-küszöb / diszkont / plafon hatása.
- **Végső ár + sáv** (pl. 90–95 M).

## 8. Adatmodell

- Új tábla: `valuation_engine_configs (id, version, is_active, params jsonb, note, created_at)` — a számszerű config verziózására (külön a szöveges promptoktól).
- `usage_history` bővítés: a becslés **audit-objektuma** (jsonb) elmentve, hogy a levezetés bármikor visszanézhető legyen.

## 9. Konzisztencia-mérés (beépített teszt)

- „5× futtatás” gomb: ugyanarra az ingatlanra 5 becslés, és kiírja a **szórást** (max–min, szórás %). Cél: pl. < 5%. Így számszerűen látjuk, javult-e a Visegrádi-probléma.

## 10. Build-sorrend (granuláris, a CLAUDE.md szerint)

1. SQL: `valuation_engine_configs` tábla + alapértelmezett config seed.
2. `lib/valuation-engine.ts`: típusok, default config, számoló függvény + audit-építő (tiszta, tesztelhető logika).
3. Retrieval prompt átírása **JSON-only comp-listára** (új prompt-verzió, a régi megmarad).
4. `route.ts`: Perplexity JSON parse → motor → riport + audit mentés; **fallback** a régi becslő-módra, ha kevés a comp.
5. Admin: `/admin/valuation-engine` oldal + API (lista / mentés / aktiválás / vissza alapra) + dry-run.
6. Levezetés-nézet a riportban.
7. Ellenőrzés: `tsc` + 5× szórás-teszt egy referencia-ingatlanon.

## 11. Kockázatok, megjegyzések

- Kevés comp (kis település) → tágabb kör kell (a „lazító létra” ide is beépül); ilyenkor jelezzük a bizonytalanságot.
- Ha a Perplexity nem ad elég használható comp-ot → automatikus visszaesés a jelenlegi (AI-becslő) módra, jelzéssel.
- Az értékbecslés mindig **becslés**; a végszó a szakértőé. A motor a védhető, konzisztens kiindulást adja.

---

### Egy mondatban

Perplexity = adatgyűjtő (JSON comps), saját motor = determinisztikus becslő (medián + trimmelés + korrekciók + kerekítés), minden gomb az adminból hangolható és verziózható, és minden becslés mellé jár egy átlátható levezetés.
