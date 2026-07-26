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

// --- NAGYON SZIGORÚ promptok (image-to-image) ------------------------------
// A modell angolul követi legpontosabban a képre vonatkozó megkötéseket.
export const ENHANCE_PROMPTS: Record<EnhanceMode, string> = {
  // 1) FELJAVÍTÁS — kizárólag technikai képminőség, NULLA tartalmi változás.
  feljavitas: `You are a professional real-estate photo retoucher. Your ONLY task is to improve the TECHNICAL image quality of this exact photo.

ABSOLUTE RULES — the image shows a REAL property, so misrepresenting it is strictly forbidden:
- Do NOT add, remove, move, replace, or reinterpret ANYTHING in the scene.
- Keep the exact same room, architecture, walls, floor, ceiling, windows, doors, furniture, appliances, decorations, objects, textures, materials, patterns and their real colors — identical to the original, in the same positions and proportions.
- Do NOT redecorate, renovate, repaint, stage, or add/remove furniture or objects.
- Do NOT change what is visible through the windows, and do NOT change the time of day or season.
- Do NOT crop out meaningful content.

ONLY improve these technical qualities:
- exposure and brightness (fix under/overexposed areas),
- white balance and natural, true-to-life color accuracy,
- contrast and dynamic range,
- sharpness and clarity,
- noise reduction,
- gently straighten tilted vertical/horizontal lines (lens/perspective correction) if the shot is slightly crooked.

The result must look like the SAME photograph, just professionally, realistically corrected. Output exactly one photorealistic image and nothing else.`,

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
