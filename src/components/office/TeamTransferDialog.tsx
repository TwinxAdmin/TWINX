// TeamTransferDialog — „Kredit adása társnak" (KÖZÖS MUNKATÉR, KM6).
//   • a társak fix magasságú, belül görgethető listában; társanként mennyiség + gyorsgombok
//   • a forrás a SAJÁT pénztárca — felül élőben: „Saját kreditem" → „Átadás után"
//   • egyben, egy gombbal, megerősítés után; visszavenni NEM lehet (ezt a felület is kimondja)
// A saját sor halványan, magyarázattal marad a helyén. Szerver: POST /api/office/transfers.
"use client";

import { useState } from "react";
import type { TeamMate } from "@/lib/office-overview";
import { ALLOCATE_MAX, ALLOCATE_NOTE_MAX } from "@/lib/office";
import { avatarColor, initials } from "@/lib/office-format";
import { showToast } from "@/components/Toast";

const QUICK = [5, 10, 20];
const TEAL = "#2F7F86";

type Props = {
  mates: TeamMate[];
  meId: string;
  wallet: number;
  preselect?: string | null;   // a Társak kártyáról nyitva: ennél a társnál +10 előre kitöltve
  onDone: () => void;           // sikeres (vagy részben sikeres) átadás után: frissítés + bezárás
};

export default function TeamTransferDialog({ mates, meId, wallet, preselect = null, onDone }: Props) {
  const [amounts, setAmounts] = useState<Record<string, string>>(preselect ? { [preselect]: "10" } : {});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const others = mates.filter((m) => m.userId !== meId);
  const rows = [...others, ...mates.filter((m) => m.userId === meId)];
  const picked = others.map((m) => ({ m, n: Number(amounts[m.userId] || 0) })).filter((x) => x.n > 0);
  const total = picked.reduce((s, x) => s + x.n, 0);
  const left = wallet - total;
  const invalid = picked.some((x) => !Number.isInteger(x.n) || x.n > ALLOCATE_MAX);
  const nameOf = (m: TeamMate) => m.name || m.email;

  function setAmount(id: string, v: string) {
    setAmounts((cur) => ({ ...cur, [id]: v.replace(/[^0-9]/g, "").slice(0, 4) }));
    setError(null);
  }

  async function submit() {
    if (picked.length === 0) { setError("Írd be, kinek mennyi kreditet adsz."); return; }
    if (invalid) { setError(`Egy társnak egyszerre legfeljebb ${ALLOCATE_MAX} kredit adható.`); return; }
    if (left < 0) { setError(`Nincs ennyi kredited (${wallet}). Vásárolj, vagy adj kevesebbet.`); return; }
    const who = picked.length === 1 ? nameOf(picked[0].m) : `${picked.length} társadnak`;
    if (!window.confirm(`Biztosan átadsz ${total} kreditet ${who}? Ez nem vonható vissza.`)) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/office/transfers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: picked.map((x) => ({ userId: x.m.userId, amount: x.n })), note: note.trim() || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      const done: string[] = Array.isArray(d.done) ? d.done : [];
      if (!res.ok) {
        const msg = d.errors?.note ?? d.error ?? "Nem sikerült.";
        if (done.length > 0) {
          // a sikereseket kivesszük, hogy ne lehessen kétszer átadni
          setAmounts((cur) => Object.fromEntries(Object.entries(cur).filter(([id]) => !done.includes(id))));
          showToast(`${done.length} társnak átadva — a többit nézd meg.`, "error");
          setError(`${done.length} társnak sikerült, utána megakadt: ${msg}`);
        } else {
          setError(msg);
        }
        return;
      }
      showToast(picked.length === 1 ? `${total} kredit átadva — ${nameOf(picked[0].m)}` : `${total} kredit átadva ${picked.length} társnak.`, "success");
      onDone();
    } catch {
      setError("Hálózati hiba.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* saját egyenleg — élőben */}
      <div className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5" style={{ background: "#F8F3EC", border: "1px solid #EFE7DD" }}>
        <div className="text-xs" style={{ color: "#6B6258" }}>
          Saját kreditem: <strong className="text-[13px] tabular-nums" style={{ color: "#1C1A17" }}>{wallet}</strong>
        </div>
        <div className="text-xs tabular-nums" style={{ color: left < 0 ? "#B3261E" : "#6B6258" }}>
          Átadás után: <strong className="text-[13px]">{left}</strong>
        </div>
      </div>

      {/* társak — fix magasság, belül görget */}
      <div className="h-[220px] overflow-y-auto overscroll-contain rounded-xl" style={{ background: "#fff", border: "1px solid #EFE7DD" }}>
        {rows.map((m) => {
          const self = m.userId === meId;
          const av = avatarColor(m.userId);
          const val = amounts[m.userId] ?? "";
          return (
            <div key={m.userId} title={self ? "Magadnak nem adhatsz kreditet." : undefined}
              className="flex items-center gap-3 px-3.5 py-2.5" style={{ borderBottom: "1px solid #F3EDE6", opacity: self ? 0.5 : 1 }}>
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-xs font-semibold" style={{ background: av.bg, color: av.fg }}>
                {initials(m.name, m.email)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">{nameOf(m)}{self && <span className="font-medium" style={{ color: "#6B6258" }}> (te)</span>}</div>
                <div className="truncate text-xs" style={{ color: "#6B6258" }}>{self ? "magadnak nem adhatsz" : "Társ"}</div>
              </div>
              {self ? (
                <span className="flex-none text-xs" style={{ color: "#6B6258" }}>—</span>
              ) : (
                <div className="flex flex-none items-center gap-1.5">
                  <div className="hidden gap-1 sm:flex">
                    {QUICK.map((v) => (
                      <button key={v} type="button" onClick={() => setAmount(m.userId, String(v))}
                        className="rounded-full px-2 py-[3px] text-[11px] font-semibold"
                        style={val === String(v) ? { background: "#1C1A17", color: "#fff" } : { background: "#F1EAE1", color: "#4A433C" }}>
                        +{v}
                      </button>
                    ))}
                  </div>
                  <input aria-label={`${nameOf(m)} — átadandó kredit`} inputMode="numeric" placeholder="0"
                    value={val} onChange={(e) => setAmount(m.userId, e.target.value)}
                    className="h-8 w-[64px] rounded-lg px-2 text-right text-[14px] font-semibold tabular-nums outline-none"
                    style={{ border: `1px solid ${Number(val) > 0 ? TEAL : "#E1D6C9"}` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <input aria-label="Megjegyzés" placeholder="Megjegyzés (nem kötelező, pl. „a Thököly videóhoz”)" maxLength={ALLOCATE_NOTE_MAX}
        value={note} onChange={(e) => setNote(e.target.value)}
        className="h-9 rounded-lg px-2.5 text-[13px] outline-none" style={{ border: "1px solid #E1D6C9" }} />

      <p className="rounded-xl px-3 py-2.5 text-xs leading-relaxed" style={{ background: "#FFF6EE", border: "1px solid #F1D3BF", color: "#7A4A2E" }}>
        A kredit a <strong>saját egyenlegedből</strong> megy át a társad egyenlegébe. <strong>Visszavenni nem lehet.</strong>
      </p>

      {/* fix magasságú üzenetsor — a gomb nem ugrik */}
      <p className="min-h-[16px] text-xs" style={{ color: "#B3261E" }}>
        {error ?? (left < 0 ? `Nincs ennyi kredited (${wallet}).` : "")}
      </p>

      <button type="button" onClick={submit} disabled={busy || total === 0 || left < 0 || invalid}
        className="h-10 rounded-full text-[13px] font-semibold disabled:opacity-50" style={{ background: "#F08A68", color: "#1C1A17" }}>
        {busy ? "Átadás…" : total === 0 ? "Írd be, kinek mennyit adsz"
          : `Átadás — ${picked.length} társ, összesen ${total} kredit`}
      </button>
    </div>
  );
}
