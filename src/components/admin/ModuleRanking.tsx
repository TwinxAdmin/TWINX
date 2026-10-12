// ModuleRanking — „Modul-rangsor" blokk az admin Modul-használat fülön (MH5).
//   • modulonként: megnyitás → futtatás sáv (halvány = megnyitás, sötét = futtatás), megnyitás, futtatás, felhasználó,
//     visszatérő %, változás az előző időszakhoz, kedvencnek jelölés; jelzések: „Érdeklődés > használat", „Felfutó"
//   • rendezhető; fix magasságú, belül görget
//   • egy modulra kattintva felugró ablak: KPI-k, napi görbe (futtatás + megnyitás), kik használják a legtöbbet
"use client";

import { useEffect, useMemo, useState } from "react";
import SelectField from "@/components/SelectField";
import { OfficeDialog } from "@/components/office/OfficeUi";

export type RankRow = {
  href: string; label: string; views: number; viewUsers: number; runs: number; users: number;
  returningPct: number; conversionPct: number | null; change: number | "new" | null; favorites: number;
  flags: ("interest" | "rising")[];
};

type ModuleDetail = {
  module: { href: string; label: string };
  kpi: { runs: number; views: number; users: number; viewUsers: number };
  top: { id: string; name: string; email: string; source: string; runs: number; views: number; last: string | null }[];
  curve: { day: string; runs: number; views: number }[];
};

type SortKey = "runs" | "views" | "users" | "returningPct" | "change" | "favorites";
const SORTS: { value: SortKey; label: string }[] = [
  { value: "runs", label: "Rendezés: futtatás" }, { value: "views", label: "Rendezés: megnyitás" },
  { value: "users", label: "Rendezés: felhasználó" }, { value: "returningPct", label: "Rendezés: visszatérő" },
  { value: "change", label: "Rendezés: változás" }, { value: "favorites", label: "Rendezés: kedvenc" },
];
const COLS = "lg:grid lg:grid-cols-[28px_minmax(0,1.3fr)_minmax(0,1.6fr)_72px_72px_78px_80px_74px_60px] lg:items-center lg:gap-3";
const MUTED = "#6E655C";

export default function ModuleRanking({ rows, query, loading }: { rows: RankRow[] | null; query: string; loading: boolean }) {
  const [sort, setSort] = useState<SortKey>("runs");
  const [open, setOpen] = useState<RankRow | null>(null);

  const sorted = useMemo(() => {
    const val = (r: RankRow) => sort === "change" ? (r.change === "new" ? 9999 : r.change ?? -9999) : r[sort];
    return [...(rows ?? [])].sort((a, b) => val(b) - val(a) || b.runs - a.runs);
  }, [rows, sort]);
  const max = Math.max(1, ...(rows ?? []).map((r) => Math.max(r.views, r.runs)));

  return (
    <section className="overflow-hidden rounded-2xl" style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] pb-3 pt-4">
        <h2 className="font-display text-lg font-semibold">Modul-rangsor</h2>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-3 text-[11px]" style={{ color: MUTED }}>
            <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2 w-4 rounded-full" style={{ background: "linear-gradient(90deg,#E3683F,#F4A48A)" }} />futtatás</span>
            <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2 w-4 rounded-full" style={{ background: "rgba(227,104,63,0.25)" }} />megnyitás</span>
          </span>
          <SelectField size="sm" className="w-[190px]" ariaLabel="Rendezés" value={sort} onChange={(v) => setSort(v as SortKey)} options={SORTS} />
        </div>
      </div>

      <div className="h-[472px] overflow-y-auto overscroll-contain">
        {/* a fejléc a görgető dobozon BELÜL, rögzítve — a görgetősáv így a fejlécet is szűkíti, az oszlopok egy vonalban maradnak */}
        <div className={`sticky top-0 z-10 hidden px-[18px] py-2 text-[10.5px] font-bold uppercase tracking-[0.06em] ${COLS}`} style={{ background: "#1B1815", color: "#BFB4A8" }}>
          <span>#</span><span>Modul</span><span>Megnyitás → futtatás</span><span className="text-right">Megnyitás</span><span className="text-right">Futtatás</span>
          <span className="text-right">Felhasználó</span><span className="text-right">Visszatérő</span><span className="text-right">Változás</span><span className="text-right">Kedvenc</span>
        </div>
        {!rows && <p className="p-5 text-sm" style={{ color: MUTED }}>{loading ? "Betöltés…" : "Nincs adat."}</p>}
        {sorted.map((r, i) => (
          <button key={r.href} type="button" onClick={() => setOpen(r)}
            className={`flex w-full flex-col gap-1.5 px-[18px] py-3 text-left text-[13px] transition-colors hover:bg-[#FBF6F0] lg:h-[54px] lg:py-0 ${COLS}`}
            style={{ borderTop: "1px solid #EFE7DD", opacity: r.runs || r.views ? 1 : 0.55 }}>
            <span className="hidden text-center font-extrabold lg:block" style={{ color: MUTED }}>{i + 1}</span>
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
              <b className="truncate">{r.label}</b>
              {r.flags.includes("rising") && <Flag bg="#DDF0E4" fg="#1F5C38" title="Legalább +30% az előző időszakhoz képest">FELFUTÓ</Flag>}
              {r.flags.includes("interest") && <Flag bg="#FFF0D6" fg="#8A5A00" title="Sokan megnyitják, de kevesen futtatják (35% alatt)">ÉRDEKLŐDÉS &gt; HASZNÁLAT</Flag>}
            </span>
            <span className="relative h-2.5 overflow-hidden rounded-full" style={{ background: "#F1EAE1" }}
              title={r.conversionPct === null ? "Még nincs megnyitás-adat" : `Akik megnyitották, ${r.conversionPct}%-uk futtatta is`}>
              <i className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(r.views / max) * 100}%`, background: "rgba(227,104,63,0.22)" }} />
              <i className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(r.runs / max) * 100}%`, background: "linear-gradient(90deg,#E3683F,#F4A48A)" }} />
            </span>
            <Num label="Megnyitás">{r.views}</Num>
            <Num label="Futtatás" strong>{r.runs}</Num>
            <Num label="Felhasználó">{r.users}</Num>
            <Num label="Visszatérő">{r.users ? `${r.returningPct}%` : "—"}</Num>
            <Num label="Változás">
              {r.change === null ? <span style={{ color: MUTED }}>—</span>
                : r.change === "new" ? <span style={{ color: "#1F7A4D" }}>új</span>
                : <span style={{ color: r.change >= 0 ? "#1F7A4D" : "#B3261E" }}>{r.change >= 0 ? "↑" : "↓"} {Math.abs(r.change)}%</span>}
            </Num>
            <Num label="Kedvenc">{r.favorites}</Num>
          </button>
        ))}
      </div>

      {open && (
        <OfficeDialog title={open.label} onClose={() => setOpen(null)} wide>
          <ModuleDetailBody href={open.href} query={query} />
        </OfficeDialog>
      )}
    </section>
  );
}

function Flag({ children, bg, fg, title }: { children: React.ReactNode; bg: string; fg: string; title: string }) {
  return <span title={title} className="rounded-full px-1.5 py-[2px] text-[9.5px] font-extrabold" style={{ background: bg, color: fg }}>{children}</span>;
}

function Num({ children, label, strong }: { children: React.ReactNode; label: string; strong?: boolean }) {
  return (
    <span className={`tabular-nums lg:text-right ${strong ? "font-bold" : ""}`}>
      <span className="font-normal lg:hidden" style={{ color: MUTED }}>{label}: </span>{children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Felugró ablak: egy modul részletei
// ---------------------------------------------------------------------------
function ModuleDetailBody({ href, query }: { href: string; query: string }) {
  const [d, setD] = useState<ModuleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/module-usage?${query}&module=${encodeURIComponent(href)}`)
      .then((r) => r.json())
      .then((x) => { if (alive) { if (x.error) setError(x.error); else setD(x as ModuleDetail); } })
      .catch(() => alive && setError("Nem sikerült betölteni."));
    return () => { alive = false; };
  }, [href, query]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  const max = Math.max(1, ...(d?.curve ?? []).map((c) => Math.max(c.runs, c.views)));

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["Futtatás", d?.kpi.runs], ["Megnyitás", d?.kpi.views], ["Felhasználó", d?.kpi.users], ["Megnyitotta", d?.kpi.viewUsers]].map(([t, v]) => (
          <div key={t as string} className="rounded-xl px-3 py-2" style={{ background: "#F8F3EC" }}>
            <p className="text-[10.5px]" style={{ color: MUTED }}>{t}</p>
            <b className="text-lg tabular-nums">{v ?? "…"}</b>
          </div>
        ))}
      </div>

      {/* napi görbe — fix magasság */}
      <div className="rounded-xl p-3" style={{ background: "#fff", border: "1px solid #EFE7DD" }}>
        <div className="flex h-[120px] items-end gap-[2px]">
          {(d?.curve ?? []).map((c) => (
            <div key={c.day} className="relative flex h-full min-w-0 flex-1 items-end" title={`${c.day}: ${c.runs} futtatás, ${c.views} megnyitás`}>
              <i className="absolute bottom-0 left-0 right-0 rounded-t-[2px]" style={{ height: `${(c.views / max) * 100}%`, background: "rgba(227,104,63,0.2)" }} />
              <i className="relative block w-full rounded-t-[2px]" style={{ height: `${(c.runs / max) * 100}%`, background: "#E3683F" }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px]" style={{ color: MUTED }}>
          <span>{d?.curve[0]?.day ?? ""}</span><span>ma</span>
        </div>
      </div>

      {/* kik használják a legtöbbet — fix magasság, belül görget */}
      <div>
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: MUTED }}>Kik használják a legtöbbet</p>
        <div className="h-[220px] overflow-y-auto rounded-xl" style={{ background: "#fff", border: "1px solid #EFE7DD" }}>
          {!d && <p className="p-3 text-sm" style={{ color: MUTED }}>Betöltés…</p>}
          {d && d.top.length === 0 && <p className="p-3 text-sm" style={{ color: MUTED }}>Ebben az időszakban senki nem használta.</p>}
          {d?.top.map((u) => (
            <div key={u.id} className="flex h-[44px] items-center gap-3 px-3 text-[13px]" style={{ borderBottom: "1px solid #F3EDE6" }}>
              <span className="min-w-0 flex-1 truncate"><b>{u.name || u.email}</b> <span className="text-xs" style={{ color: MUTED }}>· {u.source}</span></span>
              <span className="w-[86px] text-right tabular-nums"><b>{u.runs}</b> <span className="text-xs" style={{ color: MUTED }}>futt.</span></span>
              <span className="w-[86px] text-right tabular-nums" style={{ color: MUTED }}>{u.views} megn.</span>
              <span className="w-[90px] text-right text-xs" style={{ color: MUTED }}>{u.last ? new Date(u.last).toLocaleDateString("hu-HU", { month: "short", day: "numeric" }) : "—"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
