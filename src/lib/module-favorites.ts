// Kedvenc modulok — a választható modulok listája a KATALÓGUSBÓL (catalog.ts) jön,
// így csak valódi, látható modul jelölhető meg, és egy új modul magától megjelenik.
import { visibleCategories, visibleModules, type ModuleLink } from "@/lib/catalog";

/** Egyszerre ennyi kedvenc lehet (a felület is ennyit mutat kényelmesen). */
export const FAVORITES_MAX = 12;

/** Minden látható modul, útvonal szerint egyedi (ugyanaz a modul két kategóriában is szerepelhet). */
export function selectableModules(): ModuleLink[] {
  const seen = new Set<string>();
  const out: ModuleLink[] = [];
  for (const c of visibleCategories()) {
    for (const m of visibleModules(c)) {
      if (seen.has(m.href)) continue;
      seen.add(m.href);
      out.push(m);
    }
  }
  return out;
}

export function isSelectableModule(href: string): boolean {
  return selectableModules().some((m) => m.href === href);
}

/**
 * Az előzmény (usage_history.feature_used) melyik modulhoz tartozik — az
 * „Utoljára: …" dátumhoz. Ami nincs itt, annak nincs utolsó használata.
 */
export const FEATURE_TO_HREF: Record<string, string> = {
  flyer: "/dashboard/flyer",
  image_enhance: "/dashboard/real-estate/image-enhance",
  image_enhance_regenerate: "/dashboard/real-estate/image-enhance",
  visualization: "/dashboard/real-estate/visualization",
  video: "/dashboard/real-estate/video",
  "fb-ads": "/dashboard/real-estate/fb-ads",
  "google-ads": "/dashboard/real-estate/fb-ads",
  "ad-check": "/dashboard/real-estate/ad-check",
  valuation: "/dashboard/real-estate/valuation",
  professional_search: "/dashboard/real-estate/professionals",
  "land-valuation": "/dashboard/real-estate/land",
  menu_generator: "/dashboard/hospitality/menu",
  cost_analysis: "/dashboard/hospitality/costing",
  profit_plan: "/dashboard/hospitality/costing",
  supplier_search: "/dashboard/hospitality/suppliers",
};
