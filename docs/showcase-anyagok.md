# /ingatlan „Egy ingatlan, 7 kész anyag" — szükséges fájlok

Mind a `public/showcase/` mappába, pontosan ezekkel a nevekkel. Amíg egy fájl
hiányzik, a kártyán „Minta hamarosan" csempe látszik — az oldal nem törik el.
Ugyanaz az egy bemutató-ingatlan menjen végig minden modulon (azonos fotók/adatok).

| Modul | Fájl | Méret / formátum |
|---|---|---|
| Képjavító | `kepjavito-elotte.jpg`, `kepjavito-utana.jpg` | azonos kivágás, 4:3, ~1600×1200, JPEG ≤ 300 KB |
| Látványtervező | `latvanyterv-elotte.jpg`, `latvanyterv-utana.jpg` | azonos kivágás, 4:3, ~1600×1200, JPEG ≤ 300 KB |
| Hirdetési kép | (a meglévő `public/flyer-samples/openhouse-*.png` fut) | — cserélhető a bemutató-ingatlan képeire |
| Videó | `video.mp4`, `video-poster.jpg` | 16:9, 1280×720 elég, H.264, ≤ 8 MB; poszter = első képkocka |
| Értékbecslő | `ertekbecsles.jpg` | a riport 1. oldala képként, álló, ~1240×1754, JPEG ≤ 400 KB |
| Hirdetési szöveg | szöveg a kódban: `src/components/IngatlanShowcase.tsx` → `AD_TEXTS` | cseréld a valódi FB/IG/Google kimenetre |
| Szöveg ellenőrzés | szöveg a kódban: `AD_CHECK` (pontszám + 3 megállapítás) | cseréld a valódi eredményre |

Tipp: az admin fiók kreditmentesen futtatja a modulokat; a riport 1. oldalát a
böngésző PDF-előnézetéből képernyőképpel a legegyszerűbb kimenteni.
