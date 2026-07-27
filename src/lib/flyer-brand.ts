// Hirdetés arculata: mentett profilból VAGY egyszeri, itt megadott adatokból.
// Az arculat nem kötelező — ha a partner most találkozik először a modullal,
// megadhatja a színt és az elérhetőségét egyszer erre a hirdetésre, mentés nélkül.
import { getBrandingFont, BRANDING_FONTS } from "@/lib/branding";
import type { FlyerProfileData } from "@/lib/flyer-template";

export type QuickBrand = {
  display_name: string;
  title: string;
  phone: string;
  email: string;
  company: string;
  website: string;
  accent_color: string;
  font: string;
  theme: "light" | "dark";
  logo_url: string | null;
  agent_photo_url: string | null;
};

export const EMPTY_QUICK_BRAND: QuickBrand = {
  display_name: "",
  title: "",
  phone: "",
  email: "",
  company: "",
  website: "",
  accent_color: "#ef7a5a",
  font: BRANDING_FONTS[0].value,
  theme: "light",
  logo_url: null,
  agent_photo_url: null,
};

/** Az egyszeri arculatból a sablon által várt adatszerkezet. */
export function quickToProfileData(q: QuickBrand): FlyerProfileData {
  return {
    display_name: q.display_name.trim(),
    title: q.title.trim(),
    phone: q.phone.trim(),
    email: q.email.trim(),
    company: q.company.trim(),
    website: q.website.trim(),
    slogan: "",
    logo_url: q.logo_url,
    agent_photo_url: q.agent_photo_url,
    accent_color: /^#[0-9a-fA-F]{6}$/.test(q.accent_color) ? q.accent_color : "#ef7a5a",
    font: getBrandingFont(q.font).value,
    theme: q.theme === "dark" ? "dark" : "light",
  };
}

/**
 * Minimális elvárás arculat nélkül: legyen kihez kapcsolni a hirdetést.
 * (Név VAGY cégnév, és legalább egy elérhetőség.)
 */
export function validateQuickBrand(q: QuickBrand): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!q.display_name.trim() && !q.company.trim()) {
    errors.display_name = "Adj meg egy nevet vagy cégnevet.";
  }
  if (!q.phone.trim() && !q.email.trim()) {
    errors.phone = "Adj meg legalább egy elérhetőséget (telefon vagy e-mail).";
  }
  if (q.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q.email.trim())) {
    errors.email = "Érvénytelen e-mail cím.";
  }
  return errors;
}
