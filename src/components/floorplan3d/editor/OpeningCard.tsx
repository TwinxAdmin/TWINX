// OpeningCard — a kijelölt nyílászáró felugró kártyája (2026-10-16, a jóváhagyott látványterv szerint): a nyílászáró MELLETT nyílik,
// a fejlécénél fogva arrébb húzható (ott marad, dupla kattintás: vissza az elem mellé). Típus (ajtó / üvegajtó / ablak / átjáró)
// egy kattintással, szabványos méret kapszulákban, egyedi méret csúszkával (élő frissítés), szárnyak, nyitás ábrával, becsukva a
// 3D-ben, hely a falon csúszkával + „Középre", figyelmeztetések, törlés.
"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { FloorPlan, Opening } from "@/lib/floorplan3d/plan";
import { leavesOf } from "@/lib/floorplan3d/plan";
import { doorClosed, openingWarnings, roomEdge } from "@/lib/floorplan3d/geometry";
import { convertOpening, patchOpening, presetsOfType, typeOf, type OpeningType } from "@/lib/floorplan3d/edit";
import type { History } from "@/components/floorplan3d/editor/state";
import { MUTED, Slider, fmt } from "@/components/floorplan3d/editor/parts";

const TYPE_T: Record<OpeningType, string> = { door: "Ajtó", glassdoor: "Üvegajtó", window: "Ablak", passage: "Átjáró" };

export function TypeGlyph({ t, color = "#4A433C", size = 26 }: { t: OpeningType; color?: string; size?: number }) {
  const st = { stroke: color, strokeWidth: 1.8, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden>
      {t === "door" && <><path d="M6 23V3h12v20" {...st} /><path d="M3 23h20" {...st} /><circle cx="15" cy="13" r="1.1" {...st} /></>}
      {t === "glassdoor" && <><path d="M6 23V3h12v20" {...st} /><path d="M9 6h6v8H9z" {...st} /><path d="M3 23h20" {...st} /></>}
      {t === "window" && <><path d="M4 5h18v14H4zM13 5v14M4 12h18" {...st} /><path d="M3 22h20" {...st} /></>}
      {t === "passage" && <><path d="M4 23V5M22 23V5" {...st} /><path d="M9 14h8M14 11l3 3-3 3" {...st} /><path d="M2 23h22" {...st} /></>}
    </svg>
  );
}

function SwingDiagram({ o, closed }: { o: Opening; closed: boolean }) {
  const L = o.hinge === "end", IN = o.swing !== "out", y = IN ? 18 : 62, x0 = 14, x1 = 118, double = leavesOf(o) === 2;
  const leaf = (hx: number, ox: number, k: string) => {
    const w = Math.abs(ox - hx), tipY = y + (IN ? w * 0.78 : -w * 0.78);
    return <g key={k}><line x1={hx} y1={y} x2={hx} y2={tipY} stroke="#EF7A5A" strokeWidth={3} strokeLinecap="round" opacity={closed ? 0.5 : 1} />
      <path d={`M ${ox} ${y} Q ${ox} ${tipY} ${hx} ${tipY}`} fill="none" stroke="#EF7A5A" strokeWidth={1.4} strokeDasharray="4 4" /></g>;
  };
  return (
    <svg width="132" height="80" viewBox="0 0 132 80" aria-hidden>
      <line x1="2" y1={y} x2={x0} y2={y} stroke="#3B3530" strokeWidth="6" /><line x1={x1} y1={y} x2="130" y2={y} stroke="#3B3530" strokeWidth="6" />
      {double ? [leaf(x0, (x0 + x1) / 2, "a"), leaf(x1, (x0 + x1) / 2, "b")] : leaf(L ? x1 : x0, L ? x0 : x1, "a")}
      {o.glazed && <line x1={x0} y1={y} x2={x1} y2={y} stroke="#2F7F86" strokeWidth="1.4" />}
      <text x="66" y={IN ? 76 : 10} textAnchor="middle" fontSize="9.5" fill="#9C8F80" fontWeight={600}>{IN ? "a helyiség felé" : "kifelé"}</text>
    </svg>
  );
}

function SillDiagram({ o, ceiling }: { o: Opening; ceiling: number }) {
  const k = 70 / ceiling, sy = 78 - o.sill * k, ty = 78 - (o.sill + o.height) * k;
  return (
    <svg width="132" height="80" viewBox="0 0 132 80" aria-hidden>
      <rect x="30" y="8" width="72" height="70" fill="rgba(255,255,255,.6)" stroke="#D8CCBF" />
      <rect x="44" y={ty} width="44" height={Math.max(2, sy - ty)} fill="#DCEBF2" stroke="#2F7F86" strokeWidth="1.6" />
      {leavesOf(o) === 2 && <line x1="66" y1={ty} x2="66" y2={sy} stroke="#2F7F86" strokeWidth="2" />}
      <line x1="112" y1="78" x2="112" y2={sy} stroke="#EF7A5A" strokeWidth="1.6" /><line x1="108" y1={sy} x2="116" y2={sy} stroke="#EF7A5A" strokeWidth="1.6" />
      <text x="118" y={(78 + sy) / 2 + 3} fontSize="9.5" fill="#C9502F" fontWeight={700}>{Math.round(o.sill * 100)}</text>
      <line x1="2" y1="78" x2="130" y2="78" stroke="#3B3530" strokeWidth="2" />
    </svg>
  );
}

function PlaceDiagram({ o, len }: { o: Opening; len: number }) {
  const k = 120 / Math.max(0.01, len), a = 6 + (o.offset - o.width / 2) * k, b = 6 + (o.offset + o.width / 2) * k;
  return (
    <svg width="132" height="40" viewBox="0 0 132 40" aria-hidden>
      <line x1="6" y1="18" x2={a} y2="18" stroke="#3B3530" strokeWidth="7" /><line x1={b} y1="18" x2="126" y2="18" stroke="#3B3530" strokeWidth="7" />
      <rect x={a} y="12" width={Math.max(2, b - a)} height="12" rx="3" fill="#F7B49E" />
      <line x1="6" y1="33" x2={a} y2="33" stroke="#2F7F86" strokeWidth="1.4" /><line x1={b} y1="33" x2="126" y2="33" stroke="#2F7F86" strokeWidth="1.4" />
    </svg>
  );
}

const capsBar = "flex flex-1 rounded-full p-1"; const capsBtn = "h-8 min-w-0 flex-1 rounded-full px-1.5 text-[12px] font-bold whitespace-nowrap";
const pill = "inline-flex h-[30px] items-center gap-1.5 rounded-full bg-white px-3 text-[11.5px] font-bold shadow-[0_2px_8px_rgba(28,24,21,.12)] hover:bg-[#FFF5F0]";

export default function OpeningCard({ plan, id, history, cornerMin, onClose, onDelete, anchor, boundsRef }: {
  plan: FloorPlan; id: string; history: History; cornerMin: number; onClose: () => void; onDelete: () => void;
  /** a nyílászáró közepe a képernyőn (2D vagy 3D nézetből), null: nem látszik */
  anchor: () => { x: number; y: number } | null;
  /** a szerkesztő nézet-területe: ezen belül marad a kártya */
  boundsRef: RefObject<HTMLDivElement | null>;
}) {
  const o = plan.openings.find((x) => x.id === id);
  const cardRef = useRef<HTMLDivElement>(null);
  const [custom, setCustom] = useState(false);
  const [pinned, setPinned] = useState<{ left: number; top: number } | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  useEffect(() => { setCustom(false); }, [id]);

  // helyzet: a rögzített (áthúzott) hely, vagy az elem mellé (jobbra, ha nem fér: balra), a nézeten belül
  useEffect(() => {
    let raf = 0;
    const place = () => {
      const box = boundsRef.current?.getBoundingClientRect(), card = cardRef.current;
      if (box && card) {
        const w = card.offsetWidth || 344, h = card.offsetHeight || 420, clamp = (l: number, t: number) => ({ left: Math.max(8, Math.min(box.width - w - 8, l)), top: Math.max(8, Math.min(box.height - h - 8, t)) });
        let next: { left: number; top: number } | null = null;
        if (pinned) next = clamp(pinned.left, pinned.top);
        else {
          const a = anchor();
          if (a) { const x = a.x - box.left, y = a.y - box.top, gap = 34; next = clamp(x + gap + w < box.width - 8 ? x + gap : x - gap - w, y - h / 2); }
        }
        setPos((p) => (next && (!p || Math.abs(p.left - next.left) > 0.5 || Math.abs(p.top - next.top) > 0.5) ? next : p));
      }
      raf = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(raf);
  }, [anchor, boundsRef, pinned]);

  if (!o) return null;
  const room = plan.rooms.find((r) => r.id === o.roomId);
  if (!room) return null;
  const len = roomEdge(room, o.edge).length, t = typeOf(o), list = presetsOfType(t);
  const eq = (a: number, b: number) => Math.abs(a - b) < 0.005;
  const pre = list.find((p) => eq(p.width, o.width) && (o.kind === "passage" || (eq(p.height, o.height) && eq(p.sill, o.sill))));
  const showCustom = custom || !pre;
  const warns = openingWarnings(plan, cornerMin).filter((w) => w.openingId === o.id);
  const left = o.offset - o.width / 2, right = len - o.offset - o.width / 2;
  const closed = doorClosed(plan, o);
  const set = (p: Partial<Opening>) => history.commit(patchOpening(plan, o.id, p));
  const liveSet = (p: Partial<Opening>) => { history.begin(); history.live(patchOpening(plan, o.id, p)); };

  return (
    <div ref={cardRef} className="twx-glass absolute z-20 w-[344px] overflow-y-auto rounded-[28px] p-[18px]"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? 0, maxHeight: (boundsRef.current?.clientHeight ?? 600) - 16 }}
      onPointerDown={(e) => e.stopPropagation()} role="dialog" aria-label="Nyílászáró beállításai">
      {/* fejléc — fogd meg és húzd arrébb */}
      <div className="relative mb-3.5 flex cursor-grab select-none items-center gap-3 pt-1.5 active:cursor-grabbing" title="Fogd meg és húzd arrébb · dupla kattintás: vissza az elem mellé"
        onPointerDown={(e) => { if ((e.target as HTMLElement).closest("button")) return; e.preventDefault(); try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* nincs valódi mutató */ } dragRef.current = { x: e.clientX, y: e.clientY, left: pos?.left ?? 0, top: pos?.top ?? 0 }; }}
        onPointerMove={(e) => { const d = dragRef.current; if (d) setPinned({ left: d.left + e.clientX - d.x, top: d.top + e.clientY - d.y }); }}
        onPointerUp={() => { dragRef.current = null; }}
        onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest("button")) setPinned(null); }}>
        <span className="absolute left-1/2 top-[-8px] h-[5px] w-[38px] -translate-x-1/2 rounded-full" style={{ background: pinned ? "#EF7A5A" : "rgba(28,24,21,.18)" }} />
        <span className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-2xl" style={{ background: "linear-gradient(145deg,#F7B49E,#EF7A5A)", boxShadow: "0 6px 16px rgba(239,122,90,.35)" }}>
          <TypeGlyph t={t} color="#fff" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[19px] font-extrabold leading-tight">{TYPE_T[t]}</span>
          <span className="block truncate text-[12.5px]" style={{ color: MUTED }}>{room.name} · {o.edge + 1}. fal · {Math.round(o.width * 100)}{o.kind !== "passage" ? ` × ${Math.round(o.height * 100)}` : ""} cm{o.kind !== "passage" ? ` · ${leavesOf(o) === 2 ? "kétszárnyú" : "egyszárnyú"}` : ""}</span>
        </span>
        <button type="button" onClick={onClose} className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[15px]" style={{ background: "rgba(28,24,21,.05)", color: MUTED }} title="Bezárás (Esc)" aria-label="Bezárás">✕</button>
      </div>

      {/* típus */}
      <div className="grid grid-cols-4 gap-[7px]">
        {(["door", "glassdoor", "window", "passage"] as OpeningType[]).map((k) => (
          <button key={k} type="button" onClick={() => history.commit(convertOpening(plan, o.id, k))} aria-pressed={t === k}
            className="flex h-[74px] flex-col items-center justify-center gap-1 rounded-[18px] text-[11.5px] font-bold"
            style={t === k ? { color: "#fff", background: "linear-gradient(160deg,#F49274,#E9693F)", boxShadow: "0 8px 20px rgba(233,105,63,.35)" } : { background: "rgba(255,255,255,.6)", border: "1px solid rgba(255,255,255,.75)", color: "#4A433C" }}>
            <TypeGlyph t={k} color={t === k ? "#fff" : "#4A433C"} />{TYPE_T[k]}
          </button>
        ))}
      </div>

      {/* méret */}
      <div className="mt-3 flex items-center gap-2">
        <span className="w-[22px] flex-none text-center text-[13px]" style={{ color: MUTED }} title="Méret">↔</span>
        <div className={capsBar} style={{ background: "rgba(28,24,21,.06)" }}>
          {list.map((p) => (
            <button key={p.id} type="button" title={p.label} className={capsBtn} onClick={() => { setCustom(false); history.commit(patchOpening(plan, o.id, { width: p.width, height: p.kind === "passage" ? plan.ceilingHeight : p.height, sill: p.sill })); }}
              style={pre?.id === p.id && !custom ? { background: "#fff", boxShadow: "0 2px 8px rgba(28,24,21,.14)" } : { color: "#5A524A" }}>
              {Math.round(p.width * 100)}{p.kind === "door" ? `×${Math.round(p.height * 100)}` : ""}
            </button>
          ))}
          <button type="button" className={capsBtn} onClick={() => setCustom((v) => !v)} style={showCustom ? { background: "#fff", boxShadow: "0 2px 8px rgba(28,24,21,.14)" } : { color: "#5A524A" }}>Egyedi</button>
        </div>
      </div>
      {o.kind !== "passage" && (
        <div className="mt-2 flex items-center gap-2">
          <span className="w-[22px] flex-none text-center text-[13px]" style={{ color: MUTED }} title="Szárnyak">◫</span>
          <div className={capsBar} style={{ background: "rgba(28,24,21,.06)" }}>
            {([1, 2] as const).map((n) => (
              <button key={n} type="button" className={capsBtn} onClick={() => set({ leaves: n })} style={leavesOf(o) === n ? { background: "#fff", boxShadow: "0 2px 8px rgba(28,24,21,.14)" } : { color: "#5A524A" }}>
                {n === 1 ? "Egyszárnyú" : "Kétszárnyú"}
              </button>
            ))}
          </div>
        </div>
      )}
      {showCustom && (
        <div className="mt-2.5 flex flex-col gap-3 rounded-[20px] p-3" style={{ background: "rgba(255,255,255,.5)", border: "1px solid rgba(255,255,255,.7)" }}>
          <Slider label="Szélesség" value={o.width} min={0.4} max={Math.max(0.5, Math.min(3, len))} onLive={(v) => liveSet({ width: v })} onCommit={history.end} />
          {o.kind !== "passage" && <Slider label="Magasság" value={o.height} min={o.kind === "window" ? 0.3 : 1.8} max={o.kind === "window" ? Math.max(0.4, plan.ceilingHeight - o.sill - 0.05) : plan.ceilingHeight - 0.05} onLive={(v) => liveSet({ height: v })} onCommit={history.end} />}
        </div>
      )}

      {/* alkártyák: nyitás / parapet + hely a falon */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="flex min-h-[150px] flex-col gap-1.5 rounded-[20px] px-3 py-2.5" style={{ background: "rgba(255,255,255,.5)", border: "1px solid rgba(255,255,255,.7)" }}>
          {o.kind === "door" ? (
            <>
              <span className="text-[12px] font-bold" style={{ color: MUTED }}>Nyitás</span>
              <SwingDiagram o={o} closed={closed} />
              <div className="mt-auto flex flex-wrap gap-1">
                {leavesOf(o) === 1 && <button type="button" className={pill} onClick={() => set({ hinge: o.hinge === "end" ? "start" : "end" })} title="A zsanér a másik oldalra">⇄ Zsanér</button>}
                <button type="button" className={pill} onClick={() => set({ swing: o.swing === "out" ? "in" : "out" })} title="Befelé / kifelé">⇅ Irány</button>
                <button type="button" className={pill} onClick={() => set({ closed: !closed })} title="A 3D-ben becsukva vagy nyitva jelenjen meg (a bejárásban odaérve kinyílik)">{closed ? "▣ Becsukva" : "▢ Nyitva"}</button>
              </div>
            </>
          ) : o.kind === "window" ? (
            <>
              <SillDiagram o={o} ceiling={plan.ceilingHeight} />
              <div className="mt-auto"><Slider label="Parapet" value={o.sill} min={0} max={Math.max(0.1, plan.ceilingHeight - o.height - 0.05)} onLive={(v) => liveSet({ sill: v })} onCommit={history.end} /></div>
            </>
          ) : (
            <>
              <span className="text-[12px] font-bold" style={{ color: MUTED }}>Átjáró</span>
              <span className="font-display text-[15px] font-extrabold">{Math.round(o.width * 100)} cm</span>
              <span className="text-[11.5px] leading-snug" style={{ color: MUTED }}>Fal nélküli nyílás a teljes belmagasságban — a bejárásban át lehet menni.</span>
            </>
          )}
        </div>
        <div className="flex min-h-[150px] flex-col gap-1.5 rounded-[20px] px-3 py-2.5" style={{ background: "rgba(255,255,255,.5)", border: "1px solid rgba(255,255,255,.7)" }}>
          <span className="text-[12px] font-bold" style={{ color: MUTED }}>Hely a falon</span>
          <PlaceDiagram o={o} len={len} />
          <span className="flex justify-between font-display text-[14px] font-extrabold"><span>← {fmt(Math.max(0, left))}</span><span>{fmt(Math.max(0, right))} →</span></span>
          <input type="range" className="twx-range" min={0} max={Math.max(0, len - o.width)} step={0.01} value={Math.max(0, left)} aria-label="Hely a fal mentén"
            style={{ ["--p" as string]: `${((Math.max(0, left) / Math.max(0.01, len - o.width)) * 100).toFixed(1)}%` }}
            onChange={(e) => liveSet({ offset: Math.round((Number(e.target.value) + o.width / 2) * 100) / 100 })} onPointerUp={history.end} onKeyUp={history.end} onBlur={history.end} />
          <div className="mt-auto"><button type="button" className={pill} onClick={() => set({ offset: Math.round((len / 2) * 100) / 100 })} title="A fal közepére">◎ Középre</button></div>
        </div>
      </div>

      {warns.map((w, i) => (
        <p key={i} className="mt-2.5 rounded-[14px] px-3 py-2 text-[12px]" style={w.kind === "overhang" || w.kind === "overlap" ? { background: "#FDECEA", color: "#9B2C1B" } : { background: "rgba(224,165,38,.16)", color: "#8A6416" }}>
          {w.kind === "overhang" || w.kind === "overlap" ? "⛔" : "⚠"} {w.text}
        </p>
      ))}

      <div className="mt-3.5 flex items-center gap-2">
        <button type="button" onClick={onDelete} className="h-8 rounded-full px-3.5 text-[12px] font-bold" style={{ background: "rgba(179,38,30,.08)", color: "#B3261E" }}>Törlés</button>
        <span className="flex-1 text-right text-[11px]" style={{ color: MUTED }}>húzd a fal mentén · ←/→ 1 cm, Shift 10 cm</span>
      </div>
    </div>
  );
}

