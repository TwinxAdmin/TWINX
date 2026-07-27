// AI hirdetés-háttér: a Nano Banana a partner fotóiból komponál egy profi,
// ügynökségi hatású hirdetés-alapot — de SZÖVEG NÉLKÜL. A feliratokat (cím, ár,
// adatok, név, telefon, logó) utólag mi írjuk rá élesen, hogy a magyar ékezetek és a
// telefonszám garantáltan hibátlanok legyenek.

export type FlyerMood = {
  value: string;
  label: string;
  desc: string;
  /** Az AI-nak adott vizuális irány. */
  en: string;
};

export const FLYER_MOODS: FlyerMood[] = [
  {
    value: "luxus",
    label: "Elegáns luxus",
    desc: "Mélykék és arany, éles keretek — exkluzív, prémium hatás.",
    en: "luxury real estate brochure look: deep navy and gold accents, thin metallic gold frame lines, crisp geometric panels, subtle drop shadows",
  },
  {
    value: "letisztult",
    label: "Letisztult, világos",
    desc: "Sok fehér, finom vonalak — modern, nyugodt megjelenés.",
    en: "clean modern real estate layout: generous white space, thin elegant divider lines, soft neutral tones, minimal geometric panels",
  },
  {
    value: "meleg",
    label: "Meleg, otthonos",
    desc: "Krém, homok és bronz tónusok — barátságos, hívogató.",
    en: "warm inviting real estate layout: cream and sand tones, soft bronze accents, gentle rounded panels, cozy premium feel",
  },
  {
    value: "kontrasztos",
    label: "Kontrasztos, erős",
    desc: "Sötét blokkok, éles vágások — feltűnő a hirdetési felületeken.",
    en: "bold high-contrast real estate poster: strong dark blocks, sharp diagonal cuts, vivid accent bands, striking modern composition",
  },
];

export function getFlyerMood(v: string): FlyerMood {
  return FLYER_MOODS.find((m) => m.value === v) ?? FLYER_MOODS[0];
}

/**
 * A kompozíciós prompt. Kulcs: a modell RENDEZZE EL a fotókat és építsen köréjük
 * dizájnt, de NE írjon szöveget és NE rajzolja át magukat a fotókat.
 * @param imageCount hány fotót adunk át (1–4)
 * @param accent az arculati fő szín (hex) — ehhez igazítjuk a dekorációt
 */
export function buildComposePrompt(opts: {
  imageCount: number;
  accent: string;
  mood: string;
  ratioLabel: string; // pl. "square 1:1", "vertical 9:16"
}): string {
  const mood = getFlyerMood(opts.mood);
  const n = Math.max(1, Math.min(4, opts.imageCount));

  const layout =
    n === 1
      ? "Use the photo as one large hero image occupying the upper two thirds of the canvas."
      : n === 2
        ? "Use the FIRST photo as a large hero image at the top, and the SECOND photo as a smaller supporting image below it."
        : n === 3
          ? "Use the FIRST photo as a large hero image at the top; place the other two photos side by side in a smaller row below."
          : "Use the FIRST photo as a large hero image at the top; place the other three photos in a smaller row below, evenly sized.";

  return `You are a senior graphic designer creating a REAL ESTATE ADVERTISEMENT LAYOUT (${opts.ratioLabel}).

You are given ${n} interior/exterior photo${n > 1 ? "s" : ""} of ONE property. Compose them into a polished, agency-quality advertisement background.

LAYOUT
- ${layout}
- Reserve CLEAN, EMPTY areas for text that will be added later: a wide empty band across the top for a headline, an empty panel on the right or bottom for contact details, and a small empty box for the price. These areas must be flat, uncluttered surfaces (solid colour, subtle gradient or soft blur) — visually finished, but WITHOUT any letters.
- Keep an even margin around the whole composition.

STYLE
- ${mood.en}.
- Build the decorative elements (frames, bands, panels, dividers) around this accent colour: ${opts.accent}.
- Premium print-advertisement quality: precise alignment, balanced spacing, tasteful depth.

ABSOLUTE RULES — breaking any of these makes the result unusable:
- Do NOT render ANY text, letters, numbers, words, logos, watermarks, labels or icons with characters. The layout must be completely text-free.
- Do NOT alter, restyle, redraw or regenerate the photographs themselves: keep every room exactly as photographed (same furniture, same architecture, same colours). You may only crop, scale and place them.
- Do NOT invent new rooms, buildings or property photos.
- Do NOT add people.

Output exactly one photorealistic advertisement background image and nothing else.`;
}
