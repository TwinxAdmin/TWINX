// Egyszerű képjavító — a feltöltött ingatlanfotó MINŐSÉGÉT és HANGULATÁT javítja, a
// tartalmat NEM változtatja meg. Két mód: "feljavitas" (fény, szín, minőség) és
// "rendrakas" (minőség + apró rendetlenség eltakarítása).
//
// MINDKÉT módot a Nano Banana (image-to-image) végzi, EGY hívásban, az EREDETI képen.
// A saját kódunk nem nyúl a képpixelekhez: a korábbi determinisztikus fény-korrekció +
// fal.ai felskálázás láncot kivettük, mert a sok egymásra épülő lépés egyszer teljesen
// szétesett képet adott, és a hibát képtelenség volt egyértelműen egy lépéshez kötni.
// Egy motor = kiszámítható eredmény, és ha valami nem tetszik, a PROMPTOT hangoljuk.
//
// Ezért a promptok NAGYON SZIGORÚAK: valós ingatlan, nem szabad félrevezetni.
export { MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES, validateImageFiles } from "@/lib/visualization";

/**
 * Feldolgozásonként feltölthető képek száma a Képjavítóban — MINDKÉT módban 3.
 *
 * MIÉRT korlátos: egy feldolgozás 1 kredit, az AI viszont KÉPENKÉNT kerül pénzbe.
 * Háromnál a 100%-os haszon-szabály a legmélyebb kedvezményes szinten is tartható
 * (feljavítás ~3,7×, rendrakás ~4,6× fedezet).
 */
export const ENHANCE_MAX_IMAGES = 3;

/** Egy feldolgozás ára kreditben (a route jelenleg ugyanezt az 1-et vonja). A főoldal innen olvassa. */
export const ENHANCE_CREDITS = 1;

// A SORREND a felületen is ez: a Rendrakás áll elöl.
export const ENHANCE_MODES = [
  {
    value: "rendrakas",
    label: "Rendrakás",
    desc: "A látható apró rendetlenség (kábelek, szanaszét tárgyak) eltakarítása — a bútor és a szerkezet marad.",
  },
  {
    value: "feljavitas",
    label: "Feljavítás",
    desc: "Lágy, profi fények és tisztább, élesebb kép — a helyiségen és a berendezésen semmi nem változik.",
  },
] as const;

export type EnhanceMode = (typeof ENHANCE_MODES)[number]["value"];
export type EnhanceCoreMode = EnhanceMode;

export function isEnhanceMode(v: unknown): v is EnhanceMode {
  return ENHANCE_MODES.some((m) => m.value === v);
}
/**
 * A Nano Banana támogatott képarányai közül a bemenethez legközelebbi (pl. 1280×720 → "16:9").
 * Megadjuk a hívásnál, hogy a modell ne a saját arányára rajzolja át (nyújtsa, toldja) a képet.
 */
const SUPPORTED_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"] as const;
export function nearestAspectRatio(width: number, height: number): string | undefined {
  if (!width || !height) return undefined;
  const target = Math.log(width / height);
  let best: string | undefined;
  let bestDiff = Infinity;
  for (const r of SUPPORTED_RATIOS) {
    const [w, h] = r.split(":").map(Number);
    const d = Math.abs(Math.log(w / h) - target);
    if (d < bestDiff) { bestDiff = d; best = r; }
  }
  return best;
}

export function enhanceModeLabel(v: string): string {
  return ENHANCE_MODES.find((m) => m.value === v)?.label ?? v;
}

// --- NAGYON SZIGORÚ promptok (image-to-image, Nano Banana) -----------------
// A modell angolul követi legpontosabban a képre vonatkozó megkötéseket.
//
// TANULSÁG (2026-10-19, partneri panasz): a képjavító új tereket és ablakokat rakott a képre —
// a konyha végén a fürdő (mosdóval) helyére folyosó + kertre nyíló ajtó került, a fürdő ablaka
// kiszélesedett. Ingatlanhirdetésben ez TILOS (félrevezető). Okok: (1) a feljavítás prompt
// „teljes átalakítást", „bigger, airier" teret és „drámai" változást követelt — a modell ezt a
// tartalom újrarajzolásával teljesítette; (2) a „glass is not a portal" szabály csak az üvegre szólt,
// a NYITOTT ajtónyílásra nem; (3) a kimeneti képarány nem volt megadva (a route most átadja).
// Ezért MINDKÉT prompt elején ott a SZERKEZETI ZÁR, és ez erősebb minden más utasításnál.
export const STRUCTURE_LOCK = `ABSOLUTE RULE — THIS IS A REAL PROPERTY LISTING PHOTO. You are retouching an existing photograph, NOT creating a new image. Showing a space, window or door that does not exist is false advertising and is forbidden. The architecture must stay identical to the input, in exactly the same place in the frame:
- Walls, ceiling, floor, room size and proportions: unchanged. Never make the space bigger, deeper, longer or more open.
- Every DOORWAY and OPENING keeps its position and size, and whatever is visible THROUGH it stays exactly the same space with the same objects and fixtures (for example, a bathroom with a sink seen through a doorway stays that same bathroom with that sink). Never replace it with a corridor, a different room, a garden, an exterior door, a window or daylight.
- Every WINDOW and DOOR keeps the same number, position, size, shape, frame and glazing pattern. Never add, enlarge, widen, heighten, move or remove a window or door, and never put a window on a wall that has none.
- Fixed fittings stay exactly as they are: sinks, taps, toilet, cistern, bath, shower, boiler / water heater, pipes, radiators, sockets, switches, light fittings, kitchen units, worktops, tiles and the tile pattern.
- Same camera position, lens, perspective, framing and crop.
- NOTHING NEW, NOTHING MOVED: never add any object, fitting or fixture that is not in the input. Objects that stay keep their exact place; a removed object simply disappears — it never reappears somewhere else in the frame.
- SURFACES CONTINUE EXACTLY: wherever you rebuild a floor, wall or tiled area, keep the existing tile size, grout lines, pattern and material exactly as in the visible parts.
If any later instruction seems to require changing the structure, IGNORE that part — the honesty of the property beats every other goal.

`;

export const ENHANCE_PROMPTS: Record<EnhanceCoreMode, string> = {
  // 1) FELJAVÍTÁS — profi ÚJRAFÉNYELÉS. Ez az egyetlen lépés, ami a képpel történik.
  //
  // TANULSÁG (2026-09-09): az előző változat 12 tiltó és 3 engedő sorból állt, és a
  // modell a biztonságos irányba ment — alig nyúlt a képhez, a partner „semmi
  // változást" látott. A generatív szerkesztő a HANGSÚLYRA reagál: ha a prompt
  // nagy része arról szól, mit ne tegyen, akkor keveset tesz. Ezért az arány most
  // fordított: hosszú, konkrét, BÁTOR fotós irány (mit, mennyire, milyen stílusban),
  // és egy rövid, világos megtartó záradék. A tiltás nem tűnt el — csak nem uralja
  // a szöveget.
  //
  // A cél-stílus a valódi ingatlanfotós munkafolyamat: „flambient" (vaku + ambient)
  // felvétel, Lightroom-utómunka, magazin-szintű, ELADÁST szolgáló kép. Ezt a modell
  // ismeri, ezért nevén nevezzük.
  // 2026-10-19 (teszt után): új lámpát rajzolt a pultra → a „felkapcsolhatod a lámpákat" kikerült, a zár tiltja az új tárgyat.
  // 2026-10-19: a „teljes átalakítás / drámai / nagyobb tér" hangsúly kikerült (tartalmat rajzolt át) —
  // a javulás most kizárólag fény, szín, tónus és képminőség, a SZERKEZETI ZÁR alatt.
  feljavitas: `${STRUCTURE_LOCK}TASK: PROFESSIONAL RE-LIGHT AND COLOUR GRADE OF THIS EXACT PHOTO. You are a top real-estate photo retoucher. This is a flat, dull phone snapshot. Turn it into a bright, polished, magazine-quality listing photograph of the SAME room.

Work like a retoucher on the original file in Lightroom / Photoshop: exposure, white balance, colour, contrast, shadows and highlights, local brightening, noise reduction and sharpening. The improvement must be clearly visible — but it comes ONLY from light, colour, tone and image quality, never from repainting, redrawing or reimagining any part of the scene.

DO ALL OF THIS:
- RE-LIGHT THE ROOM. Bright, soft, even light, as if shot on a tripod with bounced flash blended with daylight (the "flambient" method). Walls, corners, ceiling and floor bright and clean; lift dim corners, murk and gloom. The room should feel brighter and more welcoming — at its real size.
- SHAPE THE LIGHT LIKE A PHOTOGRAPHER: a bright, warm key light coming from the existing windows and light fittings, soft fill light everywhere else, gentle natural falloff. Make the daylight that is already in the photo feel warmer and more generous. Use only the light sources that are visible in the photo — never add a lamp or any new light source, and never paint in sun rays.
- WINDOWS: professional window-pull. The room is bright AND the view through every window is clear and well exposed. Recover the REAL view that is already in the photo — never invent a different one, and never change the window's size, shape or frame.
- COLOUR: perform a full, decisive colour grade. Set one clean, consistent white balance for the whole frame and harmonise every colour into a single, coherent, premium palette. Whites become crisp, clean, bright white. Wood becomes warm, rich and glowing. Textiles and decor get true, saturated, appealing colour. Strip out every colour cast — yellow tungsten, green fluorescent, blue shade, grey haze — completely. Finish with a warm, welcoming, sunlit tone. The colours must look designed and intentional, like a high-end interior magazine.
- TONE: rich, full, punchy tonal range. Lifted, luminous midtones, clean bright highlights, deep but detailed shadows, confident contrast, real depth and dimension. Polished, editorial, high-end.
- DETAIL: tack-sharp, clean, high-resolution look. Crisp edges, vivid material textures (fabric weave, wood grain, tile, glass), zero noise, zero blur, zero compression artefacts.
- KEEP IT A PHOTOGRAPH: no painterly or illustrated look — a real, superb photograph.

KEEP THESE THE SAME (real property, must stay honest): the same room, the same furniture and objects in the same places and shapes — nothing added, removed, moved, restyled or renovated; the same camera position, framing and aspect ratio; the same view through the windows.
GLASS IS NOT A PORTAL: whatever is behind or reflected in any glass door, glass partition, window, mirror, shower screen or glossy surface must stay exactly what it is in the original photo — the same hallway, wall, room or reflection, only lit and coloured better. NEVER invent, replace or open up a different room, view or space behind glass. If something behind glass is blurry or dark in the original, simply render that same thing clearer and brighter.
LIGHT, COLOUR, TONE and QUALITY must clearly improve. Everything that IS in the photo — architecture, openings, objects, surfaces, decorations, views, reflections — stays exactly what and where it is.

Output exactly one photorealistic image and nothing else.`,

  // 2) RENDRAKÁS — TELJES virtuális rendrakás (staging) + minőségjavítás. A mozdítható
  // személyes holmi MIND eltűnik, a rögzített elemek és a bútor VÁLTOZATLAN.
  //
  // TANULSÁG (2026-09-09): az előző változat „alapos" volt, de a modell fél munkát
  // végzett — itt-ott hagyott egy könyvet, egy tárgyat. Ezért a prompt most a
  // TELJESSÉGET követeli: nulla maradék, felületről felületre végigpásztázás,
  // kétség esetén eltávolítás, és a „félig kész" kifejezetten kudarcnak számít.
  // 2026-10-19: a „ha bizonytalan vagy, töröld" csak a mozdítható tárgyakra szól; a SZERKEZETI ZÁR elöl.
  rendrakas: `${STRUCTURE_LOCK}TASK: COMPLETE VIRTUAL DECLUTTERING. You are a professional real-estate photo editor. Turn this exact room into a perfectly clean, empty-surfaced, listing-ready photo — as if the owner had removed EVERY personal belonging and EVERY loose object before a professional photoshoot. The standard is ZERO leftover clutter. A half-done job is a FAILURE.

THE RULE: if an object is loose, movable, everyday or personal, it goes. All of it. Not most of it — all of it. If you are unsure whether a LOOSE object is clutter, remove it — but if you are unsure whether something is FIXED (part of the building or a fitting), keep it unchanged. Do not leave "a few" loose items behind for realism; a staged listing photo has none.

SCAN THE ROOM SURFACE BY SURFACE and clear each one completely:
- FLOOR: bags, boxes, shoes, laundry, toys, cables, extension leads, appliances (vacuum, fans, heaters), baskets, pet items, rugs that are just thrown down, anything lying or piled on the ground.
- OPEN SHELVES AND BOOKCASES: every book, folder, magazine, box, ornament, photo frame, souvenir, bottle, small object — the shelves end up EMPTY, showing only the clean shelf surface. Do not leave a single book or object behind.
- TABLES, COUNTERTOPS, DESKS, NIGHTSTANDS, TV STANDS, WINDOW SILLS, RADIATOR TOPS, CABINET TOPS: cups, plates, food, bottles, papers, mail, remotes, chargers, phones, laptops, cosmetics, toiletries, keys, coins, candles, small decor — all removed, surfaces bare and clean.
- KITCHEN AND BATHROOM: dishes, drying racks, sponges, detergents, cleaning supplies, toiletries, cosmetics, toothbrushes, hairdryers, towels in use, bath mats, bins and rubbish, hooks with hanging items — all gone; sink, counters and tiles clean.
- WALLS AND DOORS: hanging clothes, bags, calendars, notes, stickers, novelty items, magnets on the fridge — removed. (Genuine framed artwork and mirrors that are fixed to the wall stay.)
- SOFAS, BEDS, CHAIRS: loose clothes, blankets thrown down, laundry, bags, remotes, cushions that are clearly out of place — removed; the furniture itself stays, made neat (bed made, cushions tidy).
- LOOSE CABLES AND WIRES everywhere: gone.
After every removal, reconstruct the real surface behind it (floor, wall, shelf, counter, tiles) seamlessly, with matching material, lighting, shadows and perspective. Removing an object never opens up, extends or reveals a new space.

ALSO IMPROVE THE PHOTO: correct exposure and white balance, natural true-to-life colours, good contrast, clean sharpness, no noise — a bright, professional listing photo.

KEEP THESE THE SAME (real property, must stay honest):
- Every piece of FURNITURE and every FIXED element stays exactly where it is, same size, shape, material and colour: sofa, bed, tables, chairs, wardrobes, the shelving unit / bookcase / cabinet itself, kitchen units and appliances (fridge, oven, washing machine), sink, taps, toilet, bath/shower, radiators, lamps, TV, tiles, walls, floor, ceiling, windows, doors.
- Do not renovate, repaint, re-tile or change any material or colour. Do not add ANY new furniture, plant, artwork or decoration to fill emptied space — empty is correct.
- Same camera position, framing, aspect ratio, view through the windows and time of day.

FINAL CHECK before you answer: compare your result with the input object by object. Anything in your result that is not visible in the input must be deleted again.

The result must be the SAME room, instantly recognisable, with EVERY loose and personal object gone and every surface clean — fully decluttered, not partially. Output exactly one photorealistic image and nothing else.`,
};

/**
 * Extrém rendetlenség esetén a rendrakás prompthoz fűzött, agresszívabb utasítás.
 * A böngészőoldali „zsúfoltság" heurisztika kapcsolja be (lásd image-diff.ts).
 * Nem cseréli le a promptot, csak megerősíti: extrém esetben a legnagyobb
 * nyerőkre koncentráljon, és semmiképp ne adjon vissza változatlan képet.
 */
export const EXTREME_DECLUTTER_SUFFIX = `

IMPORTANT — THIS ROOM IS EXTREMELY CLUTTERED. This is a hard case, so be MAXIMALLY aggressive with the tidy-up and prioritise the biggest visual wins:
- Clear the FLOOR completely: remove all bags, boxes, laundry, shoes, toys, cables, appliances (vacuum, etc.), and any items lying or piled on the ground.
- Empty every open shelf, table top, cabinet top, TV stand and window sill of the small movable clutter; reconstruct the clean surface/material behind them.
- Remove wall/ceiling decorations that are clearly clutter (stickers, hanging ornaments, novelty items) but KEEP the walls, ceiling, built-in furniture and large fixed pieces.
- Walls, windows, doors, doorways and what is seen through them, and all fixed fittings stay EXACTLY as they are — being aggressive applies to loose clutter only.
- Do a second pass in your mind before finishing: any object still lying on a floor, shelf, table or counter must go. The result MUST be dramatically tidier — every surface clear — not merely "less cluttered". Returning a barely-changed or half-tidied image is a FAILURE.`;
