# Tanulságnapló — „Alaprajzból bejárható 3D lakás" modul

Minden munkamenet ELEJÉN olvasd el. Minden lépés végén bővítsd röviden, dátummal:
mi működött, mi nem, milyen hiba és mi lett a megoldás, mért eredmény (idő, költség, pontosság).
Kód: `src/lib/floorplan3d/`, `src/components/floorplan3d/` · Feladatlista: `TODO.md` → „F3D" · Tesztanyag: `docs/floorplan3d-teszt/`.

---

## 2026-10-15 — 1. lépés: feltöltés, digitalizálás, javítás, méret-ellenőrzés

### Modellválasztás
- **Hiba:** a `gemini-2.5-pro` új API-kulcsnak már nem érhető el (404: „no longer available to new users").
  **Megoldás:** `gemini-3.1-pro-preview` (env: `FLOORPLAN3D_VISION_MODEL`). A modellnevet mindig konfigurációban tartsuk.
- A gondolkodó modell ideje és ára futásonként erősen szór: ugyanaz a kép 17 mp / 0,03 $ és 82 mp / 0,15 $ között
  (a „gondolkodó" tokenek 2–12 ezer között). Mérésnél több futás átlagát adjuk meg.

### Mi működött
- **Koordináták 0–1000-es normált rácson** (a Gemini ebben a formában pontos), utána képpontra, majd méterre váltva.
- **Lépték a kiírt méretvonalakból** (medián m/képpont): a méretvonalas alaprajzokon a kiírt m²-ekkel 0,1–2%-on belül egyezett.
- **Derékszögesítés + koordináta-összeigazítás** (6 cm-en belüli értékek közös értéket kapnak): a szomszéd helyiségek falai egy vonalba kerülnek.
- **Méretvonal-igazítás:** a helyiségbe írt méret (pl. „2,30") a helyiség belső mérete → a helyiséget mindkét oldalon a falból
  elvéve igazítjuk rá (a szomszédok nem mozdulnak). Ezzel a tesztlakás 6/7-ről, az ingatlan.com-os 7/8-ról → 8/8-ra javult.
- **Falhossz-javítás „nyújtással":** a fal túlsó vége mögötti MINDEN pont (és nyílászáró) ugyanannyival tolódik → a terv nem esik szét.
- **Az eredeti rajz a terv alatt** (lépték + eltolás visszaszámolva): a felhasználó szemmel azonnal látja az illeszkedést.

### Mi nem működött / tipikus hibák
- **Túl vastag válaszfalak:** a modell a 10 cm-es falat 20–30 cm-nek rajzolja → a keskeny helyiségek (előszoba, fürdő) kisebbek.
  Megoldás: a fenti méretvonal-igazítás; ami marad, azt a felhasználó egy falhosszal javítja.
- **Egyterű helyiségek:** a szaggatott vonallal elválasztott nappali–konyha közé a modell 20 cm-es rést (= falat) tett.
  Megoldás: `openTo` a promptban + „nyitott határ" (`openEdges`) a sémában, a javítófelületen átállítható.
- **Nyílászáró-felismerési hibák (megfigyelt):**
  - futásonként változó számú nyílászáró ugyanazon a képen (tesztlakás: egyszer 11/11, egyszer 8/11);
  - teljes magasságú teraszajtót (pl. „K05 150/240") ablaknak vett;
  - ajtó helyett nyitott határt tett (előszoba–konyha „A02" ajtó);
  - a nyílászáró rossz helyiséghez / rossz falra kerülhet, ha a középpontja két helyiség közti falban van (a legközelebbi párhuzamos élre tesszük).
  → Ezért kell a nyílászáró-javítás a felületen (kiegészítés, 2026-10-15).
- **Hirdetési (3D-renderelt, berendezett) alaprajzok** (pl. Lomb Corner): nincs méretvonal, a nevek és m²-ek oldalt táblázatban.
  Első próba: 2/11 helyiség rendben — a teljes képernyőképen az alaprajz csak a kép ~negyede volt.
  Megoldás: **kétlépcsős digitalizálás** (1. hol az alaprajz + táblázat kiolvasása → kivágás, nagyítás; 2. digitalizálás a táblázattal)
  és **lépték a táblázat belső sorainak ÖSSZEGÉBŐL** (egy-egy rossz párosítás nem torzítja). A felismert belső terület 71,97 m² ↔ táblázat 71,96 m².
- **Összevont táblázatsorok:** „Hálószoba 34,11 m²" három szobára; a fejlesztő az egyterű nappali/étkező/konyhát saját logikája szerint
  osztja fel (pl. étkező 1,68 m²). Megoldás: **összevont ellenőrzés** (`areaGroups`) — a tagok összegét vetjük össze.
- **Felület:** keskeny helyiségben a falhossz-címkék egymásra csúsztak → 1,6 m alatt a címkék kívülre kerülnek.
- **Tesztelés:** a böngészőpanelben a kattintás a lebegő admin „Nézet" panelre esett, nem a gombra — koordináta helyett elemre
  (vagy a panelt elkerülő pontra) kattintani. Az emulált nagy ablakméretnél a képernyőkép apró és torz → szöveges ellenőrzés.

### Mért eredmények (1. lépés)
| Alaprajz | Helyiség rendben (±5%) | Idő | Költség |
|---|---|---|---|
| Tesztlakás (saját, méretvonalas) | 6/7 (előszoba: 1 falhossz) | 17–82 mp | 0,03–0,15 $ |
| ingatlan.com, Bíbor u. (méretvonalas) | 8/8 | 18–28 mp | 0,03–0,04 $ |
| Lomb Corner (hirdetési, táblázatos) | 0/12 egyenként — a geometria jó, a táblázat összevont | 95 mp | 0,17 $ |

---

## 2026-10-15 — 2. lépés: 3D-alap (A út: a böngésző renderel)

### Mi működött
- **Falszeletek a helyiségek közti résből:** minden nem nyitott él kifelé kap egy szeletet; vastagság = a szemközti szomszédig tartó rés
  (≤ 50 cm), különben a konfigurált külső fal. A domború sarkokat a szeletek meghosszabbítása zárja.
- **Méretpontosság a KÉSZ modellen mérve:** sugárvetés több magasságban (0,45 / 1,2 / 2,25 / mennyezet alatt), hogy az ajtó- és
  ablaknyílásokon ne menjen át a sugár; a nyitott határ irányában nem mérünk. Valós tesztlakás: **0 mm** minden helyiségben.

### Hibák és megoldások
- **A sarokzárás sorrendfüggő volt** (a már meghosszabbított szelet nem „érte el" a szomszédot) → előbb az eredeti értékekből számolunk, utána alkalmazzuk.
- **Összeérő, nem nyitott helyiségek közt nem épült fal** (a digitalizált körvonalak fal-rés nélkül értek össze) → a sugár átment a szomszédba
  (pl. a Lomb-mosdónál 7,7 m „szélesség"). Megoldás: ide 6 cm-es válaszfal épül középre; a mérés ezt 30 mm-ként őszintén kimutatja.
- **Fény:** az első változat túl sötét, a második túl világos (fal és padló egybemosódott) → melegebb, sötétebb padló, mérsékelt fény.
- A three.js r155+ fizikailag korrekt fényerőket használ: a régi példák értékei (1.0) túl sötétek.

### Mért eredmények (2. lépés)
| Terv | Legnagyobb eltérés (modell ↔ JSON) |
|---|---|
| Tesztlakás valós méretei | 0 mm |
| Digitalizált terveken | 30 mm (csak a vékony válaszfalnál) |

---

## 2026-10-15 (este) — Kiegészítés: nyílászáró-javítás, utólagos javítás, videó külön

### Mi készült
- **Nyílászáró-javítás a 2D terven:** húzás a falon (cm-es lépés, a fogás helye a kéz alatt marad), pontos távolság mindkét saroktól,
  szabványos méretlista (beltéri/bejárati/teraszajtó, 60×60…180×150 ablak) vagy egyedi méret, parapet, ajtó ↔ ablak csere, nyitásirány, zsanér.
- **Figyelmeztetések (nem tiltás):** kilóg a falból · ütközik egy másikkal (a fal túloldaláról felvettel is — tipikus digitalizálási hiba:
  ugyanaz az ajtó kétszer, a két szomszéd helyiséghez) · túl közel a sarokhoz (config) · magasabb a belmagasságnál.
- **Utólagos javítás:** 3D → „Vissza a 2D javításhoz" → újbóli jóváhagyás `creditsGeometryFix` áron (alapból 0); a korábbi jóváhagyott
  pillanatképhez képest `affectedRooms` számolja, mely helyiségek épüljenek újra (`rebuild_rooms`, a 3. lépés berendezése ezt használja).
- **Videó:** NEM automatikus — külön gomb + `creditsVideo` (config). Automatikus videóhoz eddig nem készült semmi, nem kellett igazítani.

### Hibák és megoldások
- **A `scrollIntoView` az egész oldalt görgette** (szűk elrendezésben a panel a terv alatt van) → húzás közben elugrott az oldal, és a húzás
  szövegkijelölésbe ment át. Megoldás: csak a panel saját görgetősávját mozgatjuk (`scrollWithin`).
- **„−0,00" a saroktávolságnál** (lebegőpontos −0) → `|| 0` normalizálás.
- **Érintett helyiségek túl bővre számolva:** nyílászáró-változásnál a helyiség MINDEN falszomszédja bekerült, majd az egy vonalban futó
  (mellette lévő) helyiség is. Megoldás: csak a fal TÚLOLDALÁN lévő, ellentétes irányba néző él számít. Ellenőrizve: bejárati ajtó → csak az
  előszoba; szobaablak → szoba + a mögötte lévő terasz; falhossz-javítás → minden mozduló helyiség.
- **Tesztelés:** a koordináta-mérés és a kattintás között a késve töltődő képek miatt elcsúszott az oldal → rossz elemre kattintottunk.
  Megbízhatóbb: közvetlen egéresemények (pointerdown/move/up) a kiválasztott elemen, és az eredmény kiolvasása a mezőkből.

### Mért eredmények
- Húzás: 30 px balra → az ajtó a saroktól 1,52 → 0,81 m, az oldal nem mozdult; méretlista → 0,90 m, a közép helyben maradt.
- Figyelmeztetés: 2,5 m széles ajtó → „Kilóg a falból (24 cm)" + „Ütközik egy másik ajtóval (Nappali felől)".
- **Utólagos javítás élesben (SQL után):** visszanyitás → ajtó +30 cm → újbóli jóváhagyás „ingyenes" → „újraépítve: Fürdő, Szoba"
  (csak az ajtó két oldala). Az első jóváhagyásnál, ha még nincs pillanatkép, minden helyiség újraépül — ez helyes.
- **Szám-mező:** elhagyáskor a MEZŐ aktuális szövegét olvassuk (nem a React-állapotot) — gyors gépelés + azonnali továbbkattintás
  után az állapot késhet. **Teszt-tanulság:** a háttérben futó böngészőlapon a mesterséges `focus()`/`blur()` nem vált ki valódi
  elhagyást → a „módosítás elveszett" látszat a TESZT hibája volt; mezőkbe valódi gépeléssel (Enter) teszteljünk.

## 2026-10-15 (éjjel) — Mérőpad skill
- Új skill: `.claude/skills/alaprajz-meropad` + `scripts/floorplan3d-meropad.mjs` (digitalizálás + 3D-mérés + átfedő kép + táblázat).
- Első futás, tesztlakás: 5/7 rendben (előszoba −30,5%, erkély +5,6%), 11 nyílászáró, 2 figyelmeztetés, 19,9 mp, 0,035 $, 3D 0 mm.
  Tanulság: futásonként szór (korábban 6/7) → a mérőpadot kétes esetben 2–3-szor futtassuk.

---

## 2026-10-16 — 3. lépés, F3a: japandi anyagok (CC0-textúrák)

### Döntések
- Bútorforrás: **(c)** — fő bútorok paraméteresen (kódból), díszek CC0-modellként. Textúrák: Poly Haven CC0, 1k JPG
  (`wood_floor`, `white_plaster_02`, `rough_linen`, `wool_boucle`; ~10 MB, `public/floorplan3d/textures`, licencjegyzékkel).
- Szaniterek / konyhasor helye: **még nincs döntés** — megvizsgálni, mennyire szerepelnek az alaprajzokon (nappalit nem érinti).
- Hatókör: előbb **egy nappali** végig (célkép → építő → kritikus), mérésekkel.

### Mi működött
- **Stíluslap ↔ anyagkönyvtár szétválasztása:** a stíluslap megnevezi az anyagot (`light_oak_matte`), a `MATERIAL_LIBRARY` mondja meg a
  3D-megjelenést. A geometria érintetlen; a mérés a semleges modellen fut.
- **Átszínezés vásznon:** a CC0-textúra világosság-mintázata marad (erezet, deszkahatár), a szín a stílusé (`contrast` anyagonként).
- **Világ-méteres UV a falakon:** a BoxGeometry lapjai 0–1 UV-t kapnak → minden fal más léptékű lenne; a csúcsok világhelyéből számolt UV egységes.

### Hibák és megoldások
- **Sárosbarna falak:** a vakolat színtérképe szürkés-foltos, a falszín ezzel szorzódott → a falnál is átszínezés, 6%-os kontraszttal.
- **Narancsos padló:** a nyers 2850 K-es fény + a tónusleképezés (ACES) telíti és sötétíti → a fény színe 55%-ban fehéregyensúlyozva
  (mint a fényképezőgép), és világosabb tölgy-alapszín (#CDB596 → #DCC8AA).

### Stíluslap-javaslat (jóváhagyásra — a stíluslapot NEM módosítottam)
- A fa anyagokhoz nincs HEX a stíluslapban (`primary_wood: "light_oak_matte"`, `secondary_wood: walnut`). 3D-ben a „világos tölgy"
  sokféle lehet (mézestől a szürkésig) → javaslat: `wood_colors: { light_oak_matte: "#DCC8AA", walnut: "#6B4A33" }` (a 3D-ben jól ható érték).
- A „meleg, 2700–3000 K" fény nyersen narancsossá teszi a világos tölgyet → javaslat: a stíluslapba „fehéregyensúlyozott meleg fény"
  megjegyzés (a renderelés és a célkép-prompt is így kezelje).

## 2026-10-16 — F3b: paraméteres bútorkészlet + szabályalapú nappali-elrendezés

### Mi készült
- `lib/floorplan3d/furniture.ts` (three.js nélkül, gépen tesztelhető): bútorleírás (típus, közép, elforgatás, méret, anyagok) — ugyanez lesz
  az építő kimenete; ellenőrzés (helyiségen belül · ajtó előtti 0,9 m-es sáv szabad · nem ütközik; szőnyeg/függőlámpa kivétel);
  szabályalapú nappali-elrendezés (kanapé a leghosszabb ajtómentes falnál — ablak alá is, ha a parapet a háttámla fölött van —,
  előtte asztal + szőnyeg, fotel az asztal mellett, polc másik falnál, növény a kanapé végénél, lámpa az asztal fölött).
- `lib/floorplan3d/furniture3d.ts`: kódos bútorok a stíluslap formái szerint (lekerekített élek, látható tölgylábak, len/buklé kárpit,
  fogantyú nélküli front, polc legfeljebb harmadáig töltve, rizspapír lámpa, kódos növény — a CC0-növényig).

### Hibák és megoldások
- **Kockás buklé:** a CC0 `wool_boucle` színtérképe kockás takaró → a kontrasztot 6%-ra vettük (csak a hurkos szerkezet marad).
- **Elforgatott bútor csíkos textúrája:** a világ-méteres UV a LOKÁLIS normálissal választott tengelyt → 90°-os bútoron rossz tengely.
  Megoldás: a normálist a világ-koordinátába fordítjuk (`transformDirection`).

### Mért eredmények
- Ingatlan.com-os nappali: 7/7 bútor szabályosan elhelyezve. Tesztlakás nappali: 6/7 — a fotel kimaradt, mert elzárta volna
  az ajtó előtti szabad sávot (helyes döntés, jelezve). A tesztlakásban a két ajtó közti átjáró a szőnyegen át vezet → F3c-ben
  közlekedőút-ellenőrzés kell.

## 2026-10-16 — Külső kódok vizsgálata (csak olvasva, semmit nem futtattunk)
- `morluto/rea`: visszafejtő (reverse engineering) MCP-eszköz — **nem kapcsolódik** a modulhoz, nem veszünk át belőle semmit.
- `Sam1983Aing/casa-serra` (+ `casa-larga`): three.js „alaprajzból ház görgetésre" — **nincs licence** (minden jog fenntartva),
  ezért KÓDOT NEM veszünk át, csak elveket, saját megvalósításban:
  A) HDR égbolt környezeti fénynek (CC0 HDRI + PMREM) · B) az alaprajz = a 3D-modell metszete (vágósík ~1,2 m, felülről, szűk látószög) —
  a videó alaprajza és a minitérkép ugyanabból a modellből · C) sima, túllövés nélküli kameraút (monoton köbös interpoláció) ·
  D) eszközfüggő textúrakeret + tartalék állókép/klip · E) visszafogott utófeldolgozás · F) helyiségenkénti 1–10 pontszám a felvételekből.
  Nem vesszük át: görgetés-alapú landing (GSAP/Lenis), bőr textúra (japandi tilos).
- Tanulság: idegen repónál ELŐSZÖR a licencet nézzük (licenc nélkül csak ötlet, kód nem), és a kódot nem futtatjuk.

## 2026-10-16 — F3c: építő (Gemini) + közlekedőút-ellenőrzés

### Mi készült
- `walkwayIssues` (furniture.ts): 10 cm-es rácson utat keres a bejáratok (ajtók + nyitott határok, 45 cm-rel befelé) között —
  bútoroktól ≥ 40 cm (= 80 cm-es út), faltól ≥ 30 cm; szőnyeg és függőlámpa nem akadály. 3–4 ms/helyiség.
- `builder.ts`: az építő a helyiség számszerű leírását (sokszög, falak a nyílásokkal, ajtósávok, bejáratok), a stíluslap TELJES szövegét,
  a bútorkatalógust (±40% méret) és a szabályalapú elrendezést kapja; JSON-t ad indoklással. A kód ellenőriz (bent van, ajtósáv, ütközés,
  közlekedőút); hibánál 1 javítókör a hibalistával; ha az sem jó → szabályalapú tartalék (forrás: "rule"). A bútorok anyagát a kód adja
  (nem bízzuk a modellre). `POST .../projects/[id]/furnish` + `furnishing` oszlop (20261016001943_floorplan-furnishing.sql).

### Mért eredmények (gemini-3.1-pro-preview)
| Nappali | Forrás | Körök | Idő | Költség | Bútor | Maradt hiba |
|---|---|---|---|---|---|---|
| ingatlan.com (Bíbor u.) | építő | 1 | 66 mp | 0,13 $ | 9 | 0 |
| Tesztlakás | építő | 1 | 63 mp | 0,14 $ | 9 | 0 |
- Az építő minőségileg jobb, mint a szabályalapú: beszélgetősarok (fotel ferdén az asztal felé), alacsony komód az ablak alá,
  kisasztal a kanapé mellett, a két ajtó közti átjáró szabadon hagyva (a tesztlakásban a szabályalapú itt elakadt).
- Drága és lassú a gondolkodó modell miatt (~0,13 $, ~1 perc / helyiség) → később mérni egy olcsóbb modellel vagy alacsonyabb gondolkodási szinttel.

### Tesztelési tanulság
- A böngészőpanel „find" eszköze ékezetes gombfeliratot nem mindig talál meg → szöveges (JS) kijelölés + kattintás.
- Hosszú (1–2 perces) műveletnél a JS-várakozás 45 mp után megszakad → rövid lekérdezések, közte `wait`.
