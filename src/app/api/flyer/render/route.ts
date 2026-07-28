// POST /api/flyer/render — a hirdetés PNG-je Satorival (next/og ImageResponse).
// Pixelpontos, valódi betűkészlettel: nincs levágott ékezet, minden gépen egyforma.
// Bemenet: multipart — a képek (fájlok) + a hirdetés mezői (JSON-stringek).
// Kimenet: PNG. Ingyenes (előnézet); az elfogadás külön, kredittel a /accept-ben.
import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { getBrandingFont } from "@/lib/branding";
import { getFlyerSize, type RenderOpts } from "@/lib/flyer-poster";
import { buildFlyerElement } from "@/lib/flyer-satori";
import { loadGoogleFont, googleFamilyOf } from "@/lib/google-font";
import type { FlyerProfileData } from "@/lib/flyer-template";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const FALLBACK_FAMILY = "Montserrat";

async function toDataUri(f: File): Promise<string> {
  const b64 = Buffer.from(await f.arrayBuffer()).toString("base64");
  return `data:${f.type || "image/jpeg"};base64,${b64}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Bejelentkezés szükséges.", { status: 401 });

  let form: FormData;
  try { form = await request.formData(); } catch { return new Response("Érvénytelen kérés.", { status: 400 }); }

  const files = form.getAll("images").filter((v): v is File => v instanceof File && v.size > 0).slice(0, 4);
  if (!files.length) return new Response("Adj hozzá legalább egy képet.", { status: 422 });
  if (files.some((f) => !ALLOWED.includes(f.type))) return new Response("Csak JPG, PNG vagy WEBP.", { status: 422 });

  let profile: FlyerProfileData;
  try { profile = JSON.parse(String(form.get("profile") ?? "{}")) as FlyerProfileData; }
  catch { return new Response("Hibás arculat.", { status: 400 }); }

  const size = getFlyerSize(String(form.get("size") ?? "1:1"));
  const mood = String(form.get("mood") ?? "luxus");
  const watermark = String(form.get("watermark") ?? "") === "1";
  let chips: string[] = [];
  try { chips = JSON.parse(String(form.get("chips") ?? "[]")) as string[]; } catch { chips = []; }

  let details: Record<string, string> = {};
  try { details = JSON.parse(String(form.get("details") ?? "{}")) as Record<string, string>; } catch { details = {}; }

  const text = {
    title: String(form.get("title") ?? ""),
    subtitle: String(form.get("subtitle") ?? ""),
    price: String(form.get("price") ?? ""),
    chips,
    badge: String(form.get("badge") ?? "ELADÓ"),
    details,
  };

  try {
    const images = await Promise.all(files.map(toDataUri));

    // A hirdetésen előforduló karakterek (a betű glyph-lefedettségéhez) + alapkészlet.
    const used = [
      text.title, text.subtitle, text.price, text.badge, ...text.chips,
      profile.display_name, profile.company, profile.title, profile.phone, profile.email, profile.website,
      "ELADÓ IRÁNYÁR ELŐNÉZET TWINX",
      "AÁBCDEÉFGHIÍJKLMNOÓÖŐPQRSTUÚÜŰVWXYZ",
      "aábcdeéfghiíjklmnoóöőpqrstuúüűvwxyz",
      "0123456789.,:;·-–—/()%²+&@ ",
    ].join(" ");
    const charset = Array.from(new Set(used.split(""))).join("");

    // Betűk: az arculati család, tartalékkal.
    const wanted = googleFamilyOf(getBrandingFont(profile.font).family);
    let family = wanted;
    let loaded = await loadGoogleFont(wanted, charset).catch(() => null);
    if (!loaded) { family = FALLBACK_FAMILY; loaded = await loadGoogleFont(FALLBACK_FAMILY, charset); }
    const fonts = loaded.map((f) => ({
      name: family, data: f.data, style: "normal" as const,
      weight: (f.weight >= 700 ? 700 : 400) as 400 | 700,
    }));

    const opts: RenderOpts = {
      images, width: size.w, height: size.h, profile, text, mood, watermark,
    };
    const element = buildFlyerElement(opts, family);

    return new ImageResponse(element, { width: size.w, height: size.h, fonts });
  } catch (err) {
    return new Response("Render hiba: " + (err as Error).message, { status: 500 });
  }
}
