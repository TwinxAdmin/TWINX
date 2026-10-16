# 3D bejárás modul, 2. kör — elemzés (kiindulás a külön munkamenethez)

2026-10-16 · A brief: „TWINX – 3D bejárás modul, 2. kör: minőség, katalógus, szerkesztés, berendezés" (Márk).
Ez a lap összeveti a briefet a mostani kóddal: mi van kész, mi részben, mi új, hol ütközik a brief a meglévővel, és mit kell eldönteni.
Munkamenet elején: ezt + `tanulsagok.md` + `fotorealizmus-terv.md` olvasd el.

## 1. Mi van már meg (ráépíthető)

| Brief-pont | Mostani állapot | Hol |
|---|---|---|
| Bejárható link | kész: nyilvános /3d/<token>, lejárat, hosszabbítás, visszavonás | `shares.ts`, `app/(public)/3d/[token]` |
| Bejárás-érzet (ütközés, 1,6 m, kattintásra séta, W-A-S-D) | kész; a gyorsulás/lassulás csak kattintásos sétánál finom | `walk.ts`, `WalkthroughViewer.tsx` |
| Mini alaprajz, helyiségnév | kész | `WalkthroughViewer.tsx` |
| Osztott 2D + 3D szerkesztő, közös kijelölés, visszavonás | kész (geometriára) | `components/floorplan3d/editor/` |
| Nyílászáró-javítás, utólagos javítás érintett helyiségekkel | kész | `edit.ts`, `affectedRooms` |
| Anyagok a stíluslapból (japandi), CC0-textúrák | kész (Poly Haven, 1k) | `materials.ts`, `public/floorplan3d/textures` |
| Szabályalapú nappali-berendezés, közlekedőút-ellenőrzés | kész (csak nappali + „pár bútor") | `furniture.ts` |
| Videó csak külön gombra, `creditsVideo` | a gomb/díj megvan, a videó (F5) még nem készült | `config.ts` |
| Mintalakás + kameraút (automatikus túrához is) | kész — a mérőpad 5 nézőpontja ebből lehet | `demo.ts`, `intro/IntroWalkthrough.tsx` |
| Partner logója | a fiók márkabeállításaiban van logó | `app/dashboard/branding`, `api/branding` |
| Verziók | van általános munkaverzió-tábla (`work_versions`) — meg kell nézni, illik-e | `20261008081511_office-work-edit.sql` |

## 2. Ami új

- **Mérőpad páros összehasonlítással** (5 rögzített nézőpont képernyőképe; a kritikus párban dönt). Ma csak a geometriai mérőpad (`alaprajz-meropad`) van.
- **Fénybeégetés** (lightmap) a böngészőben, jóváhagyáskor + mentéskor újra; **6 / 4 kulcsállapot a napszak-csúszkához** → ez a kör legnagyobb műszaki kockázata (lásd 4.).
- **Utómunka** (AO, ragyogás, tónusgörbe), **részletek a JSON-ból** (lábazat, tok, káva, párkány, radiátor, konnektor/kapcsoló, lámpák), **HDRI-kilátás**.
- **Telefonos teljesítmény-szintek** (iPhone 11 / Galaxy A52 cél, automatikus visszalépés) + betöltési idő mérése.
- **Központi katalógus („bútorgyár")** adatszerkezettel, minőségkapuval, forrásnyilvántartással, elhelyezési adatokkal; jóváhagyó oldal kategóriánként.
- **Bejárás-funkciók:** koppintásra méret, napszak-csúszka, berendezett/üres, logó, joystick/nyílgombok, ugrás szobába, automatikus túra, első súgó.
- **Szerkesztés:** falszín, padló- és falburkolat, verziók + visszaállítás, ingyenes link-frissítés újraégetéssel.
- **Automatikus + kézi berendezés** minden helyiségre, rögzítéssel, „Másik változat", katalógus-panel, paraméterek.
- **Telefon/tablet egyszerű mód** + értesítés. **Tervező mód előkészítése** (adatszerkezet, másolat).

## 3. Ütközések a meglévővel (döntést igényel vagy jelzés)

1. **Bútorforrás:** a mostani katalógusban 7 Poly Haven CC0 bútormodell (fotel, dohányzóasztal, kisasztal, polc, komód, lámpa, növény) és egy
   fal.ai-jal generált kanapé van. A brief szerint a bútor **paraméteres, kódból**, a Poly Haven 3D-modell csak **növény / dekor**.
   → Javaslat: a meglévők ideiglenesen maradnak, és kategóriánként cserélődnek, ahogy az új elem jóváhagyást kap (a növény maradhat).
2. **„Prototípus-jelentés":** külön fájlként nincs a repóban. Forrásként a `tanulsagok.md` + `fotorealizmus-terv.md` szolgál (az utóbbi
   tartalmazza a „miért hat blokknak" elemzést) — ha van külön jelentés, kérem a helyét.
3. **Tájolás:** a FloorPlan-ban nincs északi irány → új, elhagyható mező kell (pl. `northDeg`), és felület a megadására (2D-ben egy iránytű).
   Ha nincs megadva: semleges napállás (a brief szerint így helyes).
4. **Munkamenet és ág:** a brief szerint külön munkamenetben, saját ágon fut. A mostani `main` munkakönyvtárban **nem commitolt** munka van
   (oktató bemutató, `demo.ts` mintalakás — a mérőpad erre épül, `fotorealizmus-terv.md`, ez a lap). Az új ág csak akkor látja, ha előbb commitolva van.
5. **Az ideiglenes előnézet** (`/dashboard/real-estate/floorplan-3d/bemutato`) törölhető, ha a bemutató jóváhagyott.

## 4. Kockázatok (előre jelezve)

- **Fénybeégetés böngészőben:** a three.js-ben nincs beépített lightmapper. Ingyenes út: nyílt forrású útkövető (pl. `three-gpu-pathtracer`, MIT)
  a partner gépén, helyiségenként; vagy egyszerűbb, gyors közelítés (AO-térkép + előre számolt szórt fény). 6 kulcsállapot × lakás → több perc és
  tárhely-igény (projektenként néhány MB, Supabase Storage). **Első lépésként mérni kell** (idő asztali gépen, minőség a mérőpadon), ahogy a brief kéri.
- **Napszak-csúszka telefonon:** 4 beégetett állapot átúsztatása = 4× textúra a memóriában → a telefonos keretet ehhez kell méretezni.
- **Új npm-függőség** (pl. útkövető, utómunka-csomag): nem 3D-modell és nem előfizetés, de új függőség — jóváhagyásra jelzem, mielőtt bekerül.
- **ambientCG:** az első használat előtt a licencoldal ellenőrzése (a brief szerint).
- **SQL:** verziók, burkolat/falszín a JSON-ban (nem kell SQL), beégetett fények tárolása, katalógus-tábla (vagy kódban tartott katalógus) —
  a migrációk Márknál futnak, tartalékággal.

## 5. Javasolt sorrend (a brief „menete" szerint, egymás után, mindegyik végén jelentés)

1. **Mérőpad:** a mintalakás 5 nézőpontja (a bemutató kameraútjából) + képernyőkép a link nézetéből + páros értékelés (kritikus) → alapállapot.
2. **Minőségi rangsor** (jóváhagyásra, mielőtt bármi épül) — javaslat a `fotorealizmus-terv.md` alapján:
   (1) utómunka + tónus · (2) részletek a JSON-ból · (3) HDRI-kilátás + napfény · (4) anyagok finomítása · (5) bejárás-érzet ·
   (6) fénybeégetés-prototípus mérése · (7) telefonos szintek. Minden lépés előtt–után mérőpad.
3–10. Katalógus-alapok → Kanapé → többi kategória → bejárás-funkciók → szerkesztő → berendezés → telefon/tablet → tervező-mód előkészítés.

## 6. Döntések az induláshoz (Márk, 2026-10-16)

1. A bemutató + mintalakás + tervek commitolva a `main`-re (push nélkül); a 2. kör ága erről indul.
2. Prototípus-jelentésnek a `tanulsagok.md` + `fotorealizmus-terv.md` számít.
3. A meglévő Poly Haven bútormodellek ideiglenesen maradnak; kategóriánként kerülnek ki, amikor az új saját elem jóváhagyást kap (a növény maradhat).
