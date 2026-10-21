// SmartsuppChat — élő chat (Smartsupp) a nyilvános oldalakon és a bejelentkezett Portálban; az admin- és
// sales-felületen NEM (ott el is rejtjük, ha valaki a Portálból navigál át).
// A Smartsupp „head-be illesztendő" kódja ugyanaz, csak next/script tölti be (afterInteractive), egyszer.
// Mindig betölt (ügyfélszolgálati funkció — Márk döntése, 2026-10-21); a Smartsupp az adatkezelési
// tájékoztatóba adatfeldolgozóként kerül. A kulcs nem titok (a böngészőben fut), felülírható: NEXT_PUBLIC_SMARTSUPP_KEY.
"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const KEY = process.env.NEXT_PUBLIC_SMARTSUPP_KEY || "e7960296f4db350f2e5fff27503cfc1706a1403b";

/** Az admin- és sales-felületen nincs chat. */
function hiddenOn(path: string): boolean {
  return path.startsWith("/admin") || path.startsWith("/sales");
}

type SmartsuppFn = (...args: unknown[]) => void;
function api(): SmartsuppFn | null {
  return (window as unknown as { smartsupp?: SmartsuppFn }).smartsupp ?? null;
}

export default function SmartsuppChat() {
  const pathname = usePathname() ?? "/";
  const hidden = hiddenOn(pathname);
  // Csak akkor töltjük be, ha egyszer olyan oldalon járt, ahol a chat látszik (adminnal kezdve nem töltődik be).
  const [enabled, setEnabled] = useState(!hidden);

  useEffect(() => {
    if (!hidden) setEnabled(true);
    // betöltés után oldalváltáskor: elrejtés / újra megjelenítés
    api()?.(hidden ? "chat:hide" : "chat:show");
  }, [hidden]);

  if (!enabled) return null;
  return (
    <Script id="smartsupp-chat" strategy="afterInteractive">
      {`var _smartsupp = _smartsupp || {};
_smartsupp.key = ${JSON.stringify(KEY)};
// bal alsó sarok: a jobb alsóban a nézet-váltó sáv és a modul-értékelő ablak ül
_smartsupp.orientation = "left";
// telefonon a buborék a Portál alsó kredit-sávja fölé kerül
if (window.innerWidth < 768) _smartsupp.offsetY = 84;
window.smartsupp||(function(d) {
  var s,c,o=smartsupp=function(){ o._.push(arguments)};o._=[];
  s=d.getElementsByTagName('script')[0];c=d.createElement('script');
  c.type='text/javascript';c.charset='utf-8';c.async=true;
  c.src='https://www.smartsuppchat.com/loader.js?';s.parentNode.insertBefore(c,s);
})(document);`}
    </Script>
  );
}

/**
 * Bejelentkezett felhasználónál a chatben a neve és az e-mail-címe látszik (Márk döntése) — kredit- vagy
 * pénzügyi adatot NEM küldünk. A Portál layoutja teszi ki; ha a chat még töltődik, a Smartsupp sorba állítja a hívást.
 */
export function SmartsuppIdentity({ name, email }: { name: string | null; email: string | null }) {
  useEffect(() => {
    let tries = 0;
    const t = window.setInterval(() => {
      const s = api();
      if (s) {
        if (name) s("name", name);
        if (email) s("email", email);
      }
      if (s || ++tries > 40) window.clearInterval(t);
    }, 250);
    return () => window.clearInterval(t);
  }, [name, email]);
  return null;
}
