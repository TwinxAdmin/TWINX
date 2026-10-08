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
  image_enhance: "Képjavító",
  image_enhance_regenerate: "Képjavító (újra)",
  "fb-ads": "Hirdetésszöveg",
  "google-ads": "Google Ads",
  cost_analysis: "Önköltség elemzés",
  profit_plan: "Profit-terv",
  supplier_search: "Beszállító-kereső",
  professional_search: "Szakember-kereső",
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

/** „14:32" — budapesti idő szerint (a szerver UTC-ben fut). */
function hm(iso?: string | null): string {
  if (!iso) return "";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  return new Intl.DateTimeFormat("hu-HU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Budapest" }).format(t);
}

export function activityTitle(feature: string, input: Json, createdAt?: string | null): string {
  const d = (input ?? {}) as Record<string, unknown>;

  // Kézzel adott név (átnevezés a közös mappában) mindig elsőbbséget kap.
  if (s(d.custom_title)) return s(d.custom_title);

  // Képjavító: a partner nem ad címet — a mód + képszám + időpont különbözteti meg a munkákat.
  if (feature === "image_enhance" || feature === "image_enhance_regenerate") {
    const mode = s(d.mode_label) || (feature === "image_enhance_regenerate" ? "Újrajavítás" : "Képjavítás");
    const n = Number(d.image_count) || 0;
    return [mode, n ? `${n} kép` : "", hm(createdAt)].filter(Boolean).join(" · ");
  }

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
    // A videó neve az ingatlan címe (a varázslóban megadott cím); ha nincs, a főcím, végül a formátum.
    const name = s(d.address) || (s(d.title) && !/^(Eladó ingatlan|Ingatlan videó)$/i.test(s(d.title)) ? s(d.title) : "");
    if (name) return name;
    const fmt = VIDEO_FORMATS.find((f) => f.value === s(d.format))?.value ?? s(d.format);
    const count = Number(d.image_count) || 0;
    const parts = [fmt, count ? `${count} kép` : ""].filter(Boolean).join(", ");
    return parts ? `Videó — ${parts}` : "Videó";
  }

  return featureLabel(feature);
}
