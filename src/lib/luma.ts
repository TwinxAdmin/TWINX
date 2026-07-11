// Luma Labs (Dream Machine) — Image-to-Video. Keyframe (frame0 = kép URL) + callback_url.
// A modell/hossz env-ből felülírható. A pontos API-formátum élesben igazolandó.
const ENDPOINT = "https://api.lumalabs.ai/dream-machine/v1/generations";
const MODEL = process.env.LUMA_MODEL || "ray-2";
const DURATION = process.env.LUMA_DURATION || "5s";
// 720p a költséghatékony klipekhez (a Shotstack úgyis 1080p-re rendereli a végeredményt).
const RESOLUTION = process.env.LUMA_RESOLUTION || "720p";

const DEFAULT_PROMPT =
  "Slow, subtle cinematic camera movement across the interior, gentle parallax, " +
  "photorealistic real-estate showcase. Keep the room unchanged.";

// A videó-modul finomítható promptja (nincs zárolt változó-blokk).
export const VIDEO_DEFAULT_PROMPT = DEFAULT_PROMPT;

export async function submitImageToVideo(params: {
  imageUrl: string;
  aspectRatio: string; // '16:9' | '9:16' | '1:1'
  callbackUrl: string;
  prompt?: string;
}): Promise<string> {
  const apiKey = process.env.LUMA_API_KEY;
  if (!apiKey) throw new Error("Hiányzó LUMA_API_KEY.");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      prompt: params.prompt ?? DEFAULT_PROMPT,
      aspect_ratio: params.aspectRatio,
      duration: DURATION,
      resolution: RESOLUTION,
      keyframes: { frame0: { type: "image", url: params.imageUrl } },
      callback_url: params.callbackUrl,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Luma hiba (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  if (!data?.id) throw new Error("A Luma nem adott vissza generation id-t.");
  return data.id as string;
}
