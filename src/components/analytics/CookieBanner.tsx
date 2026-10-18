// Süti-sáv — lebegő kártya a bal alsó sarokban, csak a publikus oldalakon.
// Két külön kategória: Statisztika (Google Analytics) és Marketing (Meta / Facebook Pixel).
// Márk döntése (2026-10-17): új látogatónál mindkét kapcsoló ALAPBÓL BEKAPCSOLVA, és egy kiemelt „Elfogadom” gomb ment
// (aki átállít egy kapcsolót, annak a választását); alatta kicsi „Elutasítom” link. Mérés csak a kattintás UTÁN indul.
// (Jogi megjegyzés: az előre bekapcsolt hozzájárulás az EU-gyakorlat szerint vitatható — lásd a tájékoztató-tervezetet.)
// A sáv akkor jön fel, ha valamelyik kategóriáról még nincs döntés; a lábléc „Süti-beállítások” linkjével bármikor újranyitható.
// 2026-10-18: VÉKONY SÁV mobilon és asztalon is (Márk: a nagy kártya sokat kitakart a képből) — egysoros szöveg + kis
// „Elfogadom"; a kapcsolók csak a „Beállítások" alatt (a láblécből nyitva rögtön azokkal) — alapból bekapcsolva, mint eddig.
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
  const [details, setDetails] = useState(false); // a kapcsolók csak kérésre látszanak

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
    const reopen = () => { load(); setDetails(true); setOpen(true); }; // a láblécből nyitva: rögtön a kapcsolókkal
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
      className="fixed bottom-3 left-3 right-3 z-[60] sm:bottom-4 sm:left-4 sm:right-auto sm:w-[340px]"
    >
      <div
        className="rounded-xl px-3.5 py-3"
        style={{
          background: "var(--twx-cream-card)",
          border: "1px solid var(--twx-line)",
          color: "var(--twx-ink)",
          boxShadow: "0 10px 30px rgba(20,14,10,0.25)",
        }}
      >
        <div className="flex items-center gap-3">
          <p className="min-w-0 flex-1 text-[12.5px] leading-snug" style={{ color: "var(--twx-ink-muted)" }}>
            <span aria-hidden>🍪 </span>Sütikkel mérjük, honnan érkezel (Google, Facebook).
          </p>
          <button
            type="button"
            onClick={() => save(analytics, marketing)}
            className="flex-none rounded-full px-4 py-2 text-[13px] font-semibold text-white transition-[filter] hover:brightness-105 focus:outline-none focus-visible:ring-2"
            style={{ background: "linear-gradient(160deg,#F49274,#E9693F)" }}
          >
            Elfogadom
          </button>
        </div>

        {details && (
          <div className="mt-2.5 flex flex-col gap-1.5">
            <Toggle label="Statisztika" hint="Google Analytics — mi működik az oldalon." checked={analytics} onChange={setAnalytics} />
            <Toggle label="Marketing" hint="Meta (Facebook) Pixel — hirdetéseink mérése." checked={marketing} onChange={setMarketing} />
            {decided && (
              <p className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                Jelenleg: statisztika <strong>{saved.analytics === "granted" ? "be" : "ki"}</strong>, marketing{" "}
                <strong>{saved.marketing === "granted" ? "be" : "ki"}</strong> · később a lábléc „Süti-beállítások” linkjén módosíthatod
              </p>
            )}
          </div>
        )}

        <div className="mt-1.5 flex items-center gap-3 text-[11.5px]" style={{ color: "var(--twx-ink-muted)" }}>
          {!details && (
            <button type="button" onClick={() => setDetails(true)}
              className="underline-offset-2 hover:underline focus:outline-none focus-visible:underline">
              Beállítások
            </button>
          )}
          <button type="button" onClick={() => save(false, false)}
            className="underline-offset-2 hover:underline focus:outline-none focus-visible:underline">
            Elutasítom
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label
      className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-1.5 focus-within:ring-2"
      style={{ background: "#fff", border: "1px solid var(--twx-line)" }}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold">{label}</span>
        <span className="block text-[11px] leading-snug" style={{ color: "var(--twx-ink-muted)" }}>{hint}</span>
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
