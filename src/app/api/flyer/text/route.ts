// POST /api/flyer/text — AI hirdetés-szöveg a megadott alapadatokból + hangnemből.
// Csak a megadott tényekből dolgozik (webkeresés kikapcsolva), szigorú JSON választ kér.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runSonar } from "@/lib/perplexity";
import { buildFlyerCopyPromptActive } from "@/lib/prompts";
import type { FlyerFacts, FlyerText } from "@/lib/flyer";

export const runtime = "nodejs";

const TONE_DESC: Record<string, string> = {
  tenyszeru: "tényszerű, lényegre törő, tárgyilagos",
  marketinges: "lelkes, lendületes, eladás-orientált marketing",
  premium: "elegáns, prémium, választékos",
};

function v(s: unknown): string {
  return typeof s === "string" && s.trim() ? s.trim() : "";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { facts?: Partial<FlyerFacts>; tone?: string };
  try {
    body = (await request.json()) as { facts?: Partial<FlyerFacts>; tone?: string };
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const f = (body.facts ?? {}) as Partial<FlyerFacts>;
  const tone = TONE_DESC[body.tone ?? "marketinges"] ?? TONE_DESC.marketinges;

  // A prompt a hirdetés-modul aktív (finomítható) verziójából + zárolt adat-blokkból áll.
  const prompt = await buildFlyerCopyPromptActive(f, tone);

  let raw: string;
  try {
    raw = await runSonar(prompt, "sonar", { disableSearch: true, temperature: 0.5 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  // JSON kinyerése a válaszból (kódblokk / körítés eltávolítása).
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return NextResponse.json({ error: "Az AI nem adott értelmezhető választ. Próbáld újra." }, { status: 502 });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return NextResponse.json({ error: "Az AI válasza nem volt érvényes. Próbáld újra." }, { status: 502 });
  }

  const arr = (x: unknown): string[] =>
    Array.isArray(x) ? x.map((i) => String(i)).filter((s) => s.trim()) : [];

  const text: FlyerText = {
    title: v(parsed.title),
    subtitle: v(parsed.subtitle),
    price: v(parsed.price) || v(f.price),
    highlights: arr(parsed.highlights).slice(0, 4),
    characteristics: arr(parsed.characteristics).slice(0, 8),
    infra: v(parsed.infra),
    transport: v(parsed.transport),
  };

  return NextResponse.json({ text });
}
