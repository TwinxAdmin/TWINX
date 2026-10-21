// Admin → „Munkák" fül — a szerver (admin-works.ts) és a felület (AdminWorksView.tsx) közös típusai és modulcsoportjai.
// Szerveroldali kódot NEM importálhat (a kliens is betölti).
export type WorksRange = "7d" | "30d" | "90d" | "all";

/** Modulcsoportok a szűrőhöz és a darabszám-sávhoz (a Képjavító „újra" futása is Képjavító). */
export const WORK_GROUPS = [
  { key: "enhance", label: "Képjavító", features: ["image_enhance", "image_enhance_regenerate"] },
  { key: "flyer", label: "Hirdetéskép", features: ["flyer"] },
  { key: "valuation", label: "Értékbecslés", features: ["valuation", "land-valuation"] },
  { key: "video", label: "Videó", features: ["video"] },
  { key: "visualization", label: "Látványterv", features: ["visualization"] },
] as const;
export type WorkGroupKey = (typeof WORK_GROUPS)[number]["key"] | "other";
export const OTHER_GROUP_LABEL = "Szöveg és egyéb";

export const GROUPED_FEATURES = new Set<string>(WORK_GROUPS.flatMap((g) => [...g.features]));

export function groupOf(feature: string): WorkGroupKey {
  return WORK_GROUPS.find((g) => (g.features as readonly string[]).includes(feature))?.key ?? "other";
}

export type AdminWork = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  feature: string;
  group: WorkGroupKey;
  typeLabel: string;
  title: string;
  url: string | null;
  createdAt: string;
};

export type AdminWorksResult = {
  works: AdminWork[];
  /** a következő oldal kurzora (az utolsó elem ideje) — null, ha nincs több */
  next: string | null;
  /** az időszak (és a felhasználó-szűrés) darabszámai modulcsoportonként — a sávhoz */
  counts: { total: number; users: number; groups: Record<WorkGroupKey, number> };
};
