// PlanEditor — a javító mód új szerkesztője (2026-10-16, a design/alaprajz-javito-latvanyterv.html szerint).
// Osztott 2D | 3D nézet húzható elválasztóval, közös kijelölés (a 3D kamera odafordul), közös visszavonás (Ctrl+Z / Ctrl+Shift+Z),
// eszközök: Kijelölés (V) · Fal húzása (W) · + Ajtó (D) · + Ablak (A) · + Oszlop (O). A nyílászáró beállításai felugró kártyán.
// Telefonon / keskeny képernyőn: egyszerű nézet + bezárható értesítés (a teljes szerkesztés asztali gépen).
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { FloorPlan, OpeningPreset, Pt } from "@/lib/floorplan3d/plan";
import { OPENING_PRESETS } from "@/lib/floorplan3d/plan";
import { checkPlan, planBounds, roomEdge } from "@/lib/floorplan3d/geometry";
import { colliders, findPath, startPose } from "@/lib/floorplan3d/walk";
import { deleteVertex, patchOpening, removeColumn, typeOf } from "@/lib/floorplan3d/edit";
import type { SceneOptions } from "@/lib/floorplan3d/scene";
import Plan2D, { type Underlay, type View2DApi } from "@/components/floorplan3d/editor/Plan2D";
import Plan3D, { type View3DApi } from "@/components/floorplan3d/editor/Plan3D";
import OpeningCard, { TypeGlyph } from "@/components/floorplan3d/editor/OpeningCard";
import Inspector from "@/components/floorplan3d/editor/Inspector";
import { MUTED } from "@/components/floorplan3d/editor/parts";
import { useHistory, type Ghost, type Pending, type Selection, type Tool, type ViewMode } from "@/components/floorplan3d/editor/state";

const TOOLS: { t: Tool; label: string; key: string; title: string }[] = [
  { t: "select", label: "↖ Kijelölés", key: "V", title: "Kijelölés, húzás (nyílászáró, sarokpont, oszlop)" },
  { t: "wall", label: "⇕ Fal húzása", key: "W", title: "Fogd meg a falat és húzd ki vagy be (a szomszéd fal vele mozog; Alt: csak ez)" },
  { t: "door", label: "＋ Ajtó", key: "D", title: "Ajtó, üvegajtó vagy átjáró lerakása a falra" },
  { t: "window", label: "＋ Ablak", key: "A", title: "Ablak lerakása a falra" },
  { t: "column", label: "▮ Oszlop", key: "O", title: "Tartóoszlop lerakása" },
];

export default function PlanEditor({ plan, setPlan, tolerancePct, cornerMin, sceneOptions, underlay, headerRight, footer }: {
  plan: FloorPlan; setPlan: (p: FloorPlan) => void; tolerancePct: number; cornerMin: number; sceneOptions: SceneOptions;
  underlay: Underlay; headerRight?: ReactNode; footer?: ReactNode;
}) {
  const history = useHistory(plan, setPlan);
  const [sel, setSel] = useState<Selection>(null);
  const [tool, setToolState] = useState<Tool>("select");
  const [pending, setPending] = useState<Pending>(null);
  const [ghost, setGhost] = useState<Ghost>(null);
  const [view, setView] = useState<ViewMode>("split");
  const [split, setSplit] = useState(0.56);
  const [underlayOn, setUnderlayOn] = useState(true);
  const [opacity, setOpacity] = useState(0.45);
  const [toast, setToast] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [narrowOk, setNarrowOk] = useState(false);
  const viewsRef = useRef<HTMLDivElement>(null);
  const api2d = useRef<View2DApi | null>(null);
  const api3d = useRef<View3DApi | null>(null);

  const check = useMemo(() => checkPlan(plan, tolerancePct), [plan, tolerancePct]);
  const checks = useMemo(() => new Map(check.rooms.map((c) => [c.roomId, c])), [check]);
  // bejárhatóság (2026-10-16): a kezdőpontból (előszoba) minden helyiségbe el lehet-e jutni — ajtó / átjáró / nyitott határ hiánya
  // így már a jóváhagyás ELŐTT kiderül (nem tilt, csak jelez). Bútor nélkül számol (az a 3D-lépésben jön).
  const unreachable = useMemo(() => {
    const rects = colliders(plan, sceneOptions, []), st = startPose(plan, rects), b = planBounds(plan);
    return plan.rooms.filter((r) => {
      const c: Pt = [r.polygon.reduce((s2, q) => s2 + q[0], 0) / r.polygon.length, r.polygon.reduce((s2, q) => s2 + q[1], 0) / r.polygon.length];
      return !findPath(st.pos, c, rects, b);
    });
  }, [plan, sceneOptions]);

  // keskeny képernyő (telefon, kis tablet): csak a 2D, bezárható értesítéssel
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const f = () => { setNarrow(mq.matches); if (mq.matches) setView("2d"); };
    f(); mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  // érvénytelen kijelölés (pl. visszavonás után már nem létező elem) → törlés
  useEffect(() => {
    if (sel?.type === "opening" && !plan.openings.some((o) => o.id === sel.id)) setSel(null);
    if (sel?.type === "column" && !(plan.columns ?? []).some((c) => c.id === sel.id)) setSel(null);
    if ((sel?.type === "room" || sel?.type === "edge" || sel?.type === "vertex") && !plan.rooms.some((r) => r.id === sel.roomId)) setSel(null);
    if (sel?.type === "vertex") { const r = plan.rooms.find((x) => x.id === sel.roomId); if (r && sel.index >= r.polygon.length) setSel({ type: "room", roomId: r.id }); }
    if (sel?.type === "edge") { const r = plan.rooms.find((x) => x.id === sel.roomId); if (r && sel.edge >= r.polygon.length) setSel({ type: "room", roomId: r.id }); }
  }, [plan, sel]);

  const setTool = useCallback((t: Tool) => { setToolState(t); setPending(null); setGhost(null); }, []);
  const flash = (t: string) => { setToast(t); window.setTimeout(() => setToast((x) => (x === t ? null : x)), 4000); };

  const del = useCallback(() => {
    if (sel?.type === "opening") {
      const o = plan.openings.find((x) => x.id === sel.id); if (!o) return;
      history.commit({ ...plan, openings: plan.openings.filter((x) => x.id !== o.id) });
      setSel({ type: "edge", roomId: o.roomId, edge: o.edge }); flash("Nyílászáró törölve");
    } else if (sel?.type === "column") { history.commit(removeColumn(plan, sel.id)); setSel(null); flash("Oszlop törölve"); }
    else if (sel?.type === "vertex") { const n = deleteVertex(plan, sel.roomId, sel.index); if (n) { history.commit(n); setSel({ type: "room", roomId: sel.roomId }); flash("Sarokpont törölve"); } }
  }, [sel, plan, history]);

  // billentyűk
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (k === "z" || k === "y")) { e.preventDefault(); if (k === "y" || e.shiftKey) history.redo(); else history.undo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (k === "escape") { if (pending || tool !== "select") setTool("select"); else setSel(null); return; }
      if (k === "delete" || k === "backspace") { e.preventDefault(); del(); return; }
      if (k === "v") setTool("select"); else if (k === "w") setTool("wall"); else if (k === "d") setTool("door"); else if (k === "a") setTool("window"); else if (k === "o") setTool("column");
      if (sel?.type === "opening" && (k === "arrowleft" || k === "arrowright")) {
        e.preventDefault();
        const o = plan.openings.find((x) => x.id === sel.id), r = o && plan.rooms.find((x) => x.id === o.roomId);
        if (o && r) { const len = roomEdge(r, o.edge).length, st = (k === "arrowright" ? 1 : -1) * (e.shiftKey ? 0.1 : 0.01); history.commit(patchOpening(plan, o.id, { offset: Math.round(Math.max(o.width / 2, Math.min(len - o.width / 2, o.offset + st)) * 100) / 100 })); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [history, pending, tool, sel, plan, del, setTool]);

  // a nyílászáró-kártya horgonya: a nyílás közepe a látható nézetben
  const anchor = useCallback(() => {
    if (sel?.type !== "opening") return null;
    const o = plan.openings.find((x) => x.id === sel.id), r = o && plan.rooms.find((x) => x.id === o.roomId);
    if (!o || !r) return null;
    const e = roomEdge(r, o.edge), len = e.length || 1;
    const p: Pt = [e.a[0] + ((e.b[0] - e.a[0]) * o.offset) / len, e.a[1] + ((e.b[1] - e.a[1]) * o.offset) / len];
    return (view !== "3d" ? api2d.current?.screenOf(p) : null) ?? api3d.current?.screenOf(p) ?? null;
  }, [sel, plan, view]);

  const onPlaced = useCallback((s: Selection) => { setSel(s); setTool("select"); }, [setTool]);
  const palette = tool === "door" ? OPENING_PRESETS.filter((p) => p.kind === "door" || p.kind === "passage") : tool === "window" ? OPENING_PRESETS.filter((p) => p.kind === "window") : [];
  const okCount = check.rooms.filter((c) => c.status === "ok" || c.status === "approved").length;

  const hint = pending ? <><b>{pending.label}:</b> vidd a falra (2D vagy 3D) és kattints · Esc: mégse</>
    : tool === "wall" ? <><b>Fal húzása:</b> fogd meg a falat és húzd — 1 cm-es lépés, mágnes; a szomszéd fal vele mozog (Alt: csak ez)</>
    : tool === "column" ? <><b>Oszlop:</b> kattints oda, ahol a tartóoszlop áll — a falhoz illeszkedik · Esc: mégse</>
    : tool === "door" || tool === "window" ? <><b>{tool === "door" ? "Ajtó" : "Ablak"}:</b> válassz méretet a palettán</>
    : <><b>Kijelölés:</b> kattints helyiségre, falra, nyílászáróra · húzással mozgatsz · dupla kattintás a falon: új sarokpont · görgő: nagyítás</>;

  const cols = view === "2d" ? "1fr 0" : view === "3d" ? "0 1fr" : `${split}fr 10px ${1 - split}fr`;
  return (
    <div className="twx-card flex flex-col overflow-hidden p-0" style={{ height: narrow ? 1080 : 760 }}>
      {/* eszköztár */}
      <div className="flex min-h-[56px] flex-wrap items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid var(--twx-line)" }}>
        <div className="relative inline-flex gap-0.5 rounded-full p-[3px]" style={{ background: "#F1EAE1" }}>
          {TOOLS.filter((x) => !narrow || x.t === "select" || x.t === "door" || x.t === "window").map((x) => (
            <button key={x.t} type="button" onClick={() => setTool(x.t)} aria-pressed={tool === x.t} title={`${x.title} (${x.key})`}
              className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold" style={tool === x.t ? { background: "#12100e", color: "#fff" } : { color: "#4A433C" }}>
              {x.label}{!narrow && <span className="rounded border border-current px-[3px] text-[10px] leading-[14px] opacity-55">{x.key}</span>}
            </button>
          ))}
        </div>
        <button type="button" onClick={history.undo} disabled={!history.canUndo} title="Visszavonás (Ctrl+Z)" aria-label="Visszavonás"
          className="flex h-[34px] w-[34px] items-center justify-center rounded-full disabled:opacity-35" style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>↶</button>
        <button type="button" onClick={history.redo} disabled={!history.canRedo} title="Újra (Ctrl+Shift+Z)" aria-label="Újra"
          className="flex h-[34px] w-[34px] items-center justify-center rounded-full disabled:opacity-35" style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>↷</button>
        {!narrow && (
          <div className="inline-flex gap-0.5 rounded-full p-[3px]" style={{ background: "#F1EAE1" }}>
            {([["2d", "2D"], ["split", "2D | 3D"], ["3d", "3D"]] as const).map(([v, t]) => (
              <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} className="h-8 rounded-full px-3 text-[12.5px] font-semibold"
                style={view === v ? { background: "#12100e", color: "#fff" } : { color: "#4A433C" }}>{t}</button>
            ))}
          </div>
        )}
        <span className="flex-1" />
        <span className="flex h-8 items-center rounded-full px-3 text-[12px] font-semibold" style={okCount === plan.rooms.length ? { background: "rgba(47,158,95,.14)", color: "#2f7a4f" } : { background: "rgba(224,165,38,.18)", color: "#8A6416" }}>
          {okCount}/{plan.rooms.length} helyiség rendben
        </span>
        <button type="button" onClick={() => unreachable[0] && setSel({ type: "room", roomId: unreachable[0].id })}
          title={unreachable.length ? `Nem lehet bejutni: ${unreachable.map((r) => r.name).join(", ")} — hiányzik egy ajtó / átjáró, vagy egy fal zárja el. Kattints az elsőre.` : "A bejárásban minden helyiség elérhető"}
          className="flex h-8 items-center rounded-full px-3 text-[12px] font-semibold" style={unreachable.length ? { background: "rgba(224,165,38,.18)", color: "#8A6416" } : { background: "rgba(47,158,95,.14)", color: "#2f7a4f" }}>
          {unreachable.length ? `Bejárás: ${unreachable.length} helyiség zárt` : "Bejárás: minden elérhető"}
        </button>
        {headerRight}
      </div>

      {narrow && !narrowOk && (
        <div className="flex items-center gap-3 px-4 py-2.5 text-[12.5px]" style={{ background: "#FFF3EC", borderBottom: "1px solid #F3D3C4" }}>
          <span className="flex-1">A teljes szerkesztés (falhúzás, sarokpontok, 3D, oszlop) <b>asztali gépen</b> érhető el, és ott sokkal pontosabb. Itt a nyílászárók és a m² javítható.</span>
          <button type="button" onClick={() => setNarrowOk(true)} className="h-8 flex-none rounded-full px-3 text-[12px] font-semibold" style={{ background: "#12100e", color: "#fff" }}>Rendben</button>
        </div>
      )}

      <div className={`flex min-h-0 flex-1 ${narrow ? "flex-col" : ""}`}>
        <div ref={viewsRef} className={`relative grid min-w-0 ${narrow ? "h-[380px] flex-none" : "flex-1"}`} style={{ gridTemplateColumns: cols }}>
          {/* 2D */}
          <div className="relative min-w-0 overflow-hidden">
            <Plan2D plan={plan} checks={checks} sel={sel} onSelect={setSel} tool={tool} pending={pending} onPlaced={onPlaced} history={history}
              underlay={underlay} underlayOn={underlayOn} underlayOpacity={opacity} wall={sceneOptions.interiorWall} apiRef={api2d} ghost={ghost} onGhost={setGhost} />
            <div className="pointer-events-none absolute left-3 top-2.5 flex items-center gap-2">
              <span className="rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide" style={{ background: "rgba(253,251,246,.9)", color: MUTED }}>Alaprajz · 2D</span>
              {underlay && (
                <span className="pointer-events-auto flex items-center gap-2 rounded-full px-3 py-1 text-[11.5px] font-semibold" style={{ background: "rgba(253,251,246,.92)", border: "1px solid var(--twx-line)" }}>
                  <label className="flex cursor-pointer items-center gap-1.5">
                    <input type="checkbox" checked={underlayOn} onChange={(e) => setUnderlayOn(e.target.checked)} style={{ accentColor: "var(--twx-coral)" }} />Eredeti rajz
                  </label>
                  <input type="range" className="twx-range" min={0.1} max={1} step={0.05} value={opacity} disabled={!underlayOn} onChange={(e) => setOpacity(Number(e.target.value))}
                    style={{ width: 90, ["--p" as string]: `${(((opacity - 0.1) / 0.9) * 100).toFixed(0)}%` }} aria-label="Az eredeti rajz áttetszősége" title="Áttetszőség" />
                </span>
              )}
            </div>
          </div>
          {view === "split" && (
            <div className="relative cursor-col-resize" style={{ background: "#EFE7DD" }} title="Húzd a nézetek arányához"
              onPointerDown={(e) => {
                const host = viewsRef.current!.getBoundingClientRect(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                const move = (ev: PointerEvent) => setSplit(Math.max(0.25, Math.min(0.75, (ev.clientX - host.left) / host.width)));
                const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
                window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
              }}>
              <span className="absolute left-1 top-1/2 -mt-[18px] h-9 w-0.5 rounded" style={{ background: "#C9BEB1" }} />
            </div>
          )}
          {/* 3D */}
          {!narrow && (
            <div className="relative min-w-0 overflow-hidden">
              <Plan3D plan={plan} opts={sceneOptions} sel={sel} onSelect={setSel} tool={tool} pending={pending} onPlaced={onPlaced} history={history} apiRef={api3d} ghost={ghost} onGhost={setGhost} />
              <span className="pointer-events-none absolute left-3 top-2.5 rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide" style={{ background: "rgba(253,251,246,.9)", color: MUTED }}>3D-ellenőrzés · húzással forgatható</span>
            </div>
          )}

          {/* paletta: ajtó / ablak méret */}
          {palette.length > 0 && !pending && (
            <div className="twx-glass absolute left-3 top-12 z-20 w-[560px] max-w-[calc(100%-24px)] rounded-[26px] p-4">
              <div className="mb-2.5 flex items-center gap-2">
                <b className="flex-1 text-[14px]">{tool === "door" ? "Ajtó, üvegajtó vagy átjáró" : "Ablak"} — válassz méretet</b>
                <button type="button" onClick={() => setTool("select")} className="h-7 rounded-full px-3 text-[12px] font-semibold" style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>Mégse (Esc)</button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {palette.map((p: OpeningPreset) => (
                  <button key={p.id} type="button" onClick={() => setPending(p)}
                    className="flex h-[88px] flex-col items-center justify-center gap-1 rounded-[18px] px-1 text-center text-[11.5px] font-semibold leading-tight hover:border-[#D8CCBF]"
                    style={{ background: "rgba(255,255,255,.65)", border: "1px solid rgba(255,255,255,.8)" }}>
                    <TypeGlyph t={typeOf(p)} size={28} />{p.label}
                  </button>
                ))}
              </div>
              <p className="mt-2.5 text-[11.5px]" style={{ color: MUTED }}>Utána vidd a kurzort a falra (2D vagy 3D): a szellemkép a falra ugrik, piros, ha nem fér el. Kattintás = lerakás; a méret utána bármikor állítható.</p>
            </div>
          )}

          {sel?.type === "opening" && tool === "select" && (
            <OpeningCard plan={plan} id={sel.id} history={history} cornerMin={cornerMin} anchor={anchor} boundsRef={viewsRef}
              onClose={() => { const o = plan.openings.find((x) => x.id === sel.id); setSel(o ? { type: "room", roomId: o.roomId } : null); }} onDelete={del} />
          )}
          {toast && (
            <div className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full py-2 pl-4 pr-2 text-[12.5px] text-white" style={{ background: "#12100e" }}>
              {toast}<button type="button" onClick={() => { history.undo(); setToast(null); }} className="rounded-full px-2 py-0.5 font-bold" style={{ color: "#F08A68" }}>Visszavonás</button>
            </div>
          )}
        </div>
        {/* jobb oldali panel (telefonon a rajz alatt) */}
        <aside className={`flex flex-col ${narrow ? "min-h-0 flex-1" : "w-[340px] flex-none"}`} style={{ [narrow ? "borderTop" : "borderLeft"]: "1px solid var(--twx-line)", background: "#fff" }}>
          <Inspector plan={plan} check={check} checks={checks} sel={sel} onSelect={setSel} history={history} tolerancePct={tolerancePct} onTool={setTool} />
        </aside>
      </div>
      <div className="flex min-h-[32px] items-center gap-4 px-3.5 text-[11.5px]" style={{ borderTop: "1px solid var(--twx-line)", color: MUTED }}>
        <span className="min-w-0 flex-1 truncate">{hint}</span>
        {footer}
        <span className="hidden md:inline">Ctrl+Z visszavonás · Ctrl+Shift+Z újra</span>
      </div>
    </div>
  );
}
