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

  // 2) RENDRAKÁS — minőségjavítás + CSAK apró rendetlenség eltakarítása.
  rendrakas: `You are a professional real-estate photo retoucher. Do exactly TWO things and NOTHING else.

(1) Improve the TECHNICAL image quality: exposure/brightness, white balance and natural true-to-life colors, contrast, sharpness/clarity, noise reduction, and gently straighten tilted vertical/horizontal lines if the shot is slightly crooked.

(2) Lightly DECLUTTER the room: remove ONLY small, clearly out-of-place everyday mess and personal clutter — for example loose cables, scattered small items, dishes, laundry, stray papers, bins, rubbish, and personal toiletries. Fill the freed spots with the realistic surface/floor that is already there.

ABSOLUTE RULES — the image shows a REAL property, keep it truthful:
- Do NOT alter the property itself: keep the exact same architecture, room layout, walls, floor, ceiling, windows, doors and built-in elements.
- Keep the existing FURNITURE and appliances in the SAME positions — do NOT add, remove, replace or move furniture.
- Do NOT add any new furniture, decoration, plants or objects that were not there.
- Do NOT renovate, repaint, restage, or change the materials/colors of any surface.
- Do NOT change what is visible through the windows, nor the time of day or season.

The result must remain an honest representation of the real property — simply tidy, clean and well-photographed. Output exactly one photorealistic image and nothing else.`,
};
