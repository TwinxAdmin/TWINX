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

  // A jobb oldali kerek gomb: privátban feltöltés (csomagválasztó), irodai módban az Irodai fiók
  // oldal (kredit kérése / keret). Mindig látszik, így nincs üres hely és a sáv szélessége sem változik.
  const action = isOffice
    ? { label: "Kredit kérése / irodai fiók", onClick: () => { window.location.href = "/dashboard/iroda"; } }
    : { label: "Kredit feltöltése", onClick: () => window.dispatchEvent(new CustomEvent("open-pricing")) };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4">
      <div className="pointer-events-auto flex h-12 items-center gap-1.5 rounded-full py-1 pl-1.5 pr-1.5 shadow-xl"
        style={{
          background: "linear-gradient(180deg, #24201c 0%, #171412 100%)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 12px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}>
        {office && mode && (
          <div className="relative flex h-9 w-[144px] shrink-0 items-center rounded-full p-1" style={{ background: "rgba(255,255,255,0.07)" }}
            title="Melyik kreditből dolgozol: a saját egyenlegedből vagy az irodai keretedből.">
            {/* csúszó kiemelés */}
            <span aria-hidden className="absolute top-1 h-7 w-[66px] rounded-full transition-all duration-300"
              style={{ left: mode === "private" ? 4 : 74, background: "var(--twx-coral)" }} />
            {(["private", "office"] as WorkMode[]).map((m) => {
              const on = mode === m;
              return (
                <button key={m} type="button" onClick={() => changeMode(m)} disabled={busy} aria-pressed={on}
                  className="relative z-10 h-7 w-[66px] rounded-full text-xs font-semibold transition-colors disabled:opacity-60"
                  style={{ color: on ? "#1c1005" : "rgba(255,255,255,0.72)" }}>
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
            className="h-9 w-[140px] shrink-0 truncate rounded-full px-3 text-xs font-medium outline-none"
            style={{ background: "rgba(255,255,255,0.07)", color: "#fff", border: "none" }}>
            {office!.offices.map((o) => (
              <option key={o.id} value={o.id} style={{ color: "#1c1815" }}>{o.name}</option>
            ))}
          </select>
        )}

        {/* Egyenleg — fix szélesség, érme-ikonnal */}
        <div className="flex w-[124px] shrink-0 items-center gap-2 pl-2">
          <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
            style={{ background: isOffice ? "rgba(239,122,90,0.22)" : "rgba(255,255,255,0.10)", color: isOffice ? "var(--twx-coral)" : "#fff" }}>
            {isOffice ? "▣" : "◎"}
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[10px]" style={{ color: "rgba(255,255,255,0.55)" }}>
              {isOffice ? "Irodai keret" : "Egyenleg"}
            </span>
            <span className="truncate font-display text-sm font-semibold tabular-nums">{amount}</span>
          </span>
        </div>

        <button type="button" onClick={action.onClick} title={action.label} aria-label={action.label}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-semibold transition-transform hover:scale-105"
          style={{ background: "rgba(255,255,255,0.10)", color: "#fff" }}>
          +
        </button>
      </div>
    </div>
  );
}
