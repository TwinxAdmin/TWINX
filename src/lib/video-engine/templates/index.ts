// A SAJÁT MOTOR SABLONJAI — egy helyen. Új sablon = egy új fájl + egy sor itt.
import type { TwinxTemplate, TemplateVariant } from "@/lib/video-engine/template-schema";
import { applyVariant } from "@/lib/video-engine/template-schema";
import { AURORA, AURORA_VARIANTS } from "@/lib/video-engine/templates/aurora";
import { SKANDI, SKANDI_VARIANTS } from "@/lib/video-engine/templates/skandi";

export const ENGINE_TEMPLATES: TwinxTemplate[] = [AURORA, SKANDI];
export const ENGINE_VARIANTS: TemplateVariant[] = [...AURORA_VARIANTS, ...SKANDI_VARIANTS];

/** A választható tételek: alap sablonok + színváltozatok (a laborhoz / varázslóhoz). */
export function engineChoices(): Array<{ id: string; name: string; templateId: string }> {
  return [
    ...ENGINE_TEMPLATES.map((t) => ({ id: t.id, name: t.name, templateId: t.id })),
    ...ENGINE_VARIANTS.map((v) => ({ id: v.id, name: v.name, templateId: v.templateId })),
  ];
}

/** A szerkesztő sablon-galériája: név + végleges paletta + méretek (előnézet-csempékhez). */
export type EngineGalleryItem = {
  id: string;
  name: string;
  templateId: string;
  palette: TwinxTemplate["palette"];
  aspects: TwinxTemplate["aspects"];
  /** Fotónkénti felirat max. hossza (ha nincs megadva: a régi alap). */
  captionMaxChars?: number;
};
export function engineGallery(): EngineGalleryItem[] {
  return engineChoices().map((c) => {
    const t = resolveEngineTemplate(c.id);
    return { id: c.id, name: c.name.replace(/^TWINX\s+/, ""), templateId: c.templateId, palette: t.palette, aspects: t.aspects, captionMaxChars: t.captionMaxChars };
  });
}

/**
 * SABLONCSALÁDOK a szerkesztőhöz: egy sablon = egy kártya, a színváltozatai
 * kör alakú színválasztó gombok. A család neve és a színek nevei itt állnak —
 * új színváltozatnál csak egy sor kell a COLOR_NAMES-be.
 */
const FAMILY_NAMES: Record<string, { name: string; tagline: string }> = {
  aurora: { name: "Aurora", tagline: "Elegáns, sötét — nyíl-áttűnések, ferde panelek" },
  skandi: { name: "Skandi", tagline: "Világos, letisztult — lágy átúsztatás, háztető-panel" },
};
const COLOR_NAMES: Record<string, string> = {
  aurora: "Borostyán",
  nocturne: "Éjkék",
  skandi: "Homok",
  "skandi-zsalya": "Zsálya",
};
export type EngineColor = EngineGalleryItem & { colorName: string };
export type EngineFamily = { templateId: string; name: string; tagline: string; colors: EngineColor[] };
export function engineFamilies(): EngineFamily[] {
  const all = engineGallery();
  return ENGINE_TEMPLATES.map((t) => ({
    templateId: t.id,
    name: FAMILY_NAMES[t.id]?.name ?? t.name.replace(/^TWINX\s+/, ""),
    tagline: FAMILY_NAMES[t.id]?.tagline ?? "",
    colors: all.filter((g) => g.templateId === t.id).map((g) => ({ ...g, colorName: COLOR_NAMES[g.id] ?? g.name })),
  }));
}

/** Sablon (és ha kell, színváltozat) azonosító alapján; ismeretlen → Aurora. */
export function resolveEngineTemplate(id: string): TwinxTemplate {
  const base = ENGINE_TEMPLATES.find((t) => t.id === id);
  if (base) return base;
  const v = ENGINE_VARIANTS.find((x) => x.id === id);
  if (v) {
    const t = ENGINE_TEMPLATES.find((x) => x.id === v.templateId);
    if (t) return applyVariant(t, v);
  }
  return AURORA;
}
