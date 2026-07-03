// Látványtervező — közös konfiguráció és validáció (kliens + szerver).
// Üzleti szabály: 1 ingatlan = 1 kredit, max. 8 képpel (a köteg egyben számít).
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB / kép
export const MAX_IMAGES = 8; // max. kép / ingatlan / 1 kredit
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_NOTE_LENGTH = 500;

export type StyleOption = { value: string; label: string };

// Az üres érték ("") = "csak felújítás" (referenciakép nélkül, falak változatlanok).
export const STYLE_OPTIONS: StyleOption[] = [
  { value: "", label: "Nincs — csak felújítás (a falak nem változnak)" },
  { value: "modern", label: "Modern" },
  { value: "provence", label: "Provence" },
  { value: "skandinav", label: "Skandináv" },
  { value: "industrial", label: "Industrial" },
  { value: "minimal", label: "Minimál" },
  { value: "klasszikus", label: "Klasszikus" },
];

export function isValidStyle(style: string): boolean {
  return STYLE_OPTIONS.some((s) => s.value === style);
}

// Fix angol prompt + szigorú negatív prompt.
// Stílussal: az adott stílust alkalmazza. Stílus nélkül ("") : csak felújítás,
// a falak és a geometria VÁLTOZATLAN (tiszta textúra/Image-to-Image logika).
// (A stílus-referenciakép bekötése egy későbbi lépés — placeholder anyagok után.)
export function buildVisualizationPrompt(style: string, note: string): string {
  const base =
    "You are a photorealistic interior visualization tool. Redesign the uploaded room photo. Keep the room's architecture, wall positions, windows and doors exactly unchanged. Only change surfaces, furniture, textures and decor.";

  const styleText = style
    ? `Apply a ${style} interior design style to the room.`
    : "Do NOT restyle the room. Perform a light renovation only: refresh finishes and surfaces while keeping the existing layout and walls exactly as they are.";

  const noteText = note ? `Additional user requests: ${note}.` : "";

  const negative =
    "Strictly do not: move or change wall positions, move windows or doors, alter the room geometry or perspective, add text, add watermark, or distort the image.";

  return [base, styleText, noteText, negative].filter(Boolean).join(" ");
}

// Egy fájl ellenőrzése.
export function validateImageFile(file: File): string | null {
  if (!file || file.size === 0) return "Üres fájl.";
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Csak JPG, PNG vagy WEBP formátum tölthető fel.";
  }
  if (file.size > MAX_IMAGE_BYTES) return "Egy kép maximum 10 MB lehet.";
  return null;
}

// A teljes köteg (1 ingatlan) ellenőrzése — kliens + szerver.
export function validateImageFiles(files: File[]): string | null {
  if (files.length === 0) return "Tölts fel legalább egy képet.";
  if (files.length > MAX_IMAGES) {
    return `Legfeljebb ${MAX_IMAGES} kép tölthető fel egy ingatlanhoz.`;
  }
  for (const f of files) {
    const err = validateImageFile(f);
    if (err) return err;
  }
  return null;
}
