// A próba modul „költséges" próbaművelete (10 Ft a havi keretből) — a plafon kipróbálására (terv 20).
"use client";

import { useState } from "react";

export default function RunButton() {
  const [state, setState] = useState<{ busy: boolean; msg: string; err: boolean }>({ busy: false, msg: "", err: false });
  async function run() {
    setState({ busy: true, msg: "", err: false });
    const r = await fetch("/api/modules/proba-modul/run", { method: "POST" });
    const d = await r.json().catch(() => ({}));
    setState({ busy: false, msg: r.ok ? "Próbaművelet kész." : d.error ?? "Nem sikerült.", err: !r.ok });
  }
  return (
    <div className="mt-2 flex min-h-[72px] flex-col items-center gap-2">
      <button type="button" className="twx-btn" disabled={state.busy} onClick={run}>{state.busy ? "Fut…" : "Próbaművelet indítása"}</button>
      <p className="h-4 text-xs" style={{ color: state.err ? "#b5372f" : "var(--twx-ink-muted)" }}>{state.msg}</p>
    </div>
  );
}
