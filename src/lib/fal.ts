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
export const VIDEO_DEFAULT_PROMPT =
  "Slow, elegant cinematic camera move through the interior. Gentle push-in, subtle parallax. " +
  "Photorealistic real-estate showcase. Keep the room, furniture and lighting exactly as in the photo.";
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
}): Promise<string> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("Hiányzó FAL_KEY.");

  const url = `${FAL_QUEUE}/${FAL_I2V_MODEL}?fal_webhook=${encodeURIComponent(params.webhookUrl)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: params.imageUrl,
      prompt: params.prompt || I2V_PROMPT,
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
  return id;
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
