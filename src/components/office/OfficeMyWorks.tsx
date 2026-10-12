// OfficeMyWorks — „Munkáim" kártya az irodai felületen (kolléga- ÉS vezetői nézet).
// A saját munkák (privát + irodai) fix 5 soros, belül görgethető listában; kattintásra a közös
// WorkViewer nyílik, a „+ megosztás" gombbal a munka egy közös irodai mappába tehető — így a
// vezető is ugyanúgy dolgozhat közösen a kollégákkal, mint ők egymással. Adat: /api/office/works/list.
"use client";

import { useEffect, useState } from "react";
import type { OverviewRange, WorkRow } from "@/lib/office-overview";
import { fmtWhen } from "@/lib/office-format";
import { EmptyState } from "@/components/office/OfficeUi";
import WorkViewer, { FolderPicker, workKind, type ViewerWork } from "@/components/works/WorkViewer";

const RANGES: OverviewRange[] = ["7d", "14d", "30d", "all"];
const RANGE_TEXT: Record<OverviewRange, string> = { "7d": "1 hét", "14d": "2 hét", "30d": "30 nap", all: "Összes" };
const ROW_H = 49;          // egy sor magassága (48 + 1 px elválasztó)
const VISIBLE_ROWS = 5;

// ---------------------------------------------------------------------------
// Munkáim — fix 5 sor, görgethető; modul, munka, mappa, dátum, kredit
// ---------------------------------------------------------------------------
export default function OfficeMyWorks({ range, onRange }: { range: OverviewRange; onRange: (r: OverviewRange) => void }) {
  const [works, setWorks] = useState<WorkRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<{ index: number; pop: "folder" | "send" | null } | null>(null);
  const [picker, setPicker] = useState<{ id: string; folders: string[]; anchor: DOMRect } | null>(null);
  const [tick, setTick] = useState(0);

  // mappába tétel után frissítjük a „Mappa" oszlopot
  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener("twx-works-changed", on);
    return () => window.removeEventListener("twx-works-changed", on);
  }, []);

  useEffect(() => {
    let alive = true;
    if (tick === 0) setWorks(null);
    fetch(`/api/office/works/list?range=${range}`)
      .then((r) => r.json())
      .then((d) => { if (alive) { if (d.error) setError(d.error); else setWorks(d.works ?? []); } })
      .catch(() => alive && setError("Nem sikerült betölteni a munkáidat."));
    return () => { alive = false; };
  }, [range, tick]);

  const viewerWorks: ViewerWork[] = (works ?? []).map((w) => ({
    id: w.id, title: w.title, typeLabel: w.moduleLabel, url: w.fileUrl ?? null, createdAt: w.createdAt, mine: true, folders: w.folders,
  }));

  const COLS = "md:grid md:grid-cols-[120px_minmax(0,1fr)_minmax(0,170px)_80px_56px] md:items-center md:gap-3";

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl" style={{ background: "#FCFAF7", border: "1px solid #E9E0D5" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-[18px]">
        <h2 className="font-display text-[17px] font-semibold">Munkáim</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "#6B6258" }}>Időszak:</span>
          {RANGES.map((r) => (
            <button key={r} type="button" onClick={() => onRange(r)} aria-pressed={range === r}
              className="rounded-full px-2 py-[3px] text-[11px] font-semibold"
              style={range === r ? { background: "#1C1A17", color: "#fff" } : { background: "#F1EAE1", color: "#4A433C" }}>
              {RANGE_TEXT[r]}
            </button>
          ))}
        </div>
      </div>

      <div className={`hidden px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] ${COLS}`} style={{ background: "#1B1815", color: "#BFB4A8" }}>
        <span>Modul</span><span>Munka</span><span>Mappa</span><span>Dátum</span><span className="text-right">Kredit</span>
      </div>

      {/* fix magasság: 5 sor — a többi a dobozon belül görget */}
      <div className="h-[300px] overflow-y-auto overscroll-contain md:h-[var(--rows-h)]" style={{ ["--rows-h" as string]: `${ROW_H * VISIBLE_ROWS}px` }}>
        {error && <p className="p-4 text-sm text-red-600">{error}</p>}
        {!works && !error && <p className="p-4 text-sm" style={{ color: "#6B6258" }}>Betöltés…</p>}
        {works && works.length === 0 && (
          <div className="h-full p-4">
            <EmptyState
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18" /></svg>}
              title="Ebben az időszakban még nincs munkád"
              text="Amit a modulokban elkészítesz, itt jelenik meg — és egy kattintással megoszthatod egy közös irodai mappában." />
          </div>
        )}
        {works && works.map((w, i) => (
          <div key={w.id} role="button" tabIndex={0}
            onClick={() => setView({ index: i, pop: null })}
            onKeyDown={(e) => { if (e.key === "Enter") setView({ index: i, pop: null }); }}
            className={`flex cursor-pointer flex-col gap-1 px-4 py-2.5 text-[13px] transition-colors hover:bg-[#FBF6F0] md:h-12 md:py-0 ${COLS}`} style={{ borderBottom: "1px solid #EFE7DD" }}>
            <span className="truncate text-xs md:text-[13px]" style={{ color: "#6B6258" }}>{w.moduleLabel}</span>
            <span className="flex min-w-0 items-center gap-2">
              <KindBadge url={w.fileUrl ?? null} />
              <strong className="truncate">{w.title}</strong>
            </span>
            <span className="min-w-0">
              {w.folders && w.folders.length > 0 ? (
                <span className="inline-block max-w-full truncate rounded-full px-2 py-[3px] text-[11px] font-semibold" title={w.folders.join(", ")}
                  style={{ background: "#FBE1D6", color: "#A8411F" }}>
                  {w.folders[0]}{w.folders.length > 1 ? ` +${w.folders.length - 1}` : ""}
                </span>
              ) : (
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); setPicker({ id: w.id, folders: w.folders ?? [], anchor: e.currentTarget.getBoundingClientRect() }); }}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-semibold transition-colors hover:bg-[#FBE1D6]"
                  style={{ color: "#C2512F", border: "1px dashed #E8B9A6" }}>
                  + megosztás
                </button>
              )}
            </span>
            <span className="text-xs" style={{ color: "#6B6258" }}>{fmtWhen(w.createdAt, false)}</span>
            <strong className="tabular-nums md:text-right">{w.credits > 0 ? `−${w.credits}` : "0"}</strong>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-4 py-2 text-xs" style={{ borderTop: "1px solid #EFE7DD", color: "#6B6258" }}>
        <span>{works ? `${works.length}${works.length >= 50 ? "+" : ""} munka ebben az időszakban` : " "}</span>
        <a href="/dashboard/munkaim" className="font-semibold" style={{ color: "#C2512F" }}>Összes munkám →</a>
      </div>

      {picker && <FolderPicker work={{ id: picker.id, folders: picker.folders }} anchor={picker.anchor} onClose={() => setPicker(null)} />}

      {view && viewerWorks.length > 0 && (
        <WorkViewer works={viewerWorks} index={view.index} initialPop={view.pop} canShare
          onIndex={(i) => setView({ index: i, pop: null })} onClose={() => setView(null)} />
      )}
    </section>
  );
}

/** Kis típus-jelző a munka címe előtt (videó / kép / PDF). */
function KindBadge({ url }: { url: string | null }) {
  const k = workKind(url);
  const txt = k === "video" ? "▶" : k === "image" ? "IMG" : k === "pdf" ? "PDF" : "·";
  return (
    <span className="flex h-5 min-w-[28px] flex-none items-center justify-center rounded-md px-1 text-[9px] font-bold"
      style={k === "video" ? { background: "#1C1A17", color: "#F08A68" } : { background: "#F1EAE1", color: "#6B6258" }}>
      {txt}
    </span>
  );
}
