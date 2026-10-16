// Inspector — a javító szerkesztő jobb oldali panelje (2026-10-16). Nyugodt áttekintő: helyiséglista (+ belmagasság) →
// helyiség (név, típus, valós m², eltérés jóváhagyása, összevont csoport, falak, nyílászárók) → fal (hossz csúszkával, nyitott / zárt,
// + ajtó / ablak) → sarokpont (törlés) → oszlop (méret csúszkával). A nyílászáró részletei a felugró kártyán vannak (itt csak kiemelve).
"use client";

import type { FloorPlan, Room, RoomKind } from "@/lib/floorplan3d/plan";
import { ROOM_KINDS } from "@/lib/floorplan3d/plan";
import { groupOf, leaveGroup, patchGroup, roomEdge, setWallLength, toggleGroupMember, type PlanCheck, type RoomCheck } from "@/lib/floorplan3d/geometry";
import { deleteVertex, patchColumn, removeColumn, typeOf } from "@/lib/floorplan3d/edit";
import SelectField from "@/components/SelectField";
import { GroupBlock, MUTED, NumField, STATUS_TEXT, Slider, StatusPill, fmt } from "@/components/floorplan3d/editor/parts";
import type { History, Selection, Tool } from "@/components/floorplan3d/editor/state";
import { TypeGlyph } from "@/components/floorplan3d/editor/OpeningCard";

const H = "mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-wide";
const TYPE_T = { door: "Ajtó", glassdoor: "Üvegajtó", window: "Ablak", passage: "Átjáró" } as const;

export default function Inspector({ plan, check, checks, sel, onSelect, history, tolerancePct, onTool }: {
  plan: FloorPlan; check: PlanCheck; checks: Map<string, RoomCheck>; sel: Selection; onSelect: (s: Selection) => void;
  history: History; tolerancePct: number; onTool: (t: Tool) => void;
}) {
  const patchRoom = (id: string, p: Partial<Room>) => history.commit({ ...plan, rooms: plan.rooms.map((r) => (r.id === id ? { ...r, ...p } : r)) });

  // ---------------- semmi kijelölve: helyiséglista ----------------
  if (!sel) {
    return (
      <>
        <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--twx-line)" }}>
          <p className="text-[15px] font-bold">Helyiségek ({plan.rooms.length})</p>
          <p className="text-[12px]" style={{ color: MUTED }}>Kattints egy helyiségre, falra vagy nyílászáróra — a 2D-ben vagy a 3D-ben.</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {plan.rooms.map((r) => {
            const c = checks.get(r.id)!;
            return (
              <button key={r.id} type="button" onClick={() => onSelect({ type: "room", roomId: r.id })}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[rgba(239,122,90,0.06)]" style={{ borderBottom: "1px solid var(--twx-line)" }}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">{r.name}</span>
                  <span className="block text-[11.5px]" style={{ color: MUTED }}>
                    {fmt(c.area)}{c.declared ? ` / ${fmt(c.declared)}` : ""} m²{c.diffPct !== null ? ` · ${c.diffPct > 0 ? "+" : ""}${fmt(c.diffPct, 1)}%` : ""}
                  </span>
                </span>
                <StatusPill status={c.status} />
              </button>
            );
          })}
          <p className={`${H} px-4`} style={{ color: MUTED }}>Jelmagyarázat</p>
          <p className="px-4 pb-4 text-[11.5px] leading-[1.7]" style={{ color: MUTED }}>
            ▬ fal · ┄ nyitott határ (fal nélkül; a szomszéd oldalán is)<br />◜ ajtó a nyitás irányával · <span style={{ color: "#2F7F86" }}>◜</span> üvegajtó · ≡ ablak · ┆ átjáró · ▮ oszlop<br />
            Dupla kattintás a falon: új sarokpont · Ctrl+Z: visszavonás
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderTop: "1px solid var(--twx-line)" }}>
          <span className="flex-1 text-[13px] font-semibold">Belmagasság</span>
          <NumField value={plan.ceilingHeight} suffix="m" onCommit={(v) => { if (v === null || v < 2 || v > 5) return false; history.commit({ ...plan, ceilingHeight: v, openings: plan.openings.map((o) => (o.kind === "passage" ? { ...o, height: v } : o)) }); }} />
        </div>
      </>
    );
  }

  // ---------------- oszlop ----------------
  if (sel.type === "column") {
    const c = (plan.columns ?? []).find((x) => x.id === sel.id);
    if (!c) return null;
    return (
      <>
        <PanelHead title="Tartóoszlop" sub={`${Math.round(c.w * 100)} × ${Math.round(c.d * 100)} cm · teljes belmagasság`} onBack={() => onSelect(null)} />
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="flex flex-col gap-3">
            <Slider label="Szélesség" value={c.w} min={0.1} max={1.2} onLive={(v) => { history.begin(); history.live(patchColumn(plan, c.id, { w: v }, false)); }} onCommit={history.end} />
            <Slider label="Mélység" value={c.d} min={0.1} max={1.2} onLive={(v) => { history.begin(); history.live(patchColumn(plan, c.id, { d: v }, false)); }} onCommit={history.end} />
          </div>
          <p className="mt-3 text-[12px] leading-relaxed" style={{ color: MUTED }}>Húzd a 2D-ben — ha egy oldala 4 cm-en belül van egy faltól, a falhoz simul. A bejárásban akadály; a méretellenőrzést nem befolyásolja.</p>
          <button type="button" onClick={() => { history.commit(removeColumn(plan, c.id)); onSelect(null); }} className="mt-4 h-9 w-full rounded-full text-[12.5px] font-bold" style={{ background: "rgba(179,38,30,.08)", color: "#B3261E" }}>Oszlop törlése (Delete)</button>
        </div>
      </>
    );
  }

  const roomId = sel.type === "opening" ? plan.openings.find((o) => o.id === sel.id)?.roomId : sel.roomId;
  const room = plan.rooms.find((r) => r.id === roomId);
  if (!room) return null;
  const c = checks.get(room.id)!;

  // ---------------- fal ----------------
  if (sel.type === "edge") {
    const e = roomEdge(room, sel.edge), open = (room.openEdges ?? []).includes(sel.edge);
    const ops = plan.openings.filter((o) => o.roomId === room.id && o.edge === sel.edge);
    return (
      <>
        <PanelHead title={`${sel.edge + 1}. fal · ${room.name}`} sub={open ? "Nyitott határ — itt a 3D-ben nincs fal" : e.axis ? "A 2D-ben ki-be húzható (a szomszéd fal vele mozog)" : "Ferde fal — a sarokpontjait húzd"} onBack={() => onSelect({ type: "room", roomId: room.id })} back={room.name} />
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {e.axis ? (
            <Slider label="Falhossz" unit="m" value={Math.round(e.length * 100) / 100} min={Math.max(0.3, Math.round((e.length - 1.5) * 10) / 10)} max={Math.round((e.length + 1.5) * 10) / 10}
              onLive={(v) => { const r = setWallLength(plan, room.id, sel.edge, v); if (r.ok) { history.begin(); history.live(r.plan); } }} onCommit={history.end} />
          ) : <p className="text-[13px]">Hossz: <b>{fmt(e.length)} m</b> <span style={{ color: MUTED }}>(ferde fal)</span></p>}
          <p className="mt-1.5 text-[11.5px] leading-snug" style={{ color: MUTED }}>A csúszka a fal végét tolja (a mögötte lévő rész vele együtt mozdul). Pontos szám: kattints a csúszkára, és ←/→ = 1 cm.</p>
          <p className={H} style={{ color: MUTED }}>Határ</p>
          <div className="grid grid-cols-2 gap-1 rounded-full p-1" style={{ background: "#F1EAE1" }}>
            {([[false, "Fal"], [true, "Nyitott (fal nélkül)"]] as const).map(([v, t]) => (
              <button key={t} type="button" aria-pressed={open === v} className="h-8 rounded-full text-[12px] font-semibold" style={open === v ? { background: "#12100e", color: "#fff" } : undefined}
                onClick={() => {
                  const set = new Set(room.openEdges ?? []); if (v) set.add(sel.edge); else set.delete(sel.edge);
                  history.commit({ ...plan, rooms: plan.rooms.map((r) => (r.id === room.id ? { ...r, openEdges: [...set].sort((a, b) => a - b) } : r)), openings: v ? plan.openings.filter((o) => !(o.roomId === room.id && o.edge === sel.edge)) : plan.openings });
                }}>{t}</button>
            ))}
          </div>
          <p className={H} style={{ color: MUTED }}>Nyílászárók ezen a falon</p>
          {ops.length ? ops.map((o) => (
            <button key={o.id} type="button" onClick={() => onSelect({ type: "opening", id: o.id })} className="flex h-10 w-full items-center gap-2 rounded-xl px-2.5 text-left text-[13px] hover:bg-[#F8F3EC]">
              <TypeGlyph t={typeOf(o)} size={22} /><span className="flex-1">{TYPE_T[typeOf(o)]} {Math.round(o.width * 100)}{o.kind !== "passage" ? `×${Math.round(o.height * 100)}` : " cm"}</span>
            </button>
          )) : <p className="text-[12.5px]" style={{ color: MUTED }}>Nincs.</p>}
          {!open && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onTool("door")} className="h-9 rounded-full text-[12.5px] font-bold text-white" style={{ background: "#12100e" }}>＋ Ajtó</button>
              <button type="button" onClick={() => onTool("window")} className="h-9 rounded-full text-[12.5px] font-bold text-white" style={{ background: "#12100e" }}>＋ Ablak</button>
            </div>
          )}
        </div>
      </>
    );
  }

  // ---------------- sarokpont ----------------
  if (sel.type === "vertex") {
    const p = room.polygon[sel.index];
    const canDelete = room.polygon.length > 3;
    return (
      <>
        <PanelHead title={`Sarokpont · ${room.name}`} sub={p ? `x ${fmt(p[0])} m · y ${fmt(p[1])} m` : ""} onBack={() => onSelect({ type: "room", roomId: room.id })} back={room.name} />
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <p className="text-[12.5px] leading-relaxed" style={{ color: MUTED }}>
            Húzd a pontot a 2D-ben — más pontok vonalához illeszkedik (türkiz vezetővonal). Új pont: <b>dupla kattintás a falon</b> (pl. akna kivágásához vagy ferde falhoz).
          </p>
          <button type="button" disabled={!canDelete} title={canDelete ? "A két szomszédos fal egybeolvad" : "Egy helyiségnek legalább 3 sarka van"}
            onClick={() => { const n = deleteVertex(plan, room.id, sel.index); if (n) { history.commit(n); onSelect({ type: "room", roomId: room.id }); } }}
            className="mt-4 h-9 w-full rounded-full text-[12.5px] font-bold disabled:cursor-not-allowed disabled:opacity-40" style={{ background: "rgba(179,38,30,.08)", color: "#B3261E" }}>Pont törlése (Delete)</button>
        </div>
      </>
    );
  }

  // ---------------- helyiség (nyílászáró kijelölésekor is — kiemelve) ----------------
  const group = groupOf(plan, room.id);
  const hiOp = sel.type === "opening" ? sel.id : null;
  const ops = plan.openings.filter((o) => o.roomId === room.id);
  return (
    <>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--twx-line)" }}>
        <button type="button" onClick={() => onSelect(null)} className="flex h-8 w-8 flex-none items-center justify-center rounded-full" style={{ background: "var(--twx-line)" }} aria-label="Vissza a listához">←</button>
        <p className="min-w-0 flex-1 truncate text-[15px] font-bold">{room.name || "Névtelen helyiség"}</p>
        <StatusPill status={c.status} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="grid grid-cols-[84px_1fr] items-center gap-x-3 gap-y-2.5 text-[13px]">
          <span className="font-semibold">Név</span>
          <input value={room.name} onFocus={history.begin} onBlur={history.end}
            onChange={(e) => { history.begin(); history.live({ ...plan, rooms: plan.rooms.map((r) => (r.id === room.id ? { ...r, name: e.target.value.slice(0, 60) } : r)) }); }} className="h-8 rounded-lg px-2 text-[13px] outline-none" style={{ border: "1px solid var(--twx-line)", background: "#fff" }} />
          <span className="font-semibold">Típus</span>
          <SelectField size="sm" value={room.kind} onChange={(v) => patchRoom(room.id, { kind: v as RoomKind })} options={ROOM_KINDS.map((k) => ({ value: k.value, label: k.label }))} ariaLabel="Helyiségtípus" />
          <span className="font-semibold">Valós m²</span>
          <span className="flex items-center gap-2">
            {group ? <span className="text-xs" style={{ color: MUTED }}>a csoport m²-e számít · saját: {fmt(c.area)}</span>
              : <><NumField value={room.declaredArea} suffix="m²" placeholder="kötelező" onCommit={(v) => patchRoom(room.id, { declaredArea: v, areaApproved: false })} /><span className="text-xs" style={{ color: MUTED }}>számolt: {fmt(c.area)}</span></>}
          </span>
        </div>
        <GroupBlock room={room} group={group} groupCheck={check.groups.find((g) => g.groupId === c.groupId) ?? null} plan={plan} checks={checks} tolerancePct={tolerancePct}
          onToggleMember={(other) => history.commit(toggleGroupMember(plan, room.id, other))} onLeave={() => history.commit(leaveGroup(plan, room.id))}
          onPatch={(gid, p) => history.commit(patchGroup(plan, gid, p))} />
        {!group && (c.status === "deviation" || c.status === "approved") && (
          <div className="mt-3 rounded-xl p-3 text-[12.5px]" style={{ background: STATUS_TEXT[c.status].bg }}>
            <p>A számolt terület <b>{c.diffPct! > 0 ? "+" : ""}{fmt(c.diffPct!, 1)}%</b>-kal tér el a megadottól (tűrés ±{fmt(tolerancePct, 0)}%). Húzd a falat vagy a sarokpontot, vagy hagyd jóvá tudatosan.</p>
            <label className="mt-2 flex cursor-pointer items-center gap-2 font-semibold">
              <input type="checkbox" checked={!!room.areaApproved} onChange={(e) => patchRoom(room.id, { areaApproved: e.target.checked })} style={{ accentColor: "var(--twx-coral)" }} />
              Tudatosan jóváhagyom az eltérést
            </label>
          </div>
        )}
        {!group && c.status === "missing" && <p className="mt-3 rounded-xl p-3 text-[12.5px]" style={{ background: STATUS_TEXT.missing.bg }}>Add meg a helyiség valós m²-ét (pl. az alaprajzról) — ezzel ellenőrizzük a méreteket.</p>}

        <p className={H} style={{ color: MUTED }}>Falak</p>
        {room.polygon.map((_, i) => {
          const e = roomEdge(room, i), open = (room.openEdges ?? []).includes(i);
          return (
            <button key={i} type="button" onClick={() => onSelect({ type: "edge", roomId: room.id, edge: i })} className="flex h-9 w-full items-center gap-2 rounded-xl px-2.5 text-left text-[13px] hover:bg-[#F8F3EC]">
              <span className="flex h-[22px] w-[22px] items-center justify-center rounded-md text-[11px] font-bold" style={{ background: "#F1EAE1" }}>{i + 1}</span>
              <span className="flex-1">{open ? "Nyitott határ" : e.axis ? "Fal" : "Ferde fal"}</span><b>{fmt(e.length)} m</b>
            </button>
          );
        })}
        <p className={H} style={{ color: MUTED }}>Nyílászárók</p>
        {ops.length ? ops.map((o) => (
          <button key={o.id} type="button" onClick={() => onSelect({ type: "opening", id: o.id })} className="flex h-10 w-full items-center gap-2 rounded-xl px-2.5 text-left text-[13px] hover:bg-[#F8F3EC]"
            style={hiOp === o.id ? { background: "#FBE1D6" } : undefined}>
            <TypeGlyph t={typeOf(o)} size={22} /><span className="flex-1">{TYPE_T[typeOf(o)]} {Math.round(o.width * 100)}{o.kind !== "passage" ? `×${Math.round(o.height * 100)}` : " cm"}</span>
            <span className="text-[11.5px]" style={{ color: MUTED }}>{o.edge + 1}. fal</span>
          </button>
        )) : <p className="text-[12.5px]" style={{ color: MUTED }}>Nincs nyílászáró — válaszd a „+ Ajtó” / „+ Ablak” eszközt.</p>}
        {hiOp && <p className="mt-3 rounded-xl px-3 py-2 text-[12px]" style={{ background: "#F6F1EA", color: "#4A433C" }}>A kijelölt nyílászáró beállításai a rajzon, mellette, a kis ablakban vannak.</p>}
      </div>
    </>
  );
}

function PanelHead({ title, sub, onBack, back }: { title: string; sub: string; onBack: () => void; back?: string }) {
  return (
    <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--twx-line)" }}>
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-[15px] font-bold">{title}</p>
        <button type="button" onClick={onBack} className="h-7 flex-none rounded-full px-3 text-[12px] font-semibold" style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>‹ {back ?? "Lista"}</button>
      </div>
      <p className="mt-0.5 text-[12px]" style={{ color: MUTED }}>{sub}</p>
    </div>
  );
}
