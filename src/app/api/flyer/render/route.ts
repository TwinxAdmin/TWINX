// POST /api/flyer/render — a hirdetés PNG-je Satorival (next/og ImageResponse).
// Pixelpontos, valódi betűkészlettel: nincs levágott ékezet, minden gépen egyforma.
// Bemenet: multipart — a képek (fájlok) + a hirdetés mezői (JSON-stringek).
// Kimenet: PNG. Ingyenes (előnézet); az elfogadás külön, kredittel a /accept-ben.
import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { getBrandingFont } from "@/lib/branding";
import { getFlyerSize, getFlyerTemplate, type RenderOpts } from "@/lib/flyer-poster";
import { buildFlyerElement } from "@/lib/flyer-satori";
import { loadGoogleFont, googleFamilyOf, supportsHungarian } from "@/lib/google-font";
import type { FlyerProfileData } from "@/lib/flyer-template";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const FALLBACK_FAMILY = "Montserrat";
// A magazin sablon FIX címbetűje (nem az arculatból jön) — klasszikus magazin-serif.
const DISPLAY_FAMILY = "Playfair Display";

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
  // A sablon csak az ismert értékek egyike lehet (ismeretlen → prémium).
  const template = getFlyerTemplate(String(form.get("template") ?? "premium")).value;
  const mood = String(form.get("mood") ?? "luxus");
  const watermark = String(form.get("watermark") ?? "") === "1";
  const strList = (key: string, max: number): string[] => {
    try {
      const raw = JSON.parse(String(form.get(key) ?? "[]"));
      return Array.isArray(raw) ? raw.map((x) => String(x ?? "")).slice(0, max) : [];
    } catch { return []; }
  };
  const chips = strList("chips", 4);
  const highlights = strList("highlights", 4).map((s) => s.trim()).filter(Boolean);
  const thumbLabels = strList("thumbLabels", 3);

  let details: Record<string, string> = {};
  try { details = JSON.parse(String(form.get("details") ?? "{}")) as Record<string, string>; } catch { details = {}; }

  const text = {
    title: String(form.get("title") ?? ""),
    subtitle: String(form.get("subtitle") ?? ""),
    price: String(form.get("price") ?? ""),
    chips,
    badge: String(form.get("badge") ?? "ELADÓ"),
    details,
    highlights,
    blurb: String(form.get("blurb") ?? ""),
  };

  try {
    const images = await Promise.all(files.map(toDataUri));

    // A hirdetésen előforduló karakterek (a betű glyph-lefedettségéhez) + alapkészlet.
    const used = [
      text.title, text.subtitle, text.price, text.badge, ...text.chips,
      ...text.highlights, text.blurb, ...thumbLabels,
      profile.display_name, profile.company, profile.title, profile.phone, profile.email, profile.website,
      "ELADÓ IRÁNYÁR ELŐNÉZET TWINX KAPCSOLAT ÁTTEKINTÉS TÍPUS MÉRET ÁLLAPOT",
      "NAPPALI KONYHA HÁLÓSZOBA FÜRDŐSZOBA ÉTKEZŐ ERKÉLY TERASZ KERT ELŐSZOBA FOTÓ",
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

    // A MAGAZIN sablon főcíme fix, elegáns magazin-serifet kap (a többi szöveg
    // marad az arculati betűn). Csak akkor kapcsoljuk be, ha a betű TÉNYLEG
    // tartalmazza a magyar ékezeteket (ő ű Ő Ű) — különben üres négyzet lenne.
    let displayFamily: string | undefined;
    if (template === "openhouse") {
      const disp = await loadGoogleFont(DISPLAY_FAMILY, charset).catch(() => null);
      if (disp && supportsHungarian(disp)) {
        displayFamily = DISPLAY_FAMILY;
        fonts.push(
          ...disp.map((f) => ({
            name: DISPLAY_FAMILY, data: f.data, style: "normal" as const,
            weight: (f.weight >= 700 ? 700 : 400) as 400 | 700,
          }))
        );
      } else if (disp) {
        console.warn(`[flyer] ${DISPLAY_FAMILY}: hiányos magyar ékezetkészlet — arculati betű marad.`);
      }
    }

    const heroPos = {
      x: Math.max(0, Math.min(100, Number(form.get("heroX") ?? 50) || 50)),
      y: Math.max(0, Math.min(100, Number(form.get("heroY") ?? 50) || 50)),
    };
    const heroDim = {
      w: Math.max(0, Number(form.get("heroW") ?? 0) || 0),
      h: Math.max(0, Number(form.get("heroH") ?? 0) || 0),
    };
    let thumbSlots: Array<"row" | "up1" | "up2"> = [];
    try {
      const raw = JSON.parse(String(form.get("thumbSlots") ?? "[]")) as string[];
      thumbSlots = raw.map((s) => (s === "up1" || s === "up2" ? s : "row"));
    } catch { thumbSlots = []; }
    // Nagy felbontás: minden (szöveg, logó, fotó) élesebb; a sablon u-alapú, ezért
    // arányosan skálázódik. Előnézet (vízjeles): 2× — gyors. Végleges: 2,5× — magas
    // minőség, de a renderidő a szerverkorlát alatt marad (a 3× nagy méretnél time-outolt).
    // Env-ből felülírható (FLYER_FINAL_SCALE). A kész képet a kliens JPEG-ként tölti fel.
    const finalScale = Number(process.env.FLYER_FINAL_SCALE) || 2.5;
    const SCALE = watermark ? 2 : finalScale;
    const W = Math.round(size.w * SCALE);
    const H = Math.round(size.h * SCALE);
    const opts: RenderOpts = {
      images, width: W, height: H, profile, text, mood, watermark, template, thumbLabels,
      displayFamily,
      heroPos, thumbSlots, heroDim: heroDim.w && heroDim.h ? heroDim : undefined,
    };
    const element = buildFlyerElement(opts, family);

    return new ImageResponse(element, { width: W, height: H, fonts });
  } catch (err) {
    return new Response("Render hiba: " + (err as Error).message, { status: 500 });
  }
}
