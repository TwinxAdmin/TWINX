// Plan2D — a javító szerkesztő 2D-nézete (SVG, centiméterben). Építészeti jelek: fal, nyitott határ (szaggatott), ajtó nyitási
// ívvel (egy / két szárny), üvegajtó (türkiz üvegvonal), ablak (hármas vonal, osztó), átjáró, tartóoszlop. Az eredeti rajz a
// terv alá tehető, állítható áttetszőséggel.
// Műveletek: kijelölés · falhúzás (a szomszéd fal vele mozog; Alt: csak ez a helyiség; mágnes) · sarokpont húzása / beszúrása
// (dupla kattintás a falon) · nyílászáró húzása a fal mentén · lerakás szellemképpel · oszlop · görgő: nagyítás, üres helyen húzás: mozgatás.
"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject, type PointerEvent as RPE } from "react";
import type { FloorPlan, Opening, Pt } from "@/lib/floorplan3d/plan";
import { OUTDOOR_KINDS, leavesOf } from "@/lib/floorplan3d/plan";
import { doorClosed, openingSegment, planBounds, polygonArea, roomEdge, type RoomCheck } from "@/lib/floorplan3d/geometry";
import { addColumn, insertVertex, moveEdgeTo, moveVertex, openSpans, patchColumn, patchOpening, placeOpening } from "@/lib/floorplan3d/edit";
import type { Ghost, History, Pending, Selection, Tool } from "@/components/floorplan3d/editor/state";
import { fmt } from "@/components/floorplan3d/editor/parts";

export type Underlay = { url: string; metersPerPixel: number; size: [number, number]; offset: [number, number] } | null;
export type View2DApi = { screenOf: (p: Pt) => { x: number; y: number } | null };

const S = 100; // 1 m = 100 egység (cm)
const WALL_C = "#3B3530", CORAL = "#EF7A5A", TEAL = "#2F7F86";
const FILL: Record<RoomCheck["status"], string> = { ok: "#FFFDF8", approved: "#FFF8EA", deviation: "#FFF1E6", missing: "#F6F2EC" };

type Drag =
  | { kind: "pan"; sx: number; sy: number; vb: VB }
  | { kind: "edge"; roomId: string; edge: number; startValue: number; startPt: Pt; alt: boolean }
  | { kind: "vertex"; roomId: string; index: number }
  | { kind: "opening"; id: string; grab: number }
  | { kind: "column"; id: string; dx: number; dy: number };
type VB = { x: number; y: number; w: number; h: number };

function distSeg(p: Pt, a: Pt, b: Pt) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function inside(p: Pt, poly: Pt[]) {
  let r = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) r = !r;
  }
  return r;
}
const inwardOf = (a: Pt, b: Pt): Pt => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l]; };

/** A nyílászáró lerakhatósága (szellemkép): kilóg-e, ütközik-e. */
export function ghostCheck(plan: FloorPlan, roomId: string, edge: number, offset: number, width: number): { valid: boolean; reason?: string } {
  const room = plan.rooms.find((r) => r.id === roomId);
  if (!room) return { valid: false };
  const len = roomEdge(room, edge).length;
  if (offset - width / 2 < -0.001 || offset + width / 2 > len + 0.001) return { valid: false, reason: "Nem fér el ezen a falon." };
  for (const o of plan.openings) if (o.roomId === roomId && o.edge === edge && Math.abs(o.offset - offset) < (o.width + width) / 2) return { valid: false, reason: "Ütközne egy másik nyílászáróval." };
  return { valid: true };
}

export default function Plan2D({ plan, checks, sel, onSelect, tool, pending, onPlaced, history, underlay, underlayOn, underlayOpacity, wall, apiRef, ghost, onGhost }: {
  plan: FloorPlan; checks: Map<string, RoomCheck>; sel: Selection; onSelect: (s: Selection) => void;
  tool: Tool; pending: Pending; onPlaced: (sel: Selection) => void; history: History;
  underlay: Underlay; underlayOn: boolean; underlayOpacity: number; wall: number;
  apiRef: MutableRefObject<View2DApi | null>; ghost: Ghost; onGhost: (g: Ghost) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [vb, setVb] = useState<VB>({ x: 0, y: 0, w: 1000, h: 700 });
  const vbRef = useRef(vb); vbRef.current = vb;
  const [hover, setHover] = useState<Selection>(null);
  const [tip, setTip] = useState<{ x: number; y: number; t: string; s?: string } | null>(null);
  const [guide, setGuide] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [colGhost, setColGhost] = useState<Pt | null>(null);
  const drag = useRef<Drag | null>(null);
  const planRef = useRef(plan); planRef.current = plan;
  const fitted = useRef(false);

  // a teljes terv a nézetbe (első megjelenéskor és méretváltáskor, amíg a felhasználó nem nagyított)
  const userZoom = useRef(false);
  const fit = () => {
    const host = hostRef.current; if (!host || host.clientWidth < 10 || host.clientHeight < 10) return; // még nincs mérete (rejtett nézet)
    const b = planBounds(planRef.current), pad = 0.7, asp = host.clientWidth / host.clientHeight;
    const w0 = (b.maxX - b.minX + 2 * pad) * S, h0 = (b.maxY - b.minY + 2 * pad) * S;
    let w = w0, h = w0 / asp; if (h < h0) { h = h0; w = h0 * asp; }
    setVb({ x: ((b.minX + b.maxX) / 2) * S - w / 2, y: ((b.minY + b.maxY) / 2) * S - h / 2, w, h });
  };
  useEffect(() => {
    const host = hostRef.current; if (!host) return;
    const ro = new ResizeObserver(() => { if (!userZoom.current || !fitted.current) { fit(); fitted.current = host.clientWidth >= 10 && host.clientHeight >= 10; } });
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  const pxPerCm = () => { const r = svgRef.current?.getBoundingClientRect(); return r && r.width ? r.width / vbRef.current.w : 1; };
  const toPlan = (clientX: number, clientY: number): Pt => {
    const r = svgRef.current!.getBoundingClientRect(), v = vbRef.current;
    return [(v.x + ((clientX - r.left) / r.width) * v.w) / S, (v.y + ((clientY - r.top) / r.height) * v.h) / S];
  };
  useEffect(() => {
    apiRef.current = {
      screenOf: (p) => {
        const svg = svgRef.current, host = hostRef.current; if (!svg || !host || host.offsetWidth < 40) return null;
        const r = svg.getBoundingClientRect(), v = vbRef.current;
        return { x: r.left + ((p[0] * S - v.x) / v.w) * r.width, y: r.top + ((p[1] * S - v.y) / v.h) * r.height };
      },
    };
    return () => { apiRef.current = null; };
  }, [apiRef]);

  const openingGeom = (o: Opening) => {
    const room = plan.rooms.find((r) => r.id === o.roomId)!;
    const e = roomEdge(room, o.edge), s = openingSegment(room, o), n = inwardOf(e.a, e.b);
    return { room, e, s, n };
  };

  // ---------- találat (képernyő-pixelben mért tűréssel) ----------
  function hitTest(p: Pt): Selection {
    const tol = 9 / pxPerCm() / S; // ~9 px méterben
    if (sel && (sel.type === "room" || sel.type === "edge" || sel.type === "vertex")) {
      const r = plan.rooms.find((x) => x.id === sel.roomId);
      const i = r?.polygon.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < tol * 1.2) ?? -1;
      if (r && i >= 0) return { type: "vertex", roomId: r.id, index: i };
    }
    for (const c of plan.columns ?? []) if (Math.abs(p[0] - c.x) <= c.w / 2 + tol * 0.5 && Math.abs(p[1] - c.y) <= c.d / 2 + tol * 0.5) return { type: "column", id: c.id };
    for (const o of plan.openings) { const { s } = openingGeom(o); if (distSeg(p, s.a, s.b) < tol * 1.6) return { type: "opening", id: o.id }; }
    let best: Selection = null, bd = tol * 1.3;
    for (const r of plan.rooms) r.polygon.forEach((_, i) => { const e = roomEdge(r, i), d = distSeg(p, e.a, e.b); if (d < bd) { bd = d; best = { type: "edge", roomId: r.id, edge: i }; } });
    if (best) return best;
    const r = plan.rooms.find((x) => inside(p, x.polygon));
    return r ? { type: "room", roomId: r.id } : null;
  }
  /** A ponthoz legközelebbi (nem nyitott) fal → a nyílászáró ide kerülne. A kurzor helyiség felőli oldala dönti el a gazdát. */
  function nearestWall(p: Pt, maxD = 0.45) {
    let best: { roomId: string; edge: number; t: number; len: number } | null = null, bd = maxD;
    for (const r of plan.rooms) r.polygon.forEach((_, i) => {
      if ((r.openEdges ?? []).includes(i)) return;
      const e = roomEdge(r, i), d = distSeg(p, e.a, e.b), n = inwardOf(e.a, e.b);
      const side = (p[0] - e.a[0]) * n[0] + (p[1] - e.a[1]) * n[1];
      const dd = d + (side < -0.02 ? 0.2 : 0);
      if (dd < bd) { bd = dd; const len = e.length || 1; best = { roomId: r.id, edge: i, t: ((p[0] - e.a[0]) * (e.b[0] - e.a[0]) + (p[1] - e.a[1]) * (e.b[1] - e.a[1])) / len, len: e.length }; }
    });
    return best as { roomId: string; edge: number; t: number; len: number } | null;
  }
  const showTip = (clientX: number, clientY: number, t: string, s?: string) => {
    const r = hostRef.current!.getBoundingClientRect();
    setTip({ x: clientX - r.left + 16, y: clientY - r.top + 16, t, s });
  };

  // ---------- mutató ----------
  function onDown(ev: RPE<SVGSVGElement>) {
    if (ev.button !== 0) return;
    const p = toPlan(ev.clientX, ev.clientY);
    (ev.currentTarget as SVGSVGElement).setPointerCapture(ev.pointerId);
    if ((tool === "door" || tool === "window") && pending) {
      if (ghost?.valid) {
        const next = placeOpening(plan, ghost.roomId, ghost.edge, ghost.offset, pending);
        history.commit(next);
        onPlaced({ type: "opening", id: next.openings[next.openings.length - 1].id });
        onGhost(null);
      }
      return;
    }
    if (tool === "column") {
      const r = addColumn(plan, p);
      history.commit(r.plan); onPlaced({ type: "column", id: r.id }); setColGhost(null);
      return;
    }
    const h = hitTest(p);
    if (h?.type === "vertex") { history.begin(); drag.current = { kind: "vertex", roomId: h.roomId, index: h.index }; onSelect(h); return; }
    if (h?.type === "opening") {
      const o = plan.openings.find((x) => x.id === h.id)!, { e } = openingGeom(o), len = e.length || 1;
      const t = ((p[0] - e.a[0]) * (e.b[0] - e.a[0]) + (p[1] - e.a[1]) * (e.b[1] - e.a[1])) / len;
      history.begin(); drag.current = { kind: "opening", id: o.id, grab: t - o.offset }; onSelect(h); return;
    }
    if (h?.type === "column") { const c = (plan.columns ?? []).find((x) => x.id === h.id)!; history.begin(); drag.current = { kind: "column", id: c.id, dx: c.x - p[0], dy: c.y - p[1] }; onSelect(h); return; }
    if (h?.type === "edge") {
      const room = plan.rooms.find((r) => r.id === h.roomId)!, e = roomEdge(room, h.edge);
      const already = sel?.type === "edge" && sel.roomId === h.roomId && sel.edge === h.edge;
      onSelect(h);
      if ((tool === "wall" || already) && e.axis && !(room.openEdges ?? []).includes(h.edge)) {
        history.begin();
        drag.current = { kind: "edge", roomId: h.roomId, edge: h.edge, startValue: e.a[e.axis === "x" ? 1 : 0], startPt: p, alt: ev.altKey };
      }
      return;
    }
    onSelect(h);
    if (!h) drag.current = { kind: "pan", sx: ev.clientX, sy: ev.clientY, vb: { ...vb } };
  }

  function onMove(ev: RPE<SVGSVGElement>) {
    const p = toPlan(ev.clientX, ev.clientY), d = drag.current;
    if (d) {
      if (d.kind === "pan") {
        const r = svgRef.current!.getBoundingClientRect();
        userZoom.current = true;
        setVb({ ...d.vb, x: d.vb.x - ((ev.clientX - d.sx) / r.width) * d.vb.w, y: d.vb.y - ((ev.clientY - d.sy) / r.height) * d.vb.h });
        return;
      }
      const cur = planRef.current;
      if (d.kind === "edge") {
        const room = cur.rooms.find((r) => r.id === d.roomId)!, e = roomEdge(room, d.edge), q = e.axis === "x" ? 1 : 0;
        const m = moveEdgeTo(cur, d.roomId, d.edge, d.startValue + (p[q] - d.startPt[q]), { withNeighbors: !d.alt && !ev.altKey, wall });
        if (!m) return;
        history.live(m.plan);
        const nr = m.plan.rooms.find((r) => r.id === d.roomId)!, c = checks.get(d.roomId);
        const delta = Math.round((m.value - d.startValue) * 100);
        const area = polygonArea(nr.polygon);
        showTip(ev.clientX, ev.clientY, `${delta >= 0 ? "+" : ""}${delta} cm${m.snapped !== null ? " · illesztve" : ""}`,
          `${nr.name}: ${fmt(area)} m²${c?.declared ? ` / megadott ${fmt(c.declared)} (${area > c.declared ? "+" : ""}${fmt(((area - c.declared) / c.declared) * 100, 1)}%)` : ""}${m.moved.length > 1 ? " · a szomszéd fal is mozdul (Alt: csak ez)" : ""}`);
        if (m.snapped !== null) {
          const b = planBounds(cur);
          setGuide(q === 1 ? { x1: (b.minX - 0.5) * S, x2: (b.maxX + 0.5) * S, y1: m.snapped * S, y2: m.snapped * S } : { y1: (b.minY - 0.5) * S, y2: (b.maxY + 0.5) * S, x1: m.snapped * S, x2: m.snapped * S });
        } else setGuide(null);
        return;
      }
      if (d.kind === "vertex") {
        const m = moveVertex(cur, d.roomId, d.index, p);
        if (!m) return;
        history.live(m.plan);
        const nr = m.plan.rooms.find((r) => r.id === d.roomId)!;
        showTip(ev.clientX, ev.clientY, `Sarokpont${m.snapX !== null || m.snapY !== null ? " · illesztve" : ""}`, `${nr.name}: ${fmt(polygonArea(nr.polygon))} m²`);
        const b = planBounds(cur);
        setGuide(m.snapX !== null ? { x1: m.snapX * S, x2: m.snapX * S, y1: (b.minY - 0.5) * S, y2: (b.maxY + 0.5) * S } : m.snapY !== null ? { y1: m.snapY * S, y2: m.snapY * S, x1: (b.minX - 0.5) * S, x2: (b.maxX + 0.5) * S } : null);
        return;
      }
      if (d.kind === "opening") {
        const o = cur.openings.find((x) => x.id === d.id); if (!o) return;
        const room = cur.rooms.find((r) => r.id === o.roomId)!, e = roomEdge(room, o.edge), len = e.length || 1;
        const t = ((p[0] - e.a[0]) * (e.b[0] - e.a[0]) + (p[1] - e.a[1]) * (e.b[1] - e.a[1])) / len - d.grab;
        const off = Math.round(Math.max(o.width / 2, Math.min(e.length - o.width / 2, t)) * 100) / 100;
        history.live(patchOpening(cur, o.id, { offset: off }));
        showTip(ev.clientX, ev.clientY, `← ${fmt(off - o.width / 2)} m · ${fmt(e.length - off - o.width / 2)} m →`, `a saroktól · ${room.name}`);
        return;
      }
      if (d.kind === "column") {
        history.live(patchColumn(cur, d.id, { x: p[0] + d.dx, y: p[1] + d.dy }));
        return;
      }
    }
    // nincs húzás: szellemkép / kiemelés
    if ((tool === "door" || tool === "window") && pending) {
      const w = nearestWall(p);
      if (!w) { onGhost(null); setTip(null); return; }
      const off = Math.round(Math.max(pending.width / 2, Math.min(w.len - pending.width / 2, w.t)) * 100) / 100;
      const chk = ghostCheck(plan, w.roomId, w.edge, off, pending.width);
      onGhost({ roomId: w.roomId, edge: w.edge, offset: off, ...chk });
      const rn = plan.rooms.find((r) => r.id === w.roomId)?.name ?? "";
      showTip(ev.clientX, ev.clientY, pending.label, `${rn} · ${chk.valid ? "kattints a lerakáshoz" : chk.reason ?? ""}`);
      return;
    }
    if (tool === "column") { setColGhost(p); showTip(ev.clientX, ev.clientY, "Oszlop 30 × 30 cm", "kattints a lerakáshoz · a mérete utána állítható"); return; }
    const h = hitTest(p);
    if (JSON.stringify(h) !== JSON.stringify(hover)) setHover(h);
    if (h?.type === "edge" && tool === "wall") {
      const room = plan.rooms.find((r) => r.id === h.roomId)!, e = roomEdge(room, h.edge);
      showTip(ev.clientX, ev.clientY, e.axis ? `Húzd ki vagy be · ${fmt(e.length)} m` : "Ferde fal", e.axis ? "a szomszéd fal is vele mozog (Alt: csak ez)" : "a sarokpontjait húzd, vagy a panelen add meg");
    } else setTip(null);
  }

  function onUp() {
    const d = drag.current;
    drag.current = null; setGuide(null); setTip(null);
    if (d && d.kind !== "pan") history.end();
  }

  function onDouble(ev: React.MouseEvent<SVGSVGElement>) {
    if (tool !== "select" && tool !== "wall") return;
    const p = toPlan(ev.clientX, ev.clientY), h = hitTest(p);
    if (h?.type !== "edge") return;
    const room = plan.rooms.find((r) => r.id === h.roomId)!, e = roomEdge(room, h.edge), len = e.length || 1;
    const t = ((p[0] - e.a[0]) * (e.b[0] - e.a[0]) + (p[1] - e.a[1]) * (e.b[1] - e.a[1])) / len;
    const next = insertVertex(plan, h.roomId, h.edge, t);
    if (!next) return;
    history.commit(next);
    onSelect({ type: "vertex", roomId: h.roomId, index: h.edge + 1 });
  }

  function onWheel(ev: React.WheelEvent<SVGSVGElement>) {
    const p = toPlan(ev.clientX, ev.clientY), k = ev.deltaY > 0 ? 1.1 : 1 / 1.1;
    userZoom.current = true;
    setVb((v) => { const nw = Math.max(250, Math.min(4000, v.w * k)), nh = (v.h * nw) / v.w; return { x: p[0] * S - ((p[0] * S - v.x) * nw) / v.w, y: p[1] * S - ((p[1] * S - v.y) * nh) / v.h, w: nw, h: nh }; });
  }
  // a görgő ne görgesse az oldalt a rajz fölött
  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    const stop = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", stop, { passive: false });
    return () => el.removeEventListener("wheel", stop);
  }, []);

  // ---------- rajz ----------
  const selRoomId = sel && (sel.type === "room" || sel.type === "edge" || sel.type === "vertex") ? sel.roomId : sel?.type === "opening" ? plan.openings.find((o) => o.id === sel.id)?.roomId ?? null : null;
  const selOpening = sel?.type === "opening" ? plan.openings.find((o) => o.id === sel.id) ?? null : null;
  const grid = useMemo(() => {
    const out: React.ReactNode[] = [];
    for (let x = Math.floor(vb.x / 50) * 50; x < vb.x + vb.w; x += 50) out.push(<line key={`x${x}`} x1={x} y1={vb.y} x2={x} y2={vb.y + vb.h} stroke={x % 100 ? "#F1EBE2" : "#E9E1D5"} strokeWidth={1 / pxPerCm()} />);
    for (let y = Math.floor(vb.y / 50) * 50; y < vb.y + vb.h; y += 50) out.push(<line key={`y${y}`} x1={vb.x} y1={y} x2={vb.x + vb.w} y2={y} stroke={y % 100 ? "#F1EBE2" : "#E9E1D5"} strokeWidth={1 / pxPerCm()} />);
    return out;
  }, [vb]);
  const px = 1 / pxPerCm(); // 1 képernyő-pixel cm-ben (vonalvastagság, betűméret a nagyítástól függetlenül)

  const drawOpening = (o: Opening & { ghost?: "ok" | "bad" }, state: "" | "sel" | "hov") => {
    const { s, n } = openingGeom(o);
    const col = o.ghost ? (o.ghost === "ok" ? CORAL : "#B3261E") : state === "sel" ? CORAL : state === "hov" ? "#C9643F" : WALL_C;
    const A: Pt = [s.a[0] * S, s.a[1] * S], B: Pt = [s.b[0] * S, s.b[1] * S];
    const tick = 6 * px, els: React.ReactNode[] = [];
    els.push(<line key="gap" x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke="#FBF8F3" strokeWidth={15 * px} />);
    const jamb = (q: Pt, k: string, w = 2.4) => <line key={k} x1={q[0] - n[0] * tick} y1={q[1] - n[1] * tick} x2={q[0] + n[0] * tick} y2={q[1] + n[1] * tick} stroke={col} strokeWidth={w * px} />;
    if (o.kind === "passage") {
      els.push(<line key="p" x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke={col} strokeWidth={1.4 * px} strokeDasharray={`${6 * px} ${5 * px}`} />, jamb(A, "ja", 3), jamb(B, "jb", 3));
    } else if (o.kind === "window") {
      for (const dd of [-4.5, 0, 4.5]) els.push(<line key={`w${dd}`} x1={A[0] - n[0] * dd * px} y1={A[1] - n[1] * dd * px} x2={B[0] - n[0] * dd * px} y2={B[1] - n[1] * dd * px} stroke={col} strokeWidth={(dd ? 1.6 : 2.4) * px} />);
      els.push(jamb(A, "ja", 2), jamb(B, "jb", 2));
      if (leavesOf(o) === 2) els.push(jamb([(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], "jm", 2));
    } else {
      const sd = o.swing === "out" ? -1 : 1, closed = doorClosed(plan, o), double = leavesOf(o) === 2;
      const mid: Pt = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
      const leaves: [Pt, Pt][] = double ? [[A, mid], [B, mid]] : [o.hinge === "end" ? [B, A] : [A, B]];
      leaves.forEach(([h, other], i) => {
        const w = Math.hypot(other[0] - h[0], other[1] - h[1]), tip: Pt = [h[0] + n[0] * sd * w, h[1] + n[1] * sd * w];
        const cross = (other[0] - h[0]) * (tip[1] - h[1]) - (other[1] - h[1]) * (tip[0] - h[0]);
        els.push(<line key={`l${i}`} x1={h[0]} y1={h[1]} x2={tip[0]} y2={tip[1]} stroke={col} strokeWidth={(o.glazed ? 2 : 3) * px} opacity={closed ? 0.55 : 1} />);
        els.push(<path key={`a${i}`} d={`M ${other[0]} ${other[1]} A ${w} ${w} 0 0 ${cross > 0 ? 1 : 0} ${tip[0]} ${tip[1]}`} fill="none" stroke={col} strokeWidth={1.3 * px} strokeDasharray={`${5 * px} ${4 * px}`} />);
      });
      if (o.glazed) els.push(<line key="g" x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke={TEAL} strokeWidth={1.6 * px} />);
      els.push(jamb(A, "ja"), jamb(B, "jb"));
    }
    els.push(<line key="hit" x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke="transparent" strokeWidth={26 * px} />);
    return <g key={o.id} style={{ cursor: o.ghost ? "copy" : "grab" }}>{els}</g>;
  };

  const dim = (a: Pt, b: Pt, label: string, color: string, key: string, filled = false) => {
    const x1 = a[0] * S, y1 = a[1] * S, x2 = b[0] * S, y2 = b[1] * S, mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    if (Math.hypot(x2 - x1, y2 - y1) < 6 * px) return null;
    return (
      <g key={key} pointerEvents="none">
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.4 * px} />
        <circle cx={x1} cy={y1} r={2.4 * px} fill={color} /><circle cx={x2} cy={y2} r={2.4 * px} fill={color} />
        <rect x={mx - 24 * px} y={my - 10 * px} width={48 * px} height={20 * px} rx={6 * px} fill={filled ? color : "#fff"} stroke={filled ? "none" : "#E2D8CB"} strokeWidth={px} />
        <text x={mx} y={my + 4.5 * px} textAnchor="middle" fontSize={12.5 * px} fontWeight={700} fill={filled ? "#fff" : "#4A433C"}>{label}</text>
      </g>
    );
  };

  const selRoom = selRoomId ? plan.rooms.find((r) => r.id === selRoomId) ?? null : null;
  const ghostOpening: (Opening & { ghost: "ok" | "bad" }) | null = ghost && pending ? {
    id: "ghost", kind: pending.kind, roomId: ghost.roomId, edge: ghost.edge, offset: ghost.offset, width: pending.width,
    height: pending.height, sill: pending.sill, hinge: "start", swing: "in", glazed: pending.glazed, ghost: ghost.valid ? "ok" : "bad",
  } : null;

  return (
    <div ref={hostRef} className="relative h-full w-full">
      <svg ref={svgRef} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="block h-full w-full select-none" style={{ background: "#FBF8F3", touchAction: "none", cursor: tool === "column" || pending ? "copy" : drag.current?.kind === "pan" ? "grabbing" : undefined }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onDoubleClick={onDouble} onWheel={onWheel}
        onPointerLeave={() => { setHover(null); setTip(null); setColGhost(null); if (ghost) onGhost(null); }} role="img" aria-label="Alaprajz-szerkesztő">
        {grid}
        {underlay && underlayOn && (
          <image href={underlay.url} x={-underlay.offset[0] * S} y={-underlay.offset[1] * S} width={underlay.size[0] * underlay.metersPerPixel * S}
            height={underlay.size[1] * underlay.metersPerPixel * S} opacity={underlayOpacity} preserveAspectRatio="none" pointerEvents="none" />
        )}
        {/* helyiségek */}
        {plan.rooms.map((r) => {
          const st = checks.get(r.id)?.status ?? "missing";
          const fill = OUTDOOR_KINDS.includes(r.kind) ? "#EEF2EC" : FILL[st];
          return <polygon key={r.id} points={r.polygon.map((q) => `${q[0] * S},${q[1] * S}`).join(" ")} fill={fill} fillOpacity={underlay && underlayOn ? 0.55 : 1}
            stroke={selRoomId === r.id ? CORAL : "none"} strokeWidth={selRoomId === r.id ? 2 * px : 0} />;
        })}
        {/* falak (zárt szakasz vastag, nyitott szaggatott) */}
        {plan.rooms.map((r) => r.polygon.map((_, i) => {
          const e = roomEdge(r, i), len = e.length || 1, at = (t: number) => [(e.a[0] + ((e.b[0] - e.a[0]) * t) / len) * S, (e.a[1] + ((e.b[1] - e.a[1]) * t) / len) * S];
          const isSel = sel?.type === "edge" && sel.roomId === r.id && sel.edge === i, isHov = hover?.type === "edge" && hover.roomId === r.id && hover.edge === i;
          const col = isSel ? CORAL : isHov ? "#6E5A4A" : OUTDOOR_KINDS.includes(r.kind) ? "#7D8A76" : WALL_C;
          const segs: React.ReactNode[] = []; let cur = 0;
          const wallSeg = (a: number, b: number, k: string) => { if (b - a < 0.005) return; const p = at(a), q = at(b); segs.push(<line key={k} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={col} strokeWidth={(isSel || isHov ? 13 : 11) * px} strokeLinecap="square" />); };
          const openSeg = (a: number, b: number, k: string) => { const p = at(a), q = at(b); segs.push(<line key={k} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={isSel ? CORAL : "#B9AC9C"} strokeWidth={(isSel ? 5 : 2) * px} strokeDasharray={`${8 * px} ${7 * px}`} />); };
          openSpans(plan, r.id, i).forEach(([a, b], k) => { wallSeg(cur, a, `w${k}`); openSeg(a, b, `o${k}`); cur = b; });
          wallSeg(cur, e.length, "wend");
          return <g key={`${r.id}-${i}`}>{segs}</g>;
        }))}
        {plan.openings.map((o) => drawOpening(o, selOpening?.id === o.id ? "sel" : hover?.type === "opening" && hover.id === o.id ? "hov" : ""))}
        {ghostOpening && drawOpening(ghostOpening, "")}
        {(plan.columns ?? []).map((c) => {
          const isSel = sel?.type === "column" && sel.id === c.id, isHov = hover?.type === "column" && hover.id === c.id;
          const x0 = (c.x - c.w / 2) * S, y0 = (c.y - c.d / 2) * S, w = c.w * S, h = c.d * S;
          return (
            <g key={c.id} style={{ cursor: "grab" }}>
              <rect x={x0} y={y0} width={w} height={h} fill={isSel ? CORAL : isHov ? "#6E5A4A" : WALL_C} />
              <line x1={x0} y1={y0} x2={x0 + w} y2={y0 + h} stroke="rgba(255,255,255,.35)" strokeWidth={1.2 * px} pointerEvents="none" />
              <line x1={x0 + w} y1={y0} x2={x0} y2={y0 + h} stroke="rgba(255,255,255,.35)" strokeWidth={1.2 * px} pointerEvents="none" />
            </g>
          );
        })}
        {colGhost && <rect x={(colGhost[0] - 0.15) * S} y={(colGhost[1] - 0.15) * S} width={30} height={30} fill="rgba(239,122,90,.55)" pointerEvents="none" />}
        {/* címkék */}
        {plan.rooms.map((r) => {
          const c = checks.get(r.id), a = polygonArea(r.polygon), small = a < 1.3;
          const cx = r.polygon.reduce((s2, q) => s2 + q[0], 0) / r.polygon.length * S, cy = r.polygon.reduce((s2, q) => s2 + q[1], 0) / r.polygon.length * S;
          const color = c?.status === "ok" ? "#2f7a4f" : c?.status === "deviation" ? "#C2522D" : c?.status === "approved" ? "#9A7020" : "#6E655C";
          return (
            <g key={`t${r.id}`} pointerEvents="none">
              <text x={cx} y={cy - (small ? 2 : 6) * px} textAnchor="middle" fontSize={(small ? 12 : 15) * px} fontWeight={800} fill="#2B2520">{r.name}</text>
              <text x={cx} y={cy + (small ? 12 : 14) * px} textAnchor="middle" fontSize={(small ? 10.5 : 12) * px} fontWeight={700} fill={color}>
                {fmt(a)} m²{c?.diffPct !== null && c?.diffPct !== undefined && c.status !== "ok" ? ` · ${c.diffPct > 0 ? "+" : ""}${fmt(c.diffPct, 1)}%` : ""}
              </text>
            </g>
          );
        })}
        {/* a kijelölt helyiség falainak hossza + sarokpontjai */}
        {selRoom && selRoom.polygon.map((_, i) => {
          const e = roomEdge(selRoom, i), n = inwardOf(e.a, e.b), off = -0.42;
          const hot = sel?.type === "edge" && sel.edge === i;
          return dim([e.a[0] + n[0] * off, e.a[1] + n[1] * off], [e.b[0] + n[0] * off, e.b[1] + n[1] * off], fmt(e.length), hot ? CORAL : "#9C8F80", `d${i}`, hot);
        })}
        {selRoom && (sel?.type === "room" || sel?.type === "edge" || sel?.type === "vertex") && selRoom.polygon.map((q, i) => {
          const on = sel?.type === "vertex" && sel.index === i;
          return <circle key={`v${i}`} cx={q[0] * S} cy={q[1] * S} r={(on ? 7 : 5.5) * px} fill={on ? CORAL : "#fff"} stroke={CORAL} strokeWidth={2 * px} style={{ cursor: "move" }} />;
        })}
        {/* a kijelölt nyílászáró: saroktávolság + jelölő */}
        {selOpening && (() => {
          const { e, s, n } = openingGeom(selOpening), o2 = 0.36;
          const sStart = selOpening.offset - selOpening.width / 2, sEnd = e.length - selOpening.offset - selOpening.width / 2;
          const sh = (p: Pt): Pt => [p[0] + n[0] * o2, p[1] + n[1] * o2];
          const c: Pt = [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2], q: Pt = [c[0] - n[0] * 0.62, c[1] - n[1] * 0.62];
          return (
            <g>
              {dim(sh(e.a), sh(s.a), fmt(Math.max(0, sStart)), sStart < 0.1 ? "#B3261E" : TEAL, "os", true)}
              {dim(sh(s.b), sh(e.b), fmt(Math.max(0, sEnd)), sEnd < 0.1 ? "#B3261E" : TEAL, "oe", true)}
              <line x1={c[0] * S} y1={c[1] * S} x2={q[0] * S} y2={q[1] * S} stroke={CORAL} strokeWidth={2 * px} pointerEvents="none" />
              <circle cx={c[0] * S} cy={c[1] * S} r={5 * px} fill="#fff" stroke={CORAL} strokeWidth={2.5 * px} pointerEvents="none" />
              <circle cx={q[0] * S} cy={q[1] * S} r={12 * px} fill={CORAL} stroke="#fff" strokeWidth={3 * px} pointerEvents="none" />
            </g>
          );
        })()}
        {guide && <line {...guide} stroke={TEAL} strokeWidth={2 * px} strokeDasharray={`${10 * px} ${6 * px}`} pointerEvents="none" />}
      </svg>
      {tip && (
        <div className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-lg" style={{ left: tip.x, top: tip.y, background: "#12100e" }}>
          {tip.t}{tip.s && <span className="block text-[11px] font-medium opacity-75">{tip.s}</span>}
        </div>
      )}
    </div>
  );
}
