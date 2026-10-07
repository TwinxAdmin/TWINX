// WorkModeSwitch — fejléc-kapcsoló irodai tagoknak: „Privát | Irodai".
// Mindig látszik, melyik kreditből dolgozik a felhasználó (irodai keret / saját egyenleg).
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkMode } from "@/lib/office";

type Props = {
  initialMode: WorkMode;
  officeLabel: string;   // pl. „12 kredit" vagy „Korlátlan" (a tag kerete)
  privateBalance: number;
  compact?: boolean;     // mobil fejléchez
};

export default function WorkModeSwitch({ initialMode, officeLabel, privateBalance, compact }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<WorkMode>(initialMode);
  const [busy, setBusy] = useState(false);

  async function change(next: WorkMode) {
    if (next === mode || busy) return;
    setBusy(true);
    const prev = mode;
    setMode(next);
    try {
      const res = await fetch("/api/office/mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
      if (!res.ok) { setMode(prev); return; }
      router.refresh();
    } catch {
      setMode(prev);
    } finally {
      setBusy(false);
    }
  }

  const opt = (m: WorkMode, label: string) => {
    const on = mode === m;
    return (
      <button type="button" onClick={() => change(m)} aria-pressed={on} disabled={busy}
        className={`rounded-full font-medium transition-colors ${compact ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs"}`}
        style={on ? { background: "var(--twx-coral)", color: "#1c1005" } : { color: "var(--twx-on-dark-muted)" }}>
        {label}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-2" title="Melyik kreditből dolgozol: az irodai keretedből vagy a saját egyenlegedből.">
      <div className="flex items-center rounded-full p-0.5" style={{ border: "1px solid rgba(255,255,255,0.18)" }}>
        {opt("private", "Privát")}
        {opt("office", "Irodai")}
      </div>
      {!compact && (
        <span className="whitespace-nowrap text-xs" style={{ color: "var(--twx-on-dark-muted)" }}>
          {mode === "office" ? `Irodai keret: ${officeLabel}` : `Saját: ${privateBalance} kredit`}
        </span>
      )}
    </div>
  );
}
