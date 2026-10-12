// OfficeAllocateDialog — „Kredit kiosztása" felugró ablak (vezetői nézet, fejléc-sáv gombja).
//   • az iroda összes tagja egy fix magasságú, belül görgethető listában; tagonként mennyiség-mező + gyorsgombok
//   • „Mindenkinek" gyorsgombok: egy kattintással minden kiosztható kollégánál beállítja a mennyiséget
//   • egyben kiosztás egy gombbal; előtte élőben látszik, mennyi marad szabadon kiosztható
//   • CSAK adás — visszavenni a tagtáblában lehet, és csak a létrehozó
// Akinek nem kell / nem adható keret (létrehozó, korlátlan tag, a vezető saját maga), annak a sora
// halványan, magyarázattal marad a helyén. A kiosztás tagonként a meglévő PATCH /api/office/members
// végponton fut (office_allocate_in — egy tranzakcióban, naplózva).
"use client";

import { useState } from "react";
import type { MemberStat } from "@/lib/office-overview";
import { ALLOCATE_MAX, ALLOCATE_NOTE_MAX } from "@/lib/office";
import { avatarColor, initials, ROLE_TEXT } from "@/lib/office-format";
import { showToast } from "@/components/Toast";
import { EmptyState, Icons } from "@/components/office/OfficeUi";

const QUICK = [5, 10, 20, 50];

type Props = {
  members: MemberStat[];
  meId: string;
  isOwner: boolean;
  free: number;
  joinCode: string;
  onDone: () => void;   // sikeres (vagy részben sikeres) kiosztás után: adatfrissítés + bezárás
};

/** Miért nem adható ennek a tagnak keret (null = adható). */
function blockedReason(m: MemberStat, meId: string, isOwner: boolean): string | null {
  if (m.role === "owner") return "A létrehozó az iroda egyenlegéből dolgozik, nem kell keret.";
  if (m.unlimited) return "Korlátlan tag — az iroda egyenlegéből dolgozik, nem kell keret.";
  if (!isOwner && m.userId === meId) return "Magadnak nem oszthatsz keretet.";
  return null;
}

export default function OfficeAllocateDialog({ members, meId, isOwner, free, joinCode, onDone }: Props) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligible = members.filter((m) => !blockedReason(m, meId, isOwner));
  // sorrend: előbb akiknek adható keret, utána a többiek (halványan)
  const rows = [...eligible, ...members.filter((m) => blockedReason(m, meId, isOwner))];

  const picked = eligible
    .map((m) => ({ m, n: Number(amounts[m.userId] || 0) }))
    .filter((x) => x.n > 0);
  const total = picked.reduce((s, x) => s + x.n, 0);
  const freeNow = Math.max(free, 0);
  const left = freeNow - total;
  const invalid = picked.some((x) => !Number.isInteger(x.n) || x.n > ALLOCATE_MAX);

  function setAmount(id: string, v: string) {
    setAmounts((cur) => ({ ...cur, [id]: v.replace(/[^0-9]/g, "").slice(0, 4) }));
    setError(null);
  }

  function setAll(v: number) {
    setAmounts(Object.fromEntries(eligible.map((m) => [m.userId, String(v)])));
    setError(null);
  }

  async function submit() {
    if (picked.length === 0) { setError("Írd be, kinek mennyi kreditet adsz."); return; }
    if (invalid) { setError(`Egy kollégának egyszerre legfeljebb ${ALLOCATE_MAX} kredit adható.`); return; }
    if (left < 0) { setError(`Nincs ennyi szabadon kiosztható kredit (${freeNow}). Tölts fel, vagy adj kevesebbet.`); return; }

    setBusy(true);
    setError(null);
    const done: string[] = [];
    try {
      for (const { m, n } of picked) {
        const res = await fetch("/api/office/members", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: m.userId, action: "allocate", delta: n, note: note.trim() || undefined }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) {
          const who = m.name || m.email;
          const msg = d.errors?.note ?? d.error ?? "Nem sikerült.";
          setError(done.length > 0
            ? `${done.length} kollégának sikerült, ${who} kiosztása megakadt: ${msg}`
            : `${who}: ${msg}`);
          if (done.length > 0) {
            // a sikereseket kivesszük a listából, hogy ne lehessen kétszer kiosztani
            setAmounts((cur) => Object.fromEntries(Object.entries(cur).filter(([id]) => !done.includes(id))));
            showToast(`${done.length} kollégának kiosztva — a többit nézd meg.`, "error");
          }
          return;
        }
        done.push(m.userId);
      }
      showToast(picked.length === 1
        ? `${total} kredit jóváírva — ${picked[0].m.name || picked[0].m.email}`
        : `${total} kredit kiosztva ${picked.length} kollégának.`, "success");
      onDone();
    } catch {
      setError(done.length > 0 ? `${done.length} kollégának sikerült, utána hálózati hiba történt.` : "Hálózati hiba.");
    } finally {
      setBusy(false);
    }
  }

  if (eligible.length === 0) {
    return (
      <EmptyState icon={Icons.users} title="Még nincs kinek kiosztani"
        text={`Ha a kollégák csatlakoznak a kóddal (${joinCode}), itt egyszerre adhatsz nekik kreditet az irodai keretből.`} />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* szabad keret — élőben */}
      <div className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5" style={{ background: "#F8F3EC", border: "1px solid #EFE7DD" }}>
        <div className="text-xs" style={{ color: "#6B6258" }}>
          Szabadon kiosztható: <strong className="text-[13px] tabular-nums" style={{ color: "#1C1A17" }}>{freeNow}</strong> kredit
        </div>
        <div className="text-xs tabular-nums" style={{ color: left < 0 ? "#B3261E" : "#6B6258" }}>
          Kiosztás után: <strong className="text-[13px]">{left}</strong>
        </div>
      </div>

      {/* mindenkinek */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs" style={{ color: "#6B6258" }}>Mindenkinek:</span>
        {QUICK.map((v) => (
          <button key={v} type="button" onClick={() => setAll(v)}
            className="rounded-full px-2.5 py-[3px] text-[11px] font-semibold" style={{ background: "#F1EAE1", color: "#4A433C" }}>
            +{v}
          </button>
        ))}
        <button type="button" onClick={() => { setAmounts({}); setError(null); }} disabled={total === 0}
          className="ml-auto rounded-full px-2.5 py-[3px] text-[11px] font-semibold disabled:opacity-40" style={{ color: "#6B6258" }}>
          Törlés
        </button>
      </div>

      {/* tagok — fix magasság, belül görget */}
      <div className="h-[300px] overflow-y-auto overscroll-contain rounded-xl" style={{ background: "#fff", border: "1px solid #EFE7DD" }}>
        {rows.map((m) => {
          const reason = blockedReason(m, meId, isOwner);
          const av = avatarColor(m.userId);
          const val = amounts[m.userId] ?? "";
          return (
            <div key={m.userId} title={reason ?? undefined}
              className="flex items-center gap-3 px-3.5 py-2.5" style={{ borderBottom: "1px solid #F3EDE6", opacity: reason ? 0.5 : 1 }}>
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-xs font-semibold" style={{ background: av.bg, color: av.fg }}>
                {initials(m.name, m.email)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">
                  {m.name || m.email}{m.userId === meId && <span className="font-medium" style={{ color: "#6B6258" }}> (te)</span>}
                </div>
                <div className="truncate text-xs" style={{ color: "#6B6258" }}>
                  {ROLE_TEXT[m.roleLabel]} · {reason ? (m.unlimited || m.role === "owner" ? "korlátlan" : "nem adható") : `${m.allowance} kredit elérhető`}
                </div>
              </div>
              {reason ? (
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
                  <input aria-label={`${m.name || m.email} — kiosztandó kredit`} inputMode="numeric" placeholder="0"
                    value={val} onChange={(e) => setAmount(m.userId, e.target.value)}
                    className="h-8 w-[64px] rounded-lg px-2 text-right text-[14px] font-semibold tabular-nums outline-none"
                    style={{ border: `1px solid ${Number(val) > 0 ? "#E3683F" : "#E1D6C9"}` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <input aria-label="Megjegyzés" placeholder="Megjegyzés mindenkinek (nem kötelező, pl. októberi keret)" maxLength={ALLOCATE_NOTE_MAX}
        value={note} onChange={(e) => setNote(e.target.value)}
        className="h-9 rounded-lg px-2.5 text-[13px] outline-none" style={{ border: "1px solid #E1D6C9" }} />

      {/* fix magasságú üzenetsor — a gomb nem ugrik */}
      <p className="min-h-[16px] text-xs" style={{ color: "#B3261E" }}>
        {error ?? (left < 0 ? `Nincs ennyi szabadon kiosztható kredit (${freeNow}).` : "")}
      </p>

      <button type="button" onClick={submit} disabled={busy || total === 0 || left < 0 || invalid}
        className="h-10 rounded-full text-[13px] font-semibold disabled:opacity-50" style={{ background: "#F08A68", color: "#1C1A17" }}>
        {busy ? "Kiosztás…" : total === 0 ? "Írd be, kinek mennyit adsz"
          : `Kiosztás — ${picked.length} kolléga, összesen ${total} kredit`}
      </button>
    </div>
  );
}
