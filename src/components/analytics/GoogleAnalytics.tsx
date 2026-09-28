// Google Analytics 4 betöltése — Consent Mode v2-vel, ALAPBÓL MINDEN TILTVA.
// Amíg a látogató nem fogad el sütit (CookieBanner), a GA csak süti nélküli, névtelen
// jeleket kap; elfogadás után a sáv frissíti az állapotot, a korábbi döntést pedig
// betöltéskor innen állítjuk vissza (localStorage).
//
// Csak a publikus oldalakon töltődik be és mér (a dashboard/admin belső felület).
// Az oldalmegtekintést kézzel küldjük útvonalváltáskor (Next.js kliensoldali navigáció),
// ezért a GA-ban a „böngészési előzmények alapján” mért oldalváltást ki kell kapcsolni.
"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { GA_ID, gaPageView, isTrackedPath } from "@/lib/analytics";
import { CONSENT_KEY } from "@/lib/consent";

function PageViewTracker() {
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    if (!isTrackedPath(pathname)) return;
    const qs = search?.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    // Az első betöltésnél a gtag még nem biztos, hogy létezik (a Script a hidratálás
    // után fut) — ilyenkor rövid ideig várunk rá, hogy az első oldalmegtekintés se vesszen el.
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const send = () => {
      if (typeof (window as unknown as { gtag?: unknown }).gtag === "function") {
        gaPageView(url);
      } else if (tries++ < 50) {
        timer = setTimeout(send, 100);
      }
    };
    send();
    return () => { if (timer) clearTimeout(timer); };
  }, [pathname, search]);

  return null;
}

export default function GoogleAnalytics() {
  const pathname = usePathname();
  // Nincs azonosító (helyi fejlesztés) vagy belső oldalon nyitották meg → nem töltjük be.
  if (!GA_ID || !isTrackedPath(pathname)) return null;

  return (
    <>
      <Script id="ga-consent-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('consent', 'default', {
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            analytics_storage: 'denied',
            wait_for_update: 500
          });
          try {
            if (localStorage.getItem('${CONSENT_KEY}') === 'granted') {
              gtag('consent', 'update', { analytics_storage: 'granted' });
            }
          } catch (e) {}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { send_page_view: false });
        `}
      </Script>
      <Script
        id="ga-gtag"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
    </>
  );
}
