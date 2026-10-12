// OfficeHub — az „Irodai fiók" oldal: a KIVÁLASZTOTT iroda felülete.
//   • létrehozó / vezető (kiosztó jogú): vezetői nézet (OfficeManagerView)
//   • kolléga (vagy vezető kolléga-előnézetben): kolléga-nézet (OfficeMemberView)
//   • közös munkatér (kind = team): átmeneti nézet (név + állandó kód) — a teljes felület a KM5-ben készül
//   • ha még nem tag: rövid üres állapot — igénylés (külön oldal) vagy csatlakozás kóddal (felugró ablak)
// Ha több irodának tagja, felül irodaváltó.
"use client";

import { useEffect, useState } from "react";
import type { MyOffice } from "@/lib/office";
import ModuleIntro from "@/components/ModuleIntro";
import OfficeMemberView from "@/components/office/OfficeMemberView";
import OfficeManagerView from "@/components/office/OfficeManagerView";

type State = { office: MyOffice | null; offices: { id: string; name: string; role: "owner" | "member" }[]; memberPreview: boolean };

export default function OfficeHub() {
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
        <Intro />
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
            <a href="/dashboard/iroda/bemutato" className="self-center text-sm underline" style={{ color: "var(--twx-ink-muted)" }}>
              Mi az irodai fiók?
            </a>
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
      {state.office.kind === "team" ? (
        <TeamInterim office={state.office} />
      ) : isManager ? (
        <OfficeManagerView key={state.office.id} />
      ) : (
        <OfficeMemberView key={`${state.office.id}-${state.memberPreview}`} />
      )}
    </div>
  );
}

/** Közös munkatér — átmeneti nézet, amíg a társ-felület (KM5) el nem készül: név + állandó kód. */
function TeamInterim({ office }: { office: MyOffice }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!office.joinCode) return;
    try { await navigator.clipboard.writeText(office.joinCode); setCopied(true); } catch { /* a kód kijelölhető kézzel */ }
  }
  return (
    <section className="flex flex-col gap-5 rounded-[20px] p-5 sm:p-7"
      style={{ background: "#121110", backgroundImage: "radial-gradient(ellipse 520px 300px at 88% 0%, rgba(47,127,134,0.32), transparent 70%)", border: "1px solid #2A2420", color: "#F3EDE6" }}>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold tracking-[0.16em]" style={{ color: "#7FC8CE" }}>KÖZÖS MUNKATÉR</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[28px] font-bold leading-[1.1] sm:text-[32px]" style={{ color: "#F6F1EA" }}>{office.name}</h1>
            <span className="rounded-full px-2 py-[3px] text-[11px] font-semibold" style={{ background: "rgba(47,127,134,0.2)", color: "#9ED6DB", border: "1px solid rgba(127,200,206,0.45)" }}>Társ</span>
          </div>
          <p className="text-sm" style={{ color: "#A89E94" }}>Egyenrangú társak, közös mappák. Mindenki a saját kreditjéből dolgozik.</p>
        </div>
        <div className="flex min-w-[260px] flex-col gap-2 rounded-[14px] px-3.5 py-3" style={{ background: "#1B1815", border: "1px solid rgba(127,200,206,0.45)" }}>
          <span className="flex justify-between text-[11px] font-semibold tracking-[0.1em]" style={{ color: "#9ED6DB" }}>
            CSATLAKOZÁSI KÓD <span className="font-medium tracking-normal" style={{ color: "#8F857B" }}>állandó</span>
          </span>
          <span className="select-all font-mono text-lg font-bold tracking-[0.08em]" style={{ color: "#7FC8CE" }}>{office.joinCode ?? "—"}</span>
          <div className="flex items-center justify-between gap-3 pt-2" style={{ borderTop: "1px solid #2E2723" }}>
            <span className="text-[11px]" style={{ color: "#8F857B" }}>Add át a társaidnak ({office.memberCount ?? 1} / 5)</span>
            <button type="button" onClick={copy} className="h-[26px] rounded-full px-2.5 text-[11px] font-semibold" style={{ border: "1px solid #3A322C", color: "#F3EDE6" }}>
              {copied ? "Kimásolva" : "Másolás"}
            </button>
          </div>
        </div>
      </div>
      <p className="flex flex-wrap items-center gap-2 rounded-xl px-3.5 py-3 text-sm" style={{ background: "#1B1815", border: "1px solid #2E2723", color: "#BFB4A8" }}>
        <span className="rounded-full px-2 py-[2px] text-[11px] font-bold" style={{ background: "#2E2723", color: "#E8DED3" }}>Hamarosan</span>
        A munkatér teljes felülete — társak, közös mappák, kredit adása, üzenetek — a következő lépésben készül el.
      </p>
    </section>
  );
}

function Intro() {
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
