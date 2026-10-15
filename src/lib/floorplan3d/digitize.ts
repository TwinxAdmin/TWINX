// Digitalizálás 1. fele (CSAK szerveroldal): alaprajz-kép / PDF → Gemini képelemzés → nyers JSON → normalizeDigitized().
// Kézi rajz fotójánál ugyanez fut, a prompt jelzi, hogy kézi rajzról van szó (pontatlanabb vonalak).
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { normalizeDigitized, type NormalizeStats, type RawDigitized } from "@/lib/floorplan3d/normalize";
import { ROOM_KINDS, type FloorPlan } from "@/lib/floorplan3d/plan";
import { floorplan3dConfig } from "@/lib/floorplan3d/config";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export type DigitizeResult = {
  plan: FloorPlan;
  stats: NormalizeStats & { model: string; seconds: number; tokensIn: number; tokensOut: number; costUsd: number };
};

function prompt(hand: boolean): string {
  return `You are an architectural floor plan digitizer. Analyze the attached ${hand ? "PHOTO OF A HAND-DRAWN" : ""} apartment floor plan and return ONLY JSON.

COORDINATES: every x,y is on a normalized 0-1000 grid of the WHOLE image (x = horizontal from the left edge, y = vertical from the top edge).

Return:
{
  "ceilingHeight": number|null,            // only if written on the plan (e.g. "bm. 2,70")
  "rooms": [{
    "name": string,                          // exactly as written, in the plan's language (e.g. "Nappali", "Fürdő", "Terasz")
    "kind": one of ${JSON.stringify(ROOM_KINDS.map((k) => k.value))},
    "areaLabel": number|null,                // the written m² of this room (e.g. 13.07), null if not written
    "polygon": [[x,y], ...],                 // the INNER (clear) outline of the room along the inner face of its walls, corners in order. Use as few corners as possible; rectangles have 4.
    "openTo": [number]                       // indexes of rooms connected to this one WITHOUT a wall (only a dashed line / floor change between them, e.g. open-plan kitchen–living room). Empty if none.
  }],
  "openings": [{
    "kind": "door"|"window",                 // a window/French window/balcony door in an exterior wall counts as "window" only if it has a sill; full-height glazed doors are "door"
    "room": number,                          // index in rooms of the room it belongs to (for a door between two rooms: the smaller room)
    "x1": number, "y1": number, "x2": number, "y2": number   // the two ends of the opening along the wall
  }],
  "dimensions": [{
    "meters": number,                        // a written dimension converted to meters (e.g. "2,85" → 2.85; "285" cm → 2.85)
    "x1": number, "y1": number, "x2": number, "y2": number   // the two ends of the dimension line / the measured span
  }],
  "notes": [string]                          // short notes about anything uncertain (unreadable labels, guessed walls). WRITE THE NOTES IN HUNGARIAN.
}

RULES:
- Include every room including outdoor terraces/balconies (kind "terasz"). Ignore private gardens, furniture, sanitary fixtures, grid axes, hatching and watermarks.
- Room outlines must be accurate: follow the inner wall faces, walls are the gaps between rooms. Where two rooms are separated only by a dashed line (no wall), their outlines must touch along that line and list each other in "openTo".
- Give at least 3-6 dimensions that are clearly written, preferring long ones (room widths/depths written inside rooms are ideal).
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

export async function digitizeFloorplan(file: { bytes: Buffer; mime: string }, hand: boolean): Promise<DigitizeResult> {
  const cfg = floorplan3dConfig();
  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!apiKey) throw new Error("Hiányzó GOOGLE_AI_STUDIO_API_KEY.");

  // Telefonfotó: a tájolást a képbe „égetjük", hogy a modell és a méretezés ugyanazt a képet lássa.
  let bytes = file.bytes, mime = file.mime;
  if (mime !== "application/pdf") {
    bytes = await sharp(file.bytes).rotate().resize({ width: 3000, height: 3000, fit: "inside", withoutEnlargement: true }).png().toBuffer();
    mime = "image/png";
  }
  const [w, h] = await imageSize(bytes, mime);

  const t0 = Date.now();
  const res = await fetch(`${ENDPOINT}/${cfg.visionModel}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt(hand) }, { inline_data: { mime_type: mime, data: bytes.toString("base64") } }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`Képelemzés hiba (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text ?? "").join("") ?? "";
  let raw: RawDigitized;
  try {
    raw = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new Error("A képelemző nem adott értelmezhető választ. Próbáld újra, vagy tölts fel élesebb képet.");
  }

  const { plan, stats } = normalizeDigitized(raw, w, h, cfg.defaultCeilingHeight);
  if (!plan.rooms.length) throw new Error("Nem találtam helyiségeket az alaprajzon. Élesebb, felülről készült képpel próbáld újra.");

  const tokensIn = data?.usageMetadata?.promptTokenCount ?? 0;
  const tokensOut = (data?.usageMetadata?.candidatesTokenCount ?? 0) + (data?.usageMetadata?.thoughtsTokenCount ?? 0);
  const costUsd = (tokensIn * cfg.visionUsdPerMTokIn + tokensOut * cfg.visionUsdPerMTokOut) / 1e6;
  return { plan, stats: { ...stats, model: cfg.visionModel, seconds: Math.round((Date.now() - t0) / 100) / 10, tokensIn, tokensOut, costUsd } };
}
