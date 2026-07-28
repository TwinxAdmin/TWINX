// Shotstack — a videó összeállítása: kártyák + fotók (Ken Burns zoommal) + zene.
// Teszthez SHOTSTACK_ENV=stage, élesben 'v1'.
const ENV = process.env.SHOTSTACK_ENV || "stage";
const BASE = `https://api.shotstack.io/${ENV}`;

export type TimelineClip = {
  kind: "image" | "video";
  src: string;
  length: number;      // mp
  zoom?: boolean;      // Ken Burns (csak képre)
};

/**
 * Render beküldése: a klipek sorban, fade áttűnésekkel; a zene a teljes videó
 * alatt szól és a végén leúszik. A callback URL-re jön a kész/failed jelzés.
 */
export async function submitVideoRender(params: {
  clips: TimelineClip[];
  musicUrl: string | null;
  width: number;
  height: number;
  callbackUrl: string;
}): Promise<string> {
  const apiKey = process.env.SHOTSTACK_API_KEY;
  if (!apiKey) throw new Error("Hiányzó SHOTSTACK_API_KEY.");

  let t = 0;
  const zoomEffects = ["zoomIn", "zoomOut", "slideLeft", "slideRight"];
  let zi = 0;
  const clips = params.clips.map((c) => {
    const clip: Record<string, unknown> = {
      asset: { type: c.kind, src: c.src },
      start: t,
      length: c.length,
      fit: "cover",
      transition: { in: "fade", out: "fade" },
    };
    if (c.kind === "image" && c.zoom) {
      // Váltakozó Ken Burns irányok, hogy ne legyen monoton.
      clip.effect = zoomEffects[zi % zoomEffects.length];
      zi++;
    }
    t += c.length;
    return clip;
  });

  const body: Record<string, unknown> = {
    timeline: {
      background: "#000000",
      ...(params.musicUrl ? { soundtrack: { src: params.musicUrl, effect: "fadeOut", volume: 1 } } : {}),
      tracks: [{ clips }],
    },
    output: {
      format: "mp4",
      size: { width: params.width, height: params.height },
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

/** Render állapot lekérése (tartalék a webhook mellé). */
export async function getRenderStatus(id: string): Promise<{ status: string; url: string | null; error: string | null }> {
  const apiKey = process.env.SHOTSTACK_API_KEY;
  if (!apiKey) throw new Error("Hiányzó SHOTSTACK_API_KEY.");
  const res = await fetch(`${BASE}/render/${id}`, { headers: { "x-api-key": apiKey } });
  if (!res.ok) throw new Error(`Shotstack státusz hiba (${res.status}).`);
  const data = await res.json();
  return {
    status: String(data?.response?.status ?? "unknown"),
    url: (data?.response?.url as string) ?? null,
    error: (data?.response?.error as string) ?? null,
  };
}
