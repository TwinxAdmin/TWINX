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
};

export function featureLabel(feature: string): string {
  return FEATURE_LABEL[feature] ?? feature;
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function activityTitle(feature: string, input: Json): string {
  const d = (input ?? {}) as Record<string, unknown>;

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
