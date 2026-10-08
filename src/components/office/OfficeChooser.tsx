// OfficeChooser — irodai fiókjaim listája; „Belépés" kiválasztja az irodát (irodai módban) és az iroda oldalára visz.
"use client";

import { useState } from "react";

type Office = { id: string; name: string; role: "owner" | "member" };

export default function OfficeChooser({ offices, selectedId }: { offices: Office[]; selectedId: string | null }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function enter(id: string) {
    setBusy(id);
    setError(null);
    const res = await fetch("/api/office/mode", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ officeId: id }),
    }).catch(() => null);
    if (res?.ok) { window.location.href = "/dashboard/iroda"; return; }
    setBusy(null);
    setError("Nem sikerült belépni. Próbáld újra.");
  }

  if (offices.length === 0) {
    return (
      <section className="twx-card space-y-4 p-6">
        <h2 className="font-display text-xl font-semibold">Még nem vagy tagja irodai fióknak</h2>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="twx-btn" onClick={() => window.dispatchEvent(new CustomEvent("open-office-join"))}>
            Csatlakozás kóddal
          </button>
          <a href="/dashboard/iroda/igenyles" className="twx-btn-outline">Irodai fiók igénylése</a>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {offices.map((o) => {
        const on = o.id === selectedId;
        return (
          <div key={o.id} className="twx-card flex items-center gap-4 p-5"
            style={on ? { outline: "2px solid var(--twx-coral)", outlineOffset: -2 } : undefined}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-lg font-semibold">{o.name}</p>
              <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                {o.role === "owner" ? "Létrehozó (vezető)" : "Tag"}{on ? " · jelenleg kiválasztva" : ""}
              </p>
            </div>
            {on ? (
              <a href="/dashboard/iroda" className="twx-btn-outline">Megnyitás</a>
            ) : (
              <button type="button" className="twx-btn" disabled={!!busy} onClick={() => enter(o.id)}>
                {busy === o.id ? "Belépés…" : "Belépés"}
              </button>
            )}
          </div>
        );
      })}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="pt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Másik irodához csatlakoznál?{" "}
        <button type="button" className="underline" onClick={() => window.dispatchEvent(new CustomEvent("open-office-join"))}>
          Csatlakozás kóddal
        </button>
      </p>
    </section>
  );
}
