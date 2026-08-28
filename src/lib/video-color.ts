// Szín-variánsok a Modern Sárga sablonhoz.
//
// A sablon dizájnja, elrendezése, időzítése és áttűnései VÁLTOZATLANOK — csak a
// kiemelő szín más. Ezért NEM másoljuk a JSON-t színenként (az háromszoros
// karbantartás lenne), hanem render előtt kicseréljük benne:
//   1) a rich-text betűszíneket (a sablonban #f0c20c a kiemelés, #ffffff a szöveg),
//   2) a beégetett átmenet-grafikák (.webm) URL-jét a saját, átszínezett példányunkra.
//
// A (2) egyszeri előkészítés: `npm run video:overlays` letölti a Shotstack
// overlay-eket, ffmpeg-gel átszínezi és feltölti a Supabase Storage-ba. Az
// eredmény-térkép az overlay-colors.json — amíg üres, csak a sárga választható.
import overlayColorsRaw from "@/lib/video-json/overlay-colors.json";
import type { TemplateJson } from "@/lib/video-merge";

/**
 * PARKOLÓPÁLYÁN (2026-08-28). A Modern Korall és Modern Krém átszínezése nem lett
 * elég jó: a sablon grafikái beégetett sötét törlőelemek, ezért a szín csak
 * korlátozottan tud érvényesülni. A színek helyett később ÚJ sablonok jönnek.
 *
 * A teljes gépezet érintetlenül megmarad (variánsok, átszínező script, feltöltött
 * grafikák, URL-térkép) — csak nem választható. Visszakapcsolás: állítsd `true`-ra.
 * A Modern Sárga ettől függetlenül végig változatlanul működik.
 */
export const COLOR_VARIANTS_ENABLED = false;

/** A sablonban eredetileg használt színek — ezeket cseréljük. */
export const TEMPLATE_ACCENT = "#f0c20c";
export const TEMPLATE_TEXT = "#ffffff";

export type VideoColorId = "sarga" | "korall" | "krem";

export type VideoColorVariant = {
  id: VideoColorId;
  name: string;
  /** A választóban megjelenő sablonnév (a szín a sablon neve része). */
  title: string;
  /** A kiemelő szín (a sablon #f0c20c helyére, és a saját Satori rétegeinkben). */
  accent: string;
  /** A másodlagos szöveg színe (a sablon #ffffff helyére). */
  text: string;
  /**
   * A KIEMELT szövegek színe (cím, típus, ár, ügynök neve — a sablonban #f0c20c).
   * Az új színeknél ez FEHÉR: a variánst a felületek hordozzák, nem a betűk,
   * mert így olvashatóbb és tisztább a videó. A sárgánál marad az eredeti sárga.
   */
  heading: string;
  /**
   * A nyitókép ferde paneljének színe (a szöveg mögötti nagy felület).
   * Mély, telítetlen tónus — nem a márkaszín, hogy a fotó és a szöveg olvasható maradjon.
   */
  panel: string;
  /** A sablon alap háttere (a záró kártya alatt). `null` = maradjon az eredeti fekete. */
  surface: string | null;
  /**
   * Az áttűnés-grafikák tónusa: ezek FEKETE átlós törlőelemek, nincs bennük
   * márkaszín. A feketét emeljük erre az árnyalatra (az alfa és az animáció marad).
   * Az előkészítő script használja.
   */
  deepTint: string | null;
  /** Varázsló-korong: a sablon hangulata két színnel. */
  swatch: { bg: string; accent: string };
  /**
   * ffmpeg szűrő az overlay-grafikák átszínezéséhez (az előkészítő script
   * használja). A `hue` a fehér és fekete részeket érintetlenül hagyja, így a
   * grafika árnyalatai és élsimítása megmarad.
   */
  overlayFilter: string | null;
};

export const VIDEO_COLOR_VARIANTS: VideoColorVariant[] = [
  {
    id: "sarga",
    name: "Sárga",
    title: "TWINX Aurora", // a sablon megjelenő neve (fantázianév, nem színre utal)
    accent: TEMPLATE_ACCENT,
    text: TEMPLATE_TEXT,
    heading: TEMPLATE_ACCENT,
    // Az eredeti sablon — minden marad, ahogy van.
    panel: "rgba(26,18,48,0.94)",
    surface: null,
    deepTint: null,
    swatch: { bg: "#111111", accent: "#f0c20c" },
    overlayFilter: null, // az eredeti grafika — nincs mit átszínezni
  },
  {
    id: "korall",
    name: "Korall",
    title: "Modern Korall",
    accent: "#ef7a5a",
    text: TEMPLATE_TEXT,
    heading: TEMPLATE_TEXT, // fehér betű — a színt a felületek viszik
    // Telt terrakotta: ezt kapja a nyitópanel, a záró kártya és az áttűnés-grafika.
    panel: "rgba(74,32,22,0.94)",
    surface: "#2a120c",
    deepTint: "#4a2016",
    swatch: { bg: "#141110", accent: "#ef7a5a" },
    // Sárga (~48°) → korall (~14°): -34° forgatás, kicsit lágyabb telítettség.
    overlayFilter: "hue=h=-34:s=0.94",
  },
  {
    id: "krem",
    name: "Krémfehér",
    title: "Modern Krém",
    accent: "#f4efe7",
    text: TEMPLATE_TEXT,
    heading: TEMPLATE_TEXT, // fehér betű — a színt a felületek viszik
    // Meleg greige: a krém kiemelés ezen a legelegánsabb, a fehér betű jól olvasható.
    panel: "rgba(58,52,44,0.94)",
    surface: "#22201b",
    deepTint: "#3a342c",
    swatch: { bg: "#141210", accent: "#f4efe7" },
    // A krém majdnem telítetlen: a sárgát szinte fehérre halványítjuk, egy
    // leheletnyi meleg árnyalattal, hogy ne legyen rideg.
    overlayFilter: "hue=s=0.10,eq=brightness=0.06",
  },
];

export function getColorVariant(id: string): VideoColorVariant {
  return VIDEO_COLOR_VARIANTS.find((v) => v.id === id) ?? VIDEO_COLOR_VARIANTS[0];
}

/** Az átszínezett overlay-ek térképe: variáns → { eredeti URL: új URL }. */
type OverlayColors = Partial<Record<VideoColorId, Record<string, string>>>;
const overlayColors = overlayColorsRaw as OverlayColors;

/**
 * Kész-e a variáns? A sárga mindig; a többi csak akkor, ha az átszínezett
 * overlay-ek fel vannak töltve. Így a partner nem tud félkész színt választani
 * (sárga ékek korall szöveggel).
 */
export function colorVariantReady(id: VideoColorId): boolean {
  if (id === "sarga") return true;
  if (!COLOR_VARIANTS_ENABLED) return false;
  return Object.keys(overlayColors[id] ?? {}).length > 0;
}

export function readyColorVariants(): VideoColorVariant[] {
  return VIDEO_COLOR_VARIANTS.filter((v) => colorVariantReady(v.id));
}

/**
 * A sablon átszínezése. ÚJ objektumot ad vissza — az importált JSON-modul
 * (ami több kérés közt megosztott) sosem módosul.
 */
export function applyColorVariant(tpl: TemplateJson, variant: VideoColorVariant): TemplateJson {
  const out = JSON.parse(JSON.stringify(tpl)) as TemplateJson;
  if (variant.id === "sarga") return out; // az eredeti sablon — érintetlenül

  // A kiemelt (eredetileg sárga) szövegek a `heading` színt kapják — az új
  // variánsoknál fehéret, hogy a szín a felületeken jelenjen meg, ne a betűkön.
  const colorMap: Record<string, string> = {
    [TEMPLATE_ACCENT.toLowerCase()]: variant.heading,
    [TEMPLATE_TEXT.toLowerCase()]: variant.text,
  };
  const srcMap = overlayColors[variant.id] ?? {};

  // 0) A sablon alap háttere (a záró kártya alatt látszik ki).
  if (variant.surface) out.timeline.background = variant.surface;

  for (const track of out.timeline.tracks) {
    for (const clip of track.clips) {
      const asset = clip?.asset;
      if (!asset) continue;
      // 1) Betűszínek (rich-text / text).
      const color = asset.font?.color;
      if (typeof color === "string" && colorMap[color.toLowerCase()]) {
        asset.font.color = colorMap[color.toLowerCase()];
      }
      // 2) Átmenet-grafikák: az átszínezett példányra mutatunk.
      if (typeof asset.src === "string" && srcMap[asset.src]) {
        asset.src = srcMap[asset.src];
      }
    }
  }
  return out;
}

/** A sablonban használt overlay-videók URL-jei (az előkészítő scriptnek). */
export function collectOverlaySources(tpl: TemplateJson): string[] {
  const set = new Set<string>();
  for (const track of tpl.timeline.tracks) {
    for (const clip of track.clips) {
      const a = clip?.asset;
      if (a?.type === "video" && typeof a.src === "string" && /^https?:/.test(a.src)) set.add(a.src);
    }
  }
  return [...set];
}
