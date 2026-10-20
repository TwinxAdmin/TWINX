// Admin → Prémium 3D: állapotkapcsoló (Rejtett / Hamarosan / Elérhető — előkészítve) + várólista. Azonnal érvényes.
"use client";

import { useEffect, useState } from "react";
import { showToast } from "@/components/Toast";

type Status = "hidden" | "coming_soon" | "available";
type Row = { userId: string; name: string | null; email: string | null; createdAt: string };
type Info = { status: Status; migrated: boolean; updatedAt: string | null; waitlist: Row[] };

const OPTIONS: { id: Status; title: string; text: string; ready: boolean }[] = [
  { id: "hidden", title: "Rejtett", text: "A menüpont csak neked (adminnak) látszik.", ready: true },
  { id: "coming_soon", title: "Hamarosan", text: "Mindenki látja „Hamarosan” jelvénnyel; megnyitva a bemutató + „Értesíts, ha elérhető”. Generálás nem indítható.", ready: true },
  { id: "available", title: "Elérhető", text: "Előkészítve — élesre külön feladat köti be, amikor a modul kész.", ready: false },
];
const card = { background: "#fff", border: "1px solid var(--twx-line)" };
const when = (iso: string) => new Date(iso).toLocaleString("hu-HU", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function Premium3dAdmin() {
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/premium3d", { cache: "no-store" })
      .then((r) => r.json().then((d) => (r.ok ? setInfo(d as Info) : setError(d.error))))
      .catch(() => setError("Az állapot nem olvasható."));
  }, []);

  async function choose(id: Status) {
    if (!info || info.status === id || busy) return;
    setBusy(id); setError(null);
    try {
      const r = await fetch("/api/admin/premium3d", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: id }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Az átkapcsolás nem sikerült.");
      setInfo(d as Info);
      showToast(`Prémium 3D: ${OPTIONS.find((o) => o.id === id)?.title}`, "success");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-2xl p-5" style={card}>
        <div>
          <h2 className="text-base font-semibold">A modul állapota a felhasználóknál</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            Azonnal érvényes. Te adminként minden állapotban a teljes modult látod (3D-labor). A felhasználói nézetet a jobb alsó „Nézet: Felhasználó” kapcsolóval nézheted meg.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {OPTIONS.map((o) => {
            const active = info?.status === o.id;
            const disabled = !info || !info.migrated || !o.ready || busy !== null;
            return (
              <button key={o.id} type="button" onClick={() => void choose(o.id)} disabled={disabled && !active} aria-pressed={active}
                title={!o.ready ? "Külön feladat — amikor a modul kész" : undefined}
                className="flex min-h-[112px] flex-col rounded-xl p-4 text-left transition disabled:cursor-not-allowed"
                style={{
                  border: `2px solid ${active ? "#b7791f" : "var(--twx-line)"}`,
                  background: active ? "#fdf3e2" : "#fff", opacity: !o.ready ? 0.5 : 1,
                }}>
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span aria-hidden className="flex h-4 w-4 items-center justify-center rounded-full" style={{ border: `2px solid ${active ? "#b7791f" : "var(--twx-line)"}` }}>
                    {active && <span className="h-2 w-2 rounded-full" style={{ background: "#b7791f" }} />}
                  </span>
                  {o.title}
                  {!o.ready && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "var(--twx-line)" }}>Előkészítve</span>}
                  {busy === o.id && <span className="text-[11px] font-normal" style={{ color: "var(--twx-ink-muted)" }}>Mentés…</span>}
                </span>
                <span className="mt-1.5 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{o.text}</span>
              </button>
            );
          })}
        </div>
        {info && !info.migrated && (
          <p className="rounded-lg px-3 py-2 text-xs" style={{ background: "#fdf3e2", color: "#8a5a12" }}>
            Futtasd le a <code>20261020150000_premium3d-coming-soon.sql</code>-t a Supabase SQL Editorban — addig a menüpont rejtett.
          </p>
        )}
        {info?.updatedAt && <p className="text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>Utoljára módosítva: {when(info.updatedAt)}</p>}
      </section>

      <section className="rounded-2xl p-5" style={card}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">„Értesíts, ha elérhető” — feliratkozók</h2>
          <span className="text-2xl font-extrabold tabular-nums">{info?.waitlist.length ?? "…"}</span>
        </div>
        <div className="mt-3 max-h-[420px] overflow-y-auto rounded-xl" style={{ border: "1px solid var(--twx-line)" }}>
          {!info ? (
            <p className="p-4 text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>
          ) : info.waitlist.length === 0 ? (
            <p className="p-6 text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>Még senki nem iratkozott fel. Amint valaki megnyomja az „Értesíts, ha elérhető” gombot, itt megjelenik.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wide" style={{ color: "var(--twx-ink-muted)" }}>
                <th className="px-4 py-2">Név</th><th className="px-4 py-2">E-mail</th><th className="px-4 py-2">Feliratkozott</th>
              </tr></thead>
              <tbody>
                {info.waitlist.map((r) => (
                  <tr key={r.userId} style={{ borderTop: "1px solid var(--twx-line)" }}>
                    <td className="px-4 py-2 font-medium">{r.name ?? "—"}</td>
                    <td className="px-4 py-2" style={{ color: "var(--twx-ink-muted)" }}>{r.email ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{when(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {error && <p className="rounded-lg px-3 py-2 text-xs" style={{ background: "#fdecea", color: "#a1302a" }}>{error}</p>}
    </div>
  );
}
