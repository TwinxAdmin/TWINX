// Süti-sáv — lebegő kártya a bal alsó sarokban, csak a publikus oldalakon.
// Két külön kategória (2026-10-17): Statisztika (Google Analytics) és Marketing (Meta / Facebook Pixel), mindkettő alapból KI.
// Három EGYENRANGÚ gomb (Elutasítom / Kiválasztottak / Mindet elfogadom): azonos méret és stílus, hogy az elutasítás ne legyen
// nehezebb az elfogadásnál. A sáv akkor jön fel, ha valamelyik kategóriáról még nincs döntés (a korábban csak statisztikáról
// döntőknek egyszer újra, a marketing miatt). A lábléc „Süti-beállítások” linkjével (openConsentSettings) bármikor újranyitható.
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isTrackedPath } from "@/lib/analytics";
import { getConsentState, setConsentState, OPEN_CONSENT_EVENT, type ConsentState } from "@/lib/consent";

export default function CookieBanner() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<ConsentState>({ analytics: null, marketing: null });
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  // Első betöltéskor: ha valamelyik kategóriáról még nem döntött, feljön a kártya.
  useEffect(() => {
    const load = () => {
      const s = getConsentState();
      setSaved(s);
      setAnalytics(s.analytics === "granted");
      setMarketing(s.marketing === "granted");
      return s;
    };
    const s = load();
    if (s.analytics === null || s.marketing === null) setOpen(true);
    const reopen = () => { load(); setOpen(true); };
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  if (!open || !isTrackedPath(pathname)) return null;

  function save(a: boolean, m: boolean) {
    setConsentState({ analytics: a ? "granted" : "denied", marketing: m ? "granted" : "denied" });
    setOpen(false);
  }

  const btn =
    "flex-1 rounded-full px-2 py-2.5 text-[13px] font-semibold transition-colors focus:outline-none focus-visible:ring-2";
  const btnStyle = { background: "#fff", border: "1.5px solid var(--twx-ink)", color: "var(--twx-ink)" };
  const decided = saved.analytics !== null && saved.marketing !== null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Süti-beállítások"
      className="fixed bottom-4 left-4 right-4 z-[60] sm:right-auto sm:w-[380px]"
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
          Csak a hozzájárulásoddal használunk sütit. Bármelyiket külön is választhatod, és később a lábléc
          „Süti-beállítások” linkjén módosíthatod.
        </p>

        <div className="mt-3 flex flex-col gap-2">
          <Toggle
            label="Statisztika"
            hint="Google Analytics — mérjük, mi működik az oldalon."
            checked={analytics}
            onChange={setAnalytics}
          />
          <Toggle
            label="Marketing"
            hint="Meta (Facebook) Pixel — hirdetéseink eredményének mérése."
            checked={marketing}
            onChange={setMarketing}
          />
        </div>

        {decided && (
          <p className="mt-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            Jelenleg: statisztika <strong>{saved.analytics === "granted" ? "be" : "ki"}</strong>, marketing{" "}
            <strong>{saved.marketing === "granted" ? "be" : "ki"}</strong>
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => save(false, false)} className={btn} style={btnStyle}>
            Elutasítom
          </button>
          <button type="button" onClick={() => save(analytics, marketing)} className={btn} style={btnStyle}>
            Kiválasztottak
          </button>
          <button type="button" onClick={() => save(true, true)} className={btn} style={btnStyle}>
            Mindet elfogadom
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label
      className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 focus-within:ring-2"
      style={{ background: "#fff", border: "1px solid var(--twx-line)" }}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs leading-snug" style={{ color: "var(--twx-ink-muted)" }}>{hint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden
        className="relative h-6 w-11 flex-none rounded-full transition-colors"
        style={{ background: checked ? "var(--twx-coral)" : "var(--twx-line)" }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
          style={{ left: checked ? 22 : 2 }}
        />
      </span>
    </label>
  );
}
