// Süti-sáv — lebegő kártya a bal alsó sarokban, csak a publikus oldalakon.
// Két EGYENRANGÚ gomb (Elutasítom / Elfogadom): azonos méret és stílus, hogy az
// elutasítás ne legyen nehezebb az elfogadásnál. A döntés után eltűnik; a lábléc
// „Süti-beállítások” linkjével (openConsentSettings) bármikor újra megnyitható.
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isTrackedPath } from "@/lib/analytics";
import { getConsent, setConsent, OPEN_CONSENT_EVENT, type ConsentChoice } from "@/lib/consent";

export default function CookieBanner() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<ConsentChoice | null>(null);

  // Első betöltéskor: ha még nem döntött, feljön a kártya.
  useEffect(() => {
    const c = getConsent();
    setCurrent(c);
    if (c === null) setOpen(true);
    const reopen = () => { setCurrent(getConsent()); setOpen(true); };
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  if (!open || !isTrackedPath(pathname)) return null;

  function choose(choice: ConsentChoice) {
    setConsent(choice);
    setCurrent(choice);
    setOpen(false);
  }

  const btn =
    "flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2";

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Süti-beállítások"
      className="fixed bottom-4 left-4 right-4 z-[60] sm:right-auto sm:w-[360px]"
    >
      <div
        className="rounded-2xl p-5"
        style={{
          background: "var(--twx-cream-card)",
          border: "1px solid var(--twx-line)",
          color: "var(--twx-ink)",
          boxShadow: "0 18px 50px rgba(20,14,10,0.28)",
        }}
      >
        <p className="font-display text-base font-semibold">
          Sütik <span style={{ color: "var(--twx-coral)" }}>·</span> a te döntésed
        </p>
        <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>
          Látogatottsági sütikkel mérjük, mi működik az oldalon (Google Analytics). Csak a
          hozzájárulásoddal — hirdetési célra nem használjuk.
        </p>
        {current && (
          <p className="mt-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            Jelenleg: <strong>{current === "granted" ? "elfogadva" : "elutasítva"}</strong>
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => choose("denied")}
            className={btn}
            style={{ background: "#fff", border: "1.5px solid var(--twx-ink)", color: "var(--twx-ink)" }}
          >
            Elutasítom
          </button>
          <button
            type="button"
            onClick={() => choose("granted")}
            className={btn}
            style={{ background: "#fff", border: "1.5px solid var(--twx-ink)", color: "var(--twx-ink)" }}
          >
            Elfogadom
          </button>
        </div>
      </div>
    </div>
  );
}
