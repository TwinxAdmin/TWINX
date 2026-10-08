// OfficeHub — az „Irodai fiók" oldal: a KIVÁLASZTOTT iroda kezelőfelülete.
//   • ha több irodának tagja: váltó felül (és az „Irodai fiókjaim" oldalon is lehet választani)
//   • ha még nem tag: rövid üres állapot — igénylés (külön oldal) vagy csatlakozás kóddal (felugró ablak)
// A magyarázó, az igénylés és a csatlakozás a fejléc „Irodai fiók" legördülő menüjéből is elérhető.
"use client";

import { useEffect, useState } from "react";
import type { MyOffice } from "@/lib/office";
import OfficePanel from "@/components/office/OfficePanel";

type State = { office: MyOffice | null; offices: { id: string; name: string; role: "owner" | "member" }[] };

export default function OfficeHub() {
  const [state, setState] = useState<State | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    fetch("/api/office")
      .then((r) => r.json())
      .then((d) => (d.error ? setLoadError(d.error) : setState({ office: d.office ?? null, offices: d.offices ?? [] })))
      .catch(() => setLoadError("Nem sikerült betölteni az állapotot."));
  }, []);

  async function switchOffice(id: string) {
    setSwitching(true);
    const res = await fetch("/api/office/mode", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ officeId: id }),
    }).catch(() => null);
    if (res?.ok) window.location.reload();
    else setSwitching(false);
  }

  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (!state) return <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>;

  if (!state.office) {
    return (
      <section className="twx-card space-y-4 p-6">
        <h2 className="font-display text-xl font-semibold">Még nem vagy tagja irodai fióknak</h2>
        <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          Ha kódot kaptál egy kollégától, csatlakozz vele. Ha te szeretnél irodai fiókot nyitni, igényeld.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="twx-btn" onClick={() => window.dispatchEvent(new CustomEvent("open-office-join"))}>
            Csatlakozás kóddal
          </button>
          <a href="/dashboard/iroda/igenyles" className="twx-btn-outline">Irodai fiók igénylése</a>
          <a href="/dashboard/iroda/bemutato" className="self-center text-sm underline" style={{ color: "var(--twx-ink-muted)" }}>
            Mi az irodai fiók?
          </a>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {state.offices.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Irodáid:</span>
          {state.offices.map((o) => {
            const on = o.id === state.office!.id;
            return (
              <button key={o.id} type="button" disabled={switching || on} onClick={() => switchOffice(o.id)}
                className="max-w-[220px] truncate rounded-full px-4 py-1.5 text-sm font-medium"
                style={on ? { background: "var(--twx-ink)", color: "var(--twx-cream)" } : { border: "1px solid var(--twx-line)" }}>
                {o.name}{o.role === "owner" ? " ★" : ""}
              </button>
            );
          })}
        </div>
      )}
      <OfficePanel key={state.office.id} office={state.office} />
    </div>
  );
}
