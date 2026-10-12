// Modul-visszajelzés (ME3) — közös típusok és listák (kliens ÉS szerver; nincs benne "use client").
// Csillagos értékelés: a 3. sikeres futtatás után modulonként egyszer; bezárás után a 6.-nál még egyszer, utoljára.
// „Mi hiányzik?": legalább 3 különböző napon megnyitotta, de nem futtatta — modulonként egyszer.

export const RATING_FIRST_RUN = 3;
export const RATING_SECOND_RUN = 6;
export const ASK_VIEW_DAYS = 3;

/** 1–3 csillagnál választható okok (nem kötelező). */
export const RATING_REASONS = [
  { value: "inaccurate", label: "Nem pontos" },
  { value: "unexpected", label: "Nem ezt vártam" },
  { value: "slow", label: "Lassú" },
  { value: "complicated", label: "Bonyolult" },
  { value: "expensive", label: "Drága" },
  { value: "other", label: "Egyéb" },
] as const;
export type RatingReason = (typeof RATING_REASONS)[number]["value"];

/** „Mi hiányzik?" válaszlehetőségek. */
export const ASK_CHOICES = [
  { value: "unclear", label: "Nem értem, mire jó" },
  { value: "expensive", label: "Drága" },
  { value: "missing_data", label: "Hiányzik hozzá egy adat" },
  { value: "browsing", label: "Csak nézelődöm" },
  { value: "other", label: "Egyéb" },
] as const;
export type AskChoice = (typeof ASK_CHOICES)[number]["value"];

export const FEEDBACK_COMMENT_MAX = 500;
