// Képjavító — CSAK szerveroldal.
//  • aspectRatioOf: a bemeneti kép valódi (EXIF-forgatás utáni) arányából a Nano Banana-nak átadandó képarány.
//  • verifyEnhancement: AUTOMATIKUS ELLENŐRZÉS (2026-10-19) — egy olcsó szöveges Gemini-hívás összeveti az eredetit és a
//    javítottat: került-e a képre új tárgy, tér, ablak, ajtó, változott-e rögzített elem vagy a szerkezet.
//  • generateVerified: generálás → ellenőrzés → eltérésnél EGY automatikus újrapróba → ha az is eltér, a kevesebb hibát
//    tartalmazó változat megy vissza „warning" jelöléssel (a felület figyelmeztet). Ingatlanhirdetésben a félrevezető kép tilos.
// Az ellenőrzés hibája (hálózat, értelmezhetetlen válasz) SOHA nem akasztja meg a javítást: „skipped" lesz.
import sharp from "sharp";
import { generateImage } from "@/lib/nanobanana";
import { nearestAspectRatio, type EnhanceMode } from "@/lib/image-enhance";

export async function aspectRatioOf(bytes: Uint8Array): Promise<string | undefined> {
  try {
    const m = await sharp(bytes).metadata();
    const rotated = (m.orientation ?? 1) >= 5; // 5–8: 90°-os forgatás → szélesség és magasság csere
    const w = rotated ? m.height : m.width;
    const h = rotated ? m.width : m.height;
    return w && h ? nearestAspectRatio(w, h) : undefined;
  } catch {
    return undefined; // ismeretlen formátum — a modell dönt, mint eddig
  }
}

// Saját env-kulcs: a „gemini-2.5-flash" ezzel a kulccsal már 404-et ad (2026-10-19), a gemini-3.5-flash a tesztben
// 6/6 esetet helyesen ítélt meg (a két éles hibás képet is). Egy ellenőrzés kb. 6–10 mp.
const VERIFY_MODEL = process.env.ENHANCE_VERIFY_MODEL || "gemini-3.5-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Az ellenőrzés eredménye a képen (a jobs.items-ben is ez marad meg). */
export type EnhanceCheck = "ok" | "fixed" | "warning" | "skipped";
export type Violation = { type: string; what: string };

// Általános szabály, nem képspecifikus: bármilyen helyiségre, bármilyen ingatlanfotóra.
function verifyPrompt(mode: EnhanceMode): string {
  const allowed = mode === "rendrakas"
    ? "changes of light, colour, contrast, sharpness and noise, AND the removal of loose, movable objects (clutter, personal items, textiles, small decor, cables, bins, mats) with the surface behind them rebuilt"
    : "changes of light, colour, contrast, sharpness and noise only";
  return `You are a strict quality inspector for real-estate listing photos. IMAGE 1 is the ORIGINAL photo. IMAGE 2 is an AI-retouched version of it. A listing photo must never show anything that does not exist in the real property.

The ONLY allowed differences are: ${allowed}. Also ignore a slight difference in image size, scale or crop at the edges.

Find every VIOLATION, i.e. anything in IMAGE 2 that is not allowed:
- "added": an object, fitting, fixture, furniture, appliance, lamp, decoration or reflection visible in IMAGE 2 but not in IMAGE 1.
- "moved": an object that is in a clearly different place.
- "structure": a wall, room shape, depth, doorway, opening, window or door that was added, removed, enlarged, shrunk, moved or reshaped.
- "view_changed": what is seen through a doorway, opening, window or glass is a different space or view.
- "fixed_changed": a fixed element (sink, tap, toilet, bath, shower, boiler, radiator, kitchen unit, worktop, tiles or tile pattern, floor material, light fitting) was removed, replaced or visibly changed.
Be precise: only report differences you can clearly see. Do not report the allowed changes.

Answer with ONLY a JSON object, no other text: {"violations":[{"type":"added|moved|structure|view_changed|fixed_changed","what":"<short description in English>"}]}. If there is no violation, answer {"violations":[]}.`;
}

/** Az eredeti és a javított kép összevetése. null = nem sikerült ellenőrizni (ilyenkor nem akasztjuk meg a folyamatot). */
export async function verifyEnhancement(params: {
  original: { bytes: Uint8Array; mimeType: string };
  result: { bytes: Uint8Array; mimeType: string };
  mode: EnhanceMode;
}): Promise<Violation[] | null> {
  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!apiKey) return null;
  const img = (i: { bytes: Uint8Array; mimeType: string }) => ({
    inline_data: { mime_type: i.mimeType, data: Buffer.from(i.bytes).toString("base64") },
  });
  try {
    const res = await fetch(`${ENDPOINT}/${VERIFY_MODEL}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: verifyPrompt(params.mode) },
          { text: "IMAGE 1 (original):" }, img(params.original),
          { text: "IMAGE 2 (retouched):" }, img(params.result),
        ] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const d = await res.json();
    const text: string = d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    const parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")) as { violations?: unknown };
    if (!Array.isArray(parsed.violations)) return null;
    return parsed.violations
      .map((v) => ({ type: String((v as Violation)?.type ?? "other"), what: String((v as Violation)?.what ?? "").slice(0, 200) }))
      .slice(0, 10);
  } catch {
    return null;
  }
}

// Újrapróbánál általános figyelmeztetés — szándékosan NEM nevezzük meg a talált tárgyat (a megnevezés „rárajzoltatja").
const RETRY_SUFFIX = `

IMPORTANT — a previous attempt on this photo was rejected by quality control because it added, moved or changed real elements of the property. Be conservative: change ONLY what the task allows, keep every structural element, opening, fixed fitting and remaining object exactly as in the input, and add nothing.`;

export type VerifiedResult = {
  bytes: Buffer;
  mimeType: string;
  check: EnhanceCheck;
  /** Hány képgenerálás és ellenőrzés futott (költséglogoláshoz). */
  generations: number;
  verifications: number;
};

export async function generateVerified(params: {
  source: { bytes: Uint8Array; mimeType: string };
  prompt: string;
  mode: EnhanceMode;
  /** Mihez mérjük az eredményt (alap: a bemenet). A célzott utójavításnál az EREDETI fotó — így a korábbi körben
   *  becsúszott eltérés is kiderül. */
  verifyAgainst?: { bytes: Uint8Array; mimeType: string };
}): Promise<VerifiedResult> {
  const aspectRatio = await aspectRatioOf(params.source.bytes);
  const reference = params.verifyAgainst ?? params.source;
  const first = await generateImage({ source: params.source, prompt: params.prompt, aspectRatio });
  const v1 = await verifyEnhancement({ original: reference, result: first, mode: params.mode });
  if (v1 === null) return { ...first, check: "skipped", generations: 1, verifications: 1 };
  if (v1.length === 0) return { ...first, check: "ok", generations: 1, verifications: 1 };
  console.warn("[képjavító] ellenőrzés eltérést talált, újrapróba:", JSON.stringify(v1));

  // Egy automatikus újrapróba az EREDETI képről. Ha ez elbukik, az első eredmény megy vissza figyelmeztetéssel.
  let second: { bytes: Buffer; mimeType: string };
  try {
    second = await generateImage({ source: params.source, prompt: params.prompt + RETRY_SUFFIX, aspectRatio });
  } catch {
    return { ...first, check: "warning", generations: 2, verifications: 1 };
  }
  const v2 = await verifyEnhancement({ original: reference, result: second, mode: params.mode });
  if (v2 !== null && v2.length === 0) return { ...second, check: "fixed", generations: 2, verifications: 2 };
  if (v2 !== null) console.warn("[képjavító] az újrapróba is eltér:", JSON.stringify(v2));
  // Mindkettő hibás (vagy a 2. nem ellenőrizhető): a kevesebb eltérést mutató változat, figyelmeztetéssel.
  const pick = v2 !== null && v2.length < v1.length ? second : v2 === null ? second : first;
  return { ...pick, check: "warning", generations: 2, verifications: 2 };
}
