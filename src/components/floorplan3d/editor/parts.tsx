// A 3D-alaprajz modul közös felületi elemei (a javító szerkesztő és a stúdió is használja): színek, formázás, számmező,
// állapotcímke, összevont m²-ellenőrzés, csúszka. (2026-10-16: a Floorplan3dStudio.tsx-ből kiemelve, változatlan viselkedéssel.)
"use client";

import { useEffect, useState } from "react";
import type { AreaGroup, FloorPlan, Room } from "@/lib/floorplan3d/plan";
import { groupOf, type GroupCheck, type RoomCheck } from "@/lib/floorplan3d/geometry";

export const MUTED = "var(--twx-ink-muted)";
export const STATUS_TEXT: Record<RoomCheck["status"], { t: string; c: string; bg: string }> = {
  ok: { t: "Rendben", c: "#2f7a4f", bg: "rgba(47,158,95,0.12)" },
  deviation: { t: "Eltérés", c: "#C2522D", bg: "rgba(227,104,63,0.12)" },
  approved: { t: "Jóváhagyva", c: "#9A7020", bg: "rgba(214,165,58,0.16)" },
  missing: { t: "Hiányzó m²", c: "#6E655C", bg: "rgba(110,101,92,0.12)" },
};

export const fmt = (n: number, d = 2) => n.toLocaleString("hu-HU", { minimumFractionDigits: d, maximumFractionDigits: d });
export const parseNum = (s: string) => Number(s.replace(/\s/g, "").replace(",", "."));

/** Szám-mező: gépelés közben szabad szöveg, Enterre / elhagyáskor érvényesül; hibás értéknél visszaáll. */
export function NumField({ value, onCommit, suffix, width = 78, placeholder, allowZero = false }: { value: number | null; onCommit: (v: number | null) => boolean | void; suffix?: string; width?: number; placeholder?: string; allowZero?: boolean }) {
  const shown = value === null ? "" : fmt(value);
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);
  // a MEZŐ aktuális tartalmát olvassuk (nem a draft állapotot): gyors gépelés + azonnali elhagyás után a state még késhet
  function commit(text: string) {
    if (text.trim() === "") { if (onCommit(null) === false) setDraft(shown); return; }
    const v = parseNum(text);
    if (!Number.isFinite(v) || (allowZero ? v < 0 : v <= 0) || onCommit(Math.round(v * 100) / 100) === false) setDraft(shown);
  }
  return (
    <span className="inline-flex items-center gap-1">
      <input value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={(e) => commit(e.currentTarget.value)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        inputMode="decimal" placeholder={placeholder} className="h-8 rounded-lg px-2 text-right text-[13px] outline-none focus:border-[var(--twx-coral)]"
        style={{ width, border: "1px solid var(--twx-line)", background: "#fff" }} />
      {suffix && <span className="text-xs" style={{ color: MUTED }}>{suffix}</span>}
    </span>
  );
}


export function StatusPill({ status }: { status: RoomCheck["status"] }) {
  const s = STATUS_TEXT[status];
  return <span className="inline-flex h-6 flex-none items-center rounded-full px-2.5 text-[11px] font-bold" style={{ color: s.c, background: s.bg }}>{s.t}</span>;
}

/** Összevont ellenőrzés: ha a forrás több helyiséget együtt ad meg (pl. „Hálószoba 34,11 m²" három szobára). */
export function GroupBlock({ room, group, groupCheck, plan, checks, tolerancePct, onToggleMember, onLeave, onPatch }: {
  room: Room; group: AreaGroup | null; groupCheck: GroupCheck | null; plan: FloorPlan; checks: Map<string, RoomCheck>; tolerancePct: number;
  onToggleMember: (otherId: string) => void; onLeave: () => void; onPatch: (groupId: string, p: Partial<Pick<AreaGroup, "label" | "declaredArea" | "approved">>) => void;
}) {
  const [picking, setPicking] = useState(false);
  const others = plan.rooms.filter((r) => r.id !== room.id);
  const picker = (
    <div className="mt-2 max-h-[148px] overflow-y-auto rounded-lg" style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
      {others.map((r) => {
        const inMine = !!group?.roomIds.includes(r.id);
        const elsewhere = !inMine && !!groupOf(plan, r.id);
        return (
          <label key={r.id} className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[12.5px]" style={{ borderBottom: "1px solid var(--twx-line)" }}>
            <input type="checkbox" checked={inMine} onChange={() => onToggleMember(r.id)} style={{ accentColor: "var(--twx-coral)" }} />
            <span className="min-w-0 flex-1 truncate">{r.name}</span>
            <span className="text-[11px]" style={{ color: MUTED }}>{fmt(checks.get(r.id)?.area ?? 0)} m²{elsewhere ? " · másik csoportban" : ""}</span>
          </label>
        );
      })}
    </div>
  );

  if (!group) {
    return (
      <div className="mt-3 rounded-xl p-3 text-[12.5px]" style={{ background: "#fff", border: "1px dashed var(--twx-line)" }}>
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1" style={{ color: MUTED }}>A forrás több helyiséget együtt ad meg (pl. „Hálószoba 34,11 m²”)?</span>
          <button type="button" onClick={() => setPicking((v) => !v)} className="h-7 flex-none rounded-full px-3 text-[12px] font-semibold"
            style={{ border: "1px solid var(--twx-line)", background: picking ? "var(--twx-line)" : "#fff" }}>Összevonás…</button>
        </div>
        {picking && picker}
      </div>
    );
  }
  const st = groupCheck?.status ?? "missing";
  return (
    <div className="mt-3 rounded-xl p-3 text-[12.5px]" style={{ background: STATUS_TEXT[st].bg }}>
      <div className="flex items-center gap-2">
        <span className="font-bold">Összevont ellenőrzés</span>
        <span className="ml-auto"><StatusPill status={st} /></span>
      </div>
      <div className="mt-2 grid grid-cols-[72px_1fr] items-center gap-x-2 gap-y-2">
        <span className="font-semibold">Felirat</span>
        <input value={group.label} onChange={(e) => onPatch(group.id, { label: e.target.value.slice(0, 60) })} className="h-8 rounded-lg px-2 text-[13px] outline-none"
          style={{ border: "1px solid var(--twx-line)", background: "#fff" }} />
        <span className="font-semibold">Közös m²</span>
        <span className="flex items-center gap-2">
          <NumField value={group.declaredArea} suffix="m²" placeholder="kötelező" onCommit={(v) => onPatch(group.id, { declaredArea: v, approved: false })} />
          <span className="text-xs" style={{ color: MUTED }}>tagok összesen: {fmt(groupCheck?.area ?? 0)}</span>
        </span>
      </div>
      <p className="mt-2" style={{ color: MUTED }}>Tagok: {group.roomIds.map((id) => plan.rooms.find((r) => r.id === id)?.name ?? "?").join(", ")}</p>
      {(st === "deviation" || st === "approved") && (
        <label className="mt-2 flex cursor-pointer items-center gap-2 font-semibold">
          <input type="checkbox" checked={!!group.approved} onChange={(e) => onPatch(group.id, { approved: e.target.checked })} style={{ accentColor: "var(--twx-coral)" }} />
          Tudatosan jóváhagyom az eltérést ({groupCheck!.diffPct! > 0 ? "+" : ""}{fmt(groupCheck!.diffPct!, 1)}%, tűrés ±{fmt(tolerancePct, 0)}%)
        </label>
      )}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => setPicking((v) => !v)} className="h-7 rounded-full px-3 text-[12px] font-semibold" style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
          {picking ? "Kész" : "Tagok módosítása"}
        </button>
        <button type="button" onClick={onLeave} className="h-7 rounded-full px-3 text-[12px] font-semibold" style={{ color: MUTED }}>Ez a helyiség kilép</button>
      </div>
      {picking && picker}
    </div>
  );
}

/** Csúszka (1 cm-es lépés): húzás közben `onLive` (a terv azonnal frissül), elengedéskor `onCommit` (egy visszavonható lépés).
 *  A fogantyú billentyűvel (←/→) is mozgatható. unit: „cm" egész centiben, „m" két tizedessel mutatja az értéket. */
export function Slider({ label, value, min, max, unit = "cm", onLive, onCommit, step = 0.01 }: {
  label: string; value: number; min: number; max: number; unit?: "cm" | "m"; step?: number;
  onLive: (v: number) => void; onCommit: () => void;
}) {
  const show = (v: number) => (unit === "cm" ? `${Math.round(v * 100)} cm` : `${fmt(v)} m`);
  const lo = Math.min(min, value), hi = Math.max(max, value);
  const pct = hi > lo ? ((value - lo) / (hi - lo)) * 100 : 0;
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between text-[11.5px] font-bold" style={{ color: MUTED }}>
        <span>{label}</span><b className="font-display text-[14px]" style={{ color: "var(--twx-ink)" }}>{show(value)}</b>
      </span>
      <input type="range" className="twx-range" min={lo} max={hi} step={step} value={value} aria-label={label}
        style={{ ["--p" as string]: `${pct.toFixed(1)}%` }}
        onChange={(e) => onLive(Math.round(Number(e.target.value) * 100) / 100)}
        onPointerUp={onCommit} onKeyUp={onCommit} onBlur={onCommit} />
      <span className="flex justify-between text-[10px]" style={{ color: "#A99D90" }}><span>{show(lo)}</span><span>{show(hi)}</span></span>
    </label>
  );
}
