// CÉLKÉP (3. lépés, F3d) — CSAK szerveroldal. A berendezetlen, méretpontos helyiség fotóját (a böngésző készíti, szemmagasságból)
// a Nano Banana a stíluslap és a stílus referenciaképe alapján berendezi — a geometria (falak, ablakok, ajtók, kameraállás) változatlan.
// Ez a helyiség célképe: az építő ehhez igazodik, a kritikus ehhez méri a berendezett modellt (F3e).
import { generateImage } from "@/lib/nanobanana";
import { getReferenceImage } from "@/lib/references";
import { ROOM_TYPES } from "@/lib/visualization";
import type { Room } from "@/lib/floorplan3d/plan";
import type { StyleSheet } from "@/lib/floorplan3d/stylesheet";
import { ROOM_KINDS } from "@/lib/floorplan3d/plan";

/** A stíluslap szövegéből a célképhez szükséges részek: lényeg, paletta, anyagok, formák, a helyiség sora, fény, díszítettség, tiltások. */
export function styleBrief(text: string, room: Room): string {
  const sections = text.split(/\n(?=## )/);
  const pick = (n: number) => sections.find((s) => s.startsWith(`## ${n}.`)) ?? "";
  const label = ROOM_KINDS.find((k) => k.value === room.kind)?.label.split(" /")[0] ?? room.name;
  const row = pick(5).split("\n").find((l) => l.toLowerCase().startsWith(`| ${label.toLowerCase()}`)) ?? "";
  return [pick(1), pick(2), pick(3), pick(4), row ? `## 5. Ebben a helyiségben\n${row}` : "", pick(6), pick(7), pick(8)].filter(Boolean).join("\n\n");
}

export function targetPrompt(room: Room, sheet: StyleSheet, brief: string): string {
  const en = ROOM_TYPES.find((r) => r.value === room.kind)?.en ?? "room";
  return `This image is a 3D render of an EMPTY ${en} of a real apartment, seen from eye height (1.6 m).
Turn it into a finished, photorealistic interior photograph furnished in the style described below, in the spirit of the reference image.

STRICT — the result must not be misleading about the real apartment:
- Keep the camera position, viewing angle and lens EXACTLY the same.
- Keep every wall, corner, window, door, opening and the ceiling exactly where they are, with the same sizes and proportions.
- Do NOT add, remove, move or resize any wall, window, door or opening. Do not change the room's shape or size.
- Walls: matte ${sheet.wall_colors_allowed[0]} (warm off-white). Ceiling: ${sheet.ceiling_color}. Floor: ${sheet.floor.living.replaceAll("_", " ")}.
- Lighting: soft natural daylight through the existing windows, plus warm ${sheet.light_kelvin[0]}–${sheet.light_kelvin[1]} K lamps, white-balanced (not orange).

STYLE SHEET (Hungarian, authoritative):
${brief}

Output exactly one photorealistic image of the same room from the same viewpoint.`;
}

export async function makeTargetImage(room: Room, sheet: StyleSheet, styleText: string, empty: { bytes: Uint8Array; mimeType: string }) {
  const slug = ROOM_TYPES.find((r) => r.value === room.kind)?.slug ?? "nappali";
  const reference = await getReferenceImage(sheet.style_id, slug);
  const t0 = Date.now();
  const out = await generateImage({ source: empty, prompt: targetPrompt(room, sheet, styleBrief(styleText, room)), reference: reference ?? undefined });
  return { ...out, seconds: Math.round((Date.now() - t0) / 100) / 10, usedReference: !!reference };
}
