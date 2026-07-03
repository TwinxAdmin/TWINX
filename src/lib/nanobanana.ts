// Google AI Studio — Gemini 2.5 Flash Image ("Nano Banana") Image-to-Image hívás.
// A modell env-ből felülírható (pl. újabb Nano Banana 2: gemini-3.1-flash-image).
const MODEL = process.env.GOOGLE_IMAGE_MODEL || "gemini-2.5-flash-image";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

type InlineImage = { bytes: Uint8Array; mimeType: string };

export type GenerateImageParams = {
  source: InlineImage; // a feltöltött szobakép
  prompt: string;
  reference?: InlineImage; // opcionális stílus-referenciakép (később)
};

export async function generateImage(
  params: GenerateImageParams
): Promise<{ bytes: Buffer; mimeType: string }> {
  const apiKey = process.env.GOOGLE_AI_STUDIO_API_KEY;
  if (!apiKey) throw new Error("Hiányzó GOOGLE_AI_STUDIO_API_KEY.");

  const parts: Array<Record<string, unknown>> = [{ text: params.prompt }];
  parts.push({
    inline_data: {
      mime_type: params.source.mimeType,
      data: Buffer.from(params.source.bytes).toString("base64"),
    },
  });
  if (params.reference) {
    parts.push({
      inline_data: {
        mime_type: params.reference.mimeType,
        data: Buffer.from(params.reference.bytes).toString("base64"),
      },
    });
  }

  const res = await fetch(`${ENDPOINT}/${MODEL}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Nano Banana hiba (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const outParts = data?.candidates?.[0]?.content?.parts ?? [];
  const imgPart = outParts.find(
    (p: Record<string, unknown>) => p.inline_data ?? p.inlineData
  );
  const inline = (imgPart?.inline_data ?? imgPart?.inlineData) as
    | { data?: string; mime_type?: string; mimeType?: string }
    | undefined;

  if (!inline?.data) {
    throw new Error("A Nano Banana nem adott vissza képet.");
  }

  return {
    bytes: Buffer.from(inline.data, "base64"),
    mimeType: inline.mime_type ?? inline.mimeType ?? "image/png",
  };
}
