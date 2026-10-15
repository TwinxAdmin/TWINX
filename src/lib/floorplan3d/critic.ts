// KRITIKUS (3. lépés, F3e) — CSAK szerveroldal. FRISS kontextusú Gemini-hívás körönként (nem látja az előző köröket — ne „szokja meg"
// a hibákat). Két szempont:
//   a) GEOMETRIA (kötelező): a KÓD méri — a kész modell méretei a JSON-hoz (measureApartment), a bútorok szabályosak (layoutProblems).
//      Ezt nem a modell dönti el; a kritikus csak megkapja az eredményt.
//   b) STÍLUS: a berendezett 3D-fotót a célképhez és a stíluslap ellenőrzőlistájához (9. pont) méri: 1–10 pontszám, pontonkénti ítélet,
//      a LEGNAGYOBB hiányosság + utasítás az építőnek. „done", ha a helyiség eléri a célkép szintjét.
import type { FloorPlan, Room } from "@/lib/floorplan3d/plan";
import type { FurnitureItem } from "@/lib/floorplan3d/furniture";
import { buildApartment, measureApartment } from "@/lib/floorplan3d/scene";
import { layoutProblems } from "@/lib/floorplan3d/builder";
import { floorplan3dConfig } from "@/lib/floorplan3d/config";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** A geometria akkor elfogadható, ha a modell legnagyobb eltérése ennyi mm-en belül van (30 mm = összeérő helyiségek vékony fala). */
export const GEOMETRY_MAX_ERROR_MM = 30;
/** Ettől a stíluspontszámtól tekintjük a célkép szintjét elértnek. */
export const STYLE_DONE_SCORE = 8;

export type CriticResult = {
  geometry: { ok: boolean; maxErrorMm: number; problems: string[] };
  score: number;
  checklist: { item: string; pass: boolean; note: string }[];
  biggestIssue: string;        // magyarul, a felületre
  instruction: string;         // angolul, az építőnek
  done: boolean;
  seconds: number; tokensIn: number; tokensOut: number; costUsd: number;
};

function checklistOf(styleText: string): string {
  const sec = styleText.split(/\n(?=## )/).find((s) => s.startsWith("## 9.")) ?? "";
  const avoid = styleText.split(/\n(?=## )/).find((s) => s.startsWith("## 8.")) ?? "";
  return `${sec}\n\n${avoid}`;
}

/** A kódos geometria-ítélet (a kritikus ezt KAPJA, nem ő dönti el). */
export function geometryVerdict(plan: FloorPlan, room: Room, items: FurnitureItem[], opts: { interiorWall: number; exteriorWall: number }) {
  const m = measureApartment(plan, buildApartment(plan, opts)).find((x) => x.roomId === room.id);
  const maxErrorMm = m?.maxErrorMm ?? 0;
  const problems = layoutProblems(plan, room, items);
  return { ok: maxErrorMm <= GEOMETRY_MAX_ERROR_MM && problems.length === 0, maxErrorMm, problems };
}

export async function runCritic(params: {
  plan: FloorPlan; room: Room; items: FurnitureItem[]; styleText: string;
  furnished: { bytes: Uint8Array; mimeType: string }; target: { bytes: Uint8Array; mimeType: string } | null;
  /** falkiosztás a nézőpontból (wallmap.ts): melyik fal-index látszik balra / szemben / jobbra */
  wallMap?: string;
}): Promise<CriticResult> {
  const cfg = floorplan3dConfig();
  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!apiKey) throw new Error("Hiányzó GOOGLE_AI_STUDIO_API_KEY.");
  const model = process.env.FLOORPLAN3D_CRITIC_MODEL || cfg.visionModel;
  const geometry = geometryVerdict(params.plan, params.room, params.items, { interiorWall: cfg.interiorWallThickness, exteriorWall: cfg.exteriorWallThickness });

  const text = `You are a strict interior-design CRITIC. You judge ONE room of a 3D apartment model against its TARGET image and a style sheet.
IMAGE 1 = the current 3D render of the furnished room (simple procedural furniture; judge arrangement, proportions, materials and colours,
not render quality). ${params.target ? "IMAGE 2 = the TARGET image (a photorealistic staging of the SAME room from the SAME viewpoint) — the level to reach." : "There is no target image; judge against the style sheet only."}

Furniture currently placed (plan meters): ${JSON.stringify(params.items.map(({ type, x, y, rot, w, d, h }) => ({ type, x, y, rot, w, d, h })))}
${params.wallMap ? `WALLS OF THE ROOM AS SEEN IN THE IMAGES (use these wall indexes in your instruction — the builder works in plan coordinates and only understands wall indexes):\n${params.wallMap}\n` : ""}
Geometry (measured by code, authoritative): ${geometry.ok ? "OK" : `NOT OK — ${geometry.problems.join("; ") || `max error ${geometry.maxErrorMm} mm`}`}

STYLE CHECKLIST AND THINGS TO AVOID (Hungarian, authoritative):
${checklistOf(params.styleText)}

Return ONLY JSON:
{
  "score": 1-10,                         // how close IMAGE 1 is to the target level in style, arrangement and atmosphere
  "checklist": [{ "item": "<checklist question, Hungarian>", "pass": true|false, "note": "<short Hungarian>" }],
  "biggest_issue": "<the single most important shortcoming, Hungarian, one sentence>",
  "instruction": "<one concrete instruction for the furniture builder in English: which item to add/remove/move/resize and against WHICH WALL INDEX (e.g. 'move the sofa against wall 2, facing the room')>",
  "done": true|false                     // true only if the room reaches the target level (score >= ${STYLE_DONE_SCORE}) and no checklist item fails
}`;
  const parts: Record<string, unknown>[] = [{ text }, { inline_data: { mime_type: params.furnished.mimeType, data: Buffer.from(params.furnished.bytes).toString("base64") } }];
  if (params.target) parts.push({ inline_data: { mime_type: params.target.mimeType, data: Buffer.from(params.target.bytes).toString("base64") } });

  const t0 = Date.now();
  const res = await fetch(`${ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.2, responseMimeType: "application/json" } }),
  });
  if (!res.ok) throw new Error(`Kritikus hiba (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const out: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text ?? "").join("") ?? "";
  let j: Record<string, unknown> = {};
  try { j = JSON.parse(out.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { /* üres ítélet */ }
  const score = Math.max(1, Math.min(10, Math.round(Number(j.score) || 1)));
  const checklist = (Array.isArray(j.checklist) ? j.checklist : []).slice(0, 12).map((c: Record<string, unknown>) => ({
    item: String(c?.item ?? "").slice(0, 160), pass: c?.pass === true, note: String(c?.note ?? "").slice(0, 200),
  }));
  const tokensIn = data?.usageMetadata?.promptTokenCount ?? 0;
  const tokensOut = (data?.usageMetadata?.candidatesTokenCount ?? 0) + (data?.usageMetadata?.thoughtsTokenCount ?? 0);
  // a „kész" ítéletet a kód is megköveteli: geometria rendben + pontszám + nincs bukott ellenőrzőpont
  const done = geometry.ok && score >= STYLE_DONE_SCORE && checklist.every((c) => c.pass) && j.done === true;
  return {
    geometry, score, checklist, done,
    biggestIssue: String(j.biggest_issue ?? "").slice(0, 300) || (geometry.ok ? "Nincs megnevezett hiányosság." : geometry.problems[0] ?? "Geometriai hiba."),
    instruction: String(j.instruction ?? "").slice(0, 500),
    seconds: Math.round((Date.now() - t0) / 100) / 10, tokensIn, tokensOut,
    costUsd: (tokensIn * cfg.visionUsdPerMTokIn + tokensOut * cfg.visionUsdPerMTokOut) / 1e6,
  };
}
