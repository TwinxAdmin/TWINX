// Videó-DIZÁJNOK — a partner egy dizájnt választ, majd egy MÉRETET (9:16/1:1).
// Ugyanaz a dizájn több arányban is elérhető: minden méret a saját változatával.
//
// Kétféle dizájn:
//  - "json": kész Shotstack template merge-mezőkkel, méretenként külön JSON-nal.
//  - "satori": a saját (kód-alapú) renderünk, ami bármely méretben megy.
//
// A képszám KIKÖTÉS: json dizájnnál a JSON IMAGE_n helyőrzőinek száma adja;
// satori dizájnnál a design min/max mezője.

import modernSarga916 from "@/lib/video-json/modern-sarga-9x16.json";
import modernSarga11 from "@/lib/video-json/modern-sarga-1x1.json";
import { countImagePlaceholders, type TemplateJson } from "@/lib/video-merge";

export type VideoAspect = "9:16" | "1:1";
export const ALL_ASPECTS: VideoAspect[] = ["9:16", "1:1"];
export const ASPECT_LABEL: Record<VideoAspect, string> = {
  "9:16": "Álló 9:16",
  "1:1": "Négyzet 1:1",
};

export type VideoDesign = {
  id: string;
  name: string;
  tagline: string;
  kind: "satori" | "json";
  /** Elérhető méretek (ebben a sorrendben jelennek meg). */
  aspects: VideoAspect[];
  /** JSON dizájnnál: méretenkénti Shotstack template. */
  jsonByAspect?: Partial<Record<VideoAspect, TemplateJson>>;
  /** Satori dizájn képszám-tartománya (json-nál a JSON-ból jön). */
  minImages: number;
  maxImages: number;
  accent: string;
  useProfileAccent: boolean;
  font: string;
  motions: string[];
  introPanel: boolean;
  agentCard: boolean;
  preview: { from: string; to: string; ink: string };
  defaultMusic: string;
};

export const VIDEO_DESIGNS: VideoDesign[] = [
  {
    id: "twinx-premium",
    name: "TWINX Klasszikus",
    tagline: "Arculati bronz · feliratsávok · nyitó/záró kártya",
    kind: "satori",
    aspects: ["9:16", "1:1"],
    minImages: 4,
    maxImages: 5,
    accent: "#1e3a5f",
    useProfileAccent: true,
    font: "",
    motions: ["zoomIn", "slideLeft", "zoomOut", "slideRight", "zoomIn"],
    introPanel: false,
    agentCard: true,
    preview: { from: "#1c1815", to: "#3a2c20", ink: "#f4efe7" },
    defaultMusic: "elegans",
  },
  {
    id: "modern-sarga",
    name: "Modern Sárga",
    tagline: "Sárga kiemelés · intro-panel ikonokkal · ügynökkártya",
    kind: "json",
    // Két méret elérhető, méretenként külön Shotstack-JSON-nal.
    aspects: ["9:16", "1:1"],
    jsonByAspect: {
      "9:16": modernSarga916 as unknown as TemplateJson,
      "1:1": modernSarga11 as unknown as TemplateJson,
    },
    minImages: 5,
    maxImages: 5,
    accent: "#f0c20c",
    useProfileAccent: false,
    font: "Manrope",
    motions: [],
    introPanel: true,
    agentCard: true,
    preview: { from: "#111111", to: "#2a2408", ink: "#f0c20c" },
    defaultMusic: "cinematic",
  },
];

export function getDesign(id: string): VideoDesign | null {
  return VIDEO_DESIGNS.find((d) => d.id === id) ?? null;
}

export function aspectAvailable(design: VideoDesign, aspect: string): boolean {
  return design.aspects.includes(aspect as VideoAspect);
}

/** A dizájn adott méretéhez tartozó Shotstack JSON (json dizájnnál). */
export function variantJson(design: VideoDesign, aspect: VideoAspect): TemplateJson | null {
  return design.jsonByAspect?.[aspect] ?? null;
}

/** Képszám-tartomány a dizájn adott méretéhez. */
export function imageRange(design: VideoDesign, aspect: VideoAspect): { min: number; max: number } {
  if (design.kind === "json") {
    const json = variantJson(design, aspect);
    if (json) {
      const n = countImagePlaceholders(json);
      return { min: n, max: n };
    }
  }
  return { min: design.minImages, max: design.maxImages };
}

export function imageCountOk(design: VideoDesign, aspect: VideoAspect, count: number): boolean {
  const r = imageRange(design, aspect);
  return count >= r.min && count <= r.max;
}

export function imageCountLabel(design: VideoDesign, aspect: VideoAspect): string {
  const r = imageRange(design, aspect);
  return r.min === r.max ? `Pontosan ${r.min} kép` : `${r.min}–${r.max} kép`;
}
