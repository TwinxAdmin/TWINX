// Meta (Facebook) Pixel betöltése — ALAPBÓL TILTVA (consent revoke). Csak a nyilvános oldalakon (mint a GA);
// a marketing-süti elfogadása után a süti-sáv adja meg a hozzájárulást (lib/consent.ts), a korábbi döntést pedig
// betöltéskor innen állítjuk vissza. Az első oldalmegtekintést az alapkód küldi, a kliensoldali oldalváltásokat a követő.
"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { isTrackedPath } from "@/lib/analytics";
import { MARKETING_CONSENT_KEY } from "@/lib/consent";
import { META_PIXEL_ID, pixelPageView } from "@/lib/meta-pixel";

function PageViewTracker() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    // Friss betöltésnél az első PageView-t az alapkód küldi (és megjegyzi, melyik oldalon). Ha a Pixel már korábban betöltött
    // (belső oldalról érkezett vissza a látogató egy nyilvános oldalra), ezt az oldalt is jelezzük — duplán soha.
    if (first.current) {
      first.current = false;
      const sent = (window as unknown as { __twxPixelFirst?: string }).__twxPixelFirst;
      if (sent === undefined || sent === pathname) return;
    }
    if (isTrackedPath(pathname)) pixelPageView();
  }, [pathname]);
  return null;
}

export default function MetaPixel() {
  const pathname = usePathname();
  if (!META_PIXEL_ID || !isTrackedPath(pathname)) return null;

  return (
    <>
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
          document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('consent', 'revoke');
          try {
            if (localStorage.getItem('${MARKETING_CONSENT_KEY}') === 'granted') fbq('consent', 'grant');
          } catch (e) {}
          fbq('init', '${META_PIXEL_ID}');
          fbq('track', 'PageView');
          window.__twxPixelFirst = location.pathname;
        `}
      </Script>
      <PageViewTracker />
    </>
  );
}
