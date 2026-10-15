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

/** A berendezés tárgylistája darabszámmal („1 Alacsony lenkanapé, 1 Rizspapír függőlámpa…") — hogy ne legyen 1 helyett 7 lámpa. */
export function itemList(items: { type: string; label?: string }[]): string {
  const count = new Map<string, number>();
  for (const it of items) count.set(it.label ?? it.type, (count.get(it.label ?? it.type) ?? 0) + 1);
  return [...count.entries()].map(([k, n]) => `${n} × ${k}`).join(", ");
}

export function targetPrompt(room: Room, sheet: StyleSheet, brief: string, items: string): string {
  const en = ROOM_TYPES.find((r) => r.value === room.kind)?.en ?? "room";
  return `The first image is a 3D render of an EMPTY ${en} of a real apartment, seen from eye height (1.6 m). The bright areas in the walls are real window openings; dark/plain areas are walls.

TASK: ADD FURNITURE AND DECOR ONLY. This is "virtual staging": place objects INTO the existing room and make the photo look photorealistic.

ABSOLUTE RULES (the image must not mislead buyers about the real apartment):
- Same camera, same framing, same aspect ratio: every wall edge, corner, the ceiling line, every window and door opening must stay at EXACTLY the same position in the image.
- Do NOT add, remove, enlarge, move or reshape any wall, window, door, opening, column or niche. Do NOT add built-in shelving walls, glass walls or partitions.
- Do not change the room's size or proportions. Keep the walls matte ${sheet.wall_colors_allowed[0]}, the ceiling ${sheet.ceiling_color}, the floor ${sheet.floor.living.replaceAll("_", " ")}.
- Place EXACTLY these freestanding items, no more: ${items}. Small decor on them is fine (a few ceramics or books), following the decor density below.
- Lighting: soft natural daylight through the existing windows, plus warm ${sheet.light_kelvin[0]}–${sheet.light_kelvin[1]} K lamps, white-balanced (not orange).

STYLE SHEET (Hungarian, authoritative — the second image is a style reference only, NOT a layout reference):
${brief}

Output exactly one photorealistic 16:9 image of the same room from the same viewpoint.`;
}

export async function makeTargetImage(room: Room, sheet: StyleSheet, styleText: string, empty: { bytes: Uint8Array; mimeType: string }, items: string) {
  const slug = ROOM_TYPES.find((r) => r.value === room.kind)?.slug ?? "nappali";
  const reference = await getReferenceImage(sheet.style_id, slug);
  const t0 = Date.now();
  const out = await generateImage({
    source: empty, prompt: targetPrompt(room, sheet, styleBrief(styleText, room), items), reference: reference ?? undefined, aspectRatio: "16:9",
  });
  return { ...out, seconds: Math.round((Date.now() - t0) / 100) / 10, usedReference: !!reference };
}
