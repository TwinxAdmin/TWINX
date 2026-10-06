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
