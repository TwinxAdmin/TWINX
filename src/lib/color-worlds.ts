// SZÍNVILÁGOK — közös forrás a videósablonokhoz és a hirdetéskép-készítőhöz.
//
// Egy színvilág = azonosító + név + hangulat + 6 színszerep (a videómotor palettája) + cím- és szövegbetű.
//   • A videósablonok (src/lib/video-engine/templates/*) a palettájukat és betűcsaládjukat INNEN olvassák —
//     az értékek itt pontosan azok, amik korábban a sablonfájlokban álltak (az előre elkészített
//     átmenet-animációk fájlneve is ezekből a színkódokból áll: ha egy videós szín változik,
//     futtasd újra a scripts/video-transitions-prepare.mjs-t).
//   • A hirdetéskép-készítő ugyanebből vezeti le a hirdetés színeit (adColors), kontrasztellenőrzéssel.
//   • ÚJ SZÍNVILÁG: egy új bejegyzés a COLOR_WORLDS-be. Ha videós színváltozat is, a sablonfájl
//     *_VARIANTS listájába egy sor kell (videoPalette("az-uj-id")), és mindkét modulban megjelenik.
//
// FONTOS: a felületen sehol nem írjuk ki, hogy a színek a videósablonokból jönnek.

export type WorldPalette = {
  shadow: string; // legsötétebb tónus (videó: áttűnések, sávok alapja)
  base: string;   // fő felület / háttér
  glow: string;   // lágy kísérőszín
  accent: string; // kiemelés (cím, ár, vonalak)
  text: string;   // fő szöveg a háttéren
  muted: string;  // másodlagos szöveg
};

export type WorldFont = { family: string; weight: number };

export type ColorWorld = {
  id: string;
  /** A felületen megjelenő név (Arculat lépés kártyája). */
  name: string;
  /** Rövid hangulatleírás a név alatt. */
  mood: string;
  palette: WorldPalette;
  fonts: { heading: WorldFont; body: WorldFont };
  /** Videós színváltozat-címke a videó-varázsló színgombjaihoz (csak videós színvilágnál). */
  videoLabel?: string;
  /** A hirdetés színeinek felülírása szerepenként ("@szerep" vagy "#hex"), ha az alapszabály nem illik. */
  ad?: Partial<Record<"bg" | "ink" | "accent" | "band" | "bandInk", string>>;
};

/** A „Saját szín" kártya azonosítója: a mentett arculat fő színe + betűtípusa. */
export const OWN_WORLD_ID = "own";
/** Alapértelmezett színvilág a hirdetéskép-készítőben. */
export const DEFAULT_WORLD_ID = "twinx";

export const COLOR_WORLDS: ColorWorld[] = [
  {
    id: "twinx",
    name: "TWINX",
    mood: "Meleg, barátságos",
    palette: { shadow: "#1c1815", base: "#faf8f4", glow: "#f9c9b6", accent: "#ef7a5a", text: "#1c1815", muted: "#6e655c" },
    fonts: { heading: { family: "Manrope", weight: 800 }, body: { family: "Manrope", weight: 400 } },
  },
  // ---- A videósablonok színvilágai (értékek: a sablonfájlok korábbi palettái, változatlanul) ----
  {
    id: "aurora",
    name: "Borostyán éj",
    mood: "Látványos, figyelemfelkeltő",
    videoLabel: "Borostyán",
    palette: {
      shadow: "#110420", // mély indigó: a nyíl-áttűnés és a zárópanel alapja
      base: "#1a1230",   // a nyitópanel és a zárókártya felülete
      glow: "#a17a3e",   // meleg borostyán izzás az áttűnésekben
      accent: "#f0c20c", // sárga kiemelés: cím, ár, ügynök neve, csíkok
      text: "#ffffff",
      muted: "#e8e4ee",
    },
    fonts: { heading: { family: "Manrope", weight: 800 }, body: { family: "Manrope", weight: 400 } },
  },
  {
    id: "nocturne",
    name: "Éjkék & Arany",
    mood: "Exkluzív, elegáns",
    videoLabel: "Éjkék",
    // A Videó-generátor éles Nocturne-változatának színei (video-color.ts).
    palette: { shadow: "#08142c", base: "#0b1a36", glow: "#c99a5e", accent: "#dcb985", text: "#ffffff", muted: "#dcdfe6" },
    fonts: { heading: { family: "Manrope", weight: 800 }, body: { family: "Manrope", weight: 400 } },
  },
  {
    id: "skandi",
    name: "Skandináv",
    mood: "Letisztult, világos",
    videoLabel: "Homok",
    palette: {
      shadow: "#2f2a26", // meleg szénszürke
      base: "#f6f2ec",   // krém — kártyák, panelek, átúsztatás
      glow: "#e8e0d4",   // homok
      accent: "#a9805a", // tölgy-karamell kiemelés
      text: "#2b2622",   // sötét szöveg a világos kártyán
      muted: "#7b7168",  // másodlagos szöveg
    },
    fonts: { heading: { family: "Jost", weight: 500 }, body: { family: "Jost", weight: 400 } },
  },
  {
    id: "skandi-zsalya",
    name: "Zsálya",
    mood: "Természetes, nyugodt",
    videoLabel: "Zsálya",
    palette: { shadow: "#26302a", base: "#f1f2ec", glow: "#dfe3d6", accent: "#6f8a6a", text: "#26302a", muted: "#6f766c" },
    fonts: { heading: { family: "Jost", weight: 500 }, body: { family: "Jost", weight: 400 } },
  },
  {
    id: "prestige",
    name: "Pezsgőarany",
    mood: "Luxus, prémium",
    videoLabel: "Pezsgőarany",
    palette: {
      shadow: "#0b0a09", // mély fekete
      base: "#14110e",   // a feliratkártya sötét alapja
      glow: "#c9a96e",   // pezsgőarany
      accent: "#c9a96e", // arany: ikonok, vonalak, ár
      text: "#f5efe4",   // elefántcsont szöveg
      muted: "#bfb29c",  // másodlagos szöveg
    },
    fonts: { heading: { family: "Cormorant Garamond", weight: 600 }, body: { family: "Jost", weight: 400 } },
  },
  {
    id: "prestige-grafit",
    name: "Grafit & Platina",
    mood: "Modern, visszafogott",
    videoLabel: "Grafit + platina",
    // Antracit alap + hűvös ezüst-platina kiemelés (ikonok, vonalak, ár, keret).
    palette: { shadow: "#0b0c0e", base: "#17191d", glow: "#cfd3d9", accent: "#cfd4db", text: "#f3f4f6", muted: "#a6abb3" },
    fonts: { heading: { family: "Cormorant Garamond", weight: 600 }, body: { family: "Jost", weight: 400 } },
  },
  {
    id: "mozaik",
    name: "Terrakotta",
    mood: "Meleg, otthonos",
    videoLabel: "Márvány + terrakotta",
    palette: {
      shadow: "#3a3631",  // antracit (sötét szöveg, vonalak)
      base: "#f3f1ee",    // márvány alap
      glow: "#e4e0da",    // halvány erezet / árnyalat
      accent: "#a65d36",  // terrakotta (főcím, ár)
      text: "#3a3631",    // antracit szöveg
      muted: "#77716a",   // másodlagos szöveg, erezet
    },
    fonts: { heading: { family: "Outfit", weight: 800 }, body: { family: "Outfit", weight: 400 } },
  },
  {
    id: "mozaik-smaragd",
    name: "Smaragd & Arany",
    mood: "Gazdag, klasszikus",
    videoLabel: "Smaragd + arany",
    palette: { shadow: "#0b1c17", base: "#173229", glow: "#24463b", accent: "#d4b06a", text: "#f3ece0", muted: "#9fb6a9" },
    fonts: { heading: { family: "Outfit", weight: 800 }, body: { family: "Outfit", weight: 400 } },
  },
  {
    id: "polaroid",
    name: "Bíbor",
    mood: "Merész, feltűnő",
    videoLabel: "Bíborpiros",
    palette: {
      shadow: "#5c0713",  // mély bordó
      base: "#ad1328",    // BÍBORPIROS háttér (a referencia színe)
      glow: "#c42239",
      accent: "#ffffff",  // fehér kiemelés
      text: "#ffffff",    // világos szöveg (a régi-film tónus után is jól olvasható)
      muted: "#f1d3cf",   // halvány rózsás másodlagos szöveg
    },
    // A videó Liberation Sans-a a hirdetésen a vele azonos rajzolatú Arimo (Google Fonts).
    fonts: { heading: { family: "Arimo", weight: 700 }, body: { family: "Arimo", weight: 400 } },
    ad: { band: "@shadow" },
  },
  {
    id: "polaroid-kek",
    name: "Drámai kék",
    mood: "Erőteljes, megbízható",
    videoLabel: "Drámai kék",
    palette: { shadow: "#06143a", base: "#11307f", glow: "#1d45a6", accent: "#ffffff", text: "#ffffff", muted: "#cfdcf5" },
    fonts: { heading: { family: "Arimo", weight: 700 }, body: { family: "Arimo", weight: 400 } },
    ad: { band: "@shadow" },
  },
];

export function colorWorld(id: string): ColorWorld | undefined {
  return COLOR_WORLDS.find((w) => w.id === id);
}

/** Egy videós színvilág palettája (a sablonfájlok ezt használják). Ismeretlen id → programhiba. */
export function videoPalette(id: string): WorldPalette {
  const w = colorWorld(id);
  if (!w) throw new Error(`Ismeretlen színvilág: ${id}`);
  return { ...w.palette };
}

// ---------------------------------------------------------------------------
// Kontraszt (WCAG 2.x) és a hirdetés színei
// ---------------------------------------------------------------------------
const HEX = /^#[0-9a-fA-F]{6}$/;

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Kontrasztarány két szín között (1–21). */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/** Szín keverése feketével (amount<0) vagy fehérrel (amount>0), 0..1. */
function mix(hex: string, amount: number): string {
  const t = amount < 0 ? 0 : 255;
  const k = Math.abs(amount);
  return toHex(rgb(hex).map((v) => v + (t - v) * k) as [number, number, number]);
}
/**
 * Olvasható változat: a színt addig sötétíti/világosítja (a háttértől távolodva), amíg a kontraszt el nem éri
 * a célt. Ha már jó, változatlanul adja vissza.
 */
export function readableOn(color: string, bg: string, target = 4.5): string {
  if (contrast(color, bg) >= target) return color;
  const dir = luminance(bg) > 0.4 ? -1 : 1;
  for (let k = 0.05; k <= 1.0001; k += 0.05) {
    const c = mix(color, dir * k);
    if (contrast(c, bg) >= target) return c;
  }
  return dir < 0 ? "#000000" : "#ffffff";
}
/** A háttéren jobban olvasható szövegszín a megadott jelöltek közül (az első, ami eléri a célt; különben a legjobb). */
export function bestInk(bg: string, candidates: string[], target = 4.5): string {
  const ok = candidates.find((c) => contrast(c, bg) >= target);
  if (ok) return ok;
  return [...candidates, "#ffffff", "#000000"].sort((p, q) => contrast(q, bg) - contrast(p, bg))[0];
}

/** A hirdetés színei egy színvilágból — minden szöveg/háttér pár legalább 4.5:1 kontrasztú. */
export type AdColors = {
  bg: string;      // a hirdetés alapfelülete
  ink: string;     // fő szöveg az alapfelületen
  muted: string;   // másodlagos szöveg az alapfelületen
  accent: string;  // kiemelés az alapfelületen (ár, címke-szöveg)
  band: string;    // kapcsolati sáv / címke háttere
  bandInk: string; // szöveg a sávon
};

/**
 * A hirdetés színeinek levezetése.
 * @param ownAccent a „Saját szín" kártyánál a mentett arculat fő színe
 */
export function adColors(worldId: string, ownAccent?: string): AdColors {
  if (worldId === OWN_WORLD_ID) {
    // „Saját szín" = a korábbi megjelenés: világos papír, a fő szín sötétített árnyalata a sávon.
    const a = ownWorld(ownAccent).palette.accent;
    const band = readableOn(mix(a, -0.55), "#ffffff");
    return { bg: "#faf8f4", ink: "#1c1815", muted: "#6e655c", accent: readableOn(a, "#faf8f4", 3), band, bandInk: "#ffffff" };
  }
  const w = colorWorld(worldId) ?? colorWorld(DEFAULT_WORLD_ID)!;
  const p = w.palette;
  const ref = (v: string | undefined, fallback: string) => {
    if (!v) return fallback;
    if (v.startsWith("@")) return p[v.slice(1) as keyof WorldPalette] ?? fallback;
    return HEX.test(v) ? v : fallback;
  };
  const bg = ref(w.ad?.bg, p.base);
  const ink = readableOn(ref(w.ad?.ink, p.text), bg);
  const muted = readableOn(p.muted, bg);
  const accent = readableOn(ref(w.ad?.accent, p.accent), bg);
  // A sáv (alsó kapcsolati rész, címke) alapból a kiemelő szín.
  //  • Világos, élénk sávon (sárga, arany, platina — a feketével vett kontraszt ≥ 8) a színvilág sötét tónusa a betű:
  //    ott az olvashatóbb.
  //  • Minden más (közepes / sötét) sávon FEHÉR a betű; ha a fehér nem éri el a 4.5:1-et, a sávot addig
  //    sötétítjük, amíg el nem éri (pl. Zsálya, Skandináv, TWINX terrakotta) — fekete betű ilyen sávra nem kerül.
  let band = ref(w.ad?.band, p.accent);
  let bandInk: string;
  if (w.ad?.bandInk) bandInk = ref(w.ad.bandInk, "#ffffff");
  else if (contrast(band, "#000000") >= 8) bandInk = readableOn(p.shadow, band);
  else {
    band = readableOn(band, "#ffffff");
    bandInk = "#ffffff";
  }
  return { bg, ink, muted, accent, band, bandInk };
}

/** A „Saját szín": a TWINX világos alapja + a mentett arculat fő színe. */
export function ownWorld(accent?: string): ColorWorld {
  const base = colorWorld(DEFAULT_WORLD_ID)!;
  const a = accent && HEX.test(accent) ? accent.toLowerCase() : "#1e3a5f";
  return { ...base, id: OWN_WORLD_ID, name: "Saját szín", mood: "A mentett arculatod", palette: { ...base.palette, accent: a, glow: a } };
}
