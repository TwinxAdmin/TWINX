// ModuleAnalysisView — Admin → Felhasználók → „Modul elemzés" fül (ME1; látványterv: design/admin-modul-elemzes-latvanyterv.html).
// Maga a MODUL elemzése — felhasználó-szintű adat nincs. Adat: GET /api/admin/module-analysis.
//   • szűrők (mint a Modul-használat fülön) + Eszköz (mobil / tablet / asztali — az eseménynaplóra hat, ME2d)
//   • TOP 3 modul (futtatás szerint) · Modulok egészsége (közlekedési lámpa) · egy modul mély elemzése
// ME1: a meglévő adatokból · ME2d: Tölcsér, hibás futtatás, futási idő, eszköz (eseménynapló, egyelőre az 5 fő modul).
// ME3d: Elégedettség (★ átlag, eloszlás, okok, megjegyzések) és „Mi hiányzik?" válaszok — név nélkül. Minden blokk fix méretű.
// Hibaokok: a run_error „kód · HTTP · üzenet" szövegéből (failDetail) — Leggyakoribb hibák + „Összes hiba" ablak (név nélkül).
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SelectField from "@/components/SelectField";

type Range = "7d" | "30d" | "90d" | "all";
type Health = {
  href: string; label: string; runs: number; users: number; change: number | "new" | null; returningPct: number | null; spark: number[];
  conversionPct: number | null; secondPct: number | null; within30Pct: number | null;
  failurePct: number | null; satisfaction: number | null; ratingsN: number; avgSeconds: number | null; tracked: boolean;
};
type Overview = { top3: Health[]; health: Health[] };
type Deep = {
  module: { href: string; label: string }; runs: number; users: number;
  retention: { cohort: number; secondPct: number | null; within30Pct: number | null; medianDaysToSecond: number | null; startedHere: number;
    curve: { day: number; pct: number | null; n: number }[]; avgCurve: { day: number; pct: number | null }[] };
  heat: { weekdays: string[]; slots: string[]; cells: number[][] };
  links: { before: { label: string; pct: number }[]; after: { label: string; pct: number }[]; firstOfDayPct: number | null; onlyThisPct: number | null };
  quality: { items: { label: string; value: string; hint?: string }[]; reasons: { reason: string; at: string }[]; topErrors: { code: string; n: number }[];
    recentErrors: { at: string; detail: string; device: string | null; role: string; ms: number | null }[] };
  funnel: { step: string; users: number }[] | null;
  devices: { mobile: number; tablet: number; desktop: number };
  tracked: boolean;
  rating: { n: number; avg: number | null; dist: { stars: number; n: number }[]; reasons: { label: string; n: number }[];
    comments: { stars: number; comment: string | null; reasons: string[]; at: string; source: string }[] };
  missing: { n: number; dismissed: number; choices: { value: string; label: string; n: number }[];
    items: { choice: string | null; label: string; comment: string | null; device: string | null; at: string; source: string }[] };
};

const DARK = "#12100e", MUTED = "#6E655C", CARD = { background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" } as const;
const RANGES: { v: Range; t: string }[] = [{ v: "7d", t: "7 nap" }, { v: "30d", t: "30 nap" }, { v: "90d", t: "90 nap" }, { v: "all", t: "Összes" }];

// közlekedési lámpa határok (egy helyen)
const LIGHTS: Record<"conversionPct" | "secondPct" | "within30Pct", [number, number]> = {
  conversionPct: [55, 35], secondPct: [55, 35], within30Pct: [40, 25],
};
// elégedettség (★ átlag): ≥ 4,2 zöld, ≥ 3,5 sárga, alatta piros
function starLight(v: number | null): string { return v === null ? "" : v >= 4.2 ? "#2E9E5E" : v >= 3.5 ? "#E0A526" : "#D2492F"; }
const fmtStar = (v: number) => v.toFixed(1).replace(".", ",");
const DEVICE_TEXT: Record<string, string> = { mobile: "mobil", tablet: "tablet", desktop: "asztali" };

// hibás futtatás: fordított skála (kevesebb = jobb) — ≤ 3% zöld, ≤ 8% sárga, felette piros
function failLight(v: number | null): string { return v === null ? "" : v <= 3 ? "#2E9E5E" : v <= 8 ? "#E0A526" : "#D2492F"; }
function fmtSec(sec: number | null): string {
  if (sec === null) return "—";
  const m = Math.floor(sec / 60), s = sec % 60;
  return m ? `${m} p${s ? ` ${s} mp` : ""}` : `${s} mp`;
}

function light(key: keyof typeof LIGHTS, v: number | null): string {
  if (v === null) return "";
  const [g, y] = LIGHTS[key];
  return v >= g ? "#2E9E5E" : v >= y ? "#E0A526" : "#D2492F";
}

export default function ModuleAnalysisView() {
  const [range, setRange] = useState<Range>("30d");
  const [source, setSource] = useState("all");
  const [mode, setMode] = useState("all");
  const [staff, setStaff] = useState(false);
  const [device, setDevice] = useState("all");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [sort, setSort] = useState<keyof Health>("runs");

  const query = useMemo(() => new URLSearchParams({ range, source, mode, staff: staff ? "1" : "0", device }).toString(), [range, source, mode, staff, device]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await fetch(`/api/admin/module-analysis?${query}`).then((r) => r.json());
      if (d.error) setError(d.error);
      else {
        setData(d as Overview);
        setSelected((cur) => cur ?? (d as Overview).top3[0]?.href ?? (d as Overview).health[0]?.href ?? null);
      }
    } catch { setError("Nem sikerült betölteni."); } finally { setLoading(false); }
  }, [query]);
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => [...(data?.health ?? [])].sort((a, b) => {
    const va = a[sort], vb = b[sort];
    return (typeof vb === "number" ? vb : -1) - (typeof va === "number" ? va : -1) || b.runs - a.runs;
  }), [data, sort]);

  return (
    <div className="flex flex-col gap-4">
      {/* szűrők */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl px-3.5 py-3" style={CARD}>
        <div className="inline-flex rounded-full p-[3px]" style={{ background: "#F1EAE1" }}>
          {RANGES.map((r) => (
            <button key={r.v} type="button" onClick={() => setRange(r.v)} aria-pressed={range === r.v} className="h-7 rounded-full px-3 text-xs font-semibold"
              style={range === r.v ? { background: DARK, color: "#fff" } : { color: "#4A433C" }}>{r.t}</button>
          ))}
        </div>
        <SelectField size="sm" className="w-[190px]" ariaLabel="Forrás" value={source} onChange={setSource}
          options={[{ value: "all", label: "Forrás: mind" }, { value: "direct", label: "Forrás: közvetlen" }, { value: "landing", label: "Forrás: ingatlan landing" }]} />
        <SelectField size="sm" className="w-[200px]" ariaLabel="Mód" value={mode} onChange={setMode}
          options={[{ value: "all", label: "Mód: mind" }, { value: "private", label: "Mód: privát" }, { value: "office", label: "Mód: irodai fiók" }, { value: "team", label: "Mód: közös munkatér" }]} />
        <span title="Az eszköz-szűrő a tölcsérre, a hibás futtatásra és a futási időre hat (az eseménynaplóból).">
          <SelectField size="sm" className="w-[170px]" ariaLabel="Eszköz" value={device} onChange={setDevice}
            options={[{ value: "all", label: "Eszköz: mind" }, { value: "desktop", label: "Eszköz: asztali" }, { value: "mobile", label: "Eszköz: mobil" }, { value: "tablet", label: "Eszköz: tablet" }]} />
        </span>
        <button type="button" onClick={() => setStaff((s) => !s)} aria-pressed={staff} className="inline-flex items-center gap-2 text-xs font-semibold">
          <span className="relative h-5 w-[34px] rounded-full transition-colors" style={{ background: staff ? "#F08A68" : "#D9CFC3" }}>
            <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: staff ? 16 : 2 }} />
          </span>
          Admin és sales is
        </button>
        <span className="ml-auto text-xs" style={{ color: MUTED }}>{loading ? "Frissítés…" : " "}</span>
      </div>
      {error && <p className="rounded-xl px-4 py-3 text-sm text-red-700" style={{ background: "#FDECEA" }}>{error}</p>}

      {/* TOP 3 */}
      <div>
        <h2 className="font-display text-lg font-semibold">TOP 3 modul <span className="text-xs font-medium" style={{ color: MUTED }}>· futtatások száma szerint, a kiválasztott időszakban</span></h2>
        <div className="mt-2.5 grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => {
            const t = data?.top3[i];
            const first = i === 0 && !!t;
            return (
              <button key={i} type="button" disabled={!t} onClick={() => t && setSelected(t.href)}
                className="relative flex h-[132px] flex-col gap-1.5 overflow-hidden rounded-2xl px-4 py-3.5 text-left disabled:cursor-default"
                style={first ? { background: DARK, color: "#F3EDE6", border: `1px solid ${DARK}` } : { ...CARD, opacity: t ? 1 : 0.55 }}>
                <span className="absolute right-3.5 top-2 font-display text-[44px] font-extrabold leading-none" style={{ color: first ? "rgba(240,138,104,0.28)" : "rgba(28,24,21,0.07)" }}>{i + 1}</span>
                <span className="text-[15px] font-bold">{t?.label ?? (data ? "—" : "…")}</span>
                <span className="font-display text-[26px] font-extrabold tabular-nums">
                  {t ? t.runs : ""}
                  {t && <Change c={t.change} dark={first} />}
                </span>
                <span className="text-[11.5px]" style={{ color: first ? "#A89E94" : MUTED }}>
                  {t ? `${t.users} felhasználó · ${t.returningPct ?? 0}% visszatér` : data ? "Még nincs elég használt modul." : " "}
                </span>
                {t && <Spark values={t.spark} color={first ? "#F08A68" : "#E3683F"} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Modulok egészsége */}
      <section className="overflow-hidden rounded-2xl" style={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] pb-3 pt-4">
          <h2 className="font-display text-lg font-semibold">Modulok egészsége</h2>
          <span className="flex flex-wrap items-center gap-3 text-[11px]" style={{ color: MUTED }}>
            <Dot c="#2E9E5E" />jó <Dot c="#E0A526" />figyelni <Dot c="#D2492F" />gond <span>— kevés adat (5 alatt)</span>
          </span>
        </div>
        <div className="h-[380px] overflow-y-auto overscroll-contain">
          <div className="sticky top-0 z-10 hidden h-11 items-center gap-2.5 px-[18px] text-[10px] font-bold uppercase leading-tight tracking-[0.05em] lg:grid lg:grid-cols-[minmax(190px,1.5fr)_70px_repeat(6,minmax(0,1fr))]"
            style={{ background: "#1B1815", color: "#BFB4A8" }}>
            <HeadBtn label="Modul" onClick={() => setSort("runs")} />
            <HeadBtn label="Futtatás" right on={sort === "runs"} onClick={() => setSort("runs")} />
            <HeadBtn label="Megnyitásból futtatás" right on={sort === "conversionPct"} onClick={() => setSort("conversionPct")} />
            <HeadBtn label="Második futtatás" right on={sort === "secondPct"} onClick={() => setSort("secondPct")} />
            <HeadBtn label="Visszatér 30 napon belül" right on={sort === "within30Pct"} onClick={() => setSort("within30Pct")} />
            <HeadBtn label="Hibás futtatás" right on={sort === "failurePct"} onClick={() => setSort("failurePct")} />
            <HeadBtn label="Elégedettség (★)" right on={sort === "satisfaction"} onClick={() => setSort("satisfaction")} />
            <HeadBtn label="Medián futási idő" right on={sort === "avgSeconds"} onClick={() => setSort("avgSeconds")} />
          </div>
          {!data && <p className="p-5 text-sm" style={{ color: MUTED }}>{loading ? "Betöltés…" : "Nincs adat."}</p>}
          {rows.map((h) => (
            <button key={h.href} type="button" onClick={() => setSelected(h.href)}
              className="flex w-full flex-col gap-1 px-[18px] py-3 text-left text-[13px] transition-colors hover:bg-[#FBF6F0] lg:grid lg:h-[50px] lg:grid-cols-[minmax(190px,1.5fr)_70px_repeat(6,minmax(0,1fr))] lg:items-center lg:gap-2.5 lg:py-0"
              style={{ borderTop: "1px solid #EFE7DD", ...(selected === h.href ? { background: "#FFF8F3", boxShadow: "inset 3px 0 0 #EF7A5A" } : {}) }}>
              <b className="break-words leading-tight">{h.label}</b>
              <span className="tabular-nums lg:text-right">{h.runs}</span>
              <Light v={h.conversionPct} c={light("conversionPct", h.conversionPct)} label="Megnyitásból futtatás" />
              <Light v={h.secondPct} c={light("secondPct", h.secondPct)} label="Második futtatás" />
              <Light v={h.within30Pct} c={light("within30Pct", h.within30Pct)} label="Visszatér 30 napon belül" />
              <Light v={h.failurePct} c={failLight(h.failurePct)} label="Hibás futtatás" untracked={!h.tracked} />
              <span className="flex items-center gap-1.5 tabular-nums lg:justify-end"
                title={h.satisfaction === null ? (h.ratingsN ? `Még csak ${h.ratingsN} értékelés (legalább 3 kell)` : "Még nincs értékelés") : `${h.ratingsN} értékelés átlaga`}>
                <span className="lg:hidden" style={{ color: MUTED }}>Elégedettség: </span>
                {h.satisfaction === null ? <span style={{ color: "#B2A89D" }}>—</span>
                  : <><i className="inline-block h-[9px] w-[9px] rounded-full" style={{ background: starLight(h.satisfaction) }} /><b>★ {fmtStar(h.satisfaction)}</b></>}
              </span>
              <span className="tabular-nums lg:text-right" title={h.tracked ? undefined : "Ezt a modult még nem mérjük (egyelőre az 5 fő modul)."}>
                <span className="lg:hidden" style={{ color: MUTED }}>Medián futási idő: </span>
                {h.tracked && h.avgSeconds !== null ? <b>{fmtSec(h.avgSeconds)}</b> : <span style={{ color: "#B2A89D" }}>—</span>}
              </span>
            </button>
          ))}
        </div>
      </section>
      <p className="text-xs" style={{ color: MUTED }}>
        Határok: megnyitásból futtatás és második futtatás ≥ 55% zöld, 35–55% sárga · visszatérés 30 napon belül ≥ 40% zöld, 25–40% sárga ·
        hibás futtatás ≤ 3% zöld, ≤ 8% sárga · elégedettség ≥ ★ 4,2 zöld, ≥ ★ 3,5 sárga (legalább 3 értékelésből).
        A hibás futtatást, a futási időt és az értékelést egyelőre az 5 fő modulban mérjük (2026. okt. 12-től).
        A „második futtatás” és a „visszatérés” azokra vonatkozik, akik az időszakban próbálták ki először a modult.
      </p>

      {/* Mély elemzés */}
      {selected && data && (
        <DeepAnalysis href={selected} query={query} modules={data.health} onPick={setSelected} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function DeepAnalysis({ href, query, modules, onPick }: { href: string; query: string; modules: Health[]; onPick: (h: string) => void }) {
  const [d, setD] = useState<Deep | null>(null);
  const [errorsOpen, setErrorsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setD(null); setError(null);
    fetch(`/api/admin/module-analysis?${query}&module=${encodeURIComponent(href)}`)
      .then((r) => r.json())
      .then((x) => { if (alive) { if (x.error) setError(x.error); else setD(x as Deep); } })
      .catch(() => alive && setError("Nem sikerült betölteni."));
    return () => { alive = false; };
  }, [href, query]);

  const label = modules.find((m) => m.href === href)?.label ?? "";
  const quick = modules.filter((m) => m.runs > 0).slice(0, 6);
  const heatMax = Math.max(1, ...(d?.heat.cells.flat() ?? [0]));
  const PAL = ["#FAF7F2", "#FBE1D6", "#F7C3AE", "#F4A48A", "#EE865F", "#E3683F"];

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <h2 className="font-display text-[22px] font-extrabold">{label} <span className="text-sm font-semibold" style={{ color: MUTED }}>— mély elemzés</span></h2>
        <div className="flex flex-wrap items-center gap-1.5">
          {quick.map((m) => (
            <button key={m.href} type="button" onClick={() => onPick(m.href)} className="h-[30px] rounded-full px-3 text-xs font-semibold"
              style={m.href === href ? { background: DARK, color: "#fff" } : { background: "#F1EAE1", color: "#4A433C" }}>{m.label}</button>
          ))}
          <SelectField size="sm" className="w-[190px]" ariaLabel="Másik modul" value={href} onChange={onPick}
            options={modules.map((m) => ({ value: m.href, label: m.label }))} />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-3.5 lg:grid-cols-2">
        {/* 1 · Tölcsér — ME2 */}
        <Panel title="1 · Tölcsér — hol esnek ki?" h={300}>
          {!d && <p className="text-sm" style={{ color: MUTED }}>Betöltés…</p>}
          {d && !d.funnel && <Empty text="Ennél a modulnál még nincs tölcsér-mérés — egyelőre az 5 fő modulban mérünk (értékbecslés, hirdetéskép, képjavító, videó, látványtervező)." />}
          {d?.funnel && <Funnel steps={d.funnel} />}
        </Panel>

        {/* 2 · Visszatérés */}
        <Panel title="2 · Visszatérés" h={300}>
          <div className="grid grid-cols-3 gap-2">
            <Tile t="Második futtatás" v={fmtPct(d?.retention.secondPct, d)} />
            <Tile t="Idő a 2. futtatásig" v={d ? (d.retention.medianDaysToSecond === null ? "—" : `${String(d.retention.medianDaysToSecond).replace(".", ",")} nap`) : "…"} />
            <Tile t="Ezzel kezdték a TWINX-et" v={d ? `${d.retention.startedHere} fő` : "…"} />
          </div>
          <RetentionChart d={d} />
          <p className="text-[11.5px]" style={{ color: MUTED }}>
            Akik az időszakban először futtatták ({d?.retention.cohort ?? "…"} fő): hányan használják még 1 / 7 / 14 / 21 / 30 nap múlva — összevetve az összes modul átlagával.
          </p>
        </Panel>
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[1.2fr_1fr_1fr]">
        {/* 3 · Minőség */}
        <Panel title="3 · Minőség és elégedettség" h={420}>
          {d && d.quality.items.length === 0 && <p className="text-[12.5px]" style={{ color: MUTED }}>Ennél a modulnál még nincs külön minőségi jel — a hibás futtatás és az elégedettség a következő lépésekben jön.</p>}
          {d?.quality.items.map((q) => (
            <div key={q.label} className="flex items-baseline justify-between gap-2 border-b py-1.5 text-[12.5px]" style={{ borderColor: "#F3EDE6" }}>
              <span>{q.label}{q.hint && <span className="block text-[11px]" style={{ color: MUTED }}>{q.hint}</span>}</span>
              <b className="tabular-nums">{q.value}</b>
            </div>
          ))}
          {d && d.quality.reasons.length > 0 && (
            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg" style={{ background: "#fff", border: "1px solid #EFE7DD" }}>
              {d.quality.reasons.map((r, i) => (
                <p key={i} className="px-2.5 py-1.5 text-[12px]" style={{ borderBottom: "1px solid #F3EDE6" }}>„{r.reason}” <span className="text-[10.5px]" style={{ color: MUTED }}>· {new Date(r.at).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })}</span></p>
              ))}
            </div>
          )}
          {d && d.quality.topErrors.length > 0 && (
            <div className="text-[12px]">
              <p className="mb-1 flex items-center justify-between gap-2 font-bold">
                Leggyakoribb hibák
                <button type="button" onClick={() => setErrorsOpen(true)} className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{ background: "#fff", boxShadow: "inset 0 0 0 1px var(--twx-line)" }}>
                  Összes hiba ({d.quality.recentErrors.length}) →
                </button>
              </p>
              {d.quality.topErrors.map((e) => {
                const r = splitDetail(e.code);
                return (
                  <div key={e.code} className="flex justify-between gap-2 py-0.5" title={e.code}>
                    <span className="min-w-0 truncate"><b>{r.label}</b>{r.rest && <span style={{ color: MUTED }}> · {r.rest}</span>}</span>
                    <b className="tabular-nums">{e.n}</b>
                  </div>
                );
              })}
            </div>
          )}
          {errorsOpen && d && <ErrorsDialog module={d.module.label} rows={d.quality.recentErrors} onClose={() => setErrorsOpen(false)} />}
          <RatingBlock d={d} />
        </Panel>

        {/* 4 · Mi hiányzik — ME3 */}
        <Panel title="4 · „Mi hiányzik?”" h={420}>
          <MissingBlock d={d} />
        </Panel>

        {/* 5 · Mikor és min */}
        <Panel title="5 · Mikor és min?" h={420}>
          <table className="w-full border-separate border-spacing-[3px] text-[10px]">
            <thead><tr><th />{(d?.heat.weekdays ?? ["H", "K", "Sze", "Cs", "P", "Szo", "V"]).map((w) => <th key={w} className="font-semibold" style={{ color: MUTED }}>{w}</th>)}</tr></thead>
            <tbody>
              {(d?.heat.slots ?? []).map((s, si) => (
                <tr key={s}>
                  <th className="pr-1 text-right font-semibold" style={{ color: MUTED }}>{s}</th>
                  {d!.heat.cells[si].map((n, wi) => {
                    const lvl = n === 0 ? 0 : Math.min(5, 1 + Math.round((n / heatMax) * 4));
                    return <td key={wi} className="h-[22px] rounded" style={{ background: PAL[lvl] }} title={`${d!.heat.weekdays[wi]} ${s}: ${n} futtatás`} />;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {!d && <p className="text-sm" style={{ color: MUTED }}>Betöltés…</p>}
          <DeviceBar d={d} />
          <p className="text-[11px]" style={{ color: MUTED }}>Futtatások a hét napjai × napszak szerint, budapesti idő (sötétebb = több).</p>
        </Panel>
      </div>

      {/* 6 · Kapcsolódások */}
      <Panel title="6 · Kapcsolódások — mi előtte, mi utána?" h={230}>
        <div className="grid items-center gap-3 md:grid-cols-[1fr_90px_1fr]">
          <LinkList title="ELŐTTE (ugyanazon a napon)" items={d?.links.before} extra={d?.links.firstOfDayPct != null ? { t: "— ezzel kezdte a napot", p: d.links.firstOfDayPct } : null} />
          <div className="rounded-xl px-2 py-3 text-center text-[11px] font-extrabold uppercase text-white" style={{ background: DARK }}>{label}</div>
          <LinkList title="UTÁNA (ugyanazon a napon)" items={d?.links.after} extra={d?.links.onlyThisPct != null ? { t: "— utána nem használt mást", p: d.links.onlyThisPct } : null} />
        </div>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
function RatingBlock({ d }: { d: Deep | null }) {
  if (!d) return null;
  const r = d.rating;
  if (!r.n) {
    return (
      <div className="mt-1 rounded-lg px-2.5 py-2 text-[12px]" style={{ background: "#F8F3EC", color: MUTED }}>
        {d.tracked ? "Még nincs csillagos értékelés — a 3. futtatás után kérdezzük meg a partnereket." : "Ennél a modulnál még nem kérünk értékelést (egyelőre az 5 fő modul)."}
      </div>
    );
  }
  const max = Math.max(1, ...r.dist.map((x) => x.n));
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 border-t pt-2" style={{ borderColor: "#F3EDE6" }}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-bold">Elégedettség</span>
        <span className="text-[12px]" style={{ color: MUTED }}>
          {r.avg !== null ? <b className="text-[15px]" style={{ color: starLight(r.avg) }}>★ {fmtStar(r.avg)}</b> : "kevés adat"} · {r.n} értékelés
        </span>
      </div>
      {r.dist.map((x) => (
        <div key={x.stars} className="grid grid-cols-[34px_1fr_24px] items-center gap-2 text-[11.5px]">
          <span style={{ color: "#F0A23B" }}>{x.stars}★</span>
          <span className="h-2 overflow-hidden rounded-full" style={{ background: "#F1EAE1" }}><i className="block h-full rounded-full" style={{ width: `${(x.n / max) * 100}%`, background: x.stars >= 4 ? "#2E9E5E" : x.stars === 3 ? "#E0A526" : "#D2492F" }} /></span>
          <b className="text-right tabular-nums">{x.n}</b>
        </div>
      ))}
      {r.reasons.length > 0 && (
        <p className="text-[11.5px]"><b>Okok (1–3★):</b> {r.reasons.map((x) => `${x.label} (${x.n})`).join(" · ")}</p>
      )}
      {r.comments.length > 0 && (
        <div className="min-h-[60px] flex-1 overflow-y-auto rounded-lg" style={{ background: "#fff", border: "1px solid #EFE7DD" }}>
          {r.comments.map((c, i) => (
            <p key={i} className="px-2.5 py-1.5 text-[12px]" style={{ borderBottom: "1px solid #F3EDE6" }}>
              <b style={{ color: "#F0A23B" }}>{c.stars}★</b> {c.comment ? `„${c.comment}”` : <span style={{ color: MUTED }}>{c.reasons.join(", ")}</span>}
              <span className="block text-[10.5px]" style={{ color: MUTED }}>{new Date(c.at).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })} · {c.source}{c.comment && c.reasons.length ? ` · ${c.reasons.join(", ")}` : ""}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function MissingBlock({ d }: { d: Deep | null }) {
  const [f, setF] = useState<string>("all");
  if (!d) return <p className="text-sm" style={{ color: MUTED }}>Betöltés…</p>;
  const m = d.missing;
  if (!m.n) {
    return <Empty text={`Még nincs válasz. Akkor kérdezzük, ha valaki legalább 3 napon megnyitotta a modult, de nem futtatta.${m.dismissed ? ` (${m.dismissed} partner bezárta a kérdést.)` : ""}`} />;
  }
  const items = f === "all" ? m.items : m.items.filter((x) => x.choice === f);
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <Chip on={f === "all"} onClick={() => setF("all")}>Mind · {m.n}</Chip>
        {m.choices.filter((c) => c.n > 0).map((c) => <Chip key={c.value} on={f === c.value} onClick={() => setF(c.value)}>{c.label} · {c.n}</Chip>)}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg" style={{ background: "#fff", border: "1px solid #EFE7DD" }}>
        {items.map((x, i) => (
          <div key={i} className="px-2.5 py-2 text-[12.5px] leading-snug" style={{ borderBottom: "1px solid #F3EDE6" }}>
            <span className="mr-1.5 rounded-full px-1.5 py-[1px] text-[9.5px] font-extrabold uppercase" style={{ background: "#FFF0D6", color: "#8A5A00" }}>{x.label}</span>
            {x.comment ?? <span style={{ color: MUTED }}>—</span>}
            <span className="block text-[10.5px]" style={{ color: MUTED }}>
              {new Date(x.at).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })} · {x.source}{x.device ? ` · ${DEVICE_TEXT[x.device] ?? x.device}` : ""}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px]" style={{ color: MUTED }}>Név nélkül — csak forrás és eszköz.{m.dismissed ? ` ${m.dismissed} partner bezárta válasz nélkül.` : ""}</p>
    </>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="h-[26px] rounded-full px-2.5 text-[11px] font-semibold"
      style={on ? { background: DARK, color: "#fff" } : { background: "#F1EAE1", color: "#4A433C" }}>{children}</button>
  );
}

function Funnel({ steps }: { steps: { step: string; users: number }[] }) {
  const top = Math.max(1, steps[0]?.users ?? 1, ...steps.map((s) => s.users));
  // a legnagyobb kiesés (az előző lépéshez képest) kiemelve
  let worst = -1, worstDrop = 0;
  steps.forEach((s, i) => {
    if (!i) return;
    const prev = steps[i - 1].users;
    const drop = prev ? (prev - s.users) / prev : 0;
    if (drop > worstDrop) { worstDrop = drop; worst = i; }
  });
  return (
    <div className="flex flex-col gap-2">
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1].users : null;
        const drop = prev ? Math.round(((prev - s.users) / prev) * 100) : null;
        return (
          <div key={s.step} className="grid grid-cols-[140px_1fr_44px_50px] items-center gap-2.5 rounded-lg px-1 text-[12.5px]"
            style={i === worst && worstDrop > 0 ? { boxShadow: "0 0 0 2px #D2492F inset" } : undefined}>
            <span className="truncate">{s.step}</span>
            <span className="relative h-[24px] overflow-hidden rounded-md" style={{ background: "#F1EAE1" }}>
              <i className="absolute inset-y-0 left-0 rounded-md" style={{ width: `${(s.users / top) * 100}%`, background: "linear-gradient(90deg,#E3683F,#F4A48A)" }} />
            </span>
            <b className="text-right tabular-nums">{s.users}</b>
            <span className="text-right text-[11px] font-bold" style={{ color: "#B3261E" }}>{drop !== null && drop > 0 ? `−${drop}%` : ""}</span>
          </div>
        );
      })}
      <p className="text-[11.5px]" style={{ color: MUTED }}>
        Különböző felhasználók lépésenként.{worst > 0 && worstDrop > 0 ? <> Legnagyobb kiesés: <b style={{ color: "var(--twx-ink)" }}>{steps[worst - 1].step} → {steps[worst].step}</b>.</> : ""}
      </p>
    </div>
  );
}

function DeviceBar({ d }: { d: Deep | null }) {
  const v = d?.devices ?? { mobile: 0, tablet: 0, desktop: 0 };
  const total = v.mobile + v.tablet + v.desktop;
  const p = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  return (
    <div className="mt-auto flex flex-col gap-1.5 text-[12px]">
      <div className="flex justify-between gap-2">
        <span>Eszköz</span>
        <span>{total ? <><b>Asztali {p(v.desktop)}%</b> · <span style={{ color: MUTED }}>Mobil {p(v.mobile)}% · Tablet {p(v.tablet)}%</span></> : <span style={{ color: MUTED }}>{d && !d.tracked ? "nem mért modul" : "még nincs adat"}</span>}</span>
      </div>
      <span className="flex h-3 overflow-hidden rounded-full" style={{ background: "#F1EAE1" }}>
        <i className="block h-full" style={{ width: `${p(v.desktop)}%`, background: DARK }} />
        <i className="block h-full" style={{ width: `${p(v.mobile)}%`, background: "#C9B8A8" }} />
        <i className="block h-full" style={{ width: `${p(v.tablet)}%`, background: "#2F7F86" }} />
      </span>
    </div>
  );
}

/** A run_error ok olvasható formában: „start_failed · HTTP 422 · 4–5 fotó szükséges." → címke + a többi rész. */
const ERROR_LABEL: Record<string, string> = {
  start_failed: "Indítás elutasítva", job_failed: "Elkészítés közben elbukott", http: "A szerver elutasította",
  network: "Hálózati / válasz-hiba", error: "Hiba", timeout: "Időtúllépés",
};
function splitDetail(detail: string): { label: string; rest: string } {
  const [code, ...rest] = detail.split(" · ");
  const legacy = code.match(/^http_(\d+)$/); // régi formátum: „http_422"
  if (legacy) return { label: ERROR_LABEL.http, rest: `HTTP ${legacy[1]}` };
  return { label: ERROR_LABEL[code] ?? code, rest: rest.join(" · ") || (code in ERROR_LABEL ? "ok nincs rögzítve (régi mérés)" : "") };
}
const ROLE_TEXT: Record<string, string> = { admin: "Admin", sales: "Sales", user: "Partner" };

/** Az utolsó (legfeljebb 100) hiba egyenként — fix méretű ablak, belül görgetés; név nélkül. */
function ErrorsDialog({ module, rows, onClose }: { module: string; rows: Deep["quality"]["recentErrors"]; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6" style={{ background: "rgba(20,12,8,0.55)" }} onClick={onClose} role="dialog" aria-modal="true" aria-label="Összes hiba">
      <div className="flex h-[min(620px,90vh)] w-full max-w-[860px] flex-col rounded-2xl p-5" style={CARD} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-[16px] font-bold">Hibák — {module} <span className="text-[12px] font-normal" style={{ color: MUTED }}>(az időszakban, legfeljebb 100, név nélkül)</span></h3>
          <button type="button" onClick={onClose} aria-label="Bezárás" className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white text-lg" style={{ boxShadow: "inset 0 0 0 1px var(--twx-line)" }}>×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-white" style={{ border: "1px solid #EFE7DD" }}>
          {rows.length === 0 && <p className="p-6 text-center text-sm" style={{ color: MUTED }}>Ebben az időszakban nem volt hiba. 🎉</p>}
          <table className="w-full text-[12.5px]">
            <tbody>
              {rows.map((r, i) => {
                const x = splitDetail(r.detail);
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #F3EDE6" }}>
                    <td className="whitespace-nowrap px-3 py-2 align-top tabular-nums" style={{ color: MUTED }}>
                      {new Date(r.at).toLocaleString("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 align-top">
                      <span className="rounded-full px-2 py-[1px] text-[10.5px] font-bold" style={r.role === "user" ? { background: "#FDE4D9", color: "#7a2e17" } : { background: "#F1EAE1", color: "#6B6258" }}>{ROLE_TEXT[r.role] ?? r.role}</span>
                      <span className="ml-1.5 text-[11px]" style={{ color: MUTED }}>{r.device ? DEVICE_TEXT[r.device] ?? r.device : ""}</span>
                    </td>
                    <td className="px-2 py-2 align-top"><b>{x.label}</b>{x.rest && <span className="block break-words" style={{ color: MUTED }}>{x.rest}</span>}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right align-top tabular-nums" style={{ color: MUTED }}>{r.ms !== null ? fmtSec(Math.round(r.ms / 1000)) : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, tag, h, children }: { title: string; tag?: "soon" | "partial"; h: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 overflow-auto rounded-2xl px-[18px] py-4" style={{ ...CARD, height: h }}>
      <h3 className="flex items-center justify-between gap-2 text-[15px] font-bold">
        {title}
        {tag === "soon" && <Soon />}
        {tag === "partial" && <span className="rounded-full px-2 py-[2px] text-[9.5px] font-extrabold" style={{ background: "#FFF0D6", color: "#8A5A00" }}>RÉSZBEN</span>}
      </h3>
      {children}
    </section>
  );
}

function Soon({ dark = false }: { dark?: boolean }) {
  return <span className="rounded-full px-1.5 py-[1px] text-[9px] font-extrabold uppercase" style={dark ? { background: "rgba(255,255,255,0.1)", color: "#E8DED3" } : { background: "#F1EAE1", color: "#6B6258" }}>Hamarosan</span>;
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl px-6 text-center" style={{ border: "1.5px dashed #E1D6C9", background: "#fff" }}>
      <span className="text-2xl" aria-hidden>⏳</span>
      <p className="max-w-[340px] text-xs leading-relaxed" style={{ color: MUTED }}>{text}</p>
    </div>
  );
}

function Dot({ c }: { c: string }) { return <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} />; }

function HeadBtn({ label, onClick, on, right }: { label: string; onClick: () => void; on?: boolean; right?: boolean }) {
  return <button type="button" onClick={onClick} className={`uppercase ${right ? "text-right" : "text-left"}`} style={{ color: on ? "#F4A48A" : "#BFB4A8" }}>{label}{on ? " ▾" : ""}</button>;
}

function Light({ v, c, label, untracked }: { v: number | null; c: string; label: string; untracked?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 tabular-nums lg:justify-end"
      title={untracked ? "Ezt a modult még nem mérjük (egyelőre az 5 fő modul)." : v === null ? "Még nincs elég adat" : undefined}>
      <span className="lg:hidden" style={{ color: MUTED }}>{label}: </span>
      {v === null ? <span style={{ color: "#B2A89D" }}>—</span> : <><i className="inline-block h-[9px] w-[9px] rounded-full" style={{ background: c }} /><b>{v}%</b></>}
    </span>
  );
}

function Change({ c, dark }: { c: number | "new" | null; dark: boolean }) {
  if (c === null) return null;
  const up = c === "new" || c >= 0;
  return <span className="ml-1.5 text-xs font-semibold" style={{ color: up ? (dark ? "#7BD39B" : "#1F7A4D") : (dark ? "#F4A48A" : "#B3261E") }}>{c === "new" ? "új" : `${c >= 0 ? "↑" : "↓"} ${Math.abs(c)}%`}</span>;
}

function Spark({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 0);
  if (!max) return null;
  const step = 110 / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(30 - (v / max) * 26).toFixed(1)}`).join(" ");
  return <svg className="absolute bottom-3.5 right-3.5" width="110" height="34" viewBox="0 0 110 34" aria-hidden><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" /></svg>;
}

function Tile({ t, v }: { t: string; v: string }) {
  return <div className="rounded-xl px-3 py-2" style={{ background: "#F8F3EC", border: "1px solid #EFE7DD" }}><p className="truncate text-[11px]" style={{ color: MUTED }}>{t}</p><b className="block text-lg tabular-nums">{v}</b></div>;
}

function fmtPct(v: number | null | undefined, loaded: unknown): string { return !loaded ? "…" : v === null || v === undefined ? "—" : `${v}%`; }

function RetentionChart({ d }: { d: Deep | null }) {
  const W = 520, H = 110, x0 = 30, x1 = 510, y0 = 96, y1 = 10;
  const days = [0, 1, 7, 14, 21, 30];
  const xOf = (day: number) => x0 + (day / 30) * (x1 - x0);
  const yOf = (p: number) => y0 - (p / 100) * (y0 - y1);
  const line = (pts: { day: number; pct: number | null }[]) => [{ day: 0, pct: 100 }, ...pts].filter((p) => p.pct !== null).map((p) => `${xOf(p.day)},${yOf(p.pct!)}`).join(" ");
  const mine = d?.retention.curve ?? [], avg = d?.retention.avgCurve ?? [];
  const last = [...mine].reverse().find((p) => p.pct !== null), lastAvg = [...avg].reverse().find((p) => p.pct !== null);
  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} width="100%" height="124" aria-label="Megtartási görbe">
      <line x1={x0} y1={y0} x2={x1} y2={y0} stroke="#E8E1D6" />
      {d && avg.some((p) => p.pct !== null) && <polyline points={line(avg)} fill="none" stroke="#C9B8A8" strokeWidth="2" strokeDasharray="5 5" />}
      {d && mine.some((p) => p.pct !== null) && <polyline points={line(mine)} fill="none" stroke="#E3683F" strokeWidth="2.5" />}
      {d && !mine.some((p) => p.pct !== null) && <text x={W / 2} y={60} textAnchor="middle" fontSize="11" fill="#6E655C">Még kevés adat a görbéhez (legalább 5 kipróbáló kell).</text>}
      <g fontSize="10" fill="#6E655C">{days.map((dd) => <text key={dd} x={xOf(dd) - 6} y={H + 10}>{dd === 0 ? "0. nap" : `${dd}.`}</text>)}</g>
      {last && <text x={360} y={30} fontSize="10" fill="#E3683F" fontWeight="700">ez a modul: {last.pct}%</text>}
      {lastAvg && <text x={360} y={44} fontSize="10" fill="#8F857B">összes modul átlaga: {lastAvg.pct}%</text>}
    </svg>
  );
}

function LinkList({ title, items, extra }: { title: string; items?: { label: string; pct: number }[]; extra: { t: string; p: number } | null }) {
  return (
    <div className="flex flex-col gap-1.5 text-[12.5px]">
      <p className="text-[11px]" style={{ color: MUTED }}>{title}</p>
      {!items && <p style={{ color: MUTED }}>…</p>}
      {items?.length === 0 && !extra && <p style={{ color: MUTED }}>Nincs adat.</p>}
      {items?.map((x) => <div key={x.label} className="flex justify-between gap-2 rounded-lg px-2.5 py-1.5" style={{ background: "#F8F3EC" }}><span className="truncate">{x.label}</span><b>{x.pct}%</b></div>)}
      {extra && <div className="flex justify-between gap-2 rounded-lg px-2.5 py-1.5" style={{ background: "#F8F3EC" }}><span className="truncate" style={{ color: MUTED }}>{extra.t}</span><b>{extra.p}%</b></div>}
    </div>
  );
}
