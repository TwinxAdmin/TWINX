// „Alaprajzból bejárható 3D lakás" modul — MINDEN üzleti érték itt (env-ből felülírható), a kódba nem írunk számot.
// Szerveroldalon olvasandó; a kliens a lapról kapja meg (props), így a böngészőbe nem kell NEXT_PUBLIC_ változó.

function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export type Floorplan3dConfig = {
  /** Megengedett eltérés a számolt és a megadott m² között (%), fölötte figyelmeztetés. */
  areaTolerancePct: number;
  /** Belmagasság, ha az alaprajz nem adja meg (m). */
  defaultCeilingHeight: number;
  /** Falvastagság a 3D-hez (m) — belső válaszfal / külső fal. */
  interiorWallThickness: number;
  exteriorWallThickness: number;
  /** Kredit: 3D-bejárás létrehozása / a link meghosszabbítása. */
  creditsCreate: number;
  creditsExtend: number;
  /** A bejárható link élettartama napokban (lejárat után meghosszabbítható). */
  linkDays: number;
  /** Minőségi ciklus: legfeljebb ennyi kör helyiségenként. */
  maxQualityRounds: number;
  /** Feltöltés: legnagyobb fájlméret (bájt). */
  maxUploadBytes: number;
  /** Digitalizálás: képelemző modell és becsült díja (USD / millió token) a költségnaplóhoz. */
  visionModel: string;
  visionUsdPerMTokIn: number;
  visionUsdPerMTokOut: number;
};

export function floorplan3dConfig(): Floorplan3dConfig {
  return {
    areaTolerancePct: num("FLOORPLAN3D_AREA_TOLERANCE_PCT", 5),
    defaultCeilingHeight: num("FLOORPLAN3D_CEILING_HEIGHT", 2.7),
    interiorWallThickness: num("FLOORPLAN3D_WALL_INTERIOR", 0.1),
    exteriorWallThickness: num("FLOORPLAN3D_WALL_EXTERIOR", 0.3),
    creditsCreate: num("FLOORPLAN3D_CREDITS_CREATE", 10),
    creditsExtend: num("FLOORPLAN3D_CREDITS_EXTEND", 3),
    linkDays: num("FLOORPLAN3D_LINK_DAYS", 30),
    maxQualityRounds: num("FLOORPLAN3D_MAX_QUALITY_ROUNDS", 4),
    maxUploadBytes: num("FLOORPLAN3D_MAX_UPLOAD_MB", 15) * 1024 * 1024,
    visionModel: process.env.FLOORPLAN3D_VISION_MODEL || "gemini-3.1-pro-preview",
    visionUsdPerMTokIn: num("FLOORPLAN3D_VISION_USD_IN", 2),
    visionUsdPerMTokOut: num("FLOORPLAN3D_VISION_USD_OUT", 12),
  };
}

/** Elfogadott feltöltés-típusok: kép vagy PDF (a kézi rajz fotója is kép). */
export const FLOORPLAN_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
