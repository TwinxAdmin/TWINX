// 3D-BÚTORKATALÓGUS (K2/K3) — jogtiszta modellek (Poly Haven, CC0; lásd public/floorplan3d/models/LICENC.md) a bútortípusokhoz.
// A MÉRETARÁNYOSSÁG a fő cél: a katalógusos bútor mérete RÖGZÍTETT (a modell valós mérete) — az építő ezzel tervez, és a 3D sem nyújtja
// (a valódi modell torzulna). Ahol nincs megfelelő modell (pl. modern kanapé, szőnyeg), a kódos (paraméteres) bútor marad.
// Tiszta adat — kliens és szerver is használja.
import type { FurnitureType } from "@/lib/floorplan3d/furniture";

export type CatalogModel = {
  id: string;
  /** a glTF útvonala a public mappán belül */
  url: string;
  /** valós méret (m): szélesség (x) × mélység (z) × magasság (y) */
  w: number; d: number; h: number;
  /** a modell „eleje" helyi koordinátában: ha nem +z felé néz, ennyivel (fok) forgatjuk a betöltéskor */
  frontYawDeg: number;
  /** a mennyezetről lóg (lámpa): a teteje a mennyezeten */
  hangs?: boolean;
  source: string; license: "CC0" | "CC-BY"; author: string;
};

const PH = (id: string) => `/floorplan3d/models/${id}/${id}.gltf`;

export const FURNITURE_CATALOG: Partial<Record<FurnitureType, CatalogModel>> = {
  coffee_table: { id: "modern_coffee_table_01", url: PH("modern_coffee_table_01"), w: 1.2, d: 0.6, h: 0.39, frontYawDeg: 0, source: "Poly Haven", license: "CC0", author: "Amin" },
  side_table: { id: "side_table_01", url: PH("side_table_01"), w: 0.55, d: 0.45, h: 0.55, frontYawDeg: 0, source: "Poly Haven", license: "CC0", author: "James Ray Cock" },
  shelf: { id: "wooden_display_shelves_01", url: PH("wooden_display_shelves_01"), w: 1.08, d: 0.37, h: 1.56, frontYawDeg: 0, source: "Poly Haven", license: "CC0", author: "James Ray Cock" },
  sideboard: { id: "modern_wooden_cabinet", url: PH("modern_wooden_cabinet"), w: 2.44, d: 0.52, h: 0.68, frontYawDeg: 0, source: "Poly Haven", license: "CC0", author: "Patrik Pangerl" },
  pendant_lamp: { id: "modern_ceiling_lamp_01", url: PH("modern_ceiling_lamp_01"), w: 0.43, d: 0.43, h: 0.95, frontYawDeg: 0, hangs: true, source: "Poly Haven", license: "CC0", author: "James Ray Cock" },
  plant: { id: "potted_plant_02", url: PH("potted_plant_02"), w: 0.7, d: 0.66, h: 0.84, frontYawDeg: 0, source: "Poly Haven", license: "CC0", author: "Rico Cilliers" },
  armchair: { id: "modern_arm_chair_01", url: PH("modern_arm_chair_01"), w: 0.82, d: 0.99, h: 1.02, frontYawDeg: 0, source: "Poly Haven", license: "CC0", author: "Vibrant Nordic" },
};

/** Rögzített méretű-e a típus (van hozzá katalógusmodell)? */
export function catalogModel(type: FurnitureType): CatalogModel | null {
  return FURNITURE_CATALOG[type] ?? null;
}
