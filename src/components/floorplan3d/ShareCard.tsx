// ShareCard — megosztható bejárás-link (4. lépés, F4b). Fix magasságú kártya a 3D-modell alatt:
//   nincs link → üres állapot + „Link létrehozása" (ingyenes: a 3D díja a jóváhagyáskor már levonva);
//   van link   → a link + Másolás, lejárat, megnyitások; Meghosszabbítás (+linkDays, creditsExtend kredit) és Visszavonás (megerősítéssel).
"use client";

import { useEffect, useState } from "react";
import { showToast } from "@/components/Toast";

const MUTED = "var(--twx-ink-muted)";

type Share = { token: string; expiresAt: string; createdAt: string; views: number; lastViewedAt: string | null; extendCount: number; expired: boolean };

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric" });
function daysLeft(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export default function ShareCard({ projectId, linkDays, creditsExtend }: { projectId: string | null; linkDays: number; creditsExtend: number }) {
  const [share, setShare] = useState<Share | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<null | "create" | "extend" | "revoke">(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    fetch(`/api/real-estate/floorplan-3d/projects/${projectId}/share`)
      .then(async (r) => { const d = await r.json().catch(() => ({})); if (!alive) return; if (!r.ok) setError(d.error ?? "A link állapota nem tölthető be."); else setShare(d.share ?? null); })
      .catch(() => alive && setError("Hálózati hiba."))
      .finally(() => alive && setLoaded(true));
    return () => { alive = false; };
  }, [projectId]);

  async function act(action: "create" | "extend" | "revoke") {
    if (!projectId) return;
    setBusy(action); setError(null);
    try {
      const res = await fetch(`/api/real-estate/floorplan-3d/projects/${projectId}/share`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "A művelet nem sikerült."); return; }
      setShare(d.share ?? null);
      if (action === "extend") showToast(`A link ${linkDays} nappal meghosszabbítva.`, "success");
      if (action === "revoke") showToast("A link visszavonva — már nem nyitható meg.", "info");
    } catch {
      setError("Hálózati hiba. Próbáld újra.");
    } finally {
      setBusy(null); setConfirmRevoke(false);
    }
  }

  const url = share && typeof window !== "undefined" ? `${window.location.origin}/3d/${share.token}` : "";
  async function copy() {
    try { await navigator.clipboard.writeText(url); showToast("Link a vágólapon.", "success"); }
    catch { setError("A másolás nem sikerült — jelöld ki és másold kézzel."); }
  }

  const left = share ? daysLeft(share.expiresAt) : 0;
  const needsMigration = !!error && /migráció/.test(error);
  const btn = "h-9 flex-none rounded-full text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <div className="twx-card flex h-[176px] flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Megosztható link</p>
          <p className="text-xs" style={{ color: MUTED }}>
            Az ügyfél belépés nélkül, telefonon is bejárhatja a lakást. A link {linkDays} napig él, utána meghosszabbítható.
          </p>
        </div>
        {loaded && !share && (
          <button type="button" onClick={() => void act("create")} disabled={!!busy || !projectId || needsMigration}
            title={needsMigration ? "Előbb le kell futtatni az adatbázis-migrációt" : "Ingyenes — a 3D díját a jóváhagyáskor már levontuk"} className={`${btn} w-[170px]`} style={{ background: "var(--twx-coral)", color: "#fff" }}>
            {busy === "create" ? "Létrehozás…" : "Link létrehozása"}
          </button>
        )}
      </div>

      {error && <p className="truncate rounded-lg px-3 py-1.5 text-[12px]" style={{ background: "#FDECEA", color: "#9B2C1B" }} title={error}>{error}</p>}

      {!loaded ? (
        <p className="text-[12.5px]" style={{ color: MUTED }}>Betöltés…</p>
      ) : !share ? (
        !error && (
          <div className="flex flex-1 items-center rounded-xl px-4 text-[12.5px]" style={{ background: "#F4F0EA", border: "1px dashed var(--twx-line)", color: MUTED }}>
            Még nincs link. Létrehozás után itt jelenik meg, egy kattintással másolható, és látod, hányszor nyitották meg.
          </div>
        )
      ) : (
        <>
          <div className="flex items-center gap-2">
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="A megosztható link"
              className="twx-input h-9 min-w-0 flex-1 truncate rounded-full px-4 text-[12.5px]" style={share.expired ? { textDecoration: "line-through", color: MUTED } : undefined} />
            <button type="button" onClick={() => void copy()} disabled={share.expired} title={share.expired ? "A link lejárt — előbb hosszabbítsd meg" : "Link másolása"}
              className={`${btn} w-[96px]`} style={{ background: "#12100e", color: "#fff" }}>Másolás</button>
          </div>
          <div className="flex items-center gap-2 text-[12px]" style={{ color: MUTED }}>
            <span className="min-w-0 flex-1 truncate">
              {share.expired
                ? <b style={{ color: "#C2522D" }}>Lejárt: {fmtDate(share.expiresAt)}</b>
                : <>Lejár: <b style={{ color: left <= 3 ? "#9A7020" : "var(--twx-ink)" }}>{fmtDate(share.expiresAt)}</b> ({left} nap múlva)</>}
              {" · "}{share.views} megnyitás{share.lastViewedAt ? ` · utoljára ${fmtDate(share.lastViewedAt)}` : ""}
            </span>
            <button type="button" onClick={() => void act("extend")} disabled={!!busy}
              title={creditsExtend > 0 ? `+${linkDays} nap, ${creditsExtend} kredit` : `+${linkDays} nap, ingyenes`}
              className={`${btn} w-[190px]`} style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
              {busy === "extend" ? "Hosszabbítás…" : `+${linkDays} nap (${creditsExtend > 0 ? `${creditsExtend} kredit` : "ingyenes"})`}
            </button>
            <button type="button" onClick={() => (confirmRevoke ? void act("revoke") : setConfirmRevoke(true))} onBlur={() => setConfirmRevoke(false)} disabled={!!busy}
              title="A link azonnal megszűnik; utána újat hozhatsz létre" className={`${btn} w-[120px]`}
              style={confirmRevoke ? { background: "#C2522D", color: "#fff" } : { border: "1px solid var(--twx-line)", background: "#fff" }}>
              {busy === "revoke" ? "Visszavonás…" : confirmRevoke ? "Biztosan?" : "Visszavonás"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
