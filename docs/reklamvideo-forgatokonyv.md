# TWINX 30 mp-es reklámvideó — forgatókönyv és gyártási terv

Állapot: **TESZT-KÖR LEZÁRVA (2026-09-09) — a történet és a recept elmentve, a gyártás
később, profibb kivitelben indul újra.** A klipek megvannak és megnézhetők a Higgsfield
galériában; a partner észrevételei alapján valószínűleg a KÉPEKTŐL kezdjük újra.

**Mit tanultunk a teszt-körből (ez a lényeg a következő menethez):**
- A recept működik: karakter- és helyszín-biblia állóképként → azok referenciaként MINDEN
  videó-blokkhoz → kevés, hosszú blokk. Anna arca és az iroda 4 klipen át azonos maradt.
- A Seedance 2.5 „Plus" előfizetést kér; a **MiniMax H3** viszont elérhető, 2560×1440-et ad,
  ~2 kredit/mp, és jól tartja az identitást. Egyszerre csak 1–2 job fusson (429 rate_limit).
- A feliratot NEM utómunkában érdemes rátenni: üres tábla-kép → feliratos kép (nano_banana,
  jó ékezetekkel) → videó `start_image`/`end_image` párral, közte madárraj mint „lapozás".
- A laptop képernyőjét végig elfordítva tartani — így nincs mit elrontani, és a történet
  a „kész" érzésről szól, nem a UI-ról.

**Ami a teszt-körből hiányzik (a következő menetben):** pipák a B blokkban (utómunka),
D logó-záró, színkorrekció a blokkok között, narráció + zene.

> Modell-váltás: a Seedance 2.5 a Higgsfield „starter" csomagon nem elérhető (Plus kell), és
> 52–72 kredit/8 mp lett volna. Helyette **MiniMax H3** (`minimax_h3`, `image_references`,
> 2560×1440, ~2 kredit/mp) — az identitást és az irodát meglepően jól tartotta.
> Tanulság: a MiniMax-nál egy időben csak 1–2 generálás fut (429 rate_limit), a karakter
> nélküli tábla-snitt `image_references`-szel kétszer elhalt, `start_image` szereppel ment.

## 0. Kész klipek (2560×1440, néma)

| Blokk | Hossz | Job | URL |
|---|---|---|---|
| A — Lassúság | 8 mp | `af9f2b56-c96a-41be-bf68-98ef9065d4d2` | hf_20260909_065718_af9f2b56-….mp4 |
| A2 — Tábla, ELVETVE (földszinti, üres) | 5 mp | `ce2019af-4399-4d82-968a-1c1ea4f0d684` | hf_20260909_072205_ce2019af-….mp4 |
| **A2 v2 — Tábla emeleti nézetből, madárraj, felirat a végén** | 5,2 mp | `91d751f1-2ee7-42be-b9c2-d7b00dca3cfd` | hf_20260909_073557_91d751f1-….mp4 |
| B — Felgyorsulás | 10 mp | `6dbbaa6e-93a9-4774-9d8b-c1c2e35216d1` | hf_20260909_070747_6dbbaa6e-….mp4 |
| C — Nyereség | 6,6 mp | `b011af93-637a-46ba-b7be-697275d92bac` | hf_20260909_071821_b011af93-….mp4 |

Teljes URL-előtag: `https://d8j0ntlcm91z4.cloudfront.net/user_2wwbPOUq0dc6bdbEhMfJSavUm0D/`
Kreditköltség: ~70 (A 16, A2 10, B 20, C 12, A2 v2 10 + 3 kép).

A2 v2 receptje (a felirat NEM utómunka): 1) üres tábla-kép emeleti nézetből, a tábla egy
magas irodaház tetején — job `c2410611-a701-4c8a-bda2-6bccfd628e96` (cinematic_studio_2_5);
2) ugyanez a kép a felirattal — job `59650d90-2e8b-4d59-a478-4ebfd8a8a6bd` (nano_banana,
ref: az üres; „TWINX" + korall vonal + „Felgyorsítjuk az ingatlanosok munkáját.", ékezetek OK);
3) minimax_h3 `start_image` = üres, `end_image` = feliratos, prompt: madárraj söpör át,
mögötte előtűnik a felirat. Vágásban a klip vége (feliratos tábla) még 1 mp-ig kitartható. Narráció és zene: a partner vágja alá utólag.

## 1. A történet egy mondatban

Anna, az ingatlanos, reggel a lassú, kézi munkával küzd; kinéz az ablakon, meglát egy
TWINX hirdetőtáblát, leül a laptop elé, és amit eddig egy este volt, most pár perc alatt
elvégzi — a pipák sorban felvillannak mellette —, majd becsukja a laptopot, és kilép a
napfénybe. Zárás: TWINX logó + slogan.

Érzelmi mag: **visszakapott idő**. Nem felsorolás, nem szájbarágás. A szolgáltatások nem
látszanak konkrétan (nincs képernyő-tartalom) — a „kész" érzés és a tempó adja át őket.

## 2. Idővonal (30 mp)

| Idő | Blokk | Mi történik | Forrás |
|---|---|---|---|
| 0–8 | **A — Lassúság** | Kora reggeli iroda, Anna a laptop előtt, kihűlt kávé, papírok. Lassú kamera. Hátradől, a feje az ablak felé fordul, a tekintete megáll valamin. | Seedance, 1 generálás (8 mp) |
| 8–11 | **A2 — A tábla (Anna nézőpontja)** | KÜLÖN snitt, karakter nélkül: az iroda ablakán át a szemközti ház, a tetőn egy nagy, ÜRES hirdetőtábla, lassú közelítés, halvány tükröződés az üvegen. A TWINX-feliratot mi tesszük rá. Vágás vissza Annára: apró bólintás (a B blokk eleje). | Seedance, 1 generálás (3–4 mp) |
| 11–22 | **B — A felgyorsulás** | Anna visszafordul, egyenesen leül, a keze a billentyűzetre kerül; tartás megváltozik: lendületes, koncentrált. A fény melegebb. Kamera lassan közelít. A pipák (✓) a képtérben, a feje mellett úsznak be — UTÓMUNKA. | Seedance, 1 generálás (10–11 mp) |
| 22–27 | **C — A nyereség** | Anna becsukja a laptopot, feláll, a kulcsot felveszi az asztalról, félmosoly, kilép a napfényes ajtón. Ugyanaz az iroda. | Seedance, 1 generálás (5–6 mp) |
| 27–30 | **D — Zárás** | Sötét bronz–korall háttér, TWINX logó, slogan, twinx.hu/ingatlan, „Havidíj nélkül." | Saját grafika |

Összesen 4 Seedance-generálás (A, A2, B, C) — az A2 rövid és karakter nélküli, ezért olcsó és biztonságos. A blokkok a Seedance `omni_reference` módjában
készülnek, ugyanazokkal a referencia-képekkel → ugyanaz az arc, ugyanaz az iroda.

## 3. Karakter-biblia (Anna) — ELŐSZÖR ezt gyártjuk, állóképként

Ezeket a képeket lezárjuk, és MINDEN videó-generálás `image_references`-ként megkapja.
Cél: 3 kép, ugyanaz a személy, ugyanaz a ruha.

Rögzített leírás (minden promptban SZÓ SZERINT ugyanígy):

> Anna, a Hungarian woman in her late thirties, warm brown eyes, loose shoulder-length dark
> brown hair, natural light makeup, small gold stud earrings, wearing a navy blazer over a
> white blouse, dark slim trousers. Calm, intelligent face; realistic skin texture.

(A haj a portré alapján KIENGEDVE — a leírást a képhez igazítottuk, nem fordítva.)

Képek (cinematic_studio_2_5 vagy nano_banana_2, 3:2, fotórealisztikus):

1. **Portré, szemből** — job `6018f061-8761-4795-8405-80edfe57b196` (cinematic_studio_2_5) ✅
2. **Félprofil az ablak felé** — job `bd712e15-4f42-40cc-8a3e-793bf30859ef` (nano_banana, ref: portré) ✅
3. **Egész alakos az asztalnál** — job `94bcc802-2495-4548-8eb8-48aebe8d0a43` (nano_banana, ref: portré) ✅

Negatív: no text, no watermark, no second person, no sunglasses, no hat.

## 4. Helyszín-biblia (az iroda) — 2 állókép, szintén minden generáláshoz

Rögzített leírás (szó szerint minden promptban):

> A small modern real-estate office in Budapest: a light oak desk by a large window,
> a silver laptop, a white ceramic mug, a stack of papers, a small green plant, a brass desk
> lamp; pale grey walls, warm morning side-light from the window; across the street, the
> facade of a classic Budapest apartment building with a large blank billboard on its roof.

Képek:

1. **Az asztal az ablak felől**, üres szék — job `e3734169-9623-45a9-9082-3190a329fbf2` ✅
2. **Kilátás az ablakból** az ÜRES hirdetőtáblára — job `b78d357a-b667-4afa-bf25-e2384c0fe9c8` ✅
   (a tábla egy alacsony épület tetején, nagy, tiszta felület — a feliratnak ideális)

## 5. Videó-promptok (Seedance 2.5, `omni_reference`, 16:9, generate_audio: false)

Mindhárom promptban benne van a karakter- és a helyszín-leírás változatlanul; a
`image_references` mezőben a 3 Anna-kép + a 2 iroda-kép megy.

### A blokk — 8 mp — „Lassúság"

> Cinematic commercial, photorealistic, 35mm lens, shallow depth of field, warm early-morning
> light. [KARAKTER-LEÍRÁS] [HELYSZÍN-LEÍRÁS]
> 0–4s: slow dolly-in from behind Anna's shoulder; she sits at the desk, the laptop lid angled
> away from the camera (screen not visible), shoulders slightly slumped, rubbing her temple, the
> coffee untouched. 4–8s: cut to a close side profile at eye level; she sighs, leans back in the
> chair and slowly turns her head toward the window on the right; her eyes settle on something
> outside and hold there; soft window light on her face. No pan to the window — stay on her face.
> Continuous natural motion, no text, no logos, no other people, no visible screen content.

### A2 snitt — 3–4 mp — „A tábla" (Anna nézőpontja, karakter nélkül)

> Cinematic commercial, photorealistic, 35mm lens, warm early-morning light.
> Point-of-view shot from inside a small modern office, looking out through a large window:
> across the street the facade of a classic Budapest apartment building, and on its rooftop a large
> blank billboard with a smooth matte light surface, softly lit by the morning sun. Slow, gentle
> push-in toward the billboard; faint reflections of the office on the window glass; a few leaves
> of a plant blurred in the foreground edge. No people, no text, no logos, static building, calm.

(Ide kerül utómunkában a „TWINX — A lassú részt intézzük." felirat, perspektívába illesztve.)

### B blokk — 10 mp — „A felgyorsulás"

> Cinematic commercial, photorealistic, 35mm lens, warm morning light growing slightly brighter.
> [KARAKTER-LEÍRÁS] [HELYSZÍN-LEÍRÁS]
> 0–2s: Anna, still looking toward the window, gives a small nod, then turns back to the desk,
> sits up straight, pulls the chair in, a small determined breath. 2–10s: medium shot from the front-left, the laptop lid angled away from the camera; she types
> and clicks with quick, confident movements, occasionally glancing up with a faint smile; the camera
> pushes in slowly; keep generous empty space on the right side of the frame above the desk.
> Energetic but natural, no exaggerated gestures, no text, no visible screen content, no other people.

(A jobb oldali üres tér a pipáknak kell — utómunka.)

### C blokk — 6 mp — „A nyereség"

> Cinematic commercial, photorealistic, 35mm lens, bright late-morning sunlight through the window.
> [KARAKTER-LEÍRÁS] [HELYSZÍN-LEÍRÁS]
> 0–2s: Anna gently closes the laptop lid with one hand. 2–4s: she stands, picks up a small set of keys
> from the desk, a relaxed half-smile. 4–6s: she walks toward the office door where sunlight spills in,
> the camera stays on the desk in the foreground with the closed laptop and the steaming mug as she exits
> the frame. No text, no other people, calm and warm.

## 6. Utómunka (nem AI)

- **Hirdetőtábla felirat** az A2 snitten (8–11 mp): „TWINX — A lassú részt intézzük." a márka
  bronz–korall világában, perspektívába illesztve, enyhe fény-visszaverődéssel.
- **Pipák** a B blokkban: 5–6 korall ✓ jel, ütemre beúszva Anna mellett a jobb oldali üres térbe,
  esetleg egy-egy szóval alattuk (kép · videó · értékbecslés · szöveg) — opcionális.
- **D blokk**: logó-záró 3 mp, a landing hero színvilágával.
- Színkorrekció, hogy a 3 blokk fénye egységes legyen; narráció + zene a partner vágja.

## 7. Promptírás — szabályok a Seedance-hez

1. **Filmes leírás, nem kulcsszavak**: kamera (lencse, mozgás), fény, hangulat, EGY cselekvés-ív.
2. **Időbeli lefolyás explicit** (0–4s, 4–7s…), így a modell nem „kapkod".
3. **Karakter és helyszín szövege minden promptban szó szerint azonos** — ez a konzisztencia
   kulcsa a referencia-képek mellett.
4. **Tiltólista minden promptban**: no text, no logos, no other people, no visible screen content,
   no mirrors, no fast camera moves, no close-ups of typing hands.
5. **A laptop képernyője mindig elfordítva** — így nincs mit „kitalálnia" a modellnek.
6. **generate_audio: false** (a hang a partneré), **720p tesztgenerálás** blokkonként, majd a
   jóváhagyott prompttal **1080p, bitrate_mode: high** a végleges.
7. Minden generálás előtt `get_cost` előszámítás; a szükséges kreditet a partner hagyja jóvá.

## 8. Gyártási sorrend

1. Anna 3 képe → jóváhagyás (arc, ruha) — ha nem tetszik, itt cseréljük, olcsón.
2. Iroda 2 képe → jóváhagyás.
3. A blokk 720p próba → ha jó, 1080p.
4. A2 (tábla, karakter nélkül), majd B, C blokk ugyanígy.
5. Utómunka + D blokk, majd a partner narráció/zene.
