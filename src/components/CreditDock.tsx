// CreditDock — lebegő kredit-sáv a képernyő alján, középen (minden dashboard oldalon).
//   • Alap: a kredit-egyenleg + „Feltöltés" (megnyitja a csomagválasztót).
//   • Irodai tagnak: „Privát | Irodai" váltó; ha több irodának tagja, irodaválasztó is.
//     Mindig a kiválasztott forrás egyenlege látszik (irodai módban a tag kerete).
// FIX MÉRETŰ: minden rész rögzített szélességű (a hosszabb szöveg levágódik „…"-al),
// így váltáskor a sáv nem szélesedik és nem ugrál.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkMode } from "@/lib/office";

type OfficeState = {
  mode: WorkMode;
  label: string;                         // a tag kerete a kiválasztott irodában („12 kredit" / „Korlátlan")
  officeId: string;
  offices: { id: string; name: string }[];
};

type Props = {
  balance: number;              // saját egyenleg
  unlimited?: boolean;          // admin: korlátlan
  office?: OfficeState | null;
};

export default function CreditDock({ balance, unlimited = false, office = null }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<WorkMode | null>(office?.mode ?? null);
  const [officeId, setOfficeId] = useState<string | null>(office?.officeId ?? null);
  const [busy, setBusy] = useState(false);

  async function save(patch: { mode?: WorkMode; officeId?: string }, rollback: () => void) {
    setBusy(true);
    try {
      const res = await fetch("/api/office/mode", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      if (!res.ok) { rollback(); return; }
      router.refresh();
    } catch {
      rollback();
    } finally {
      setBusy(false);
    }
  }

  function changeMode(next: WorkMode) {
    if (!mode || next === mode || busy) return;
    const prev = mode;
    setMode(next);
    void save({ mode: next }, () => setMode(prev));
  }

  function changeOffice(id: string) {
    if (!id || id === officeId || busy) return;
    const prevId = officeId, prevMode = mode;
    setOfficeId(id);
    setMode("office");
    void save({ officeId: id }, () => { setOfficeId(prevId); setMode(prevMode); });
  }

  const isOffice = !!office && mode === "office";
  const amount = unlimited && !isOffice ? "Korlátlan" : isOffice ? office!.label : `${balance} kredit`;
  const multi = !!office && office.offices.length > 1;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4">
      <div className="pointer-events-auto flex h-11 items-center gap-2 overflow-hidden rounded-2xl px-2 shadow-lg"
        style={{ background: "var(--twx-dark)", color: "#fff", border: "1px solid rgba(255,255,255,0.12)" }}>
        {office && mode && (
          <div className="flex w-[148px] shrink-0 items-center rounded-xl p-0.5" style={{ background: "rgba(255,255,255,0.08)" }}
            title="Melyik kreditből dolgozol: a saját egyenlegedből vagy az irodai keretedből.">
            {(["private", "office"] as WorkMode[]).map((m) => {
              const on = mode === m;
              return (
                <button key={m} type="button" onClick={() => changeMode(m)} disabled={busy} aria-pressed={on}
                  className="w-1/2 rounded-lg py-1 text-xs font-semibold transition-colors disabled:opacity-60"
                  style={on ? { background: "var(--twx-coral)", color: "#1c1005" } : { color: "rgba(255,255,255,0.75)" }}>
                  {m === "private" ? "Privát" : "Irodai"}
                </button>
              );
            })}
          </div>
        )}

        {/* Irodaválasztó — csak ha több irodának tagja; fix szélesség, a hosszú név levágódik. */}
        {multi && (
          <select value={officeId ?? ""} onChange={(e) => changeOffice(e.target.value)} disabled={busy}
            aria-label="Iroda kiválasztása"
            className="w-[150px] shrink-0 truncate rounded-xl px-2 py-1 text-xs font-medium outline-none"
            style={{ background: "rgba(255,255,255,0.08)", color: "#fff", border: "none" }}>
            {office!.offices.map((o) => (
              <option key={o.id} value={o.id} style={{ color: "#1c1815" }}>{o.name}</option>
            ))}
          </select>
        )}

        {/* Egyenleg — fix szélességű oszlop: a felirat és az összeg sosem tolja szét a sávot. */}
        <div className="flex w-[150px] shrink-0 flex-col justify-center px-1 leading-tight">
          <span className="truncate text-[10px]" style={{ color: "rgba(255,255,255,0.6)" }}>
            {isOffice ? "Irodai keret" : "Egyenleg"}
          </span>
          <span className="truncate font-display text-sm font-semibold tabular-nums">{amount}</span>
        </div>

        {/* Feltöltés gomb helye mindig foglalt (irodai módban láthatatlan), hogy ne változzon a szélesség. */}
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("open-pricing"))}
          className="w-[92px] shrink-0 rounded-xl py-1 text-xs font-semibold"
          style={{ background: "rgba(255,255,255,0.12)", visibility: !unlimited && !isOffice ? "visible" : "hidden" }}
          tabIndex={!unlimited && !isOffice ? 0 : -1} aria-hidden={unlimited || isOffice}>
          + Feltöltés
        </button>
      </div>
    </div>
  );
}
