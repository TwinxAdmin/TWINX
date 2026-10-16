// „Alaprajzból bejárható 3D lakás" modul — MINDEN üzleti érték itt (env-ből felülírható), a kódba nem írunk számot.
// Szerveroldalon olvasandó; a kliens a lapról kapja meg (props), így a böngészőbe nem kell NEXT_PUBLIC_ változó.

function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** Mint a num(), de a 0 is érvényes érték (pl. ingyenes művelet). */
function num0(name: string, fallback: number): number {
  const raw = process.env[name];
  const v = Number(raw);
  return raw !== undefined && raw !== "" && Number.isFinite(v) && v >= 0 ? v : fallback;
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
  /** Kredit: a 9:16-os videó — NEM automatikus, a felhasználó külön kéri a kész link után. */
  creditsVideo: number;
  /** Kredit: utólagos geometriai javítás jóváhagyása (a digitalizálás hibáját javítja → alapból ingyenes). */
  creditsGeometryFix: number;
  /** Nyílászáró-figyelmeztetés: ennél közelebb a falsarokhoz (m) — csak jelzés, nem tiltás. */
  openingCornerMin: number;
  /** Célkép: legfeljebb ennyi próbálkozás, amíg a geometria-ellenőrzésen át nem megy (mindegyik fizetős képgenerálás). */
  targetMaxAttempts: number;
  /** Geometria-hűség küszöbei: a szerkezeti élek legalább ennyi része maradjon meg / legfeljebb ennyi legyen új (0–1). */
  fidelityMinKept: number;
  fidelityMaxAdded: number;
  /** A bejárható link élettartama napokban (lejárat után meghosszabbítható). */
  linkDays: number;
  /** Digitalizálás: önellenőrző körök száma, ha egy helyiség a tűrésen túl tér el a kiírt m²-től (0 = kikapcsolva). */
  digitizeRefineRounds: number;
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
    creditsVideo: num0("FLOORPLAN3D_CREDITS_VIDEO", 5),
    creditsGeometryFix: num0("FLOORPLAN3D_CREDITS_GEOMETRY_FIX", 0),
    digitizeRefineRounds: num0("FLOORPLAN3D_DIGITIZE_REFINE_ROUNDS", 1),
    openingCornerMin: num0("FLOORPLAN3D_OPENING_CORNER_MIN", 0.1),
    targetMaxAttempts: num("FLOORPLAN3D_TARGET_MAX_ATTEMPTS", 3),
    fidelityMinKept: num("FLOORPLAN3D_FIDELITY_MIN_KEPT", 0.7),
    fidelityMaxAdded: num("FLOORPLAN3D_FIDELITY_MAX_ADDED", 0.75),
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
