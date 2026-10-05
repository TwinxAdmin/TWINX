// Melyik videómotor készíti a videókat: a Shotstack (külső szolgáltatás) vagy a
// saját TWINX motor (fejlesztés alatt, lásd a `twinx-video-motor` git-ágat).
//
// Beállítás: VIDEO_RENDERER = "shotstack" | "twinx"   (alapértelmezés: shotstack)
//
// BIZTONSÁGI ZÁR: amíg a saját motor nincs kész (TWINX_ENGINE_READY = false), a
// partnerek videói akkor is a Shotstackkel készülnek, ha a beállítás "twinx" —
// így egy félkész motor véletlenül sem kerülhet élesbe. A saját motor addig csak
// az admin Videólaborban fut.
//
// SZERVEROLDALI modul (környezeti változót olvas).

export type VideoRendererId = "shotstack" | "twinx";

/** A saját motor élesíthető-e. Csak akkor állítsd true-ra, ha a Videólaborban hibátlan. */
export const TWINX_ENGINE_READY = false;

export type VideoRendererInfo = {
  /** Amit a VIDEO_RENDERER beállítás kér. */
  configured: VideoRendererId;
  /** Ami TÉNYLEGESEN fut a partnerek videóinál. */
  effective: VideoRendererId;
  /** Kész-e a saját motor az élesítésre. */
  engineReady: boolean;
  /** Shotstack környezet: "stage" (teszt, vízjeles) vagy "v1" (éles). */
  shotstackEnv: string;
};

export function configuredRenderer(): VideoRendererId {
  return String(process.env.VIDEO_RENDERER ?? "").trim().toLowerCase() === "twinx" ? "twinx" : "shotstack";
}

/** A partnerek videóinál ténylegesen használt motor (a biztonsági zárral együtt). */
export function activeRenderer(): VideoRendererId {
  return configuredRenderer() === "twinx" && TWINX_ENGINE_READY ? "twinx" : "shotstack";
}

export function rendererInfo(): VideoRendererInfo {
  return {
    configured: configuredRenderer(),
    effective: activeRenderer(),
    engineReady: TWINX_ENGINE_READY,
    shotstackEnv: process.env.SHOTSTACK_ENV || "stage",
  };
}
