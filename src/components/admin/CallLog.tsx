// Hívásnapló egy ügyfélhez (a „Részletek" ablakban — Sales és Admin is látja).
// Fent: új bejegyzés (eredmény + visszahívás napja + megjegyzés), alatta az időrendi napló (ki, mikor, mit).
// API: /api/sales/users/:id/calls (admin / sales). Migráció nélkül tájékoztató üzenet, a felület nem törik el.
"use client";

import { useEffect, useState } from "react";
import DateField from "@/components/DateField";
import { showToast } from "@/components/Toast";
import { CALL_NOTES_MIGRATION_NAME, CALL_STATUSES, callStatusLabel, type CallNote, type CallStatus } from "@/lib/call-notes-shared";

/** Állapot-színek: a napló és a lista is ezt használja. */
export const CALL_STATUS_STYLE: Record<CallStatus, { bg: string; fg: string }> = {
  talked: { bg: "#E6F2EA", fg: "#1F6B3E" },
  interested: { bg: "#E3EEF9", fg: "#1D4E89" },
  callback: { bg: "#FFF1D6", fg: "#8A5A12" },
  no_answer: { bg: "#EFE7DD", fg: "#5B524A" },
  not_interested: { bg: "#F7E1DC", fg: "#8E2F1C" },
};

const today = () => new Date().toISOString().slice(0, 10);
function dt(iso: string): string {
  return new Date(iso).toLocaleString("hu-HU", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("hu-HU", { year: "numeric", month: "2-digit", day: "2-digit" });

export default function CallLog({ userId }: { userId: string }) {
  const [notes, setNotes] = useState<CallNote[] | null>(null);
  const [migrated, setMigrated] = useState(true);
  const [status, setStatus] = useState<CallStatus | null>(null);
  const [callbackOn, setCallbackOn] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sales/users/${userId}/calls`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setNotes((d.notes ?? []) as CallNote[]); setMigrated(d.migrated !== false); } })
      .catch(() => { if (!cancelled) setNotes([]); });
    return () => { cancelled = true; };
  }, [userId]);

  async function save() {
    if (!status) { showToast("Válaszd ki a hívás eredményét.", "error"); return; }
    if (status === "callback" && !callbackOn) { showToast("Add meg, mikor hívjuk vissza.", "error"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/sales/users/${userId}/calls`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note, callbackOn: status === "callback" ? callbackOn : null }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Nem sikerült menteni.");
      setNotes((n) => [d.note as CallNote, ...(n ?? [])]);
      setStatus(null); setCallbackOn(""); setNote("");
      showToast("Bejegyzés mentve.", "success");
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally { setSaving(false); }
  }

  if (!migrated) {
    return (
      <p className="rounded-xl p-3 text-sm" style={{ background: "#FFF1D6", color: "#8A5A12" }}>
        A hívásnaplóhoz futtasd le a <strong>{CALL_NOTES_MIGRATION_NAME}</strong> migrációt.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Új bejegyzés */}
      <div className="space-y-2.5 rounded-xl p-3" style={{ background: "var(--twx-cream)" }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--twx-ink-muted)" }}>Új bejegyzés</p>
        <div className="flex flex-wrap gap-1.5">
          {CALL_STATUSES.map((s) => {
            const on = status === s.value;
            const c = CALL_STATUS_STYLE[s.value];
            return (
              <button key={s.value} type="button" onClick={() => setStatus(s.value)} aria-pressed={on}
                className="h-9 rounded-full px-3 text-xs font-semibold transition"
                style={on ? { background: c.bg, color: c.fg, boxShadow: `inset 0 0 0 1.5px ${c.fg}` } : { background: "#fff", color: "var(--twx-ink)", border: "1px solid var(--twx-line)" }}>
                {s.label}
              </button>
            );
          })}
        </div>
        {status === "callback" && (
          <div className="max-w-[220px]">
            <DateField value={callbackOn} onChange={setCallbackOn} min={today()} placeholder="Mikor hívjuk vissza?" size="sm" />
          </div>
        )}
        <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 2000))} rows={2}
          placeholder="Megjegyzés (pl. mit beszéltetek, mire kíváncsi)…" className="twx-input w-full resize-none text-sm" />
        <div className="flex justify-end">
          <button type="button" onClick={() => void save()} disabled={saving || !status}
            className="h-10 rounded-full px-5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--twx-ink)" }}>
            {saving ? "Mentés…" : "Bejegyzés mentése"}
          </button>
        </div>
      </div>

      {/* Napló */}
      {notes === null ? (
        <div className="h-16 animate-pulse rounded-xl" style={{ background: "#EFE7DD" }} />
      ) : notes.length ? (
        <ul className="space-y-2">
          {notes.map((n) => {
            const c = CALL_STATUS_STYLE[n.status] ?? CALL_STATUS_STYLE.no_answer;
            return (
              <li key={n.id} className="rounded-xl bg-white p-3 text-sm" style={{ border: "1px solid var(--twx-line)" }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: c.bg, color: c.fg }}>
                    {callStatusLabel(n.status)}{n.status === "callback" && n.callbackOn ? `: ${day(n.callbackOn)}` : ""}
                  </span>
                  <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{dt(n.createdAt)} · {n.authorName || "ismeretlen"}</span>
                </div>
                {n.note && <p className="mt-1.5 whitespace-pre-wrap">{n.note}</p>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Még nincs bejegyzés — az első hívás után itt jelenik meg.</p>
      )}
    </div>
  );
}
