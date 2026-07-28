import { formatPrice, formatSize } from "@/lib/flyer-poster";

// Videó 2.0 — közös konfiguráció (hibrid pipeline).
// Szerkezet: nyitókártya (2,5 mp) + 4-5 fotó (4 mp, alsó felirat-sávval) + zárókártya (3 mp).
// Alap: minden fotó Ken Burns (Shotstack zoom). PRO: az 1. fotó AI-mozgással (fal.ai).
// Hang: CSAK zene (nincs narráció), a végén leúsztatva.

export const MIN_VIDEO_IMAGES = 4;
export const MAX_VIDEO_IMAGES = 5;

// Időzítés (mp).
export const CARD_OPEN_SECONDS = 2.5;
export const CARD_CLOSE_SECONDS = 3;
export const PHOTO_SECONDS = 4;
export const AI_CLIP_SECONDS = 5; // a PRO első klipje (fal i2v alap hossza)

export function videoLengthSeconds(imageCount: number, pro: boolean): number {
  const photos = pro ? imageCount - 1 : imageCount;
  return CARD_OPEN_SECONDS + (pro ? AI_CLIP_SECONDS : 0) + photos * PHOTO_SECONDS + CARD_CLOSE_SECONDS;
}

// Csomagok. Az ár később dől el — env-ből állítható, addig teszt admin fiókkal (bypass).
export type VideoPackage = "alap" | "pro";
export const VIDEO_CREDITS_ALAP = Number(process.env.VIDEO_CREDITS_ALAP ?? 5);
export const VIDEO_CREDITS_PRO = Number(process.env.VIDEO_CREDITS_PRO ?? 10);

export function creditsForPackage(pkg: VideoPackage): number {
  return pkg === "pro" ? VIDEO_CREDITS_PRO : VIDEO_CREDITS_ALAP;
}

// Kimeneti formátumok — CSAK 1:1 és 9:16.
export type VideoFormat = {
  value: string;
  label: string;
  width: number;
  height: number;
};

export const VIDEO_FORMATS: VideoFormat[] = [
  { value: "1:1", label: "Négyzet 1:1", width: 1080, height: 1080 },
  { value: "9:16", label: "Álló 9:16", width: 1080, height: 1920 },
];

export function getFormat(value: string): VideoFormat | null {
  return VIDEO_FORMATS.find((f) => f.value === value) ?? null;
}

// Zenei stílusok — a Storage `music/{slug}/` mappáiból sorsolunk.
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

// A fotók alsó felirat-sávjának adatai — fotónként VÁLTAKOZÓ információ.
// Csak a megadott mezők jelennek meg; üres mezőt a sáv kihagy.
export type VideoCaptionFacts = {
  location: string;   // település, kerület
  price: string;      // megjelenő ár
  size: string;       // m²
  rooms: string;
  bathrooms: string;
  floor: string;
  structure: string;
  condition: string;
};

export const EMPTY_VIDEO_FACTS: VideoCaptionFacts = {
  location: "", price: "", size: "", rooms: "", bathrooms: "", floor: "", structure: "", condition: "",
};

/** A fotó indexéhez tartozó felirat-sor (1-2 rövid adat, ponttal elválasztva).
 *  Az ár és a méret automatikusan kapja a hiányzó mértékegységet („100" → „100 M Ft" / „100 m²"). */
export function captionForPhoto(i: number, f: VideoCaptionFacts): string {
  const join = (a?: string, b?: string) => [a, b].map((x) => (x ?? "").trim()).filter(Boolean).join("  ·  ");
  const price = formatPrice(f.price);
  const size = formatSize(f.size);
  const rows = [
    join(f.location, price && `Irányár: ${price}`),
    join(size, f.rooms),
    join(f.bathrooms, f.floor),
    join(f.structure, f.condition),
    join(f.location, price && `Irányár: ${price}`), // 5. fotó: a legfontosabb ismétlése
  ];
  return rows[i % rows.length] ?? "";
}
