// OfficeModals — az „Irodai fiók" menü kis felugró ablakai:
//   • open-office-join   → csatlakozás kóddal (sikeres csatlakozás után az iroda oldalára visz)
//   • open-office-picker → „Irodai fiókjaim": egy kattintással kiválasztod, melyik irodával dolgozol
// (A „Mi az irodai fiók?" külön oldal: /dashboard/iroda/bemutato.)
"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import OfficeJoinForm from "@/components/office/OfficeJoinForm";

type Which = "join" | "picker" | null;
type Office = { id: string; name: string; role: "owner" | "member" };

export default function OfficeModals() {
  const [which, setWhich] = useState<Which>(null);
  const [visible, setVisible] = useState(false);

  const close = useCallback(() => {
    setVisible(false);
    window.setTimeout(() => setWhich(null), 180);
  }, []);

  useEffect(() => {
    const onJoin = () => setWhich("join");
    const onPicker = () => setWhich("picker");
    window.addEventListener("open-office-join", onJoin);
    window.addEventListener("open-office-picker", onPicker);
    return () => {
      window.removeEventListener("open-office-join", onJoin);
      window.removeEventListener("open-office-picker", onPicker);
    };
  }, []);

  useEffect(() => {
    if (!which) return;
    const raf = requestAnimationFrame(() => setVisible(true));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", onKey); };
  }, [which, close]);

  if (!which) return null;

  return (
    <div onClick={close} className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200"
      style={{ background: "rgba(12,11,10,0.72)", opacity: visible ? 1 : 0 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
        className="w-full max-w-sm rounded-2xl p-6 transition-all duration-200"
        style={{
          background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)", color: "var(--twx-ink)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)", opacity: visible ? 1 : 0, transform: visible ? "scale(1)" : "scale(0.94)",
        }}>
        {which === "join" ? (
          <Frame title="Csatlakozás kóddal" onClose={close}>
            <p className="mb-4 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
              Írd be a kódot, amit az iroda vezetőjétől kaptál. A csatlakozás azonnali.
            </p>
            <OfficeJoinForm onJoined={() => { window.location.href = "/dashboard/iroda"; }} />
            <a href="/dashboard/iroda/bemutato" onClick={close} className="mt-4 inline-block text-xs font-semibold underline underline-offset-2"
              style={{ color: "var(--twx-coral)" }}>
              Mi az irodai fiók? — részletes ismertető
            </a>
          </Frame>
        ) : (
          <Frame title="Irodai fiókjaim" onClose={close}>
            <OfficePicker onJoin={() => setWhich("join")} />
          </Frame>
        )}
      </div>
    </div>
  );
}

/** Irodaválasztó: egy kattintás = az iroda kiválasztása (irodai módban); a „Belépek" gomb az irodai felületre visz. */
function OfficePicker({ onJoin }: { onJoin: () => void }) {
  const router = useRouter();
  const [offices, setOffices] = useState<Office[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/office")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); setOffices([]); return; }
        setOffices(d.offices ?? []);
        setSelectedId(d.office?.id ?? null);
      })
      .catch(() => { setError("Nem sikerült betölteni az irodáidat."); setOffices([]); });
  }, []);

  async function choose(id: string) {
    if (busy || id === selectedId) return;
    setBusy(id);
    setError(null);
    const res = await fetch("/api/office/mode", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ officeId: id }),
    }).catch(() => null);
    setBusy(null);
    if (res?.ok) { setSelectedId(id); router.refresh(); return; }  // a kredit-sáv is az új irodát mutatja
    setError("Nem sikerült váltani. Próbáld újra.");
  }

  if (!offices) return <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>;

  if (offices.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Még nem vagy tagja irodai fióknak.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="twx-btn" onClick={onJoin}>Csatlakozás kóddal</button>
          <a href="/dashboard/iroda/igenyles" className="twx-btn-outline">Igénylés</a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Válaszd ki, melyik irodai fiókkal dolgozol, majd lépj be.</p>
      <ul className="space-y-2">
        {offices.map((o) => {
          const on = o.id === selectedId;
          return (
            <li key={o.id}>
              <button type="button" onClick={() => choose(o.id)} disabled={!!busy}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors disabled:opacity-60"
                style={{
                  background: on ? "rgba(239,122,90,0.10)" : "#fff",
                  border: on ? "1.5px solid var(--twx-coral)" : "1px solid var(--twx-line)",
                }}>
                <span aria-hidden className="flex h-9 w-9 flex-none items-center justify-center rounded-lg font-display text-sm font-semibold"
                  style={{ background: on ? "var(--twx-coral)" : "var(--twx-line)", color: on ? "#1c1005" : "var(--twx-ink)" }}>
                  {o.name.trim().charAt(0).toUpperCase() || "I"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{o.name}</span>
                  <span className="block text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    {o.role === "owner" ? "Létrehozó (vezető)" : "Tag"}
                  </span>
                </span>
                <span className="flex-none text-xs font-semibold" style={{ color: on ? "var(--twx-coral)" : "var(--twx-ink-muted)" }}>
                  {busy === o.id ? "Váltás…" : on ? "✓ Kiválasztva" : "Kiválaszt"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <a href="/dashboard/iroda" aria-disabled={!selectedId || !!busy}
        className="twx-btn mt-5 flex w-full items-center justify-center gap-2"
        style={!selectedId || busy ? { opacity: 0.5, pointerEvents: "none" } : undefined}>
        Belépek az irodai felületre →
      </a>
    </div>
  );
}

function Frame({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <>
      <div className="mb-3 flex items-start justify-between gap-4">
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Bezárás"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg"
          style={{ background: "var(--twx-line)", color: "var(--twx-ink)" }}>×</button>
      </div>
      {children}
    </>
  );
}
