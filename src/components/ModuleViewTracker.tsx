// ModuleViewTracker — láthatatlan figyelő a dashboard keretében (MH2): oldalváltáskor jelzi a szervernek,
// melyik útvonalat nyitotta meg a felhasználó (POST /api/track/module-view). Hogy melyik modul az, a szerver
// dönti el. Egy böngészőben útvonalanként naponta egyszer küld (a szerver amúgy is naponta egy sort ír).
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ModuleViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || !pathname.startsWith("/dashboard/")) return;
    const day = new Date().toISOString().slice(0, 10);
    const key = `twx-mv:${day}:${pathname}`;
    try {
      if (localStorage.getItem(key)) return;
      // a korábbi napok jelzőit kitakarítjuk, hogy ne gyűljenek
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k?.startsWith("twx-mv:") && !k.startsWith(`twx-mv:${day}:`)) localStorage.removeItem(k);
      }
      localStorage.setItem(key, "1");
    } catch {
      // privát mód / tiltott tárhely: ilyenkor is küldünk, a szerver kiszűri az ismétlést
    }
    void fetch("/api/track/module-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
