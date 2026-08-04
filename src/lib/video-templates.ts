// Videó-sablonok — a partner egy kész sablont választ (mint egy profi videógenerátor).
// Minden sablon meghatározza a formátumot, a kötelező képszámot, az arculati
// akcentet, a betűt, a fotónkénti mozgásokat és a kiegészítő elemeket (intro
// panel, ügynök-zárókártya). A render ezt a leírást olvassa.
//
// A képszám-kötöttség KIKÖTÉS: ha egy sablon pontosan 5 képet kér, a varázsló
// addig nem enged tovább, amíg nincs meg pontosan 5.

export type VideoAspect = "1:1" | "9:16" | "16:9";

export type VideoTemplate = {
  id: string;
  name: string;
  tagline: string;
  aspect: VideoAspect;
  minImages: number;
  maxImages: number;
  /** Akcentszín. Ha useProfileAccent = true, az arculati profilé felülírja. */
  accent: string;
  useProfileAccent: boolean;
  /** Google-betűcsalád; üres = az arculati profil betűje. */
  font: string;
  /** Fotónkénti mozgás-sorrend (körbe forog, ha kevesebb a kép). */
  motions: string[];
  /** Intro infópanel az elején (cím + típus + szoba/fürdő ikonok). */
  introPanel: boolean;
  /** Ügynök-zárókártya (fotó + név + kontakt + logó). */
  agentCard: boolean;
  /** Előnézeti színátmenet + betűszín a galéria-kártyához. */
  preview: { from: string; to: string; ink: string };
  /** Alapértelmezett zenei stílus (a partner felülírhatja). */
  defaultMusic: string;
};

export const VIDEO_TEMPLATES: VideoTemplate[] = [
  {
    id: "twinx-premium",
    name: "TWINX Prémium",
    tagline: "Álló reel · arculati bronz · feliratsávok",
    aspect: "9:16",
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
    tagline: "Fekvő 16:9 · sárga kiemelés · intro-panel + ügynökkártya",
    aspect: "16:9",
    minImages: 5,
    maxImages: 5, // KIKÖTÉS: pontosan 5 kép
    accent: "#f0c20c",
    useProfileAccent: false,
    font: "Manrope",
    motions: ["zoomIn", "slideLeft", "slideRight", "zoomOut", "slideLeft"],
    introPanel: true,
    agentCard: true,
    preview: { from: "#111111", to: "#2a2408", ink: "#f0c20c" },
    defaultMusic: "cinematic",
  },
  {
    id: "minimal-negyzet",
    name: "Minimál Négyzet",
    tagline: "Négyzetes 1:1 · letisztult · finom feliratok",
    aspect: "1:1",
    minImages: 4,
    maxImages: 6,
    accent: "#111111",
    useProfileAccent: true,
    font: "",
    motions: ["zoomIn", "zoomOut", "zoomIn", "zoomOut", "zoomIn", "zoomOut"],
    introPanel: false,
    agentCard: true,
    preview: { from: "#f2efe9", to: "#e0d8cb", ink: "#1c1815" },
    defaultMusic: "nyugodt",
  },
];

export function getTemplate(id: string): VideoTemplate | null {
  return VIDEO_TEMPLATES.find((t) => t.id === id) ?? null;
}

export function isValidTemplate(id: string): boolean {
  return VIDEO_TEMPLATES.some((t) => t.id === id);
}

/** A képszám megfelel-e a sablon kötöttségének. */
export function imageCountOk(t: VideoTemplate, count: number): boolean {
  return count >= t.minImages && count <= t.maxImages;
}

/** Emberi szöveg a képszám-követelményről. */
export function imageCountLabel(t: VideoTemplate): string {
  return t.minImages === t.maxImages
    ? `Pontosan ${t.minImages} kép`
    : `${t.minImages}–${t.maxImages} kép`;
}
