// Süti-sáv — lebegő kártya a bal alsó sarokban, csak a publikus oldalakon.
// Két külön kategória: Statisztika (Google Analytics) és Marketing (Meta / Facebook Pixel).
// Márk döntése (2026-10-17): új látogatónál mindkét kapcsoló ALAPBÓL BEKAPCSOLVA, és egy kiemelt „Elfogadom” gomb ment
// (aki átállít egy kapcsolót, annak a választását); alatta kicsi „Elutasítom” link. Mérés csak a kattintás UTÁN indul.
// (Jogi megjegyzés: az előre bekapcsolt hozzájárulás az EU-gyakorlat szerint vitatható — lásd a tájékoztató-tervezetet.)
// A sáv akkor jön fel, ha valamelyik kategóriáról még nincs döntés; a lábléc „Süti-beállítások” linkjével bármikor újranyitható.
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
      // még nem döntött kategória: alapból bekapcsolva; korábbi döntésnél azt mutatjuk
      setAnalytics(s.analytics !== "denied");
      setMarketing(s.marketing !== "denied");
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
          Sütikkel mérjük, honnan érkezel (Google, Facebook), hogy jobb hirdetéseket és szolgáltatást adhassunk.
          Később a lábléc „Süti-beállítások” linkjén módosíthatod.
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

        <button
          type="button"
          onClick={() => save(analytics, marketing)}
          className="mt-4 w-full rounded-full px-4 py-3 text-sm font-semibold text-white transition-[filter] hover:brightness-105 focus:outline-none focus-visible:ring-2"
          style={{ background: "linear-gradient(160deg,#F49274,#E9693F)", boxShadow: "0 10px 24px rgba(233,105,63,0.35)" }}
        >
          Elfogadom
        </button>
        <button
          type="button"
          onClick={() => save(false, false)}
          className="mx-auto mt-2 block text-xs underline-offset-2 hover:underline focus:outline-none focus-visible:underline"
          style={{ color: "var(--twx-ink-muted)" }}
        >
          Elutasítom
        </button>
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
