// fal.ai — kép-feljavítás (Feljavítás mód). Alap modell: clarity-upscaler, ami
// controllable img2img: creativity = denoise strength, resemblance = mennyire tartja az
// eredetit, és VAN negative_prompt. Fizess-ahogy-használod, nincs havidíj.
// A modell és a paraméterek env-ből felülírhatók.
const FAL_BASE = "https://fal.run";
const FAL_MODEL = process.env.FAL_ENHANCE_MODEL || "fal-ai/clarity-upscaler";

export type FalEnhanceParams = {
  dataUri: string;        // base64 data URI (data:image/jpeg;base64,...)
  prompt: string;
  negativePrompt?: string;
  upscaleFactor?: number; // felülírja az alap upscale_factor-t (pl. AI Upscaler opció)
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
      creativity: Number(process.env.FAL_ENHANCE_CREATIVITY || 0.3),
      // resemblance = mennyire tartsa az eredeti szerkezetet (magasabb -> hűbb).
      resemblance: Number(process.env.FAL_ENHANCE_RESEMBLANCE || 0.8),
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
