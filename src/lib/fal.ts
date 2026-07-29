// fal.ai — kép-feljavítás (Feljavítás mód). Alap modell: clarity-upscaler, ami
// controllable img2img: creativity = denoise strength, resemblance = mennyire tartja az
// eredetit, és VAN negative_prompt. Fizess-ahogy-használod, nincs havidíj.
// A modell és a paraméterek env-ből felülírhatók.
const FAL_BASE = "https://fal.run";
const FAL_QUEUE = "https://queue.fal.run";
const FAL_MODEL = process.env.FAL_ENHANCE_MODEL || "fal-ai/clarity-upscaler";

// Image-to-Video a videó PRO csomag első klipjéhez (aszinkron, webhookkal).
// A modell env-ből cserélhető (költség/minőség szerint).
const FAL_I2V_MODEL = process.env.FAL_I2V_MODEL || "fal-ai/kling-video/v1.6/standard/image-to-video";

// A videó-modul (admin-szerkeszthető) alap-promptja — a prompts.ts is ezt használja.
// PRO: minden snitt ÉL — lágy napszakváltás, beszűrődő napsugarak, filmes kameramozgás.
// Emberek és állatok SOHA (túl sok a hibalehetőség), a szoba és a bútorok változatlanok.
export const VIDEO_DEFAULT_PROMPT =
  "Cinematic real-estate interior showcase, photorealistic, high-end architectural cinematography. " +
  "The camera stays inside the room and frames the interior — it never travels toward or into the window. " +
  "Calm, inviting, premium mood. The room, furniture and layout stay exactly as in the photo.";

// Amit MINDIG kerüljön a modell. Itt tiltjuk a monotóniát is: ne az ablak felé menjen,
// és ne maradjon statikus a fény (a napszakváltás a lényeg).
export const VIDEO_NEGATIVE_PROMPT =
  process.env.FAL_I2V_NEGATIVE ||
  "people, person, human, face, hands, pets, animals, text, watermark, logo, " +
  "camera flying out the window, zooming into the window, window filling the frame, " +
  "static unchanging lighting, flat constant light, no change in light, " +
  "distorted geometry, warping walls, melting furniture, flickering, moving furniture, " +
  "camera shake, blurry, low quality, cartoon";

/** Snittenként MÁS kameramozgás — enélkül minden klip ugyanaz lenne. */
const CAMERA_MOVES = [
  "Slow cinematic dolly-in toward the center of the room, subtle parallax.",
  "Slow lateral tracking shot gliding to the right across the room, revealing depth.",
  "Slow, gentle crane movement: the camera rises a little and tilts down over the space.",
  "Slow pull-back dolly-out, the room opens up and reveals more of the interior.",
  "Very slow arc: the camera drifts to the left around the room, smooth parallax.",
];

/**
 * A snitt FŐ ESEMÉNYE a napszakváltás — nem a kameramozgás, és nem az, hogy „besüt a nap".
 * Minden klip egy látható átalakulás: a nappali fényből naplementébe fordul a szoba,
 * közben az árnyékok végigvándorolnak a padlón és a színhőmérséklet is átfordul.
 * A klipek együtt egy folyamatos ívet adnak: reggel → dél → délután → aranyló naplemente.
 */
const LIGHT_ARC = [
  "The shot begins in cool, bluish morning light and transforms into warm, golden mid-morning sunlight. " +
    "A visible band of sunlight sweeps across the floor as the sun climbs, shadows of the window frame " +
    "travel measurably over the floorboards and walls, and the whole room warms from cold grey-blue to soft amber.",
  "The shot begins in bright, neutral midday light and transforms into warm late-afternoon sun. " +
    "The pools of light on the floor visibly slide and stretch, shadows lengthen across the room, " +
    "and the colour temperature drifts from clean white daylight into rich honey tones.",
  "The shot begins in warm afternoon light and transforms into the first glow of golden hour. " +
    "Long shadows crawl across the floor and furniture, the light turns thick and amber, " +
    "and the mood of the room shifts from bright and airy to warm and intimate.",
  "The shot begins in golden-hour light and transforms into a deep, glowing sunset. " +
    "The sunlight rakes low across the room in long dramatic shafts, shadows stretch far over the floor, " +
    "the air glows amber-orange and the whole space becomes warm, cinematic and inviting.",
];

/** Egy snitt teljes prompja: napszakváltás (fő esemény) + kameramozgás + alap prompt. */
export function videoClipPrompt(index: number, total: number, base?: string): string {
  // A klipeket az ív mentén osztjuk el: az UTOLSÓ mindig a naplemente.
  const arc =
    index === total - 1
      ? LIGHT_ARC[LIGHT_ARC.length - 1]
      : LIGHT_ARC[Math.min(index, LIGHT_ARC.length - 2)];
  const move = CAMERA_MOVES[index % CAMERA_MOVES.length];
  return (
    `Dramatic cinematic time-of-day transition — this lighting change is the main action of the shot. ${arc} ` +
    `The change in light is continuous and clearly visible from the first frame to the last. ` +
    `Camera movement is slow and secondary to the light: ${move} ` +
    `${base || VIDEO_DEFAULT_PROMPT}`
  );
}

const I2V_PROMPT = VIDEO_DEFAULT_PROMPT;

/**
 * AI-mozgás egy fotóból (queue + webhook). A visszatérési érték a fal request id.
 * A kész videó URL-je a webhookban érkezik (payload.video.url).
 */
export async function submitImageToVideoFal(params: {
  imageUrl: string;
  aspectRatio: "1:1" | "9:16";
  webhookUrl: string;
  prompt?: string;
}): Promise<{ requestId: string; statusUrl: string | null; responseUrl: string | null }> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("Hiányzó FAL_KEY.");

  const url = `${FAL_QUEUE}/${FAL_I2V_MODEL}?fal_webhook=${encodeURIComponent(params.webhookUrl)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: params.imageUrl,
      prompt: params.prompt || I2V_PROMPT,
      negative_prompt: VIDEO_NEGATIVE_PROMPT,
      duration: "5",
      aspect_ratio: params.aspectRatio,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI-mozgás hiba (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const id: string | undefined = data?.request_id;
  if (!id) throw new Error("A fal.ai nem adott request id-t.");
  return {
    requestId: id,
    statusUrl: (data?.status_url as string) ?? null,
    responseUrl: (data?.response_url as string) ?? null,
  };
}

/**
 * Az AI-klip állapota lekérdezéssel (biztonsági háló, ha a webhook nem érkezik meg
 * — pl. localhoston). A status/response URL-t a beküldés válasza adja; ha hiányzik,
 * a modell azonosítójából állítjuk össze.
 */
export async function getFalVideoResult(params: {
  requestId: string;
  statusUrl?: string | null;
  responseUrl?: string | null;
}): Promise<{ status: "pending" | "done" | "failed"; videoUrl: string | null; detail: string }> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("Hiányzó FAL_KEY.");
  const app = FAL_I2V_MODEL.split("/").slice(0, 2).join("/"); // pl. fal-ai/kling-video
  const statusUrl = params.statusUrl || `${FAL_QUEUE}/${app}/requests/${params.requestId}/status`;
  const responseUrl = params.responseUrl || `${FAL_QUEUE}/${app}/requests/${params.requestId}`;
  const headers = { Authorization: `Key ${key}` };

  const sRes = await fetch(statusUrl, { headers });
  if (!sRes.ok) {
    // FONTOS: ezt NE tüntessük fel „még dolgozik"-ként, mert akkor a job örökre várna.
    const body = (await sRes.text()).slice(0, 200);
    return { status: "pending", videoUrl: null, detail: `fal státusz HTTP ${sRes.status}: ${body}` };
  }
  const sData = await sRes.json();
  const s = String(sData?.status ?? "").toUpperCase();
  const queue = sData?.queue_position;
  if (s === "IN_QUEUE") return { status: "pending", videoUrl: null, detail: `sorban áll${queue != null ? ` (${queue}.)` : ""}` };
  if (s === "IN_PROGRESS") return { status: "pending", videoUrl: null, detail: "generálás alatt" };
  if (s && s !== "COMPLETED") return { status: "failed", videoUrl: null, detail: `fal állapot: ${s}` };

  const rRes = await fetch(responseUrl, { headers });
  if (!rRes.ok) {
    const body = (await rRes.text()).slice(0, 200);
    return { status: "pending", videoUrl: null, detail: `fal eredmény HTTP ${rRes.status}: ${body}` };
  }
  const rData = await rRes.json();
  const videoUrl: string | null = rData?.video?.url ?? rData?.url ?? null;
  return videoUrl
    ? { status: "done", videoUrl, detail: "kész" }
    : { status: "failed", videoUrl: null, detail: "a fal nem adott videó URL-t" };
}

// Háttéreltávolítás (logó-tisztítás) — BiRefNet v2. Csak akkor hívjuk, ha az ingyenes
// kliensoldali kivágás nem adott jó eredményt. Arculatonként jellemzően egyszeri.
export async function removeBackgroundFal(dataUri: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("Hiányzó FAL_KEY.");

  const model = process.env.FAL_BG_REMOVE_MODEL || "fal-ai/birefnet/v2";
  const res = await fetch(`${FAL_BASE}/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: dataUri, output_format: "png" }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Logó-tisztítás hiba (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const url: string | undefined = data?.image?.url ?? data?.images?.[0]?.url;
  if (!url) throw new Error("A logó-tisztítás nem adott vissza képet.");

  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error("A tisztított logó letöltése nem sikerült.");
  return {
    bytes: Buffer.from(await imgRes.arrayBuffer()),
    mimeType: data?.image?.content_type ?? "image/png",
  };
}

export type FalEnhanceParams = {
  dataUri: string;        // base64 data URI (data:image/jpeg;base64,...)
  prompt: string;
  negativePrompt?: string;
  upscaleFactor?: number; // felülírja az alap upscale_factor-t (pl. AI Upscaler opció)
  creativity?: number;    // denoise strength — magasabb: a prompt (fény/stílus) jobban érvényesül
  resemblance?: number;   // szerkezet-hűség — alacsonyabb: több szabadság a látványnak
};

export async function enhanceImageFal(
  params: FalEnhanceParams
): Promise<{ bytes: Buffer; mimeType: string }> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("Hiányzó FAL_KEY.");

  const res = await fetch(`${FAL_BASE}/${FAL_MODEL}`, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: params.dataUri,
      prompt: params.prompt,
      negative_prompt: params.negativePrompt ?? "",
      // creativity = denoise strength: alacsony -> hű az eredetihez, mégis feljavít.
      creativity: params.creativity ?? Number(process.env.FAL_ENHANCE_CREATIVITY || 0.3),
      // resemblance = mennyire tartsa az eredeti szerkezetet (magasabb -> hűbb).
      resemblance: params.resemblance ?? Number(process.env.FAL_ENHANCE_RESEMBLANCE || 0.8),
      upscale_factor: params.upscaleFactor ?? Number(process.env.FAL_ENHANCE_UPSCALE || 1),
      guidance_scale: 4,
      num_inference_steps: Number(process.env.FAL_ENHANCE_STEPS || 18),
      enable_safety_checker: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Képjavító hiba (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const url: string | undefined = data?.image?.url ?? data?.images?.[0]?.url;
  if (!url) throw new Error("A képjavító nem adott vissza képet.");

  const imgRes = await fetch(url);
  if (!imgRes.ok) throw new Error("A javított kép letöltése nem sikerült.");
  const bytes = Buffer.from(await imgRes.arrayBuffer());
  const mimeType: string = data?.image?.content_type ?? imgRes.headers.get("content-type") ?? "image/png";
  return { bytes, mimeType };
}
