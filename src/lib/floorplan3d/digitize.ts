// Digitalizálás 1. fele (CSAK szerveroldal): alaprajz-kép / PDF → Gemini képelemzés → nyers JSON → normalizeDigitized().
// Kézi rajz fotójánál ugyanez fut, a prompt jelzi, hogy kézi rajzról van szó (pontatlanabb vonalak).
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { normalizeDigitized, type NormalizeStats, type RawDigitized } from "@/lib/floorplan3d/normalize";
import { ROOM_KINDS, type FloorPlan } from "@/lib/floorplan3d/plan";
import { applyDoorDefaults, checkPlan } from "@/lib/floorplan3d/geometry";
import { floorplan3dConfig } from "@/lib/floorplan3d/config";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export type DigitizeResult = {
  plan: FloorPlan;
  stats: NormalizeStats & { model: string; seconds: number; tokensIn: number; tokensOut: number; costUsd: number; refinedRounds: number };
};

function prompt(hand: boolean): string {
  return `You are an architectural floor plan digitizer. Analyze the attached ${hand ? "PHOTO OF A HAND-DRAWN" : ""} apartment floor plan and return ONLY JSON.

COORDINATES: every x,y is on a normalized 0-1000 grid of the WHOLE image (x = horizontal from the left edge, y = vertical from the top edge).

Return:
{
  "ceilingHeight": number|null,            // only if written on the plan (e.g. "bm. 2,70")
  "rooms": [{
    "name": string,                          // exactly as written, in the plan's language (e.g. "Nappali", "Fürdő", "Terasz")
    "kind": one of ${JSON.stringify(ROOM_KINDS.map((k) => k.value))},   // Hungarian abbreviations: "KÖZL." / "közlekedő" / "folyosó" / "előtér" → "eloszoba"; "FR.ERK." (francia erkély) / "erkély" / "loggia" → "terasz"; "kamra" / "gardrób" / "tároló" → "gardrob"
    "areaLabel": number|null,                // the written m² of this room (e.g. 13.07), null if not written
    "polygon": [[x,y], ...],                 // the INNER (clear) outline of the room along the inner face of its walls, corners in order. Use as few corners as possible; rectangles have 4.
    "openTo": [number]                       // indexes of rooms connected to this one WITHOUT a wall (only a dashed line / floor change between them, e.g. open-plan kitchen–living room). Empty if none.
  }],
  "openings": [{
    "kind": "door"|"window"|"passage",       // door: has a leaf (drawn with a swing arc); window: has a sill (French window / balcony door without sill = "door"); passage: a gap in a wall WITHOUT any leaf or arc (archway)
    "room": number,                          // index in rooms of the room it belongs to (for a door between two rooms: the smaller room)
    "x1": number, "y1": number, "x2": number, "y2": number,  // the two ends of the opening along the wall
    "hinge": [x, y]|null,                    // door only: the END of the opening where the leaf is attached = the CENTER of the drawn swing arc. null if not visible
    "swingInto": number|null,                // door only: index of the room the leaf opens INTO (the room in which the swing arc is drawn). null if not visible
    "leaves": 1|2                            // door/window: 2 if drawn as a double door / two sashes (two arcs), else 1
  }],
  "columns": [{ "x1": number, "y1": number, "x2": number, "y2": number }],   // free-standing structural columns / pillars: small FILLED (dark or grey) rectangles standing INSIDE or at the edge of a room that are not part of a wall line; the bounding box. Empty if none.
  "dimensions": [{
    "meters": number,                        // a written dimension converted to meters (e.g. "2,85" → 2.85; "285" cm → 2.85)
    "x1": number, "y1": number, "x2": number, "y2": number   // the two ends of the dimension line / the measured span
  }],
  "groups": [{ "label": string, "area": number, "rooms": [number] }],   // ONLY for a written area that covers SEVERAL rooms together (e.g. a table row "Hálószoba 34,11" for 3 bedrooms): the written label, the m² and the indexes of those rooms. Empty if none.
  "notes": [string]                          // short notes about anything uncertain (unreadable labels, guessed walls). WRITE THE NOTES IN HUNGARIAN.
}

RULES:
- Include every room including outdoor terraces/balconies (kind "terasz"). Ignore private gardens, furniture, sanitary fixtures, grid axes, hatching and watermarks.
- Room outlines must be accurate: follow the inner wall faces, walls are the gaps between rooms. Where two rooms are separated only by a dashed or dotted line (no wall), their outlines must touch along that line and list each other in "openTo". A dashed / dotted boundary is NEVER a door: do not create an opening on it.
- Trace notches precisely: shafts, chimney boxes and pillars cut out of a room (small filled rectangles in a corner) are NOT part of the room's floor area; slanted walls must keep their real angle.
- Doors: read the swing direction from the drawing (the arc): "hinge" = the arc's center end, "swingInto" = the room containing the arc.
- Give at least 3-6 dimensions that are clearly written, preferring long ones (room widths/depths written inside rooms are ideal).
- Marketing / furnished / 3D-rendered plans: ignore furniture, rugs, shadows and decoration; trace only the inner faces of the walls.
- Room NAMES and AREAS may be listed in a legend/table next to the plan instead of inside the rooms. Then match every table row to the room on the plan by function (furniture, fixtures: bed → bedroom, bathtub/shower → bathroom, toilet → WC, stove/sink → kitchen, entrance door → hall) and by relative size, and use the table's name and m² for that room.
- If ONE table row covers SEVERAL rooms (e.g. "Hálószoba 34,11 m²" while the plan shows 2-3 bedrooms, or the m² is clearly too large for any single room), give each of those rooms a sensible name (e.g. "Hálószoba 1", "Hálószoba 2") with "areaLabel": null, and list them together in "groups" with the combined label and m². Never assign a combined area to a single room.
- Ignore whole-flat totals ("Lakás méret", "flat size") and site/building plans, compass roses, logos and photos.
- Decimal commas are decimals. Do not invent numbers that are not on the plan.${hand ? "\n- Hand drawing: lines are imprecise; assume walls are straight and perpendicular; rely on the written numbers." : ""}`;
}

async function imageSize(bytes: Buffer, mime: string): Promise<[number, number]> {
  if (mime === "application/pdf") {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const page = doc.getPage(0);
    const { width, height } = page.getSize();
    return [width, height];
  }
  const meta = await sharp(bytes).rotate().metadata();
  const w = meta.width ?? 1000, h = meta.height ?? 1000;
  // EXIF-forgatás (telefonfotó): a sharp rotate() után a szélesség/magasság felcserélődhet
  return meta.orientation && meta.orientation >= 5 ? [h, w] : [w, h];
}

type Usage = { tokensIn: number; tokensOut: number };

/** Egy képelemző hívás → JSON + tokenhasználat. */
async function callVision(apiKey: string, model: string, text: string, image: { bytes: Buffer; mime: string }): Promise<{ json: unknown; usage: Usage }> {
  const res = await fetch(`${ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text }, { inline_data: { mime_type: image.mime, data: image.bytes.toString("base64") } }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`Képelemzés hiba (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const out: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text ?? "").join("") ?? "";
  const usage = {
    tokensIn: data?.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: (data?.usageMetadata?.candidatesTokenCount ?? 0) + (data?.usageMetadata?.thoughtsTokenCount ?? 0),
  };
  try {
    return { json: JSON.parse(out.replace(/^```(?:json)?\s*|\s*```$/g, "")), usage };
  } catch {
    throw new Error("A képelemző nem adott értelmezhető választ. Próbáld újra, vagy tölts fel élesebb képet.");
  }
}

// 1. LÉPCSŐ — hirdetési lapoknál az alaprajz sokszor csak a kép egy része (logó, fotók, táblázat körülötte).
const LOCATE_PROMPT = `This image contains an apartment floor plan, possibly as part of a marketing sheet (logos, photos, site plan, legend table around it).
Return ONLY JSON:
{
  "planBox": [x1, y1, x2, y2],   // bounding box of the MAIN apartment floor plan drawing only (including its terraces/balconies), on a 0-1000 normalized grid of the whole image (x from left, y from top). Exclude site plans, photos, logos, legends.
  "legend": [{ "name": string, "area": number, "outdoor": boolean }]   // every room row of a room/area table or legend if there is one (name exactly as written, area in m²). Exclude whole-flat totals ("Lakás méret", "flat size", "összesen"). Empty if there is no table.
}`;

type Located = { box: [number, number, number, number] | null; legend: { name: string; area: number; outdoor: boolean }[] };

function parseLocated(j: unknown): Located {
  const o = (j ?? {}) as { planBox?: unknown; legend?: unknown };
  const b = Array.isArray(o.planBox) && o.planBox.length === 4 && o.planBox.every((v) => typeof v === "number") ? (o.planBox as [number, number, number, number]) : null;
  const ok = b && b[2] > b[0] + 50 && b[3] > b[1] + 50 && b[0] >= 0 && b[1] >= 0 && b[2] <= 1000 && b[3] <= 1000;
  const legend = (Array.isArray(o.legend) ? o.legend : [])
    .filter((r): r is { name: string; area: number; outdoor?: boolean } => !!r && typeof r.name === "string" && typeof r.area === "number" && r.area > 0 && r.area < 300)
    .map((r) => ({ name: r.name.slice(0, 60), area: r.area, outdoor: r.outdoor === true }))
    .slice(0, 30);
  return { box: ok ? b : null, legend };
}

export async function digitizeFloorplan(file: { bytes: Buffer; mime: string }, hand: boolean): Promise<DigitizeResult> {
  const cfg = floorplan3dConfig();
  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!apiKey) throw new Error("Hiányzó GOOGLE_AI_STUDIO_API_KEY.");
  const t0 = Date.now();
  const usage: Usage = { tokensIn: 0, tokensOut: 0 };
  const add = (u: Usage) => { usage.tokensIn += u.tokensIn; usage.tokensOut += u.tokensOut; };

  // Telefonfotó: a tájolást a képbe „égetjük", hogy a modell és a méretezés ugyanazt a képet lássa.
  let bytes = file.bytes, mime = file.mime;
  if (mime !== "application/pdf") {
    bytes = await sharp(file.bytes).rotate().png().toBuffer();
    mime = "image/png";
  }
  const [W, H] = await imageSize(bytes, mime);

  // 1. lépcső (csak képnél): hol az alaprajz + jelmagyarázat-táblázat. Ha az alaprajz a kép kis része → kivágás, nagyítás.
  let located: Located = { box: null, legend: [] };
  let crop = { left: 0, top: 0, factor: 1 };
  let work = { bytes, mime, w: W, h: H };
  if (mime !== "application/pdf") {
    const l = await callVision(apiKey, cfg.visionModel, LOCATE_PROMPT, { bytes: await sharp(bytes).resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).png().toBuffer(), mime });
    add(l.usage);
    located = parseLocated(l.json);
    const b = located.box;
    const share = b ? ((b[2] - b[0]) * (b[3] - b[1])) / 1e6 : 1;
    if (b && share < 0.7) {
      const m = 0.03; // 3% ráhagyás minden oldalon
      const left = Math.max(0, Math.floor(((b[0] / 1000) - m) * W)), top = Math.max(0, Math.floor(((b[1] / 1000) - m) * H));
      const right = Math.min(W, Math.ceil(((b[2] / 1000) + m) * W)), bottom = Math.min(H, Math.ceil(((b[3] / 1000) + m) * H));
      const cw = right - left, ch = bottom - top;
      const factor = Math.min(3, 2400 / Math.max(cw, ch)); // a kivágott alaprajz hosszabb oldala ~2400 px
      const out = await sharp(bytes).extract({ left, top, width: cw, height: ch }).resize({ width: Math.round(cw * factor), height: Math.round(ch * factor) }).png().toBuffer();
      crop = { left, top, factor };
      work = { bytes: out, mime: "image/png", w: Math.round(cw * factor), h: Math.round(ch * factor) };
    } else if (Math.max(W, H) > 3000) {
      const factor = 3000 / Math.max(W, H);
      work = { bytes: await sharp(bytes).resize({ width: Math.round(W * factor) }).png().toBuffer(), mime: "image/png", w: Math.round(W * factor), h: Math.round(H * factor) };
      crop = { left: 0, top: 0, factor };
    }
  }

  // 2. lépcső: digitalizálás (a táblázat szövegként is megy, hogy a párosítás biztosabb legyen)
  const legendHint = located.legend.length
    ? `\n\nROOM TABLE found next to the plan (use these names and areas; match each row to a room on the plan):\n${located.legend.map((r) => `- ${r.name}: ${r.area} m²${r.outdoor ? " (outdoor)" : ""}`).join("\n")}`
    : "";
  const d = await callVision(apiKey, cfg.visionModel, prompt(hand) + legendHint, { bytes: work.bytes, mime: work.mime });
  add(d.usage);

  let raw = d.json as RawDigitized;
  let { plan, stats } = normalizeDigitized(raw, work.w, work.h, cfg.defaultCeilingHeight, located.legend);
  if (!plan.rooms.length) throw new Error("Nem találtam helyiségeket az alaprajzon. Élesebb, felülről készült képpel próbáld újra.");

  // ÖNELLENŐRZŐ KÖR (2026-10-16): ugyanaz a rajz kétszer digitalizálva eltérő körvonalat adhat (pl. 8,79 vs 7,99 m²). Ha egy
  // helyiség a kiírt m²-től a tűrésen túl tér el, egyszer újrarajzoltatjuk — a hibás helyiségek NEVÉVEL és a mért eltéréssel —,
  // és a kisebb összeltérésű eredmény marad. Költség: +1 képelemző-hívás, csak ha kell (config: digitizeRefineRounds).
  const score = (pl: FloorPlan) => checkPlan(pl, cfg.areaTolerancePct).rooms.reduce((sum, c) => sum + (c.diffPct === null ? 0 : Math.max(0, Math.abs(c.diffPct) - cfg.areaTolerancePct)), 0)
    + Math.max(0, (raw.rooms?.length ?? 0) - pl.rooms.length) * 50;
  let refined = 0;
  for (let round = 0; round < cfg.digitizeRefineRounds; round++) {
    const bad = checkPlan(plan, cfg.areaTolerancePct).rooms.filter((c) => c.diffPct !== null && Math.abs(c.diffPct) > cfg.areaTolerancePct);
    if (!bad.length) break;
    const list = bad.map((c) => { const r = plan.rooms.find((x) => x.id === c.roomId)!; return `- "${r.name}": written ${c.declared} m², your outline gives ${c.area.toFixed(2)} m² (${c.diffPct! > 0 ? "+" : ""}${c.diffPct!.toFixed(1)}%)`; }).join("\n");
    const fix = `\n\nSELF-CHECK: your previous answer was:\n${JSON.stringify(raw).slice(0, 12000)}\n\nThese rooms do not match their written area:\n${list}\nRe-trace ONLY these rooms more carefully (notches, shafts, slanted walls, the exact inner wall faces), keep every other room, opening and dimension as before, and return the COMPLETE JSON again in the same format.`;
    const r2 = await callVision(apiKey, cfg.visionModel, prompt(hand) + legendHint + fix, { bytes: work.bytes, mime: work.mime });
    add(r2.usage);
    const n2 = normalizeDigitized(r2.json as RawDigitized, work.w, work.h, cfg.defaultCeilingHeight, located.legend);
    refined++;
    if (n2.plan.rooms.length && score(n2.plan) < score(plan)) { raw = r2.json as RawDigitized; plan = n2.plan; stats = n2.stats; }
  }
  plan = applyDoorDefaults(plan);   // erkély-/loggiaajtó: üvegajtó, becsukva; bejárati ajtó: becsukva

  // az eredeti kép elhelyezése a terv alatt (kivágás + nagyítás visszaszámolva)
  const mpp = stats.metersPerPixel;
  stats.imageSize = [W * crop.factor, H * crop.factor];
  stats.imageOffset = [stats.imageOffset[0] + crop.left * crop.factor * mpp, stats.imageOffset[1] + crop.top * crop.factor * mpp];

  const costUsd = (usage.tokensIn * cfg.visionUsdPerMTokIn + usage.tokensOut * cfg.visionUsdPerMTokOut) / 1e6;
  return { plan, stats: { ...stats, model: cfg.visionModel, seconds: Math.round((Date.now() - t0) / 100) / 10, ...usage, costUsd, refinedRounds: refined } };
}
