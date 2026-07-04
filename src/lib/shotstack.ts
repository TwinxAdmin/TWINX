// Shotstack — a Luma snittek összevágása zenével, áttűnésekkel, adott formátumban.
// A pontos API-formátum élesben igazolandó. Teszthez SHOTSTACK_ENV=stage.
const ENV = process.env.SHOTSTACK_ENV || "stage";
const BASE = `https://api.shotstack.io/${ENV}`;
const CLIP_SECONDS = Number(process.env.VIDEO_CLIP_SECONDS || 5);

export async function submitRender(params: {
  clipUrls: string[];
  musicUrl: string;
  aspectRatio: string; // '16:9' | '9:16' | '1:1'
  callbackUrl: string;
}): Promise<string> {
  const apiKey = process.env.SHOTSTACK_API_KEY;
  if (!apiKey) throw new Error("Hiányzó SHOTSTACK_API_KEY.");

  const clips = params.clipUrls.map((src, i) => ({
    asset: { type: "video", src },
    start: i * CLIP_SECONDS,
    length: CLIP_SECONDS,
    transition: { in: "fade", out: "fade" },
  }));

  const body = {
    timeline: {
      background: "#000000",
      soundtrack: { src: params.musicUrl, effect: "fadeOut" },
      tracks: [{ clips }],
    },
    output: {
      format: "mp4",
      resolution: "1080",
      aspectRatio: params.aspectRatio,
    },
    callback: params.callbackUrl,
  };

  const res = await fetch(`${BASE}/render`, {
    method: "POST",
    headers: { "x-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shotstack hiba (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const id = data?.response?.id;
  if (!id) throw new Error("A Shotstack nem adott render id-t.");
  return id as string;
}
