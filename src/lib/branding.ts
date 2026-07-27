// Arculat-profilok — típusok, opciók, validáció (kliens + szerver).
// Egy fiók több profilt tarthat; a Hirdetéskészítő ezekből választ.

export type ThemeMode = "light" | "dark";

export type BrandingProfile = {
  id: string;
  label: string;
  display_name: string;
  title: string;
  phone: string;
  email: string;
  company: string;
  website: string;
  slogan: string;
  logo_url: string | null;
  agent_photo_url: string | null; // az ügynök (partner) saját fotója
  accent_color: string;
  font: string;
  theme: ThemeMode;
};

export type BrandingInput = Omit<BrandingProfile, "id" | "logo_url" | "agent_photo_url">;

export const EMPTY_BRANDING: BrandingInput = {
  label: "",
  display_name: "",
  title: "",
  phone: "",
  email: "",
  company: "",
  website: "",
  slogan: "",
  accent_color: "#ef7a5a",
  font: "inter",
  theme: "light",
};

// Választható betűtípusok. MIND tartalmazza a magyar ékezeteket (latin-ext),
// így az „ő" és „ű" sosem törik el a hirdetéseken és a videókon.
// Egy helyen tartjuk a CSS-családot és a betöltő linket is — a flyer-sablon ezt használja.
export type BrandingFont = {
  value: string;
  label: string;
  category: "sans" | "serif" | "display";
  family: string;
  link: string;
};

const g = (name: string, weights = "400;600;800") =>
  `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, "+")}:wght@${weights}&display=swap`;

export const BRANDING_FONTS: BrandingFont[] = [
  // — Talpatlan (sans) —
  { value: "inter", label: "Inter", category: "sans", family: "'Inter', sans-serif", link: g("Inter") },
  { value: "montserrat", label: "Montserrat", category: "sans", family: "'Montserrat', sans-serif", link: g("Montserrat") },
  { value: "poppins", label: "Poppins", category: "sans", family: "'Poppins', sans-serif", link: g("Poppins") },
  { value: "roboto", label: "Roboto", category: "sans", family: "'Roboto', sans-serif", link: g("Roboto", "400;700;900") },
  { value: "opensans", label: "Open Sans", category: "sans", family: "'Open Sans', sans-serif", link: g("Open Sans") },
  { value: "lato", label: "Lato", category: "sans", family: "'Lato', sans-serif", link: g("Lato", "400;700;900") },
  { value: "nunito", label: "Nunito", category: "sans", family: "'Nunito', sans-serif", link: g("Nunito") },
  { value: "raleway", label: "Raleway", category: "sans", family: "'Raleway', sans-serif", link: g("Raleway") },
  { value: "worksans", label: "Work Sans", category: "sans", family: "'Work Sans', sans-serif", link: g("Work Sans") },
  { value: "rubik", label: "Rubik", category: "sans", family: "'Rubik', sans-serif", link: g("Rubik") },
  { value: "manrope", label: "Manrope", category: "sans", family: "'Manrope', sans-serif", link: g("Manrope") },
  { value: "dmsans", label: "DM Sans", category: "sans", family: "'DM Sans', sans-serif", link: g("DM Sans") },
  { value: "figtree", label: "Figtree", category: "sans", family: "'Figtree', sans-serif", link: g("Figtree") },
  { value: "outfit", label: "Outfit", category: "sans", family: "'Outfit', sans-serif", link: g("Outfit") },
  { value: "spacegrotesk", label: "Space Grotesk", category: "sans", family: "'Space Grotesk', sans-serif", link: g("Space Grotesk", "400;600;700") },
  { value: "barlow", label: "Barlow", category: "sans", family: "'Barlow', sans-serif", link: g("Barlow") },
  { value: "karla", label: "Karla", category: "sans", family: "'Karla', sans-serif", link: g("Karla") },
  { value: "mulish", label: "Mulish", category: "sans", family: "'Mulish', sans-serif", link: g("Mulish") },
  { value: "archivo", label: "Archivo", category: "sans", family: "'Archivo', sans-serif", link: g("Archivo") },

  // — Talpas (serif) —
  { value: "playfair", label: "Playfair Display", category: "serif", family: "'Playfair Display', serif", link: g("Playfair Display", "500;700;900") },
  { value: "merriweather", label: "Merriweather", category: "serif", family: "'Merriweather', serif", link: g("Merriweather", "400;700;900") },
  { value: "lora", label: "Lora", category: "serif", family: "'Lora', serif", link: g("Lora", "400;600;700") },
  { value: "librebaskerville", label: "Libre Baskerville", category: "serif", family: "'Libre Baskerville', serif", link: g("Libre Baskerville", "400;700") },
  { value: "cormorant", label: "Cormorant Garamond", category: "serif", family: "'Cormorant Garamond', serif", link: g("Cormorant Garamond", "400;600;700") },
  { value: "ebgaramond", label: "EB Garamond", category: "serif", family: "'EB Garamond', serif", link: g("EB Garamond", "400;600;800") },
  { value: "ptserif", label: "PT Serif", category: "serif", family: "'PT Serif', serif", link: g("PT Serif", "400;700") },
  { value: "spectral", label: "Spectral", category: "serif", family: "'Spectral', serif", link: g("Spectral", "400;600;800") },
  { value: "bitter", label: "Bitter", category: "serif", family: "'Bitter', serif", link: g("Bitter") },
  { value: "sourceserif", label: "Source Serif 4", category: "serif", family: "'Source Serif 4', serif", link: g("Source Serif 4", "400;600;700") },

  // — Karakteres cím (display) —
  { value: "oswald", label: "Oswald", category: "display", family: "'Oswald', sans-serif", link: g("Oswald", "400;600;700") },
  { value: "bebas", label: "Bebas Neue", category: "display", family: "'Bebas Neue', sans-serif", link: "https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" },
  { value: "anton", label: "Anton", category: "display", family: "'Anton', sans-serif", link: "https://fonts.googleapis.com/css2?family=Anton&display=swap" },
  { value: "clash", label: "Clash Display", category: "display", family: "'Clash Display', sans-serif", link: "https://api.fontshare.com/v2/css?f[]=clash-display@500,600,700&display=swap" },
];

export const FONT_CATEGORIES: { value: BrandingFont["category"]; label: string }[] = [
  { value: "sans", label: "Talpatlan" },
  { value: "serif", label: "Talpas" },
  { value: "display", label: "Karakteres" },
];

export function getBrandingFont(value: string): BrandingFont {
  return BRANDING_FONTS.find((f) => f.value === value) ?? BRANDING_FONTS[0];
}

export const BRANDING_THEMES: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Világos" },
  { value: "dark", label: "Sötét" },
];

const HEX_RE = /^#([0-9a-fA-F]{6})$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateBrandingInput(
  raw: Record<string, unknown>
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const label = String(raw?.label ?? "").trim();
  const name = String(raw?.display_name ?? "").trim();
  const email = String(raw?.email ?? "").trim();
  const accent = String(raw?.accent_color ?? "").trim();

  if (!label) errors.label = "Adj nevet a profilnak (pl. Péter).";
  if (!name) errors.display_name = "A hirdetésen megjelenő név kötelező.";
  if (email && !EMAIL_RE.test(email)) errors.email = "Érvénytelen e-mail cím.";
  if (accent && !HEX_RE.test(accent)) errors.accent_color = "A szín hex formátumú legyen (pl. #ef7a5a).";

  return { valid: Object.keys(errors).length === 0, errors };
}
