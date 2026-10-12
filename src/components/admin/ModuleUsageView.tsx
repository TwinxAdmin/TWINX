// ModuleUsageView — Admin → Felhasználók → „Modul-használat" fül (MH4; látványterv: design/admin-modul-hasznalat-latvanyterv.html).
// Pénzügy NINCS benne (az a Költségfigyelőben van). Adat: GET /api/admin/module-usage.
//   • szűrősáv: időszak · forrás · mód · „Admin és sales is" (alapból KI)
//   • KPI-sor: futtatások, aktív felhasználók, megnyitásból futtatás, legnépszerűbb modul, alvó felhasználók
//   • Új regisztrálók sáv: csempék egyszerre több időszakra + a kiválasztott grafikonja (nap / hét / hónap) és bontása
//   • Modul-rangsor (MH5, ModuleRanking) — kattintásra a modul részletei
//   • Felhasználók és kedvenc moduljaik (MH6, UserModuleTable) — TOP 5 + részletes felhasználói ablak
//   • Irodák és munkaterek (MH7, OfficeUsageCard) — váltó + iroda részletei (tag × modul)
//   • CSV letöltése (MH8) — a betöltött adatok egy fájlban, a szűrősáv beállításaival (moduleUsageCsv)
// Minden blokk fix méretű; betöltés közben a helyükön marad, nem ugrik.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SelectField from "@/components/SelectField";
import ModuleRanking, { type RankRow } from "@/components/admin/ModuleRanking";
import UserModuleTable, { type UsageUser } from "@/components/admin/UserModuleTable";
import OfficeUsageCard, { type OfficeUsageRow } from "@/components/admin/OfficeUsageCard";
import { moduleUsageCsv } from "@/components/admin/moduleUsageCsv";
import { downloadCsv } from "@/lib/csv";

type Range = "7d" | "30d" | "90d" | "all";
type RegWindow = "today" | "7d" | "30d" | "90d" | "12m" | "all";
type RegGroup = "day" | "week" | "month";

export type UsageOverview = {
  modules: { href: string; label: string }[];
  kpi: { runs: number; runsPrev: number | null; activeUsers: number; activePrev: number | null; conversionPct: number | null; topModule: string | null; sleeping: number };
  registrations: {
    tiles: { window: RegWindow; count: number; prev: number | null }[];
    selected: { window: RegWindow; group: RegGroup; count: number; direct: number; landing: number; activated: number; series: { from: string; direct: number; landing: number }[] };
  };
  ranking: RankRow[];
  users: UsageUser[];
  offices: { office: OfficeUsageRow[]; team: OfficeUsageRow[] };
  viewsSince: string | null;
};

const RANGES: { v: Range; t: string }[] = [{ v: "7d", t: "7 nap" }, { v: "30d", t: "30 nap" }, { v: "90d", t: "90 nap" }, { v: "all", t: "Összes" }];
const REG_TEXT: Record<RegWindow, string> = { today: "Ma", "7d": "7 nap", "30d": "30 nap", "90d": "90 nap", "12m": "12 hónap", all: "Összes" };
const SOURCE_TEXT: Record<string, string> = { all: "mind", direct: "közvetlen", landing: "ingatlan landing" };
const MODE_TEXT: Record<string, string> = { all: "mind", private: "privát", office: "irodai fiók", team: "közös munkatér" };
const DARK = "#12100e", CORAL = "#E3683F", TEAL = "#2F7F86", MUTED = "#6E655C";

export default function ModuleUsageView() {
  const [range, setRange] = useState<Range>("30d");
  const [source, setSource] = useState("all");
  const [mode, setMode] = useState("all");
  const [staff, setStaff] = useState(false);
  const [reg, setReg] = useState<RegWindow>("30d");
  const [group, setGroup] = useState<RegGroup>("day");
  const [data, setData] = useState<UsageOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // a részlet-ablakok ugyanezekkel a szűrőkkel kérdeznek
  const filterQuery = useMemo(() => new URLSearchParams({ range, source, mode, staff: staff ? "1" : "0" }).toString(), [range, source, mode, staff]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ range, source, mode, staff: staff ? "1" : "0", reg, group });
      const d = await fetch(`/api/admin/module-usage?${q}`).then((r) => r.json());
      if (d.error) setError(d.error); else setData(d as UsageOverview);
    } catch {
      setError("Nem sikerült betölteni az adatokat.");
    } finally {
      setLoading(false);
    }
  }, [range, source, mode, staff, reg, group]);

  useEffect(() => { void load(); }, [load]);

  function exportCsv() {
    if (!data) return;
    const csv = moduleUsageCsv(data, {
      range: RANGES.find((r) => r.v === range)?.t ?? range, source: SOURCE_TEXT[source] ?? source,
      mode: MODE_TEXT[mode] ?? mode, staff, reg: REG_TEXT[reg],
    });
    const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Budapest" }); // ÉÉÉÉ-HH-NN
    downloadCsv(`twinx-modul-hasznalat-${range}-${day}.csv`, csv);
  }

  function pickReg(w: RegWindow) {
    setReg(w);
    // a grafikon alapértelmezett bontása az ablakhoz igazodik (kézzel átállítható)
    setGroup(w === "12m" || w === "all" ? "month" : w === "90d" ? "week" : "day");
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ---------------- szűrősáv ---------------- */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl px-3.5 py-3" style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
        <Seg value={range} onChange={(v) => setRange(v as Range)} items={RANGES.map((r) => ({ v: r.v, t: r.t }))} />
        <SelectField size="sm" className="w-[190px]" ariaLabel="Forrás" value={source} onChange={setSource}
          options={[{ value: "all", label: "Forrás: mind" }, { value: "direct", label: "Forrás: közvetlen" }, { value: "landing", label: "Forrás: ingatlan landing" }]} />
        <SelectField size="sm" className="w-[200px]" ariaLabel="Mód" value={mode} onChange={setMode}
          options={[{ value: "all", label: "Mód: mind" }, { value: "private", label: "Mód: privát" }, { value: "office", label: "Mód: irodai fiók" }, { value: "team", label: "Mód: közös munkatér" }]} />
        <button type="button" onClick={() => setStaff((s) => !s)} aria-pressed={staff}
          className="inline-flex items-center gap-2 text-xs font-semibold" title="Az admin és sales kollégák bemutatói és tesztjei alapból kimaradnak.">
          <span className="relative h-5 w-[34px] rounded-full transition-colors" style={{ background: staff ? "#F08A68" : "#D9CFC3" }}>
            <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: staff ? 16 : 2 }} />
          </span>
          Admin és sales is
        </button>
        <span className="ml-auto text-xs" style={{ color: MUTED }}>{loading ? "Frissítés…" : " "}</span>
        <button type="button" onClick={exportCsv} disabled={!data || loading}
          title={!data || loading ? "Az adatok betöltése után tölthető le" : "A jelenlegi szűrőkkel látható adatok Excelben megnyitható fájlba (CSV)"}
          className="inline-flex h-8 w-[136px] items-center justify-center gap-1.5 rounded-full text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
          <span aria-hidden>⤓</span> CSV letöltése
        </button>
      </div>

      {error && <p className="rounded-xl px-4 py-3 text-sm text-red-700" style={{ background: "#FDECEA" }}>{error}</p>}

      {/* ---------------- KPI-k ---------------- */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        <Kpi label="Futtatások" value={data?.kpi.runs} delta={pctDelta(data?.kpi.runs, data?.kpi.runsPrev)} />
        <Kpi label="Aktív felhasználók" value={data?.kpi.activeUsers} delta={absDelta(data?.kpi.activeUsers, data?.kpi.activePrev)} />
        <Kpi label="Megnyitásból futtatás" value={data ? (data.kpi.conversionPct === null ? "—" : `${data.kpi.conversionPct}%`) : undefined}
          hint={data?.viewsSince === null && data ? "a megnyitás-mérés indulásától" : undefined} />
        <Kpi label="Legnépszerűbb modul" value={data ? data.kpi.topModule ?? "—" : undefined} small />
        <Kpi label={`Alvó felhasználók (30 nap)`} value={data?.kpi.sleeping} />
      </div>

      {/* ---------------- új regisztrálók ---------------- */}
      <RegistrationsBand data={data} reg={reg} group={group} onReg={pickReg} onGroup={setGroup} />

      {/* ---------------- modul-rangsor ---------------- */}
      <ModuleRanking rows={data?.ranking ?? null} query={filterQuery} loading={loading} />

      {/* ---------------- felhasználók TOP 5-tel ---------------- */}
      <UserModuleTable users={data?.users ?? null} moduleCount={data?.modules.length ?? 0} query={filterQuery} loading={loading}
        onOpenBalances={() => { window.location.href = "/admin/users"; }} />

      {/* ---------------- irodák és munkaterek ---------------- */}
      <OfficeUsageCard data={data?.offices ?? null} query={filterQuery} loading={loading} />

      <p className="text-xs" style={{ color: MUTED }}>
        A megnyitásokat a TWINX 2026. október 12-től méri (fejenként, modulonként naponta egyszer). Pénzügyi adatok a Pénzügy → Költségfigyelő oldalon.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Seg<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { v: T; t: string }[] }) {
  return (
    <div className="inline-flex rounded-full p-[3px]" style={{ background: "#F1EAE1" }}>
      {items.map((it) => (
        <button key={it.v} type="button" onClick={() => onChange(it.v)} aria-pressed={value === it.v}
          className="h-7 rounded-full px-3 text-xs font-semibold"
          style={value === it.v ? { background: DARK, color: "#fff" } : { color: "#4A433C" }}>
          {it.t}
        </button>
      ))}
    </div>
  );
}

type Delta = { text: string; up: boolean } | null;
function pctDelta(cur?: number, prev?: number | null): Delta {
  if (cur === undefined || prev === null || prev === undefined) return null;
  if (prev === 0) return cur > 0 ? { text: "új", up: true } : null;
  const p = Math.round(((cur - prev) / prev) * 100);
  return { text: `${p >= 0 ? "↑" : "↓"} ${Math.abs(p)}%`, up: p >= 0 };
}
function absDelta(cur?: number, prev?: number | null): Delta {
  if (cur === undefined || prev === null || prev === undefined) return null;
  const d = cur - prev;
  return d === 0 ? null : { text: `${d > 0 ? "↑" : "↓"} ${Math.abs(d)}`, up: d > 0 };
}

function Kpi({ label, value, delta, hint, small }: { label: string; value?: number | string; delta?: Delta; hint?: string; small?: boolean }) {
  return (
    <div className="h-[86px] rounded-2xl px-4 py-3" style={{ background: DARK, color: "#F3EDE6" }}>
      <p className="text-xs" style={{ color: "#A89E94" }}>{label}</p>
      <p className={`mt-1 truncate font-display font-extrabold tabular-nums ${small ? "text-lg" : "text-2xl"}`}>
        {value === undefined ? <span style={{ color: "#5A514A" }}>…</span> : typeof value === "number" ? value.toLocaleString("hu-HU") : value}
        {delta && <span className="ml-1.5 text-xs font-semibold" style={{ color: delta.up ? "#7BD39B" : "#F4A48A" }}>{delta.text}</span>}
      </p>
      {hint && <p className="truncate text-[10.5px]" style={{ color: "#8F857B" }}>{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Új regisztrálók — fix magasságú sáv
// ---------------------------------------------------------------------------
function RegistrationsBand({ data, reg, group, onReg, onGroup }: {
  data: UsageOverview | null; reg: RegWindow; group: RegGroup; onReg: (w: RegWindow) => void; onGroup: (g: RegGroup) => void;
}) {
  const sel = data?.registrations.selected;
  const max = Math.max(1, ...(sel?.series ?? []).map((b) => b.direct + b.landing));
  const total = Math.max(1, sel?.count ?? 0);

  return (
    <section className="grid gap-4 rounded-2xl px-[18px] py-4 lg:h-[300px] lg:grid-cols-[1.05fr_1fr]"
      style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Új regisztrálók</h2>
          <span className="text-[11px]" style={{ color: MUTED }}>kattints egy időszakra</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(data?.registrations.tiles ?? (["today", "7d", "30d", "90d", "12m", "all"] as RegWindow[]).map((w) => ({ window: w, count: NaN, prev: null }))).map((t) => {
            const on = t.window === reg;
            const d = t.prev === null || Number.isNaN(t.count) ? null : t.count - t.prev;
            return (
              <button key={t.window} type="button" onClick={() => onReg(t.window)} aria-pressed={on}
                className="h-[62px] rounded-xl px-3 py-2 text-left"
                style={on ? { background: DARK, color: "#fff", border: `1px solid ${DARK}` } : { background: "#F8F3EC", border: "1px solid #EFE7DD" }}>
                <span className="block text-[11px]" style={{ color: on ? "#A89E94" : MUTED }}>{REG_TEXT[t.window]}</span>
                <span className="font-display text-[22px] font-bold tabular-nums">{Number.isNaN(t.count) ? "…" : t.count}</span>
                {d !== null && d !== 0 && (
                  <span className="ml-1.5 text-[11px] font-semibold" style={{ color: d > 0 ? (on ? "#7BD39B" : "#1F7A4D") : (on ? "#F4A48A" : "#B3261E") }}>
                    {d > 0 ? "↑" : "↓"} {Math.abs(d)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-col gap-1.5 text-xs">
          <SplitRow label="Közvetlen" n={sel?.direct} total={total} color={CORAL} />
          <SplitRow label="Ingatlan landing" n={sel?.landing} total={total} color={TEAL} />
          <SplitRow label="Futtatott már" n={sel?.activated} total={total} color="#1F7A4D" hint="legalább egy modult" />
        </div>
      </div>

      <div className="flex min-h-[200px] min-w-0 flex-col">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-3 text-[11px]" style={{ color: MUTED }}>
            <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2 w-4 rounded-full" style={{ background: CORAL }} />közvetlen</span>
            <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2 w-4 rounded-full" style={{ background: TEAL }} />landing</span>
          </span>
          <Seg value={group} onChange={onGroup} items={[{ v: "day", t: "Nap" }, { v: "week", t: "Hét" }, { v: "month", t: "Hónap" }]} />
        </div>
        <div className="mt-2 flex min-h-0 flex-1 items-end gap-[3px] border-b px-1 pt-2" style={{ borderColor: "var(--twx-line)" }}>
          {(sel?.series ?? []).map((b) => {
            const sum = b.direct + b.landing;
            return (
              <div key={b.from} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${fmtBucket(b.from, group)}: ${sum} új (${b.direct} közvetlen, ${b.landing} landing)`}>
                <i className="block rounded-t-[3px]" style={{ height: `${(b.landing / max) * 100}%`, background: TEAL }} />
                <i className="block" style={{ height: `${(b.direct / max) * 100}%`, background: CORAL, borderRadius: b.landing ? 0 : "3px 3px 0 0" }} />
              </div>
            );
          })}
          {sel && sel.series.every((b) => b.direct + b.landing === 0) && (
            <p className="m-auto text-xs" style={{ color: MUTED }}>Ebben az időszakban nem volt új regisztráló.</p>
          )}
        </div>
        <div className="flex justify-between px-1 pt-1 text-[10px]" style={{ color: MUTED }}>
          <span>{sel?.series[0] ? fmtBucket(sel.series[0].from, group) : ""}</span>
          <span>ma</span>
        </div>
      </div>
    </section>
  );
}

function SplitRow({ label, n, total, color, hint }: { label: string; n?: number; total: number; color: string; hint?: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr_40px] items-center gap-2.5" title={hint}>
      <span>{label}</span>
      <span className="h-2.5 overflow-hidden rounded-full" style={{ background: "#F1EAE1" }}>
        <span className="block h-full rounded-full" style={{ width: `${n ? (n / total) * 100 : 0}%`, background: color }} />
      </span>
      <b className="text-right tabular-nums">{n ?? "…"}</b>
    </div>
  );
}

function fmtBucket(iso: string, g: RegGroup): string {
  const d = new Date(iso);
  return g === "month" ? d.toLocaleDateString("hu-HU", { year: "numeric", month: "short" }) : d.toLocaleDateString("hu-HU", { month: "short", day: "numeric" });
}
