// Stíluslap betöltése (CSAK szerveroldal) — a látványtervező referenciaképei mellől: references/<stílus>/stiluslap.json (+ .md).
// A JSON a gépi rész (színek, anyagok, tiltások — az építő és a geometria-független ellenőrzés használja),
// az .md a teljes szöveg (bútorformák helyiségenként, fény, ellenőrzőlista — a célkép-prompt és a kritikus kapja meg).
// Új stílus = új stíluslap ugyanide; kódmódosítás nem kell. A teszt időszakban csak a japandi.
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "references";
const HEX = /^#[0-9A-Fa-f]{6}$/;

export type StyleSheet = {
  style_id: string;
  version: string;
  wall_colors_allowed: string[];
  ceiling_color: string;
  accent_colors: string[];
  accent_not_on_walls: string[];
  primary_wood: string;
  secondary_wood?: { type: string; max_items_per_room: number };
  floor: { living: string; wet_rooms: { type: string; color: string } };
  upholstery: string[];
  upholstery_forbidden: string[];
  light_kelvin: [number, number];
  led_strip: string;
  decor_density: { shelf_fill_max: number; plants_per_room: [number, number] };
  surface_finish: string;
  forbidden: string[];
};

/** A gépi rész szerkezeti ellenőrzése — hibás stíluslappal nem indulhat berendezés. */
export function validateStyleSheet(raw: unknown): { ok: true; sheet: StyleSheet } | { ok: false; error: string } {
  const s = raw as Partial<StyleSheet> | null;
  if (!s || typeof s !== "object") return { ok: false, error: "A stíluslap nem JSON-objektum." };
  if (typeof s.style_id !== "string" || typeof s.version !== "string") return { ok: false, error: "Hiányzik a style_id vagy a version." };
  if (!Array.isArray(s.wall_colors_allowed) || !s.wall_colors_allowed.length || !s.wall_colors_allowed.every((c) => HEX.test(c)))
    return { ok: false, error: "A wall_colors_allowed HEX-színek listája legyen." };
  if (typeof s.ceiling_color !== "string" || !HEX.test(s.ceiling_color)) return { ok: false, error: "A ceiling_color HEX-szín legyen." };
  if (!s.floor?.living || !s.floor?.wet_rooms?.color || !HEX.test(s.floor.wet_rooms.color)) return { ok: false, error: "Hiányos padló-meghatározás." };
  if (!Array.isArray(s.light_kelvin) || s.light_kelvin.length !== 2) return { ok: false, error: "A light_kelvin [min, max] legyen." };
  if (!Array.isArray(s.forbidden)) return { ok: false, error: "A forbidden lista hiányzik." };
  return { ok: true, sheet: s as StyleSheet };
}

async function download(path: string): Promise<string | null> {
  const { data } = await createAdminClient().storage.from(BUCKET).download(path);
  return data ? await data.text() : null;
}

/** A stílus stíluslapja (gépi + szöveges rész). Ha nincs vagy hibás: hibaüzenet — a hívó nem indíthat berendezést. */
export async function loadStyleSheet(styleId: string): Promise<{ sheet: StyleSheet; text: string } | { error: string }> {
  if (!/^[a-z0-9_]+$/.test(styleId)) return { error: "Érvénytelen stílus." };
  const [json, text] = await Promise.all([download(`${styleId}/stiluslap.json`), download(`${styleId}/stiluslap.md`)]);
  if (!json) return { error: `Ehhez a stílushoz még nincs stíluslap (references/${styleId}/stiluslap.json).` };
  let raw: unknown;
  try { raw = JSON.parse(json); } catch { return { error: "A stíluslap JSON-ja hibás." }; }
  const v = validateStyleSheet(raw);
  if (!v.ok) return { error: `Hibás stíluslap: ${v.error}` };
  return { sheet: v.sheet, text: text ?? "" };
}
