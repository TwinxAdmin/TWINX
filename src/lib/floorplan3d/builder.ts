// ÉPÍTŐ (3. lépés, F3c) — CSAK szerveroldal. Egy helyiség berendezése a stíluslap alapján (Gemini, JSON-kimenet).
// Bemenet: a helyiség geometriája (méter), falai a nyílásokkal, az ajtók előtti szabad sávok, a stíluslap szövege, a bútorkatalógus
// (típusok + szabványos méretek) és kiindulásnak a szabályalapú elrendezés. Később (F3d/F3e) a célkép és a kritikus megjegyzése is.
// A kimenetet a KÓD ellenőrzi (helyiségen belül, ajtósáv szabad, nincs ütközés, 80 cm-es közlekedőút). Hibánál egy javítókör a hibákkal;
// ha az sem jó, a szabályalapú elrendezés marad (forrás: "rule"). A geometria (falak, nyílászárók) SOHA nem változik.
import type { FloorPlan, Room } from "@/lib/floorplan3d/plan";
import { roomEdge, polygonArea } from "@/lib/floorplan3d/geometry";
import {
  FURNITURE_DEFAULTS, FURNITURE_SIZE_RANGE, FURNITURE_TYPES, checkLayout, doorZones, entrances, livingRoomLayout, roomOpenings,
  sanitizeItems, walkwayIssues, type FurnitureItem,
} from "@/lib/floorplan3d/furniture";
import { floorplan3dConfig } from "@/lib/floorplan3d/config";
import { catalogModel } from "@/lib/floorplan3d/catalog";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** A prototípusban berendezhető helyiségtípusok (a többi később, saját alap-elrendezéssel). */
export const FURNISHABLE_KINDS = ["nappali"] as const;

export type FurnishResult = {
  items: FurnitureItem[];
  source: "builder" | "builder-repaired" | "rule";
  rationale: string;
  issues: string[];          // ami a végső elrendezésben megmaradt (csak a szabályalapú tartaléknál lehet)
  rounds: number;            // építő-hívások száma (1 vagy 2)
  seconds: number;
  tokensIn: number; tokensOut: number; costUsd: number;
  model: string;
};

const r2 = (v: number) => Math.round(v * 100) / 100;

/** A helyiség leírása az építőnek (számokkal, hogy pontosan dolgozzon). */
function describeRoom(plan: FloorPlan, room: Room) {
  const ops = roomOpenings(plan, room);
  const open = new Set(room.openEdges ?? []);
  return {
    name: room.name, kind: room.kind, area_m2: r2(polygonArea(room.polygon)), ceiling_height_m: plan.ceilingHeight,
    polygon_m: room.polygon.map(([x, y]) => [r2(x), r2(y)]),
    walls: room.polygon.map((_, i) => {
      const e = roomEdge(room, i);
      return {
        index: i, from: [r2(e.a[0]), r2(e.a[1])], to: [r2(e.b[0]), r2(e.b[1])], length_m: r2(e.length),
        open_boundary_no_wall: open.has(i),
        openings: ops.filter((o) => o.edge === i).map((o) => ({ kind: o.kind, from_m: r2(o.from), to_m: r2(o.to), sill_m: r2(o.sill) })),
      };
    }),
    keep_clear_door_zones: doorZones(plan, room).map((z) => z.map(([x, y]) => [r2(x), r2(y)])),
    entrances: entrances(plan, room).map((e) => ({ kind: e.label, at: [r2(e.p[0]), r2(e.p[1])] })),
  };
}

function prompt(plan: FloorPlan, room: Room, styleText: string, start: FurnitureItem[], feedback: string[] | null, critic?: { instruction: string; hasTarget: boolean; wallMap?: string }): string {
  const catalog = FURNITURE_TYPES.map((t) => ({
    type: t, label_hu: FURNITURE_DEFAULTS[t].label, w_d_h_m: [FURNITURE_DEFAULTS[t].w, FURNITURE_DEFAULTS[t].d, FURNITURE_DEFAULTS[t].h],
    size: catalogModel(t) ? "FIXED (real 3D model — do not change w, d, h)" : `may vary ±${Math.round(FURNITURE_SIZE_RANGE * 100)}%`,
  }));
  return `You are an interior designer placing furniture in ONE room of an apartment for a TRUE-TO-SCALE walkthrough of a new-build flat.
The goal is a realistic, functional, uncluttered modern furnishing that shows buyers how the real space works — proportions matter most.

COORDINATES: meters, plan view, x to the right, y DOWNWARDS. The room polygon is the clear inner outline (inside face of the walls).
Each item: center (x, y), size w (width) × d (depth) × h (height), rotation rot in degrees. rot = 0 means the item's FRONT faces +y
(downwards in the plan); rot = 90 → front faces -x; rot = 180 → front faces -y; rot = 270 → front faces +x. The BACK of an item is
at -d/2 from its center along its facing direction. Items placed against a wall have their back ~4 cm from the wall.

ROOM (JSON):
${JSON.stringify(describeRoom(plan, room))}

${styleText ? `STYLE NOTES (optional, secondary to function):\n${styleText}\n` : ""}
FURNITURE CATALOG (only these types; sizes as given — FIXED items are real 3D models with their real dimensions):
${JSON.stringify(catalog)}

${critic ? "CURRENT LAYOUT (keep what works, change only what the critic asks)" : "STARTING LAYOUT (rule-based, valid but basic — improve it)"}:
${JSON.stringify(start.map(({ type, x, y, rot, w, d, h }) => ({ type, x, y, rot, w, d, h })))}
${critic ? `\nCRITIC'S INSTRUCTION (apply it): ${critic.instruction}${critic.hasTarget ? "\nThe attached image is the TARGET staging of this room from the room's entrance viewpoint — follow its arrangement and atmosphere where the rules allow." : ""}${critic.wallMap ? `\nWALLS AS SEEN FROM THAT VIEWPOINT (wall index = the "walls" list above):\n${critic.wallMap}` : ""}\n` : ""}
${feedback ? `\nYOUR PREVIOUS LAYOUT WAS REJECTED BY THE VALIDATOR. Fix exactly these problems:\n- ${feedback.join("\n- ")}\n` : ""}
RULES (all mandatory):
- A typical modern living room: one sofa, a coffee table, at most one or two armchairs, a shelf and/or a sideboard (TV unit), a ceiling lamp, a rug, one plant. Few items, uncluttered.
- Every item fully inside the polygon; floor items must not overlap each other (a rug may be under the sofa/table; a pendant lamp hangs).
- Never put a floor item into a keep_clear_door_zone. Keep a ≥ 80 cm walkway between all entrances.
- Do not place tall items (shelf, plant, floor lamp) in front of a window; a sofa may stand under a window only if the sill is higher than its back.
- Conversation group: sofa facing the coffee table; armchair(s) angled towards it; the rug centred under the table.
- Do NOT change the room geometry. Do not invent new walls, doors or windows.

Return ONLY JSON: { "items": [ { "type": ..., "x": ..., "y": ..., "rot": ..., "w": ..., "d": ..., "h": ... } ], "rationale": "2-3 sentences in Hungarian" }`;
}

async function callBuilder(model: string, apiKey: string, text: string, image?: { bytes: Uint8Array; mimeType: string }) {
  const parts: Record<string, unknown>[] = [{ text }];
  if (image) parts.push({ inline_data: { mime_type: image.mimeType, data: Buffer.from(image.bytes).toString("base64") } });
  const res = await fetch(`${ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.4, responseMimeType: "application/json" } }),
  });
  if (!res.ok) throw new Error(`Építő hiba (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const out: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text ?? "").join("") ?? "";
  let json: { items?: unknown; rationale?: unknown } = {};
  try { json = JSON.parse(out.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { /* üres válasz → érvénytelen elrendezés */ }
  return {
    items: sanitizeItems(json.items), rationale: typeof json.rationale === "string" ? json.rationale.slice(0, 600) : "",
    tokensIn: data?.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: (data?.usageMetadata?.candidatesTokenCount ?? 0) + (data?.usageMetadata?.thoughtsTokenCount ?? 0),
  };
}

/** Az elrendezés minden kódos ellenőrzése egy listában (üres = elfogadható). */
export function layoutProblems(plan: FloorPlan, room: Room, items: FurnitureItem[]): string[] {
  if (!items.length) return ["Üres elrendezés."];
  return [...checkLayout(plan, room, items).map((i) => i.text), ...walkwayIssues(plan, room, items)];
}

/**
 * opts (minőségi ciklus, F3e): start = az aktuális elrendezés (ebből javít), critic = a kritikus utasítása, target = a célkép (képként kapja).
 * Ha a javított elrendezés nem megy át az ellenőrzésen, a KIINDULÓ elrendezés marad (nem a szabályalapú) — egy kör nem ronthat.
 */
export async function furnishRoom(plan: FloorPlan, room: Room, styleText: string,
  opts?: { start?: FurnitureItem[]; critic?: string; target?: { bytes: Uint8Array; mimeType: string } | null; wallMap?: string }): Promise<FurnishResult> {
  const cfg = floorplan3dConfig();
  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!apiKey) throw new Error("Hiányzó GOOGLE_AI_STUDIO_API_KEY.");
  const model = process.env.FLOORPLAN3D_BUILDER_MODEL || cfg.visionModel;
  const t0 = Date.now();
  const start = opts?.start?.length ? opts.start : livingRoomLayout(plan, room).items;
  const critic = opts?.critic ? { instruction: opts.critic, hasTarget: !!opts.target, wallMap: opts.wallMap } : undefined;
  let tokensIn = 0, tokensOut = 0, rounds = 0;
  let feedback: string[] | null = null;
  let last: { items: FurnitureItem[]; rationale: string } | null = null;

  for (let round = 0; round < 2; round++) {
    rounds++;
    const r = await callBuilder(model, apiKey, prompt(plan, room, styleText, last?.items.length ? last.items : start, feedback, critic), opts?.target ?? undefined);
    tokensIn += r.tokensIn; tokensOut += r.tokensOut;
    last = r;
    const problems = layoutProblems(plan, room, r.items);
    if (!problems.length) {
      const costUsd = (tokensIn * cfg.visionUsdPerMTokIn + tokensOut * cfg.visionUsdPerMTokOut) / 1e6;
      return { items: r.items, source: round ? "builder-repaired" : "builder", rationale: r.rationale, issues: [], rounds,
        seconds: Math.round((Date.now() - t0) / 100) / 10, tokensIn, tokensOut, costUsd, model };
    }
    feedback = problems.slice(0, 8);
  }
  // tartalék: a szabályalapú elrendezés (a megmaradt hibákat jelezzük)
  const costUsd = (tokensIn * cfg.visionUsdPerMTokIn + tokensOut * cfg.visionUsdPerMTokOut) / 1e6;
  return { items: start, source: "rule", rationale: last?.rationale ? `Az építő javaslata nem felelt meg az ellenőrzésnek: ${feedback?.join(" ")}` : "",
    issues: layoutProblems(plan, room, start), rounds, seconds: Math.round((Date.now() - t0) / 100) / 10, tokensIn, tokensOut, costUsd, model };
}
