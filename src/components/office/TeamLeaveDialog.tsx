// TeamLeaveDialog — „Kilépés a munkatérből" (KÖZÖS MUNKATÉR, KM8).
//   1 · Mely munkákat adod át? — a SAJÁT munkák pipálós listája (max. 50, fix magasság, belül görget);
//       a közös mappába tett munkák alapból kijelölve
//   2 · Kiknek adod át? — a társak pipálós listája
//   → „N munka átadása M társnak, és kilépés" vagy „Kilépés átadás nélkül" (mindkettő megerősítéssel)
// Átadás: minden kijelölt társ SAJÁT PÉLDÁNYT kap. Kilépés után a közös mappákba tett munkák 30 napig
// még olvashatók a társaknak. Szerver: POST /api/office/leave.
"use client";

import { useEffect, useState } from "react";
import type { TeamMate, WorkRow } from "@/lib/office-overview";
import { avatarColor, fmtWhen, initials } from "@/lib/office-format";
import { showToast } from "@/components/Toast";

const TEAL = "#2F7F86";

export default function TeamLeaveDialog({ officeName, mates, meId }: { officeName: string; mates: TeamMate[]; meId: string }) {
  const [works, setWorks] = useState<WorkRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [to, setTo] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const others = mates.filter((m) => m.userId !== meId);

  useEffect(() => {
    let alive = true;
    fetch("/api/office/works/list?range=all")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.error) { setLoadError(d.error); return; }
        const list: WorkRow[] = d.works ?? [];
        setWorks(list);
        // a már közös mappába tett munkák alapból kijelölve
        setPicked(new Set(list.filter((w) => (w.folders ?? []).length > 0).map((w) => w.id)));
      })
      .catch(() => alive && setLoadError("Nem sikerült betölteni a munkáidat."));
    return () => { alive = false; };
  }, []);

  const toggle = (set: Set<string>, id: string) => { const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); return n; };
  const allPicked = !!works && works.length > 0 && picked.size === works.length;

  async function leave(withHandover: boolean) {
    setError(null);
    if (withHandover && (picked.size === 0 || to.size === 0)) {
      setError(picked.size === 0 ? "Jelöld ki, mely munkákat adod át." : "Jelöld ki, kiknek adod át.");
      return;
    }
    const q = withHandover
      ? `Átadsz ${picked.size} munkát ${to.size} társadnak, és kilépsz a(z) „${officeName}” munkatérből. Biztosan?`
      : `Kilépsz a(z) „${officeName}” munkatérből átadás nélkül. A közös mappákba tett munkáid még 30 napig olvashatók a társaidnak. Biztosan?`;
    if (!window.confirm(q)) return;

    setBusy(true);
    try {
      const res = await fetch("/api/office/leave", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withHandover ? { historyIds: [...picked], recipients: [...to] } : {}),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Nem sikerült kilépni."); return; }
      showToast(d.handed > 0 ? `Kiléptél — ${picked.size} munkát átadtál.` : "Kiléptél a munkatérből.", "success");
      window.location.href = "/dashboard/iroda";
    } catch {
      setError("Hálózati hiba.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-xl px-3 py-2.5 text-xs leading-relaxed" style={{ background: "#FFF6EE", border: "1px solid #F1D3BF", color: "#7A4A2E" }}>
        Kilépés után a közös mappákba tett munkáid <strong>30 napig</strong> még olvashatók a társaidnak, utána kikerülnek.
        Ha szeretnéd, előtte <strong>átadhatod</strong> őket — akkor a kijelölt társak saját példányt kapnak, és az övék lesznek.
      </p>

      {/* 1 · munkák */}
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: "#6B6258" }}>
        <span>1 · Mely munkákat adod át?</span>
        <button type="button" disabled={!works || works.length === 0}
          onClick={() => setPicked(allPicked ? new Set() : new Set((works ?? []).map((w) => w.id)))}
          className="text-xs font-semibold normal-case tracking-normal disabled:opacity-40" style={{ color: TEAL }}>
          {allPicked ? "Kijelölés törlése" : "Mind kijelölése"}
        </button>
      </div>
      <div className="h-[208px] overflow-y-auto overscroll-contain rounded-xl" style={{ background: "#fff", border: "1px solid #EFE7DD" }}>
        {loadError && <p className="p-3 text-sm text-red-600">{loadError}</p>}
        {!works && !loadError && <p className="p-3 text-sm" style={{ color: "#6B6258" }}>Betöltés…</p>}
        {works && works.length === 0 && (
          <p className="flex h-full items-center justify-center px-4 text-center text-sm" style={{ color: "#6B6258" }}>
            Nincs átadható munkád — kiléphetsz átadás nélkül.
          </p>
        )}
        {works && works.map((w) => {
          const on = picked.has(w.id);
          return (
            <label key={w.id} className="flex h-[52px] cursor-pointer items-center gap-3 px-3.5" style={{ borderBottom: "1px solid #F3EDE6" }}>
              <input type="checkbox" checked={on} onChange={() => setPicked((s) => toggle(s, w.id))} className="h-4 w-4 flex-none" style={{ accentColor: TEAL }} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold">{w.title}</span>
                <span className="block truncate text-xs" style={{ color: "#6B6258" }}>
                  {w.moduleLabel} · {(w.folders ?? []).length ? w.folders!.join(", ") : "nincs megosztva"} · {fmtWhen(w.createdAt, false)}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {/* 2 · társak */}
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: "#6B6258" }}>
        <span>2 · Kiknek adod át?</span>
        <span className="normal-case tracking-normal">{picked.size} munka kijelölve</span>
      </div>
      <div className="rounded-xl" style={{ background: "#fff", border: "1px solid #EFE7DD" }}>
        {others.length === 0 && (
          <p className="px-3.5 py-3 text-sm" style={{ color: "#6B6258" }}>Nincs más társ a munkatérben — csak átadás nélkül léphetsz ki.</p>
        )}
        {others.map((m) => {
          const on = to.has(m.userId);
          const av = avatarColor(m.userId);
          return (
            <label key={m.userId} className="flex h-[48px] cursor-pointer items-center gap-3 px-3.5" style={{ borderBottom: "1px solid #F3EDE6" }}>
              <input type="checkbox" checked={on} onChange={() => setTo((s) => toggle(s, m.userId))} className="h-4 w-4 flex-none" style={{ accentColor: TEAL }} />
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[11px] font-bold" style={{ background: av.bg, color: av.fg }}>
                {initials(m.name, m.email)}
              </span>
              <span className="truncate text-[13px] font-semibold">{m.name || m.email}</span>
            </label>
          );
        })}
      </div>

      {/* fix magasságú üzenetsor */}
      <p className="min-h-[16px] text-xs" style={{ color: "#B3261E" }}>{error ?? ""}</p>

      <button type="button" onClick={() => void leave(true)} disabled={busy || picked.size === 0 || to.size === 0}
        title={picked.size === 0 || to.size === 0 ? "Jelölj ki legalább egy munkát és egy társat." : undefined}
        className="h-11 rounded-full text-[13px] font-bold disabled:opacity-50" style={{ background: "#F08A68", color: "#1C1A17" }}>
        {busy ? "Folyamatban…" : `${picked.size} munka átadása ${to.size} társnak, és kilépés`}
      </button>
      <button type="button" onClick={() => void leave(false)} disabled={busy}
        className="h-10 rounded-full text-[13px] font-semibold disabled:opacity-50" style={{ color: "#6B6258", border: "1px solid #E9E0D5" }}>
        Kilépés átadás nélkül
      </button>
    </div>
  );
}
