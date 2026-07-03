// Látványtervező — helységenkénti konfiguráció, változók, prompt-építés.
// Üzleti szabály: 1 ingatlan = 1 kredit, max. 8 kép. Helységtípus KÖTELEZŐ,
// a változók OPCIONÁLISAK. A prompt csak a ténylegesen kiválasztott változókat
// tartalmazza. Ha egyetlen változó sincs -> a generálás nem indul.
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB / kép
export const MAX_IMAGES = 8;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_NOTE_LENGTH = 500;

// ---- Helységtípusok (slug = referencia fájlnév, en = prompt) ----
export type RoomType = { value: string; label: string; slug: string; en: string };
export const ROOM_TYPES: RoomType[] = [
  { value: "nappali", label: "Nappali", slug: "nappali", en: "living room" },
  { value: "konyha", label: "Konyha", slug: "konyha", en: "kitchen" },
  { value: "haloszoba", label: "Hálószoba", slug: "haloszoba", en: "bedroom" },
  { value: "furdo", label: "Fürdő", slug: "furdo", en: "bathroom" },
  { value: "etkezo", label: "Étkező", slug: "etkezo", en: "dining room" },
  { value: "eloszoba", label: "Előszoba", slug: "eloszoba", en: "entrance hall" },
  { value: "gardrob", label: "Gardrób", slug: "gardrob", en: "walk-in wardrobe" },
  { value: "dolgozoszoba", label: "Dolgozószoba", slug: "dolgozoszoba", en: "home office" },
  { value: "gyerekszoba", label: "Gyerekszoba", slug: "gyerekszoba", en: "children's room" },
  { value: "egyeb", label: "Egyéb", slug: "egyeb", en: "room" },
];

// ---- Stílusok (value = bucket mappa slug, "" = nincs stílus) ----
export type StyleOption = { value: string; label: string; en: string };
export const STYLE_OPTIONS: StyleOption[] = [
  { value: "", label: "Nincs stílus – csak a megadott módosítások", en: "" },
  { value: "scandinavian", label: "Skandináv", en: "Scandinavian" },
  { value: "industrial", label: "Indusztriális", en: "industrial" },
  { value: "antik", label: "Antik", en: "antique / vintage" },
  { value: "minimal", label: "Minimál", en: "minimalist" },
  { value: "art_deco", label: "Art deco", en: "art deco" },
  { value: "mediterranean", label: "Mediterrán", en: "Mediterranean" },
  { value: "country", label: "Vidéki", en: "country / rustic" },
  { value: "japandi", label: "Japandi", en: "japandi" },
  { value: "mid_century_modern", label: "Mid-century modern", en: "mid-century modern" },
];

// ---- Változó opciók ----
export type Option = { value: string; label: string; en: string; hex?: string };

export const WALL_COLORS: Option[] = [
  { value: "feher", label: "Fehér", en: "white", hex: "#F7F6F2" },
  { value: "tortfeher", label: "Törtfehér / krém", en: "off-white / cream", hex: "#EDE6D6" },
  { value: "vilagosszurke", label: "Világosszürke", en: "light grey", hex: "#CFD2CE" },
  { value: "antracit", label: "Antracit", en: "anthracite", hex: "#3A3F41" },
  { value: "foldbarna", label: "Földbarna", en: "earth brown", hex: "#7A5C44" },
  { value: "zsalyazold", label: "Zsályazöld", en: "sage green", hex: "#9CAE94" },
  { value: "tengereszkek", label: "Tengerészkék", en: "navy blue", hex: "#2E4A62" },
  { value: "puderrozsaszin", label: "Púderrózsaszín", en: "powder pink", hex: "#E3C4C0" },
  { value: "mustarsarga", label: "Mustársárga", en: "mustard yellow", hex: "#D6A53A" },
  { value: "terrakotta", label: "Terrakotta", en: "terracotta", hex: "#C26B4D" },
  { value: "meleghomok", label: "Meleg homok / greige", en: "warm sand / greige", hex: "#D8CDBA" },
  { value: "galambszurke", label: "Galambszürke", en: "dove grey", hex: "#B8B2A7" },
  { value: "vilagoszsalya", label: "Világos zsálya", en: "light sage", hex: "#C3CDBC" },
  { value: "halvanykek", label: "Halvány kék / ködkék", en: "pale blue / misty blue", hex: "#AEC0C4" },
  { value: "melegtaupe", label: "Meleg taupe", en: "warm taupe", hex: "#A99A86" },
];

export const WALL_COVERINGS: Option[] = [
  { value: "festes", label: "Festés (sima falszín)", en: "smooth painted wall" },
  { value: "tapeta", label: "Tapéta", en: "wallpaper" },
  { value: "csempe", label: "Csempe", en: "tiled wall" },
  { value: "diszvakolat", label: "Díszvakolat", en: "decorative plaster" },
  { value: "lamberia", label: "Lambéria", en: "wood paneling" },
  { value: "koburkolat", label: "Kőburkolat", en: "stone cladding" },
  { value: "latszobeton", label: "Látszóbeton", en: "exposed concrete" },
  { value: "keramia", label: "Kerámia", en: "ceramic wall tiles" },
];

export const FLOORINGS: Option[] = [
  { value: "vilagos_tolgy", label: "Világos tölgy", en: "light oak wood floor" },
  { value: "sotet_tolgy", label: "Sötét tölgy", en: "dark oak wood floor" },
  { value: "termeszetes_fa", label: "Természetes / mézes fa", en: "natural honey-toned wood floor" },
  { value: "szurke_laminalt", label: "Szürke laminált", en: "grey laminate floor" },
  { value: "halszalka", label: "Parketta halszálka", en: "herringbone parquet floor" },
  { value: "jarolap_vilagos", label: "Járólap – világos kő", en: "light stone floor tiles" },
  { value: "jarolap_sotet", label: "Járólap – sötét", en: "dark stone floor tiles" },
  { value: "marvany", label: "Márvány-hatású", en: "marble-effect floor" },
  { value: "mikrocement", label: "Mikrocement", en: "microcement floor" },
  { value: "padloszonyeg", label: "Padlószőnyeg", en: "carpet" },
  { value: "vinyl", label: "Vinyl", en: "vinyl floor" },
];

export const FURNISHINGS: Option[] = [
  { value: "ures", label: "Üres, felújított tér", en: "empty, renovated space with no furniture" },
  { value: "reszben", label: "Részben berendezett", en: "partially furnished" },
  { value: "teljesen", label: "Teljesen berendezett", en: "fully furnished and styled" },
];

export const LIGHT_MOODS: Option[] = [
  { value: "vilagos_nappali", label: "Világos, természetes nappali", en: "bright natural daylight" },
  { value: "meleg_esti", label: "Meleg, esti hangulat", en: "warm cozy evening lighting" },
  { value: "huvos_eszakias", label: "Hűvös, északias fény", en: "cool northern daylight" },
  { value: "meleg_delies", label: "Meleg, délies fény", en: "warm southern sunlight" },
];

// ---- Egy kép (helység) konfigja ----
export type RoomConfig = {
  roomType: string; // kötelező
  style: string; // slug vagy ""
  wallColor: string;
  wallCovering: string;
  flooring: string;
  furnishing: string;
  lightMood: string;
  note: string; // opcionális szabad szöveg
};

export const EMPTY_ROOM_CONFIG: RoomConfig = {
  roomType: "",
  style: "",
  wallColor: "",
  wallCovering: "",
  flooring: "",
  furnishing: "",
  lightMood: "",
  note: "",
};

// ---- Validáció ----
export function validateImageFiles(files: File[]): string | null {
  if (files.length === 0) return "Tölts fel legalább egy képet.";
  if (files.length > MAX_IMAGES) {
    return `Legfeljebb ${MAX_IMAGES} kép tölthető fel egy ingatlanhoz.`;
  }
  for (const f of files) {
    if (!ALLOWED_IMAGE_TYPES.includes(f.type)) {
      return "Csak JPG, PNG vagy WEBP formátum tölthető fel.";
    }
    if (f.size > MAX_IMAGE_BYTES) return "Egy kép maximum 10 MB lehet.";
  }
  return null;
}

export function configHasVariable(c: RoomConfig): boolean {
  return !!(
    c.style ||
    c.wallColor ||
    c.wallCovering ||
    c.flooring ||
    c.furnishing ||
    c.lightMood ||
    c.note.trim()
  );
}

// Egy kép konfigja kész-e: helység kötelező + legalább egy változó.
export function validateRoomConfig(c: RoomConfig): string | null {
  if (!ROOM_TYPES.some((r) => r.value === c.roomType)) {
    return "Válassz helységtípust.";
  }
  if (!configHasVariable(c)) {
    return "Válassz legalább egy módosítást (stílus, szín, burkolat…).";
  }
  if (c.note.length > MAX_NOTE_LENGTH) {
    return `A megjegyzés legfeljebb ${MAX_NOTE_LENGTH} karakter.`;
  }
  return null;
}

export function isRoomConfigReady(c: RoomConfig): boolean {
  return validateRoomConfig(c) === null;
}

// ---- Mesterprompt összeállítása egy képhez ----
export function buildRoomPrompt(c: RoomConfig): { prompt: string; useReference: boolean } {
  const room = ROOM_TYPES.find((r) => r.value === c.roomType);
  const roomEn = room?.en ?? "room";
  const style = STYLE_OPTIONS.find((s) => s.value === c.style && s.value !== "");
  // A referenciaképet NEM küldjük a modellnek (az eredeti szobát „lemásolná").
  // A stílus szövegként megy a promptba; a referenciaképek csak a formon,
  // vizuális útmutatóként szolgálnak.
  const useReference = false;

  const changes: string[] = [];
  if (style) changes.push(`Overall interior design style: ${style.en}.`);
  const wc = WALL_COLORS.find((o) => o.value === c.wallColor);
  if (wc) changes.push(`Wall color: ${wc.en} (hex ${wc.hex}).`);
  const cov = WALL_COVERINGS.find((o) => o.value === c.wallCovering);
  if (cov) changes.push(`Wall finish: ${cov.en}.`);
  const fl = FLOORINGS.find((o) => o.value === c.flooring);
  if (fl) changes.push(`Flooring: ${fl.en}.`);
  const fu = FURNISHINGS.find((o) => o.value === c.furnishing);
  if (fu) changes.push(`Furnishing: ${fu.en}.`);
  const lm = LIGHT_MOODS.find((o) => o.value === c.lightMood);
  if (lm) changes.push(`Lighting mood: ${lm.en}.`);
  if (c.note.trim()) changes.push(`Additional user requests: ${c.note.trim()}.`);

  const base = [
    "You are a professional real-estate interior visualization tool.",
    "The FIRST image is the ORIGINAL room photo. Redesign ONLY the interior finishes, materials and furnishings of this room. The result must be photorealistic and clearly the SAME room, only redecorated.",
    "CRITICAL — the architecture is FIXED: keep the exact same walls, ceiling and room dimensions, and the exact same number, size and position of windows and doors as in the FIRST image. Never add, remove, move or resize any door, window, arch or opening. Never place a door or window where the FIRST image shows a solid wall or furniture. Keep the exact same camera angle and perspective.",
    `This room is a ${roomEn}.`,
  ];
  void useReference; // referenciaképet szándékosan nem küldünk a modellnek

  const changesBlock =
    "Apply the following changes and leave everything else in the original room unchanged:\n" +
    changes.map((x) => `- ${x}`).join("\n");

  const negative =
    "Must avoid: adding doors or windows that are not in the original; moving or changing wall, window or door positions; altering room geometry, proportions or perspective; changing the camera angle; warping or distorting the image; text, watermark or logo; blur or low quality.";

  return { prompt: `${base.join(" ")}\n\n${changesBlock}\n\n${negative}`, useReference };
}
