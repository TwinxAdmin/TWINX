// OfficeMemberTable — „Tagok és felhasználás" (létrehozó / vezető nézet).
//   • Széles képernyőn táblázat, ami vízszintes görgetés nélkül kifér; keskenyebben minden tag egy kártya.
//   • Sor: név, státusz (létrehozónak egy kattintással: Tag ⇄ Vezető, Korlátlan), keret · felhasználva, munkák, −/+, részletek.
//   • Részletek (felugró ablak): modulonkénti bontás, a kolléga irodai munkái (címmel), keret módosítása
//     (Ad / Visszavesz, előnézettel, megjegyzéssel), és a létrehozónak: eltávolítás.
// Minden kreditművelet a szerveren, egy tranzakcióban, naplózva fut (office_allocate_in).
"use client";

import { useEffect, useState } from "react";
import type { MemberStat, OverviewRange, WorkRow } from "@/lib/office-overview";
import { ALLOCATE_MAX, ALLOCATE_NOTE_MAX, SERVICE_LABELS } from "@/lib/office";
import { avatarColor, fmtWhen, initials, ROLE_TEXT } from "@/lib/office-format";
import { showToast } from "@/components/Toast";
import { OfficeDialog } from "@/components/office/OfficeUi";

type Props = {
  members: MemberStat[];
  meId: string;
  isOwner: boolean;
  free: number;
  range: OverviewRange;
  onChanged: () => void;
  hint?: React.ReactNode;   // üres iroda esetén a lista alatt (a fix magasságú dobozon belül) megjelenő tipp
};

// FIX 5 SOR: egy sor asztali nézetben 57 px (56 + 1 px elválasztó). Ha többen vannak,
// a tagok a dobozon BELÜL görgethetők fel-le — a blokk magassága nem változik.
const ROW_H = 57;
const VISIBLE_ROWS = 5;

// Széles képernyőn táblázat, ami MINDIG kifér (nincs vízszintes görgetés); alatta kártyák, a mezők egymás alatt.
const COLS = "lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(150px,1.3fr)_minmax(0,1.5fr)_52px_80px_32px] lg:items-center lg:gap-3";

export default function OfficeMemberTable({ members, meId, isOwner, free, range, onChanged, hint }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [preset, setPreset] = useState<"give" | "take">("give");

  function toggle(id: string, mode?: "give" | "take") {
    if (mode) setPreset(mode);
    setOpen((cur) => (cur === id && !mode ? null : id));
  }

  return (
    <div>
      <div>
        {/* fejléc — csak asztali nézetben */}
        <div className={`hidden px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] ${COLS}`}
          style={{ background: "#1B1815", color: "#BFB4A8" }}>
          <span>Kolléga</span><span>Státusz</span><span>Keret · felhasználva</span>
          <span className="text-right">Munkák</span><span className="text-center">Keret</span><span />
        </div>

        {/* görgethető, fix magasságú lista (5 sor) — mobilon kártyák, ott is fix magassággal */}
        <div className="h-[460px] overflow-y-auto overscroll-contain lg:h-[var(--rows-h)]"
          style={{ ["--rows-h" as string]: `${ROW_H * VISIBLE_ROWS}px` }}>
        {members.map((m) => {
          const isMe = m.userId === meId;
          const free_ = m.role === "owner" || m.unlimited;
          // Keretet a létrehozó bárkinek adhat (a korlátlan tagot és önmagát kivéve); a vezető magának nem.
          const canAllocate = !free_ && (isOwner || !isMe);
          const expanded = open === m.userId;
          const av = avatarColor(m.userId);
          const total = m.spent + m.allowance;
          const pct = total > 0 ? Math.round((m.spent / total) * 100) : 0;

          return (
            <div key={m.userId} style={{
              borderBottom: "1px solid #EFE7DD",
              // Korlátlan tag: halvány zöld sor + zöld csík a bal szélen (a létrehozó nem kap kiemelést).
              background: expanded ? "#FFFBF8" : m.unlimited && m.role !== "owner" ? "#F1F8F3" : undefined,
              boxShadow: expanded ? "inset 3px 0 0 #E3683F" : m.unlimited && m.role !== "owner" ? "inset 3px 0 0 #1F7A4D" : undefined,
            }}>
              <div className={`flex flex-col gap-2 px-4 py-3 lg:h-14 lg:py-0 ${COLS}`}>
                {/* név */}
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="relative flex h-8 w-8 flex-none items-center justify-center rounded-full text-xs font-semibold"
                    style={{ background: av.bg, color: av.fg, boxShadow: m.unlimited && m.role !== "owner" ? "0 0 0 2px #fff, 0 0 0 4px #1F7A4D" : undefined }}>
                    {initials(m.name, m.email)}
                    {m.unlimited && m.role !== "owner" && (
                      <span aria-hidden className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold leading-none"
                        style={{ background: "#1F7A4D", color: "#fff", border: "1.5px solid #fff" }}>∞</span>
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold">
                      {m.name || m.email}{isMe && <span className="font-medium" style={{ color: "#6B6258" }}> (te)</span>}
                    </div>
                    <div className="truncate text-xs" style={{ color: "#6B6258" }}>
                      {isJoinedToday(m.joinedAt) ? "csatlakozott ma" : m.email}
                    </div>
                  </div>
                </div>

                {/* szerep */}
                <StatusControl member={m} editable={isOwner && m.role !== "owner"} onDone={onChanged} />

                {/* keret · felhasználva */}
                <div className="flex flex-col gap-1">
                  {m.unlimited && m.role !== "owner" ? (
                    <>
                      <div className="flex items-center gap-2 text-[13px] tabular-nums">
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[11px] font-bold"
                          style={{ background: "#DDF0E4", color: "#1F5C38", border: "1px solid #A8D5B8" }}>∞ Korlátlan</span>
                        <span><strong>{m.spent}</strong> <span style={{ color: "#6B6258" }}>felhasználva</span></span>
                      </div>
                      <div className="h-1.5 rounded" style={{ background: "linear-gradient(90deg, #1F7A4D, #6FBF8E)" }} />
                    </>
                  ) : free_ ? (
                    <>
                      <div className="text-[13px] tabular-nums"><strong>{m.spent}</strong> <span style={{ color: "#6B6258" }}>felhasználva · korlátlan</span></div>
                      <div className="h-1.5 rounded" style={{ background: "#EFE7DD" }} />
                    </>
                  ) : m.allowance === 0 && !m.everAllocated ? (
                    <div className="text-[13px]" style={{ color: "#6B6258" }}>Még nincs kerete</div>
                  ) : (
                    <>
                      <div className="text-[13px] tabular-nums">
                        <strong>{m.spent}</strong> <span style={{ color: "#6B6258" }}>/ {total} ·</span>{" "}
                        {m.allowance === 0
                          ? <span className="font-semibold" style={{ color: "#B3261E" }}>elfogyott</span>
                          : <span style={{ color: "#6B6258" }}>{m.allowance} maradt</span>}
                      </div>
                      <div className="h-1.5 overflow-hidden rounded" style={{ background: "#EFE7DD" }}>
                        <div className="h-full" style={{ width: `${pct}%`, background: m.allowance === 0 ? "#B3261E" : "#E3683F" }} />
                      </div>
                    </>
                  )}
                </div>

                {/* munkák */}
                <div className="text-[13px] font-semibold tabular-nums lg:text-right">
                  <span className="font-normal lg:hidden" style={{ color: "#6B6258" }}>Munkák: </span>{m.works}
                </div>

                {/* keret gombok */}
                <div className="flex gap-1 lg:justify-center">
                  {!canAllocate ? (
                    <span className="hidden text-xs lg:inline" style={{ color: "#6B6258" }}>—</span>
                  ) : m.allowance === 0 && !m.everAllocated ? (
                    <button type="button" onClick={() => toggle(m.userId, "give")}
                      className="h-[30px] whitespace-nowrap rounded-full px-3 text-xs font-semibold" style={{ background: "#F08A68", color: "#1C1A17" }}>
                      Keret adása
                    </button>
                  ) : (
                    <>
                      <IconBtn label="Kredit visszavétele" onClick={() => toggle(m.userId, "take")}>−</IconBtn>
                      <IconBtn label="Kredit adása" onClick={() => toggle(m.userId, "give")}>+</IconBtn>
                    </>
                  )}
                </div>

                {/* részletek */}
                <div className="lg:flex lg:justify-end">
                  <button type="button" onClick={() => toggle(m.userId)} aria-expanded={expanded}
                    aria-label={expanded ? "Részletek bezárása" : "Részletek"}
                    className="flex h-[30px] items-center justify-center gap-1 rounded-lg px-2 text-xs lg:w-[30px] lg:px-0"
                    style={expanded
                      ? { background: "#1C1A17", color: "#fff", border: "1px solid #1C1A17" }
                      : { background: "#fff", color: "#3A342E", border: "1px solid #E1D6C9" }}>
                    <span className="lg:hidden">{expanded ? "Bezárás" : "Részletek"}</span>
                    <span aria-hidden className="transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "none" }}>▾</span>
                  </button>
                </div>
              </div>

            </div>
          );
        })}
        {hint && <div className="p-4 sm:p-[18px]">{hint}</div>}
        </div>

        {/* Részletek FELUGRÓ ablakban — a fix 5 soros lista így nem nyúlik meg */}
        {(() => {
          const m = members.find((x) => x.userId === open);
          if (!m) return null;
          const isMe = m.userId === meId;
          const canAllocate = !(m.role === "owner" || m.unlimited) && (isOwner || !isMe);
          return (
            <OfficeDialog title={`${m.name || m.email}${isMe ? " (te)" : ""}`} onClose={() => setOpen(null)} wide>
              <div className="flex flex-wrap gap-4">
                <MemberWorks member={m} range={range} />
                {(canAllocate || (isOwner && m.role !== "owner")) && (
                  <div className="flex min-w-0 flex-[2_1_260px] flex-col gap-3">
                    {canAllocate && (
                      <AllocatePanel key={`${m.userId}-${preset}`} member={m} free={free} initialMode={preset} onDone={onChanged} />
                    )}
                    {isOwner && m.role !== "owner" && <RemovePanel member={m} onDone={() => { setOpen(null); onChanged(); }} />}
                  </div>
                )}
              </div>
            </OfficeDialog>
          );
        })()}

        {members.length > VISIBLE_ROWS && (
          <div className="flex items-center justify-between px-4 py-2 text-xs" style={{ borderTop: "1px solid #EFE7DD", color: "#6B6258" }}>
            <span>{members.length} tag az irodában</span>
            <span>Görgess a listában a többiért ↕</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Kinyitott sor: modulonkénti bontás + a kolléga irodai munkái
// ---------------------------------------------------------------------------
function MemberWorks({ member, range }: { member: MemberStat; range: OverviewRange }) {
  const [works, setWorks] = useState<WorkRow[] | null>(null);
  const [all, setAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/office/works/list?userId=${member.userId}&range=${range}`)
      .then((r) => r.json())
      .then((d) => { if (alive) { if (d.error) setError(d.error); else setWorks(d.works ?? []); } })
      .catch(() => alive && setError("Nem sikerült betölteni a munkákat."));
    return () => { alive = false; };
  }, [member.userId, range]);

  const services = Object.entries(member.services).sort((a, b) => b[1] - a[1]);
  const shown = works ? (all ? works : works.slice(0, 5)) : [];
  const firstName = (member.name || member.email).split(" ").slice(-1)[0];

  return (
    <div className="flex min-w-0 flex-[3_1_380px] flex-col gap-2">
      {services.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {services.map(([svc, credits]) => (
            <Chip key={svc} bg="#fff" fg="#4A433C" border="#E1D6C9">
              {SERVICE_LABELS[svc] ?? "Egyéb"} <strong className="tabular-nums">{credits} kr</strong>
            </Chip>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!works && !error && <p className="text-sm" style={{ color: "#6B6258" }}>Munkák betöltése…</p>}
      {works && works.length === 0 && (
        <p className="text-sm" style={{ color: "#6B6258" }}>Ebben az időszakban nincs irodai módban készült munkája.</p>
      )}
      {shown.length > 0 && (
        <div className="overflow-hidden rounded-[10px] text-[13px]" style={{ background: "#fff", border: "1px solid #EFE7DD" }}>
          {shown.map((w, i) => (
            <div key={w.id} className="grid grid-cols-[minmax(0,1fr)_56px] gap-x-2.5 px-3 py-2 sm:grid-cols-[110px_minmax(0,1fr)_80px_56px]"
              style={{ borderBottom: i < shown.length - 1 ? "1px solid #F3ECE3" : "none" }}>
              <span className="hidden truncate sm:block" style={{ color: "#6B6258" }}>{w.moduleLabel}</span>
              <span className="min-w-0 truncate">
                <span className="sm:hidden" style={{ color: "#6B6258" }}>{w.moduleLabel} · </span>{w.title}
              </span>
              <span className="hidden self-center text-xs sm:block" style={{ color: "#6B6258" }}>{fmtWhen(w.createdAt, false)}</span>
              <strong className="text-right tabular-nums">{w.credits > 0 ? `−${w.credits}` : "0"}</strong>
            </div>
          ))}
        </div>
      )}
      {works && works.length > 5 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="self-start text-xs font-semibold" style={{ color: "#C2512F" }}>
          {all ? "Kevesebb" : `${firstName} összes munkája (${works.length}${works.length >= 50 ? "+" : ""})`}
        </button>
      )}
      <p className="text-[11px]" style={{ color: "#8F857B" }}>
        Csak az irodai keretből készült munkák látszanak; a tartalmuk akkor nyitható meg, ha a kolléga megosztja egy közös mappában.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Keret módosítása (Ad / Visszavesz) — előnézettel
// ---------------------------------------------------------------------------
function AllocatePanel({ member, free, initialMode, onDone }: {
  member: MemberStat; free: number; initialMode: "give" | "take"; onDone: () => void;
}) {
  const [mode, setMode] = useState<"give" | "take">(initialMode);
  const [amount, setAmount] = useState("10");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const n = Number(amount);
  const valid = Number.isInteger(n) && n > 0 && n <= ALLOCATE_MAX;
  const delta = valid ? (mode === "give" ? n : -n) : 0;
  const total = member.spent + member.allowance;
  const tooMuch = mode === "give" ? valid && n > free : valid && n > member.allowance;
  const firstName = (member.name || member.email).split(" ").slice(-1)[0];

  async function submit() {
    if (!valid) { setError(`1 és ${ALLOCATE_MAX} közötti egész számot adj meg.`); return; }
    if (tooMuch) {
      setError(mode === "give" ? `Legfeljebb ${Math.max(free, 0)} kredit adható (szabadon kiosztható).` : `Legfeljebb ${member.allowance} kredit vehető vissza.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/office/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.userId, action: "allocate", delta, note: note.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.errors?.note ?? d.error ?? "Nem sikerült."); return; }
      showToast(mode === "give" ? `${n} kredit jóváírva — ${firstName}` : `${n} kredit visszavéve — ${firstName}`, "success");
      setNote("");
      onDone();
    } catch {
      setError("Hálózati hiba.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-xl p-3.5" style={{ background: "#fff", border: "1px solid #EFE7DD" }}>
      <p className="font-display text-sm font-semibold">Keret módosítása</p>

      <div className="grid grid-cols-2 rounded-full p-[3px]" style={{ background: "#F1EAE1" }}>
        {(["give", "take"] as const).map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); setError(null); }}
            className="h-8 rounded-full text-[13px] font-semibold"
            style={mode === m ? { background: "#fff", color: "#1C1A17", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" } : { color: "#6B6258" }}>
            {m === "give" ? "+ Ad" : "− Visszavesz"}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor={`amt-${member.userId}`} className="w-[70px] text-xs" style={{ color: "#6B6258" }}>Mennyiség</label>
        <input id={`amt-${member.userId}`} inputMode="numeric" value={amount}
          onChange={(e) => { setAmount(e.target.value.replace(/[^0-9]/g, "")); setError(null); }}
          className="h-9 min-w-0 flex-1 rounded-lg px-2.5 text-right text-[15px] font-semibold outline-none"
          style={{ border: "1px solid #E1D6C9" }} />
        <span className="text-xs" style={{ color: "#6B6258" }}>kredit</span>
      </div>

      <div className="flex gap-1.5">
        {[5, 10, 20, 50].map((v) => (
          <button key={v} type="button" onClick={() => { setAmount(String(v)); setError(null); }}
            className="rounded-full px-2 py-[3px] text-[11px] font-semibold"
            style={String(v) === amount ? { background: "#1C1A17", color: "#fff" } : { background: "#F1EAE1", color: "#4A433C" }}>
            {mode === "give" ? "+" : "−"}{v}
          </button>
        ))}
      </div>

      {/* előnézet */}
      <div className="flex flex-col gap-0.5 rounded-lg px-2.5 py-2 text-xs" style={{ background: "#F8F3EC" }}>
        <Preview label={`${firstName} kerete`} from={total} to={total + delta} />
        <Preview label={`${firstName} elérhető kreditje`} from={member.allowance} to={member.allowance + delta} />
        <Preview label="Szabadon kiosztható" from={free} to={free - delta} />
      </div>

      <input aria-label="Megjegyzés" placeholder="Megjegyzés (pl. Thököly úti videóhoz)" maxLength={ALLOCATE_NOTE_MAX}
        value={note} onChange={(e) => setNote(e.target.value)}
        className="h-9 rounded-lg px-2.5 text-[13px] outline-none" style={{ border: "1px solid #E1D6C9" }} />

      {error && <p className="text-xs text-red-600">{error}</p>}
      {!error && tooMuch && (
        <p className="text-xs" style={{ color: "#B3261E" }}>
          {mode === "give" ? `Nincs ennyi szabadon kiosztható kredit (${Math.max(free, 0)}).` : `${firstName} keretében csak ${member.allowance} kredit van.`}
        </p>
      )}

      <button type="button" onClick={submit} disabled={busy || !valid || tooMuch}
        className="h-9 rounded-full text-[13px] font-semibold disabled:opacity-50"
        style={{ background: "#F08A68", color: "#1C1A17" }}>
        {busy ? "Mentés…" : valid ? `${n} kredit ${mode === "give" ? "jóváírása" : "visszavétele"}` : "Adj meg mennyiséget"}
      </button>
    </div>
  );
}

function Preview({ label, from, to }: { label: string; from: number; to: number }) {
  return (
    <div className="flex justify-between gap-2">
      <span style={{ color: "#6B6258" }}>{label}</span>
      <span className="tabular-nums">
        <span style={{ color: "#6B6258" }}>{from} →</span>{" "}
        <strong style={{ color: to < 0 ? "#B3261E" : undefined }}>{to}</strong>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Státusz egy gombnyomásra (CSAK a létrehozó): Tag ⇄ Vezető, és Korlátlan be/ki.
// Más nézőnek (vezetőnek) csak a címkék látszanak.
// ---------------------------------------------------------------------------
function StatusControl({ member, editable, onDone }: { member: MemberStat; editable: boolean; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const firstName = (member.name || member.email).split(" ").slice(-1)[0];

  if (!editable) {
    return (
      <div className="flex flex-nowrap items-center gap-1.5">
        <RoleChip role={member.roleLabel} />
        {member.unlimited && member.role !== "owner" && <Chip bg="#DDF0E4" fg="#1F5C38" border="#A8D5B8">∞ Korlátlan</Chip>}
      </div>
    );
  }

  async function send(body: Record<string, unknown>, okText: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/office/members", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.userId, action: "permissions", ...body }),
      });
      const d = await res.json();
      if (!res.ok) { showToast(d.error ?? "Nem sikerült.", "error"); return; }
      showToast(okText, "success");
      onDone();
    } catch {
      showToast("Hálózati hiba.", "error");
    } finally {
      setBusy(false);
    }
  }

  function setManager(v: boolean) {
    if (v === member.canAllocate || busy) return;
    void send({ canAllocate: v }, v ? `${firstName} vezető lett — kioszthat kreditet.` : `${firstName} újra tag.`);
  }

  function toggleUnlimited() {
    if (busy) return;
    const v = !member.unlimited;
    if (v && member.allowance > 0 && !window.confirm(`${firstName} korlátlan lesz: a szabad részből dolgozik, a maradék ${member.allowance} kredites kerete visszakerül az irodához. Folytatod?`)) return;
    void send({ unlimited: v }, v ? `${firstName} korlátlan lett.` : `${firstName} már nem korlátlan — keretből dolgozik.`);
  }

  return (
    <div className="flex flex-nowrap items-center gap-1.5" aria-busy={busy}>
      <div className="inline-grid grid-cols-2 rounded-full p-[2px]" style={{ background: "#F1EAE1" }} role="group" aria-label="Szerep">
        {([["member", "Tag"], ["manager", "Vezető"]] as const).map(([key, label]) => {
          const on = key === "manager" ? member.canAllocate : !member.canAllocate;
          return (
            <button key={key} type="button" disabled={busy} aria-pressed={on} onClick={() => setManager(key === "manager")}
              title={key === "manager" ? "Vezető: kioszthat kreditet a kollégáknak, látja az egyenleget" : "Tag: a saját keretéből dolgozik"}
              className="h-6 rounded-full px-2.5 text-[11px] font-semibold transition-colors disabled:opacity-60"
              style={on
                ? (key === "manager" ? { background: "#DCE8F5", color: "#24476B" } : { background: "#fff", color: "#1C1A17", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" })
                : { color: "#6B6258" }}>
              {label}
            </button>
          );
        })}
      </div>
      <button type="button" disabled={busy} aria-pressed={member.unlimited} onClick={toggleUnlimited}
        title={member.unlimited ? "Korlátlan — kattints a kikapcsoláshoz" : "Korlátlanná tétel: kérés nélkül dolgozhat a szabad részből"}
        aria-label={member.unlimited ? "Korlátlan — kikapcsolás" : "Korlátlanná tétel"}
        className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[13px] font-bold leading-none transition-colors disabled:opacity-60"
        style={member.unlimited
          ? { background: "#1F7A4D", color: "#fff", border: "1px solid #1F7A4D", boxShadow: "0 0 0 3px rgba(31,122,77,0.18)" }
          : { background: "#fff", color: "#8F857B", border: "1px dashed #D5C8B9" }}>
        ∞
      </button>
    </div>
  );
}

// Eltávolítás (CSAK a létrehozó) — a kinyitott sorban, hogy ne lehessen véletlenül megnyomni.
function RemovePanel({ member, onDone }: { member: MemberStat; onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm(`Biztosan eltávolítod ${member.name || member.email} tagot az irodából? A fel nem használt kerete visszakerül az irodához.`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/office/members", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.userId, action: "remove" }),
      });
      const d = await res.json();
      if (!res.ok) { showToast(d.error ?? "Nem sikerült.", "error"); return; }
      showToast("Tag eltávolítva.", "success");
      onDone();
    } catch {
      showToast("Hálózati hiba.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-xs" style={{ background: "#fff", border: "1px solid #EFE7DD" }}>
      <span style={{ color: "#6B6258" }}>A státuszt (Tag / Vezető / Korlátlan) a sorban egy kattintással állíthatod.</span>
      <button type="button" onClick={remove} disabled={busy} className="flex-none font-semibold underline disabled:opacity-50" style={{ color: "#B3261E" }}>
        Eltávolítás
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
function RoleChip({ role }: { role: "owner" | "manager" | "member" }) {
  const c = role === "owner" ? { bg: "#FBE1D6", fg: "#A8411F" } : role === "manager" ? { bg: "#DCE8F5", fg: "#24476B" } : { bg: "#F1EAE1", fg: "#4A433C" };
  return <Chip bg={c.bg} fg={c.fg}>{ROLE_TEXT[role]}</Chip>;
}

function Chip({ children, bg, fg, border }: { children: React.ReactNode; bg: string; fg: string; border?: string }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-semibold"
      style={{ background: bg, color: fg, border: border ? `1px solid ${border}` : undefined }}>
      {children}
    </span>
  );
}

function IconBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className="flex h-[30px] w-[30px] items-center justify-center rounded-lg text-base"
      style={{ background: "#fff", color: "#3A342E", border: "1px solid #E1D6C9" }}>
      {children}
    </button>
  );
}

function isJoinedToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
