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

## FEJLESZTÉS ALATT: **Prestige** (luxus) — csak localhost (`devOnly: true`)
- Fájl: `templates/prestige.ts`. Fekete + pezsgőarany, Cormorant Garamond (cím) + Jost.
- Felső arany ikonsor (ház, kulcs, térképjel, épület, „Eladó” tábla) — a landing `EstateIcons` rajzai.
- Áttűnés: **symbolZoom** — a sor egyik ikonja a kamera felé repül, a belsejében már a KÖVETKEZŐ fotó
  látszik („átlépés a következő szobába”, a felhasználó a B változatot választotta), majd visszaszalad a helyére.
  Kód: `transitions.ts` (`ESTATE_SYMBOLS`, `symbolZoomFrame`, `symbolMaskFrame`, `symbolSvg`),
  `render-node.ts` (`symbolFrames`, maszkos „belátás”: split → alphamerge → overlay), réteg: `kind: "symbol"`,
  lebegés: `appear: { type: "float" }`.
- Próbavideó elkészült (1:1, 36 mp). A felhasználó itt mondta: „innen folytatjuk”.

### Következő lépések (Prestige)
1. Visszajelzés a próbavideóra (áttűnés, ikonsor, nyitó/zárókép).
2. Render gyorsítása (sok teljes képernyős réteg: ~90 mp kódolás 1:1-ben; 9:16 a próbakörnyezetben >170 mp)
   — pl. rétegek összevonása / kisebb, kivágott overlay-ek.
3. Valódi betűk (Cormorant Garamond, Jost) ellenőrzése localhoston; 9:16 próba a Videólaborban.
4. Ha kész: `devOnly` kivétele → élesítés.

## Próba-script
`node scripts/video-engine-try.mjs <9:16|1:1> <aurora|nocturne|skandi|skandi-zsalya|prestige>`
(`TWINX_LONG=1` hosszú szövegek, `TWINX_NOPHOTO=1` ingatlanos-fotó nélkül, `FFMPEG_PATH` saját ffmpeg).
