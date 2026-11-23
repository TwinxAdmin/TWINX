// Modul-kapu az új felületen (3d; terv 22 / 3. A): az Ingatlan csomag moduljait csak az éri el, akinek
// van Ingatlan-hozzáférése (az admin mindig). Aki nem, az a modul helyén semleges üzenetet lát.
// A régi felületen nem csinál semmit. A szerveroldali levonás-szabály ettől független (lib/credits.ts).
"use client";

import { usePathname } from "next/navigation";
import { useUiMode } from "@/components/UiModeProvider";

/** Az Ingatlan csomag moduljainak útvonalai (lib/catalog.ts). */
const ESTATE_PATHS = ["/dashboard/real-estate", "/dashboard/flyer"];

export const MODULE_UNAVAILABLE_TEXT = "Ez a modul most nem érhető el. Kérdezd a cégvezetőt, vagy írj nekünk: office@twinx.hu.";

export default function ModuleGate({ children }: { children: React.ReactNode }) {
  const { newUi, estate, admin } = useUiMode();
  const path = usePathname() ?? "";
  const gated = newUi && !admin && !estate && ESTATE_PATHS.some((p) => path === p || path.startsWith(p + "/"));
  if (!gated) return <>{children}</>;
  return (
    <div className="twx-card mx-auto mt-10 flex min-h-[260px] max-w-xl flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="font-display text-xl font-semibold">Ez a modul most nem érhető el</p>
      <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>{MODULE_UNAVAILABLE_TEXT}</p>
      <a href="mailto:office@twinx.hu" className="twx-btn">Írok nektek</a>
    </div>
  );
}
