# Saját TWINX videómotor — állapot és folytatás (2026-10-05)

Ez a jegyzet a következő munkamenet kiindulópontja. Git-ág: `twinx-video-motor`
(a `main`-be összefésülve élesedik; a felhasználó maga gitel).

## Élesben (twinx.hu)
- A partnerek videóit a **saját TWINX motor** készíti; a **Shotstack tartalék** (nincs törölve).
- Kapcsoló: **Admin → Videólabor → „Videógenerálás motorja”** (adatbázis: `app_settings.video_renderer`,
  SQL: `app-settings.sql`). Kód: `src/lib/video-renderer.ts`, `src/app/api/admin/video-engine/route.ts`.
- Partner útvonal: `src/app/api/real-estate/video/route.ts` → `postWithEngine()` (háttér-render `after()`-rel),
  státusz: `.../video/[id]/route.ts` (saját motor: 12 perces időkorlát + kredit-visszatérítés).
- Közös render-segéd (labor + partner): `src/lib/video-engine/job-node.ts` (`runEngineJob`).
- Vercel: `ffmpeg-static` a dependencies-ben, `next.config.ts` → outputFileTracingIncludes; maxDuration 300.

## Sablonok (`src/lib/video-engine/templates/`)
- **Aurora** (`aurora.ts`) — színvilág: Borostyán (alap), Éjkék (`nocturne`).
- **Skandi** (`skandi.ts`) — színvilág: Homok (alap), Zsálya (`skandi-zsalya`). Háztető-panel a nyitó/záróképen,
  egységes feliratdoboz (`captionCard` + `uniform`), 80 karakteres felirat (`captionMaxChars`).
- Nyilvántartás + szerkesztő-kártyák: `templates/index.ts` (`engineFamilies`, `FAMILY_NAMES`, `COLOR_NAMES`).
- Szerkesztő: `src/components/video/VideoWizard.tsx` (`EngineFamilyCard`, `EnginePreview`).

## **Prestige** (luxus) — ÉLESÍTVE 2026-10-06
- Fájl: `templates/prestige.ts`. Cormorant Garamond (cím) + Jost. Színvilág: Pezsgőarany (alap, fekete + arany),
  Grafit + platina (`prestige-grafit`, `PRESTIGE_VARIANTS`).
- Felső arany ikonsor (ház, kulcs, térképjel, épület, „Eladó” tábla) — dísz, a landing `EstateIcons` rajzai.
- Áttűnés: **filmBurn** — valódi filmburn klip Screen-keveréssel + saját hang fele hangerőn (`fxVolume: 0.5`).
  Klipek: `assets/video-fx/filmburn6-9x16.mp4`, `-1x1.mp4` (előkészítés: `scripts/video-fx-prepare.mjs`;
  a perforáció közepe a kép bal szélén). Motor: `render-node.ts` → `FX_CLIPS`, fekete effekt-sáv + `blend=screen`,
  hang: `amix` a zene alá. A vágás a klip legvilágosabb pillanatára esik (`cut: 0.52`).
- 9:16-ban nagyobb betűk (nyitó/zárókép) és nagyobb feliratkártya (`portraitScale/Width/Lines`).
- A szimbólumos „átlépés a következő szobába” áttűnés (`symbolZoom`) a motorban megmaradt, jelenleg nem használt.
- Figyelni: a Prestige renderje a leglassabb (sok réteg + Screen-keverés). Ha élesben időtúllépés van, gyorsítani kell.

## **Mozaik** (4. sablon) — ÉLESÍTVE 2026-10-06
- Fájl: `templates/mozaik.ts`. Outfit 800/600/400. Paletta: Márvány + terrakotta.
- Nyitókép a referencia alapján: márvány háttér (`marble` komponens), fehér keretes rombuszok
  (`mask: "diamond"`) — a legnagyobban az 1. fotó, a kisebbekben a 2–4. fotó; infó jobbra zárva
  (1:1: jobb oszlop, 9:16: alul). Animáció: valódi „pop" (`appear.type: "pop"`, back-out rugózás):
  főkép 0,2 mp → kisebbek 0,6/0,74/0,88 → cím 1,05 → ár 1,25 → kapcsolat 1,45.
- GALÉRIA (2. fotótól, jelenetenként 5,6 mp — EGÉSZ képkockaszám kell, különben a határon 1 kocka „villan”): márvány alap, jobbra NAGYBAN a soron következő fotó
  (csak ez mozog: lassú +5% nagyítás, `motion: zoomIn` → ffmpeg zoompan a dobozban), balra egymás alatt
  a többi fotó kicsiben, fehér kerettel (5 fotónál 4, 4 fotónál 3 kis kép — `forPhotoCount`).
- Áttűnés: **swap** — a következő fotó a kis helyéről nagyra nő, az előző nagy kép a megüresedett kis helyre
  zsugorodik. Motor: `swapSequences()` (render-node.ts) — egy előzetes ffmpeg-futás képkockánként vág/méretez,
  átlátszó PNG-sorozat. Az érkező kép a nagy kép szintjén, a távozó (leendő kis kép) VÉGIG legfelül.
  A kis képek oszlopa és a nagy kép nem fedik egymást (rés), így nincs takarás-váltás. ~1 mp/csere.
- Felirat: `paperNote` komponens (layers.ts) — szakadt szélű vászonpapír-csík, Shantell Sans 500 (enyhén
  kézírásos, Google Fonts), a kis képek és a nagy kép között. 9:16: alul, szinte teljes szélességben,
  ~30 karakter/sor × 3 sor; 1:1: a nagy kép alján, ~26 karakter/sor × 4 sor → a 80 karakteres limit kitölti.
  Csere előtt elhalványul (`hideBeforeEnd`, a motor új támogatása).
- Render (5 fotó): 9:16 ~29 mp, 1:1 ~18 mp. Nyitó→galéria és galéria→zárókép: fehér softDip.

## Teljesítmény (élesítési felülvizsgálat, 2026-10-06)
Vercel: 1 vCPU, 2 GB, legfeljebb 300 mp/videó. Mérés egy maggal, hideg gyorsítótárral, 9:16:
Aurora 121 → 29 mp, Zsálya 133 → 31 mp, Prestige >170 (és memóriahiány) → 45 mp; csúcsmemória ~0,7 GB.
- Rétegek: egyszer beolvasva, a tartalmuk dobozára vágva (`png-bbox.ts`) + `loop` szűrő.
- Háttérfotók: egyszer betöltve + `loop`; zoom 4×-es belső felbontás (remegésmentes, olcsó).
- Áttűnések: ELŐRE GYÁRTVA `assets/video-transitions/*.apng` (`scripts/video-transitions-prepare.mjs`).
  **Ha sablon/szín/áttűnés változik vagy új sablon jön: futtasd újra a scriptet** (a hiányzót rajzolja meg).
- Filmburn: 2 menet — fő videó kulcskockákkal, majd csak az effekt-ablakok pontos Screen-keverése,
  a köztes részek átkódolás nélkül fűzve (`applyFxWindows`).
- Ingatlanos fotó/logó: szerveren letöltve + PNG-re alakítva (`prepareImage`, sharp); hiba esetén kimarad.
- Betűk: családonként Google (8 mp időkorlát) → tartalék a projekt saját betűiből.
- Diagnosztika: kész videónál `video_jobs.meta.engine` (időzítések); szerver-napló `[video/twinx <job>]`.
- Időtúllépés: 7 perc után a job hibás, a kredit visszajár.

## Próba-script
`node scripts/video-engine-try.mjs <9:16|1:1> <aurora|nocturne|skandi|skandi-zsalya|prestige>`
(`TWINX_LONG=1` hosszú szövegek, `TWINX_NOPHOTO=1` ingatlanos-fotó nélkül, `FFMPEG_PATH` saját ffmpeg).

### Mozaik szerkesztő-előnézet
A sablonkártya képe a VALÓDI motor nyitóképe: `public/video-previews/mozaik-9x16.jpg`
(a motor nyitóképe a többi kártyával egyező lakás-ábrával — public/video-samples/aurora-hero.jpg — minden rombuszban, minta-adatokkal; 432×768). Ha a nyitókép változik, ezt újra kell gyártani.

## Szerkesztő — sablonválasztó ablak (2026-10-06)
- A sablonlista görgethető, alatta FIX sáv: méret (egy vagy KÉT méret is kijelölhető), szűrő
  (Összes sablon / ★ Kedvencek), kredit-tájékoztató (méretenként `VIDEO_CREDITS_ALAP` = 3 kredit; 2 méret = 6).
- Két méretnél a kliens méretenként külön jobot indít ugyanazokkal a fotókkal (két külön kreditlevonás,
  két külön videó az előzményekben); a Generálás lépés méretenként mutatja az állapotot, a sikertelen
  méret külön újraindítható.
- Kedvencek: csillag a kártya bal felső sarkában → `video_template_favorites` tábla (`video-favorites.sql`),
  API: `src/app/api/real-estate/video/favorites/route.ts`. Ha a tábla hiányzik, a szerkesztő kedvencek nélkül működik.

## **Polaroid** (5. sablon; korábbi munkanév: Pakli) — FEJLESZTÉS ALATT (`devOnly`, csak localhost)
- Fájl: `templates/polaroid.ts` (id: `polaroid`). Telt háttér: Bíborpiros (alap) / Drámai kék (`polaroid-kek`).
- Betű: Liberation Sans (OFL, a repóban: `assets/fonts/video/`) — Helvetica-jellegű, szoros betűköz (a referencia betűképe).
- Fent végig a fő infó: kis típus-felirat · nagy félkövér cím (balra) · település jobbra zárva · ár kiemelő sávval.
  A nyitón egymás után, lendületesen úsznak be (`appear: "rise"`), a sáv balról kihúzódik (`appear: "wipe"`,
  `hlText` komponens: a sáv a szöveg szélességéhez igazodik). Lent a fotó szövege, szintén „rise”.
- (Az írógépes `typeStack` / `typewriter` a motorban megmaradt, a Pakli már nem használja — lassú volt.)
- Képváltás: a pakli tetejéről a szél LEFÚJJA a legfelső képet (`blow` a rétegen → forgás + gyorsuló sodródás, `kind: "blow"`).
- Zárókép: a legalsó lap üres papír, rajta gépelve az elérhetőség (sötét tinta), alatta a logó.
- Előnézet: `scripts/video-polaroid-preview.mjs` → `public/video-previews/polaroid*-9x16.jpg`.
- „Régi film” hatás: `look` a sablonon (render-node.ts → `filmLookChain`): fakó-meleg tónus (görbék),
  enyhe fényvibrálás, sötétedő szélek, mozgó filmszemcse (csak fényességen). Az előnézet is ezt kapja.
- Render (5 fotó): 9:16 ~45 mp, 1:1 ~26 mp (a szemcse miatt lassabb a kódolás; Vercelen ~1,5–2×).
- Mozgó díszek (2026-10-06): forgó „✳” jelvény (jobb felső sarok + záró lap), kihúzódó vonal a település előtt,
  csillogó csillagok az ár mellett, forgó csillag-jel a felirat előtt. Motor: `spin` / `pulse` a rétegen,
  `sparkle` komponens (badge | star4 | asterisk) — abszolút időt követnek, jelenetváltáskor nem ugranak.
- VILLANÁS-JAVÍTÁS (motor, minden sablon): az overlay-ablakok 2 ms-mal korábban kezdődnek (`ew()` a render-node-ban).
  A 14.8 / 19.6 mp-es jelenethatár képkockaideje lebegőpontosan 14.7999… volt → egy képkockára minden réteg eltűnt.

### Mozaik — második színvilág (2026-10-06)
- `mozaik-smaragd` (Smaragd + arany): sötétzöld márvány háttér, arany cím/ár, krém szöveg (`MOZAIK_VARIANTS`).
  A márvány sötét alapon halványabb fényfoltot és erezetet kap (layers.ts `marble`). Áttűnések előgyártva.
- Előnézetek: `scripts/video-mozaik-preview.mjs` → `public/video-previews/mozaik*-9x16.jpg` (a kártya a színvilág képét mutatja).
