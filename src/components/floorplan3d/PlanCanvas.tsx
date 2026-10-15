// PlanCanvas — a digitalizált lakásleírás ábrája (SVG, méterben). Kattintás: helyiség / fal / nyílászáró kiválasztása.
// Nyílászáró: húzással a falán mozgatható (a közepe a fal mentén követi az egeret); a kijelöltnél a két sarokig mért távolság
// látszik. Figyelmeztetéses nyílászáró (kilóg, ütközik, sarokhoz közel): sárga keret.
// Színek: zöld = rendben, korall = eltérés, homok = jóváhagyott eltérés, szürke = hiányzó m². Nyitott határ: szaggatott.
// Az eredeti rajz (kép) a terv alá tehető, a digitalizálás léptékével — így szemmel ellenőrizhető az illeszkedés.
"use client";

import { useMemo, useRef, type PointerEvent as RPointerEvent } from "react";
import type { FloorPlan } from "@/lib/floorplan3d/plan";
import { openingGaps, openingSegment, planBounds, roomEdge, type RoomCheck } from "@/lib/floorplan3d/geometry";

export type Underlay = { url: string; metersPerPixel: number; size: [number, number]; offset: [number, number] } | null;

const STATUS_FILL: Record<RoomCheck["status"], string> = {
  ok: "rgba(47,158,95,0.16)", deviation: "rgba(227,104,63,0.20)", approved: "rgba(214,165,58,0.20)", missing: "rgba(110,101,92,0.14)",
};
const STATUS_STROKE: Record<RoomCheck["status"], string> = { ok: "#2f9e5f", deviation: "#E3683F", approved: "#C0902B", missing: "#8F857B" };

export default function PlanCanvas({ plan, checks, selectedRoom, selectedEdge, onSelectRoom, onSelectEdge, underlay, showUnderlay,
  selectedOpening, warned, onSelectOpening, onMoveOpening }: {
  plan: FloorPlan;
  checks: Map<string, RoomCheck>;
  selectedRoom: string | null;
  selectedEdge: number | null;
  onSelectRoom: (id: string | null) => void;
  onSelectEdge: (edge: number) => void;
  underlay: Underlay;
  showUnderlay: boolean;
  selectedOpening: string | null;
  /** figyelmeztetéses nyílászárók azonosítói */
  warned: Set<string>;
  onSelectOpening: (id: string) => void;
  onMoveOpening: (id: string, offset: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; grab: number } | null>(null);

  /** Képernyőpont → terv-koordináta (méter). */
  const toPlan = (e: RPointerEvent): [number, number] | null => {
    const svg = svgRef.current, m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  };
  /** A pont vetülete a nyílászáró falára: távolság a fal elejétől. */
  const along = (openingId: string, p: [number, number]): number | null => {
    const o = plan.openings.find((x) => x.id === openingId);
    const r = o && plan.rooms.find((x) => x.id === o.roomId);
    if (!o || !r) return null;
    const e = roomEdge(r, o.edge), len = e.length || 1;
    return ((p[0] - e.a[0]) * (e.b[0] - e.a[0]) + (p[1] - e.a[1]) * (e.b[1] - e.a[1])) / len;
  };
  const startDrag = (e: RPointerEvent, id: string) => {
    e.stopPropagation();
    onSelectOpening(id);
    const p = toPlan(e), a = p && along(id, p), o = plan.openings.find((x) => x.id === id);
    if (a === null || !o) return;
    drag.current = { id, grab: a - o.offset }; // ahol megfogta, ott maradjon a keze alatt
    svgRef.current?.setPointerCapture(e.pointerId);
  };
  const moveDrag = (e: RPointerEvent) => {
    if (!drag.current) return;
    const p = toPlan(e), a = p && along(drag.current.id, p);
    if (a !== null && a !== undefined) onMoveOpening(drag.current.id, Math.round((a - drag.current.grab) * 100) / 100); // cm-es lépésben
  };
  const endDrag = (e: RPointerEvent) => {
    if (!drag.current) return;
    drag.current = null;
    svgRef.current?.releasePointerCapture(e.pointerId);
  };

  const b = useMemo(() => planBounds(plan), [plan]);
  const pad = 0.9;
  const vb = `${b.minX - pad} ${b.minY - pad} ${b.maxX - b.minX + pad * 2} ${b.maxY - b.minY + pad * 2}`;
  const sel = plan.rooms.find((r) => r.id === selectedRoom) ?? null;
  // keskeny helyiségnél (< 1,6 m) a falhossz-címkék kívülre kerülnek, hogy ne takarják egymást és a nevet
  const selNarrow = sel ? (() => { const s = planBounds({ ...plan, rooms: [sel] }); return Math.min(s.maxX - s.minX, s.maxY - s.minY) < 1.6; })() : false;

  return (
    <svg ref={svgRef} viewBox={vb} className="h-full w-full select-none touch-none" onClick={() => onSelectRoom(null)} role="img" aria-label="Digitalizált alaprajz"
      onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
      {underlay && showUnderlay && (
        <image href={underlay.url} x={-underlay.offset[0]} y={-underlay.offset[1]}
          width={underlay.size[0] * underlay.metersPerPixel} height={underlay.size[1] * underlay.metersPerPixel} opacity={0.45} preserveAspectRatio="none" />
      )}

      {/* helyiségek */}
      {plan.rooms.map((r) => {
        const c = checks.get(r.id);
        const st = c?.status ?? "missing";
        const isSel = r.id === selectedRoom;
        const cx = r.polygon.reduce((s, p) => s + p[0], 0) / r.polygon.length;
        const cy = r.polygon.reduce((s, p) => s + p[1], 0) / r.polygon.length;
        return (
          <g key={r.id} onClick={(e) => { e.stopPropagation(); onSelectRoom(r.id); }} className="cursor-pointer">
            <polygon points={r.polygon.map((p) => p.join(",")).join(" ")} fill={STATUS_FILL[st]}
              stroke={isSel ? "#12100e" : STATUS_STROKE[st]} strokeWidth={isSel ? 0.06 : 0.035} strokeLinejoin="round" />
            {/* nyitott határ: a fal helyén szaggatott vonal */}
            {(r.openEdges ?? []).map((i) => {
              const e = roomEdge(r, i);
              return <line key={i} x1={e.a[0]} y1={e.a[1]} x2={e.b[0]} y2={e.b[1]} stroke="#FBF8F3" strokeWidth={0.07} strokeDasharray="0.15 0.1" />;
            })}
            <text x={cx} y={cy - 0.12} textAnchor="middle" fontSize={0.32} fontWeight={700} fill="#1C1A17" style={{ pointerEvents: "none" }}>{r.name}</text>
            <text x={cx} y={cy + 0.28} textAnchor="middle" fontSize={0.26} fill="#4F4741" style={{ pointerEvents: "none" }}>
              {c ? `${c.area.toLocaleString("hu-HU")} m²` : ""}{c?.declared ? ` / ${c.declared.toLocaleString("hu-HU")}` : ""}
            </text>
          </g>
        );
      })}

      {/* nyílászárók */}
      {plan.openings.map((o) => {
        const r = plan.rooms.find((x) => x.id === o.roomId);
        if (!r) return null;
        const s = openingSegment(r, o);
        const isSel = o.id === selectedOpening, warn = warned.has(o.id);
        return (
          <g key={o.id} className="cursor-grab active:cursor-grabbing" onPointerDown={(e) => startDrag(e, o.id)} onClick={(e) => e.stopPropagation()}>
            <line x1={s.a[0]} y1={s.a[1]} x2={s.b[0]} y2={s.b[1]} stroke="transparent" strokeWidth={0.4} />
            {(isSel || warn) && <line x1={s.a[0]} y1={s.a[1]} x2={s.b[0]} y2={s.b[1]} stroke={isSel ? "#E3683F" : "#E0A526"} strokeWidth={0.26} strokeLinecap="round" opacity={0.85} />}
            <line x1={s.a[0]} y1={s.a[1]} x2={s.b[0]} y2={s.b[1]} stroke="#FBF8F3" strokeWidth={0.16} />
            <line x1={s.a[0]} y1={s.a[1]} x2={s.b[0]} y2={s.b[1]} stroke={o.kind === "door" ? "#2F7F86" : "#3B6FD6"}
              strokeWidth={o.kind === "door" ? 0.1 : 0.06} strokeDasharray={o.kind === "window" ? "0.08 0.05" : undefined} />
          </g>
        );
      })}

      {/* kijelölt nyílászáró: távolság a két saroktól (méretvonal a helyiség belseje felé) */}
      {(() => {
        const o = plan.openings.find((x) => x.id === selectedOpening);
        const r = o && plan.rooms.find((x) => x.id === o.roomId);
        if (!o || !r) return null;
        const e = roomEdge(r, o.edge), len = e.length || 1;
        const u = [(e.b[0] - e.a[0]) / len, (e.b[1] - e.a[1]) / len], n = [-u[1], u[0]]; // n: befelé
        const g = openingGaps(r, o), d = 0.38;
        const at = (t: number): [number, number] => [e.a[0] + u[0] * t + n[0] * d, e.a[1] + u[1] * t + n[1] * d];
        const dim = (t0: number, t1: number, v: number, key: string) => {
          if (Math.abs(t1 - t0) < 0.02) return null;
          const [x0, y0] = at(t0), [x1, y1] = at(t1), [mx, my] = at((t0 + t1) / 2);
          return (
            <g key={key} style={{ pointerEvents: "none" }}>
              <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="#E3683F" strokeWidth={0.025} />
              <rect x={mx - 0.36} y={my - 0.14} width={0.72} height={0.26} rx={0.07} fill="#E3683F" />
              <text x={mx} y={my + 0.05} textAnchor="middle" fontSize={0.17} fontWeight={700} fill="#fff">{v.toFixed(2).replace(".", ",")}</text>
            </g>
          );
        };
        return <>{dim(0, o.offset - o.width / 2, g.start, "s")}{dim(o.offset + o.width / 2, len, g.end, "e")}</>;
      })()}

      {/* kiválasztott helyiség falai: hossz-címke + kattintható sáv */}
      {sel && sel.polygon.map((_, i) => {
        const e = roomEdge(sel, i);
        const mx = (e.a[0] + e.b[0]) / 2, my = (e.a[1] + e.b[1]) / 2;
        const isSel = i === selectedEdge;
        // a címke a helyiség belseje felé tolva (óramutató szerinti körüljárásnál a jobb oldali normális mutat befelé)
        const len = e.length || 1;
        const nx = -(e.b[1] - e.a[1]) / len, ny = (e.b[0] - e.a[0]) / len;
        return (
          <g key={i} onClick={(ev) => { ev.stopPropagation(); onSelectEdge(i); }} className="cursor-pointer">
            <line x1={e.a[0]} y1={e.a[1]} x2={e.b[0]} y2={e.b[1]} stroke="transparent" strokeWidth={0.35} />
            {isSel && <line x1={e.a[0]} y1={e.a[1]} x2={e.b[0]} y2={e.b[1]} stroke="#E3683F" strokeWidth={0.1} />}
            <g transform={`translate(${mx + nx * (selNarrow ? -0.38 : 0.32)},${my + ny * (selNarrow ? -0.38 : 0.32)})`} style={{ pointerEvents: "none" }}>
              <rect x={-0.42} y={-0.17} width={0.84} height={0.3} rx={0.08} fill={isSel ? "#E3683F" : "#12100e"} />
              <text y={0.05} textAnchor="middle" fontSize={0.2} fontWeight={700} fill="#fff">{e.length.toFixed(2).replace(".", ",")}</text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
