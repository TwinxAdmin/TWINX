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
export function enhanceModeLabel(v: string): string {
  return ENHANCE_MODES.find((m) => m.value === v)?.label ?? v;
}

// --- NAGYON SZIGORÚ promptok (image-to-image, Nano Banana) -----------------
// A modell angolul követi legpontosabban a képre vonatkozó megkötéseket.
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
  feljavitas: `TASK: COMPLETE PROFESSIONAL RE-LIGHT AND COLOUR GRADE. You are the best real-estate photographer and retoucher in the business. This is a flat, dull, amateur phone snapshot. Transform it into a stunning, magazine-cover-quality listing photograph that sells the home — the kind of image a luxury agency pays a top photographer for.

THIS IS NOT A SUBTLE TOUCH-UP. It is a total transformation of light, colour, tone and quality. Push hard. Placed side by side, the original must look like a bad, cheap photo next to yours. If the result looks only slightly better than the input, you have failed. Go for the maximum professional polish that still looks like a real photograph.

DO ALL OF THIS, STRONGLY:
- RE-LIGHT THE ENTIRE ROOM. Flood it with beautiful, bright, soft light, as if shot on a tripod with a full-frame camera and multiple large, bounced, off-camera flashes blended with daylight (the "flambient" method). Every wall, every corner, the ceiling and the floor must be bright, clean and evenly lit. Kill all dim corners, muddy areas, murk and gloom. The room must feel far brighter, bigger, airier and more luxurious than it was.
- SHAPE THE LIGHT LIKE A PHOTOGRAPHER: a bright, glowing, warm key light coming from the existing windows, soft fill light everywhere else, gentle natural falloff. Make the daylight that is already in the photo feel warmer, richer and more generous. You may turn on the lamps and ceiling lights that are ALREADY in the room, so they add warm, cosy accents — but do not add new lamps, invent other light sources or paint in sun rays. Work with the light and fixtures the room really has, and make them beautiful.
- WINDOWS: perfect professional window-pull. The room is bright AND the view through every window is clear, sharp and richly coloured. No white blown-out glass, no dark room against bright windows. Recover and enhance the REAL view that is already in the photo — never invent a different one.
- COLOUR: perform a full, decisive colour grade. Set one clean, consistent white balance for the whole frame and harmonise every colour into a single, coherent, premium palette. Whites become crisp, clean, bright white. Wood becomes warm, rich and glowing. Textiles and decor get true, saturated, appealing colour. Strip out every colour cast — yellow tungsten, green fluorescent, blue shade, grey haze — completely. Finish with a warm, welcoming, sunlit tone. The colours must look designed and intentional, like a high-end interior magazine.
- TONE: rich, full, punchy tonal range. Lifted, luminous midtones, clean bright highlights, deep but detailed shadows, confident contrast, real depth and dimension. Polished, editorial, high-end.
- DETAIL: tack-sharp, clean, high-resolution look. Crisp edges, vivid material textures (fabric weave, wood grain, tile, glass), zero noise, zero blur, zero compression artefacts.
- KEEP IT A PHOTOGRAPH: no painterly or illustrated look — a real, superb photograph.

KEEP THESE THE SAME (real property, must stay honest): the same room, the same furniture and objects in the same places and shapes — nothing added, removed, moved, restyled or renovated; the same camera position, framing and aspect ratio; the same view through the windows.
GLASS IS NOT A PORTAL: whatever is behind or reflected in any glass door, glass partition, window, mirror, shower screen or glossy surface must stay exactly what it is in the original photo — the same hallway, wall, room or reflection, only lit and coloured better. NEVER invent, replace or open up a different room, view or space behind glass. If something behind glass is blurry or dark in the original, simply render that same thing clearer and brighter.
Everything about LIGHT, COLOUR, TONE and QUALITY is yours to transform — and it must change DRAMATICALLY. Everything that IS in the room — objects, surfaces, views, reflections — stays exactly what and where it is.

Output exactly one photorealistic image and nothing else.`,

  // 2) RENDRAKÁS — alapos virtuális rendrakás (staging) + minőségjavítás. A mozdítható
  // személyes holmi ELTŰNIK, a rögzített elemek és a bútor VÁLTOZATLAN.
  rendrakas: `You are a professional real-estate photo editor performing VIRTUAL DECLUTTERING (tidy-up) and quality enhancement. Make this exact room look clean, tidy and listing-ready — as if the owner had put away ALL personal belongings before a professional photoshoot. Be THOROUGH, not shy: empty shelves and surfaces should end up genuinely clean.

You MUST produce a VISIBLY decluttered image. Returning a near-identical copy with the clutter still present is a FAILURE. Even if the room is EXTREMELY cluttered, remove as much of the movable clutter as you can and clearly reduce the mess — always deliver a noticeably tidier result than the input.

DO (be thorough and complete):
- Remove ALL movable, everyday and personal items from open shelves, countertops, the sink/basin area, hooks, radiators, window sills and the floor: toiletries, cosmetics, bottles, tubes, jars, soap, sponges, toothbrushes and holders, hairdryer and cables, chargers, cleaning supplies, towels in use, laundry, papers, magazines, bins and rubbish, small clutter. Leave those shelves and surfaces CLEAN and essentially EMPTY, like a staged listing photo. Reconstruct the real, already-visible surface/material behind the removed items.
- Improve technical quality: exposure/brightness, white balance and natural true-to-life colors, contrast, sharpness/clarity, noise reduction, and gently straighten slightly tilted vertical/horizontal lines.

DO NOT (keep it truthful — this is a REAL property):
- Do NOT remove, move, replace, resize or add any FIXED element or piece of FURNITURE: keep the shelving unit / cabinet itself, mirror, sink, faucet, toilet, bath/shower, radiator, washing machine, tiles, walls, floor, ceiling, windows and doors exactly as they are, in the same place, with the same materials and colors.
- Do NOT renovate, repaint, re-tile, or change any surface material or color.
- Do NOT add new furniture, plants, artwork or decorations to fill the emptied space.
- Do NOT change the room layout, proportions, the view through the windows, or the time of day/season.

The result must be the SAME room, clearly recognizable, just thoroughly tidied and professionally photographed. Output exactly one photorealistic image and nothing else.`,
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
- It is acceptable if not every single tiny object can be removed in one pass — but the result MUST be dramatically tidier and clearly less cluttered than the input. Returning a barely-changed image is a FAILURE.`;
