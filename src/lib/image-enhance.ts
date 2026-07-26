// Egyszerű képjavító — a feltöltött ingatlanfotó MINŐSÉGÉT javítja, a tartalmat NEM
// változtatja meg. Két mód: "feljavitas" (csak képminőség) és "rendrakas" (minőség +
// apró rendetlenség eltakarítása). A képet a bekötött Nano Banana (image-to-image)
// generálja, ezért a promptok NAGYON SZIGORÚAK: valós ingatlan, nem szabad félrevezetni.
export { MAX_IMAGES, MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES, validateImageFiles } from "@/lib/visualization";

export const ENHANCE_MODES = [
  {
    value: "feljavitas",
    label: "Feljavítás",
    desc: "Csak a képminőség javul (fény, szín, élesség) — a képen semmi más nem változik.",
  },
  {
    value: "rendrakas",
    label: "Rendrakás",
    desc: "Minőségjavítás + a látható apró rendetlenség (kábelek, szanaszét tárgyak) eltakarítása.",
  },
] as const;

export type EnhanceMode = (typeof ENHANCE_MODES)[number]["value"];

export function isEnhanceMode(v: unknown): v is EnhanceMode {
  return v === "feljavitas" || v === "rendrakas";
}
export function enhanceModeLabel(v: string): string {
  return ENHANCE_MODES.find((m) => m.value === v)?.label ?? v;
}

// --- FELJAVÍTÁS (fal.ai clarity-upscaler) — pozitív + negatív prompt --------
// A fal img2img-nél a szerkezet megtartását a creativity/resemblance paraméterek adják,
// a látványt pedig ez a rövid, kulcsszavas pozitív + negatív prompt.
// Bázis (mindig alkalmazzuk): tiszta minőségjavítás, semleges. A látvány-rétegeket
// (fények, ég, hangulat) a bekapcsolható OPCIÓK adják hozzá.
export const ENHANCE_FAL_PROMPT =
  "professional real estate listing photograph, sharp focus, crisp fine textures, high detail, clean and clear, true-to-life natural colors, well-balanced exposure, photorealistic, high quality";
export const ENHANCE_FAL_NEGATIVE =
  "amateur, phone camera, blurry, dark, underexposed, grainy, noisy, distorted, fisheye, bad lighting, blown out windows, messy, changed layout, altered furniture, added objects, 3d render, digital art, illustration, worst quality, low quality";

// Bekapcsolható feljavítás-opciók — mindegyiknek saját (admin-szerkeszthető) prompt-
// rétege, amit engedélyezéskor a bázishoz fűzünk.
export const ENHANCE_OPTIONS = [
  {
    value: "lighting",
    label: "Szép fények",
    desc: "Profi, kiegyensúlyozott világítás — levegős, világos tér (HDR).",
    prompt: "bright and airy professional interior lighting, soft natural daylight, well-lit and opened-up shadows, perfectly balanced HDR lighting, luminous inviting space",
  },
  {
    value: "sky",
    label: "Kék ég az ablakban",
    desc: "Az ablakban látszó fakó/borús eget derült kék égre cseréli.",
    prompt: "replace the dull, grey or overcast sky visible through the windows with a clear natural blue sky with a few soft clouds, bright pleasant daylight outside the windows",
  },
  {
    value: "warm",
    label: "Meleg, otthonos hangulat",
    desc: "Barátságos, hívogató, meleg tónusú összkép.",
    prompt: "warm, cozy and inviting homely atmosphere, gentle warm tones, welcoming tasteful ambiance",
  },
  {
    value: "furniture",
    label: "Bútorzat kiemelése",
    desc: "A meglévő bútorok élesebbek, tisztábbak, gazdagabb textúrával — de nem cseréljük ki.",
    prompt: "enhance the appearance of the EXISTING furniture: crisp clean surfaces, rich detailed wood and fabric textures, well-defined edges, refined and tidy look — keep exactly the same furniture pieces in the same positions, do NOT replace, add or restyle any furniture",
  },
] as const;

export type EnhanceOption = (typeof ENHANCE_OPTIONS)[number]["value"];
export function isEnhanceOption(v: unknown): v is EnhanceOption {
  return ENHANCE_OPTIONS.some((o) => o.value === v);
}

// --- NAGYON SZIGORÚ promptok (image-to-image, Nano Banana) -----------------
// A modell angolul követi legpontosabban a képre vonatkozó megkötéseket.
export const ENHANCE_PROMPTS: Record<EnhanceMode, string> = {
  // 1) FELJAVÍTÁS — pozitív átalakítás: profi újrafényelés/színkezelés. A javulás
  // KÖTELEZŐEN látható legyen; a szoba tartalma nem változhat.
  feljavitas: `You are a world-class real-estate and interior photographer. RE-EDIT and RE-LIGHT this amateur phone photo into a magazine-quality, professionally photographed listing image. The visual upgrade MUST be clearly and obviously visible — returning a near-identical image is a FAILURE.

Target look (apply strongly): professional real estate photography of a beautiful interior, bright and airy natural daylight, soft natural illumination, well-lit / opened-up shadows, perfectly balanced HDR lighting, Architectural Digest style, high-end listing, sharp focus, crisp textures, true-to-life colors, clean bright walls, warm and inviting atmosphere, photorealistic.

Avoid at all costs: amateur or phone-camera look, blur, darkness, underexposure, grain/noise, distortion or fisheye, bad or flat lighting, blown-out windows (recover the outside view instead), dinginess, messy look, 3D render, digital art or illustration.

KEEP IT THE SAME REAL PROPERTY — ONLY the lighting, color, clarity and mood may change:
- The room, its architecture, layout, furniture, objects, decorations and materials must stay exactly the same and in the same positions. Do NOT change the layout, do NOT move/alter/add/remove furniture or objects, do NOT redecorate, renovate or repaint, and do NOT change the scene visible outside the windows or the season.

Output exactly one photorealistic image that looks like the SAME room professionally re-photographed and edited — clearly brighter, cleaner, sharper, warmer and more inviting than the input. Return only the image.`,

  // 2) RENDRAKÁS — alapos virtuális rendrakás (staging) + minőségjavítás. A mozdítható
  // személyes holmi ELTŰNIK, a rögzített elemek és a bútor VÁLTOZATLAN.
  rendrakas: `You are a professional real-estate photo editor performing VIRTUAL DECLUTTERING (tidy-up) and quality enhancement. Make this exact room look clean, tidy and listing-ready — as if the owner had put away ALL personal belongings before a professional photoshoot. Be THOROUGH, not shy: empty shelves and surfaces should end up genuinely clean.

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
