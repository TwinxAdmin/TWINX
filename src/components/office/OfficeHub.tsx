// OfficeHub — az „Irodai fiók" oldal: a KIVÁLASZTOTT iroda felülete.
//   • létrehozó / vezető (kiosztó jogú): vezetői nézet (OfficeManagerView)
//   • kolléga (vagy vezető kolléga-előnézetben): kolléga-nézet (OfficeMemberView)
//   • közös munkatér (kind = team): társ nézet (OfficeTeamView) — mindenki egyenrangú
//   • ha még nem tag: rövid üres állapot — igénylés (külön oldal) vagy csatlakozás kóddal (felugró ablak)
// Ha több irodának tagja, felül irodaváltó.
// ÚJ FELÜLET (3d-3): kredit nélküli közös tér (OfficeSpaceView) minden irodaformára; alatta (és az üres állapotban)
// az „Így működik" animáció (OfficeShareScene, 2026-11-24).
"use client";

import { useEffect, useState } from "react";
import type { MyOffice } from "@/lib/office";
import ModuleIntro from "@/components/ModuleIntro";
import OfficeMemberView from "@/components/office/OfficeMemberView";
import OfficeManagerView from "@/components/office/OfficeManagerView";
import OfficeTeamView from "@/components/office/OfficeTeamView";
import OfficeSpaceView from "@/components/office/OfficeSpaceView";
import { useUiMode } from "@/components/UiModeProvider";
import OfficeShareScene from "@/components/office/OfficeShareScene";

type State = { office: MyOffice | null; offices: { id: string; name: string; role: "owner" | "member" }[]; memberPreview: boolean };

export default function OfficeHub() {
  const { newUi } = useUiMode();
  const [state, setState] = useState<State | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    fetch("/api/office")
      .then((r) => r.json())
      .then((d) => (d.error ? setLoadError(d.error) : setState({ office: d.office ?? null, offices: d.offices ?? [], memberPreview: !!d.memberPreview })))
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
      <>
        <Intro newUi={newUi} />
        {/* Új felület: rövid animáció a közös tér működéséről (általános, iparág-független szöveggel). */}
        {newUi && <div className="my-6"><OfficeShareScene /></div>}
        <section className="twx-card space-y-4 p-6">
          <h2 className="font-display text-xl font-semibold">Még nem vagy tagja irodai fióknak</h2>
          <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            Ha kódot kaptál egy kollégától, csatlakozz vele. Ha te nyitnál: vezetős irodát igényelhetsz, közös munkateret pedig azonnal létrehozhatsz.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="twx-btn" onClick={() => window.dispatchEvent(new CustomEvent("open-office-join"))}>
              Csatlakozás kóddal
            </button>
            <a href="/dashboard/iroda/igenyles" className="twx-btn-outline">Iroda / közös munkatér létrehozása</a>
            {!newUi && (
              <a href="/dashboard/iroda/bemutato" className="self-center text-sm underline" style={{ color: "var(--twx-ink-muted)" }}>
                Mi az irodai fiók?
              </a>
            )}
          </div>
        </section>
      </>
    );
  }

  const isManager = (state.office.role === "owner" || state.office.canAllocate) && !state.memberPreview;

  return (
    <div className="space-y-4">
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
      {newUi ? (
        <>
          <OfficeSpaceView key={state.office.id} office={state.office} />
          {/* a közös tér működése röviden — a tagoknak is (a felület alján, nem tolja le a munkát) */}
          <OfficeShareScene />
        </>
      ) : state.office.kind === "team" ? (
        <OfficeTeamView key={state.office.id} />
      ) : isManager ? (
        <OfficeManagerView key={state.office.id} />
      ) : (
        <OfficeMemberView key={`${state.office.id}-${state.memberPreview}`} />
      )}
    </div>
  );
}

function Intro({ newUi }: { newUi: boolean }) {
  // Új felület (D35): az irodai fiók opcionális közös tér, nem közös kreditkeret.
  if (newUi) {
    return (
      <ModuleIntro
        eyebrow="Irodai fiók"
        title="Közös tér, ha együtt dolgoztok"
        subtitle="Hozz létre irodai fiókot, és hívd meg a kollégáidat egy közös térbe: közös mappák, üzenetek, megosztott munkák. A modulokhoz a hozzáférés a saját fiókodhoz tartozik."
        icon="office"
        chips={["Közös mappák", "Üzenetek", "Megosztott munkák", "Csatlakozás kóddal"]}
      />
    );
  }
  return (
    <ModuleIntro
      eyebrow="Irodai TWINX fiók"
      title="Egy iroda, egy közös kreditkeret"
      subtitle="A vezető egyszer vásárol, a kollégák pedig az irodai keretből dolgoznak — nem kell mindenkinek külön kreditet vennie. A saját kreditjeid közben megmaradnak."
      icon="office"
      chips={["Közös irodai egyenleg", "Keret kollégánként", "Csatlakozás kóddal", "Tudatos megosztás"]}
    />
  );
}
