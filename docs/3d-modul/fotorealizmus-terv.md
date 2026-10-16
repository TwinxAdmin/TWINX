# Fotórealisztikus 3D lakás — terv (csak terv, nincs fejlesztés)

2026-10-16 · Márk kérése: a kész 3D modell legyen olyan valósághű, mint a küldött referenciák (OpenArt-videó, „88351 Old Hwy" bejárás),
**az arányok megtartásával** — „mintha tényleg egy házban járnánk, és nem legenerált blokkok között".

A brief szabályai itt is érvényesek: a JSON (FloorPlan) az egyetlen igazságforrás, semmi nem lehet megtévesztő, kredit csak jóváhagyott
tervvel, prototípus mérésekkel.

---

## 1. Mit látunk a referenciákon (és mit nem szabad átvenni)

| | OpenArt (konyha, nappali, háló) | „88351 Old Hwy" bejárás |
|---|---|---|
| Hogyan készülhetett | Generatív kép/videó (AI), helyiségenként külön jelenet | Valószínűleg 3D-render (alaprajzból épített tér), amire **AI-videó** tette rá a fotószerű réteget — erre utalnak a jellegzetes hibák: a komódon „karcolásszerű" fehér vonalak, olvadó bútorélek |
| Ami miatt valóságos | fény (meleg, irányított), anyagok (fa erezet, kő), sűrű berendezés és apró tárgyak, kilátás az ablakon | napfény-csíkok a padlón, lágy árnyék a sarkokban, fényes padló-tükröződés, filmes kamera (széles lencse, lassú, sima mozgás, mélységélesség) |
| Ami nekünk TILOS / kockázatos | az arányok szabadon változnak (nincs alaprajz mögötte); **emberek** a képen (jog, megtévesztés) | az AI-réteg néha „kitalál" (plusz ablak, elcsúszott fal) → nálunk csak geometria-ellenőrzéssel mehet |

**A lényeg:** a valóságérzet ~80%-a nem a geometriából jön, hanem öt dologból: **fény, anyag, részletek, berendezés-sűrűség, kamera.**
A mi motorunk ma a geometriát hibátlanul tudja (0 mm), a másik öt területen hiányos — ezért hat „dobozosnak".

## 2. Miért hat ma blokknak (konkrétan a mi motorunkon)

1. **Fény:** nincs visszavert fény (globális megvilágítás) és sarok-árnyékolás (AO) → a falsíkok egyszínűek, a sarkok „lebegnek".
2. **Részletek hiányoznak a falakról:** nincs lábazat, ajtótok/szemöldök, ablakkáva mélysége, belső párkány, radiátor, konnektor, mennyezeti lámpa
   → minden él tökéletesen éles doboz-él (a valóságban lekerekített / takart).
3. **Anyagok:** egyszerű színek / ismétlődő textúrák, nincs tükröződés (padló, üveg), nincs finom egyenetlenség.
4. **Berendezés:** kevés és ritka (a mintalakás hálójában nincs ágy, a konyhában nincs konyhabútor, a fürdőben nincs szaniter) — a katalógusban
   ezek még nincsenek. Nincsenek „élet-tárgyak" (szőnyeg, könyv, párna, függöny, kép a falon).
5. **Ablakon kívül:** egyszínű ég — nincs kilátás, nincs napsugár a padlón.
6. **Kamera / utómunka:** nincs tónusgörbe-finomhangolás, ragyogás az ablakokon, mélységélesség, mozgási elmosódás, finom vignetta.

## 3. A terv: három szint, egymásra épülve

### A) Valós idejű szint — a böngészős bejárás és a megosztott link (mindenkinek, minden lakásnál)
Cél: telefonon is ≥ 30 fps, „jó építészeti látványterv" hatás. Ingyenes futtatás (a vevő gépe számol).

1. **Utómunka-lánc:** sarok-árnyékolás (GTAO/SSAO), ragyogás (bloom) az ablakokon, élsimítás, korszerű tónusleképezés (AgX), finom színkorrekció,
   vignetta. *Leggyorsabb, leglátványosabb nyereség.*
2. **Részletek a JSON-ból, automatikusan** (új, geometria-független réteg a scene.ts mellett — a méretek NEM változnak):
   lábazat minden falon (ajtónál megszakad), ajtótok + szemöldök, ablakkáva a falvastagságban + belső párkány, radiátor az ablak alatt,
   mennyezeti spotok / lámpa, kapcsoló az ajtó mellett, enyhén lekerekített falélek.
3. **Anyagok a stíluslapból:** valós méretarányú parketta (deszkaszélesség), falfesték finom egyenetlenséggel, csempe fugával, padló-tükröződés,
   valódi üveg. Új stílus = új stíluslap (a meglévő elv szerint, kódmódosítás nélkül).
4. **Kilátás + nap:** HDRI-égbolt és háttérkép (kert / városi környezet) az ablakokon túl, alacsony nap → fénycsík a padlón, lágy árnyékok.
5. **„Beégetett" fény (lightmap)** a jóváhagyás után, projektenként EGYSZER: a visszavert fény előre kiszámolva textúrába → a bejárás és a megosztott
   link ugyanazt a minőséget mutatja telefonon is. (Ez a legnagyobb ugrás a valós idejű szinten.)
6. **Berendezés-sűrűség:** katalógus-bővítés (ágy, konyhabútor-modulok, szaniterek, függöny, szőnyeg, kép, könyv, párna, lámpák) + a berendező
   szabályai „dekor-csomagokkal" (a stíluslap decor_density alapján). A meglévő elv marad: bútor nem lóghat ajtóba / közlekedőbe.

### B) Offline render — a bemutatóvideó (F5) és a fotók (prémium, kreditért)
Cél: a „88351 Old Hwy" minőség, de **a mi geometriánkkal**, hamisítás nélkül.

7. **Útvonal-követő fényszámítás (path tracing)** ugyanabból a jelenetből: valós fénytörés, puha árnyékok, tükröződés — képkockánként.
   Filmes kamera: 24–28 mm-es lencse, szemmagasság 1,55–1,6 m, sima ív (a bemutató kameraútjának elve: útkereséssel, előre néző nézéssel),
   mélységélesség, mozgási elmosódás.
8. **Videó összefűzése** a képkockákból (a meglévő videómotor-irány szerint, lásd docs/video-motor-allapot.md).

### C) AI-„fotófiniselés" — opcionális, csak állóképekre (és később rövid klipekre)
Cél: az OpenArt-szintű hangulat, de az arányok megtartásával.

9. A B) szint képe mellé a motor kiadja a **mélység-, él- és helyiség-maszkokat**; az AI ezek közé „festi" a fotószerű felületet
   (ugyanaz az elv, mint a meglévő célkép + geometria-hűség ellenőrzés: `target.ts`, `fidelity.ts`).
10. **Kötelező kapu:** a geometria-hűség ellenőrzés (falsarkok, ablak- és ajtókontúrok a helyükön) — ha nem megy át, az AI-kép NEM jelenik meg,
    csak a B) render. Megjelölés: „AI-val finomított látványkép — a méretek a jóváhagyott terv szerint". **Ember nem kerül a képre.**

## 4. Javasolt sorrend (mikrolépések, mindegyik után mérés)

| # | Lépés | Szint | Mérés |
|---|---|---|---|
| 0 | Mérőpad: a mintalakás 5 rögzített nézőpontja + a referenciák; a kritikus (critic.ts) 1–10-es „valósághűség" pontszáma + emberi szemle | – | kiinduló pontszám |
| 1 | Utómunka-lánc + HDRI + tónusleképezés | A | pontszám, fps telefonon |
| 2 | Részletek a JSON-ból (lábazat, tok, káva, párkány, radiátor, lámpa) | A | pontszám; 0 mm marad (gépi teszt) |
| 3 | Anyagok a stíluslapból (parketta, festék, csempe, tükröződés) | A | pontszám |
| 4 | Katalógus-bővítés: ágy, konyha, fürdő + dekor-csomagok | A | üres helyiség = 0 |
| 5 | Kilátás + napsugár | A | pontszám |
| 6 | Beégetett fény jóváhagyáskor | A | pontszám, betöltési idő, tárhely / lakás |
| 7 | Path-traced képkockák + filmes kamera → F5 videó | B | render-idő és költség / videó |
| 8 | AI-fotófiniselés geometria-kapuval (állókép) | C | átengedési arány, költség / kép |

Becslés a hatásra: az 1–5. lépés után a bejárás „jó látványterv" szintű; a 6. után telefonon is; a 7. adja a referenciavideó-szintet.

## 5. Nyitott kérdések (Márk döntése)

1. **Render-gép:** a path tracing (B) és a fénybeégetés (6.) nagy számítás. Mehet a partner böngészőjében (ingyenes, de lassú gépen percekig tart),
   vagy kell egy saját GPU-s render-szolgáltatás. A CLAUDE.md szerint minden szerverlogika natív Next.js API route — egy külön render-gép ehhez
   képest új infrastruktúra, erről külön döntés kell.
2. **AI-finiselés (C):** belefér-e a „semmi nem lehet megtévesztő" elvbe megjelöléssel és geometria-kapuval? Javaslat: csak állóképen, jelölve.
3. **Ár:** a B/C szint fizetős legyen (pl. a videó a meglévő creditsVideo-ból, a fotók külön), vagy része a 10 kredites 3D lakásnak?
4. **Eszköz-cél:** a valós idejű szintnél mi a minimum (pl. 3 éves középkategóriás telefon)?

## 6. Mit NEM változtat a terv
- A geometria forrása a jóváhagyott JSON; minden új elem (lábazat, radiátor, dekor) csak díszítés, a mérést (0 mm) nem befolyásolja.
- Erkély / terasz: mellvéd ~1 m, üvegezett erkélyajtó becsukva — a meglévő szabályok szerint.
- Valós (harmadik fél) alaprajz és a referenciavideók képkockái nem kerülnek gitbe.
