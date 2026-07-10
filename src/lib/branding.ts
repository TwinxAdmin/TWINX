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
  accent_color: string;
  font: string;
  theme: ThemeMode;
};

export type BrandingInput = Omit<BrandingProfile, "id" | "logo_url">;

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

// Választható betűtípusok (a flyer-sablon Google Fontsból tölti majd be).
export const BRANDING_FONTS: { value: string; label: string }[] = [
  { value: "inter", label: "Inter — modern, letisztult" },
  { value: "montserrat", label: "Montserrat — geometrikus" },
  { value: "playfair", label: "Playfair Display — elegáns szerif" },
  { value: "poppins", label: "Poppins — barátságos, kerek" },
  { value: "clash", label: "Clash Display — karakteres cím" },
];

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
