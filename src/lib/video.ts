// Videó pipeline — közös konfiguráció (formátumok, kredit-tábla, zenei stílusok).
// Üzleti szabály: real-estate feature, kredit a képszám (videóhossz) szerint.

export const MIN_VIDEO_IMAGES = 3;
export const MAX_VIDEO_IMAGES = 8;

// Kredit a képszám szerint (config — bármikor állítható).
export const VIDEO_CREDIT_BY_IMAGES: Record<number, number> = {
  3: 2,
  4: 3,
  5: 3,
  6: 4,
  7: 5,
  8: 6,
};

export function creditForImages(count: number): number {
  return VIDEO_CREDIT_BY_IMAGES[count] ?? 0;
}

// Kimeneti formátumok (a Shotstack render mérete).
export type VideoFormat = {
  value: string; // '16:9' | '9:16' | '1:1'
  label: string;
  width: number;
  height: number;
};

export const VIDEO_FORMATS: VideoFormat[] = [
  { value: "16:9", label: "16:9 (fekvő)", width: 1920, height: 1080 },
  { value: "9:16", label: "9:16 (álló)", width: 1080, height: 1920 },
  { value: "1:1", label: "1:1 (négyzet)", width: 1080, height: 1080 },
];

export function getFormat(value: string): VideoFormat | null {
  return VIDEO_FORMATS.find((f) => f.value === value) ?? null;
}

// Zenei stílusok — a user stílust választ, a generálás random számot húz a
// `music/{slug}/` mappából. A slug = Storage mappa neve.
export type MusicStyle = { slug: string; label: string };

export const MUSIC_STYLES: MusicStyle[] = [
  { slug: "elegans", label: "Elegáns" },
  { slug: "porgos", label: "Pörgős / energikus" },
  { slug: "nyugodt", label: "Nyugodt / letisztult" },
  { slug: "cinematic", label: "Cinematic / filmzenei" },
  { slug: "vidam", label: "Vidám / könnyed" },
];

export function isValidMusicStyle(slug: string): boolean {
  return MUSIC_STYLES.some((s) => s.slug === slug);
}
