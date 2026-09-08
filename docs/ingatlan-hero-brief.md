# /ingatlan hero — Higgsfield generálási lista („A — Filmes hero")

A landing tartalma nem változik, csak a hero kap egy filmes, sötét, természetes fényű
nappali-jelenetet, amin bronz–korall fényháló ül. A szöveg és a gomb a bal harmadon,
sötét maszkon áll — ezért a jelenet **jobb kétharmada** a hangsúlyos, a bal oldal
maradhat nyugodtabb (fal, árnyék).

## 1. Hero loop-videó (asztali nézet)

**Prompt (angolul, a Higgsfieldnek):**

> Cinematic real-estate film shot of a spacious, modern Hungarian city apartment
> living room in warm late-afternoon light. Large windows on the right, soft sun rays
> and gentle haze, natural oak floor, cream sofa, a few tasteful decor pieces, muted
> earth tones. Very slow, almost imperceptible camera push-in and slight drift to the
> right, no people, no text, no logos. Photorealistic, shallow depth, soft shadows,
> calm and premium mood. Colour grade: warm bronze and soft coral highlights on the
> walls and window light, deep charcoal shadows on the left third of the frame.

**Negatív / kerülendő:** emberek, feliratok, logók, gyors mozgás, éles fényvillanás,
túltelített narancs, tükröződő televízió, torz bútor.

**Paraméterek:**
- Arány: **16:9**, felbontás 1920×1080
- Hossz: **6–8 mp**, tökéletesen **loopolható** (az első és utolsó képkocka
  egyezzen, vagy „seamless loop" opció)
- Kameramozgás: a lehető legkisebb (slow push-in / drift)
- Hang: **nincs** (a lejátszó némán fut)

**Leadás:** `public/ingatlan/hero.mp4` — H.264, ≤ 4 MB (ha nagyobb, tömörítés
CRF 28-cal). Opcionálisan `public/ingatlan/hero.webm` is (VP9), kisebb fájl.

## 2. Poszterkép (a videó első képkockája / mobil)

Ugyanaz a jelenet **állóképként** — ezt látja a mobil, a takarékos mód és mindenki,
amíg a videó betölt. Legyen a videó nyitó képkockájával azonos beállítás.

- Arány 16:9, 1920×1080, JPEG, ≤ 300 KB
- Leadás: `public/ingatlan/hero-poster.jpg`

## 3. Mobil álló változat (opcionális, de érdemes)

Ugyanaz a nappali **álló** kivágásban, a fényes ablak felül, nyugodt alsó harmad
(oda kerül a szöveg).

- Arány **4:5**, 1080×1350, JPEG, ≤ 250 KB
- Leadás: `public/ingatlan/hero-mobile.jpg`

## Hova kerül, mi történik, ha még nincs meg

A `src/components/IngatlanHero.tsx` a fenti fájlneveket keresi. Amíg nincsenek meg,
a főoldal meglévő `design/hero-bg.jpg` háttere fut lassú Ken Burns-mozgással — tehát
az oldal a videó nélkül is kész, a fájlok bemásolása után magától vált át.
