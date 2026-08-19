// Beszédes cím generálása egy előzmény-sorhoz az elmentett input_data alapján.
// Nincs séma-változás: a usage_history.input_data-ból (az űrlap mezői) építünk címet,
// így a régi előzményekre is visszamenőleg működik.
import { ROOM_TYPES, STYLE_OPTIONS } from "@/lib/visualization";
import { VIDEO_FORMATS } from "@/lib/video";

type Json = Record<string, unknown> | null | undefined;

const FEATURE_LABEL: Record<string, string> = {
  valuation: "Ingatlan értékbecslés",
  "land-valuation": "Telek ellenőrzés",
  visualization: "Látványterv",
  video: "Videó",
  flyer: "Hirdetés",
  "ad-check": "Hirdetés-ellenőrzés",
  menu_generator: "Menü generátor",
};

export function featureLabel(feature: string): string {
  return FEATURE_LABEL[feature] ?? feature;
}

/**
 * A „Korábbi munkák" mappáinak felirata: beszédes cím + egy soros magyarázat,
 * hogy a partner ránézésre tudja, mit talál a mappában.
 *
 * A `featureLabel` rövid (listákba, chipekbe való), ez viszont a mappa-csempére
 * készült — ezért külön, és ezért bővebb.
 */
const FEATURE_FOLDER: Record<string, { title: string; hint: string }> = {
  flyer: { title: "Hirdetésképek", hint: "Posztolásra kész, márkázott képek" },
  valuation: { title: "Értékbecslések", hint: "Ingatlan piaci ár riportok" },
  "land-valuation": { title: "Telek ellenőrzések", hint: "Beépíthetőség és övezet" },
  visualization: { title: "Látványtervek", hint: "Berendezett szobák a fotóidból" },
  image_enhance: { title: "Javított fotók", hint: "Világosabb, egyenesebb képek" },
  image_enhance_regenerate: { title: "Javított fotók (újra)", hint: "Ismételt feljavítások" },
  video: { title: "Videók", hint: "Bemutató videók a fotókból" },
  "ad-check": { title: "Hirdetés-ellenőrzések", hint: "Meglévő hirdetések elemzése" },
  "fb-ads": { title: "Hirdetésszövegek", hint: "Facebook és Google Ads szövegek" },
  "google-ads": { title: "Google Ads feltöltések", hint: "Kampányba küldött hirdetések" },
  menu_generator: { title: "Menük", hint: "Napi és heti menü javaslatok" },
  cost_analysis: { title: "Önköltség elemzések", hint: "Étterem-szintű költségriportok" },
  profit_plan: { title: "Profit-tervek", hint: "Megtérülési szimulációk" },
  supplier_search: { title: "Beszállító-keresések", hint: "Termelők és nagykerek listái" },
  professional_search: { title: "Szakember-keresések", hint: "Ügyvéd, kivitelező, séf…" },
};

export function featureFolder(feature: string): { title: string; hint: string } {
  return FEATURE_FOLDER[feature] ?? { title: featureLabel(feature), hint: "Korábbi munkáid" };
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function activityTitle(feature: string, input: Json): string {
  const d = (input ?? {}) as Record<string, unknown>;

  if (feature === "ad-check") {
    const score = typeof d.score === "number" ? ` · ${d.score}/100` : "";
    const name = s(d.title) || s(d.url).replace(/^https?:\/\/(www\.)?/, "").slice(0, 50);
    return `${name || "Hirdetés-elemzés"}${score}`;
  }

  if (feature === "valuation") {
    const hely = [s(d.telepules), s(d.utca)].filter(Boolean).join(", ");
    const reszlet = [s(d.tipus), s(d.meret)].filter(Boolean).join(" · ");
    return [hely, reszlet].filter(Boolean).join(" — ") || "Ingatlan értékbecslés";
  }

  if (feature === "land-valuation") {
    const hely = [s(d.telepules), s(d.utca)].filter(Boolean).join(", ");
    const hrsz = s(d.hrsz) ? `hrsz ${s(d.hrsz)}` : "";
    return [hely, hrsz].filter(Boolean).join(" · ") || "Telek ellenőrzés";
  }

  if (feature === "visualization") {
    const count = Number(d.image_count) || (Array.isArray(d.rooms) ? d.rooms.length : 0);
    const rooms = Array.isArray(d.rooms) ? (d.rooms as Record<string, unknown>[]) : [];
    const first = rooms[0] ?? {};
    const roomLabel = ROOM_TYPES.find((r) => r.value === s(first.roomType))?.label;
    const styleLabel = STYLE_OPTIONS.find((o) => o.value === s(first.style))?.label;
    const desc = [roomLabel, styleLabel].filter(Boolean).join(" · ");
    const base = count ? `Látványterv — ${count} kép` : "Látványterv";
    return desc ? `${base} · ${desc}` : base;
  }

  if (feature === "flyer") {
    const t = s(d.title);
    return t ? `Hirdetés — ${t}` : "Hirdetés";
  }

  if (feature === "video") {
    const fmt = VIDEO_FORMATS.find((f) => f.value === s(d.format))?.value ?? s(d.format);
    const count = Number(d.image_count) || 0;
    const parts = [fmt, count ? `${count} kép` : ""].filter(Boolean).join(", ");
    return parts ? `Videó — ${parts}` : "Videó";
  }

  return featureLabel(feature);
}
