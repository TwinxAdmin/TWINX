// OfficeMemberView — az Irodai TWINX fiók felülete a meghívott KOLLÉGÁNAK
// (megjelenési terv: twinx-irodai-fiok-kollega). Adat: /api/office/overview (kolléga-ág).
//   • sötét fejléc-sáv: „Szia, …!", szerep, „Miből fizetek?" (Irodai keret / Saját kredit),
//     KPI-k (elérhető keret, saját kredit, felhasználás), „Kredit kérése a vezetőtől"
//   • üzenetek sora (fix magasság): fogadott / elküldött + üzenet küldése
//   • Munkáim (fix 5 sor, görgethető) — időszak-választóval
//   • Feladataim · Közös mappák · Keretem változásai — azonos fix magassággal
//   • Kedvenc / Saját moduljaim sáv
// Szabály: minden blokk üresen is látszik, és semmi nem változtatja a méretét (fix magasság,
// felugró ablakok). Kolléga-előnézetben (vezető nézi) a kredit-kérés le van tiltva; a „Miből fizetek?"
// kapcsoló viszont működik, mert az a NÉZŐ saját beállítása (ugyanaz, mint a lenti sávban).
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { OverviewRange, WorkRow } from "@/lib/office-overview";
import { fmtWhen } from "@/lib/office-format";
import { showToast } from "@/components/Toast";
import OfficeMessagesRow from "@/components/office/OfficeMessagesRow";
import OfficeFolders from "@/components/office/OfficeFolders";
import OfficeLedgerCard from "@/components/office/OfficeLedgerCard";
import OfficeModuleShelf from "@/components/office/OfficeModuleShelf";
import OfficeCreditAsk from "@/components/office/OfficeCreditAsk";
import OfficeTasksCard from "@/components/office/OfficeTasksCard";
import { EmptyState, OfficeDialog } from "@/components/office/OfficeUi";

type MemberOverview = {
  view: "member";
  preview: boolean;
  range: OverviewRange;
  office: { id: string; name: string };
  me: { userId: string; name: string; roleLabel: "owner" | "manager" | "member"; workMode: "office" | "private" };
  kpi: { allowance: number; unlimited: boolean; wallet: number; spent: number; works: number };
};

const RANGES: OverviewRange[] = ["7d", "14d", "30d", "all"];
const RANGE_TEXT: Record<OverviewRange, string> = { "7d": "1 hét", "14d": "2 hét", "30d": "30 nap", all: "Összes" };
const SPENT_LABEL: Record<OverviewRange, string> = {
  "7d": "Felhasználtam (1 hét)", "14d": "Felhasználtam (2 hét)", "30d": "Felhasználtam (30 nap)", all: "Felhasználtam összesen",
};
const ROW_H = 49;          // Munkáim: egy sor magassága (48 + 1 px elválasztó)
const VISIBLE_ROWS = 5;
const CARD_H = 340;        // az alsó három kártya közös, fix magassága

export default function OfficeMemberView() {
  const [range, setRange] = useState<OverviewRange>("30d");
  const [data, setData] = useState<MemberOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  const [modeBusy, setModeBusy] = useState(false);
  const router = useRouter();

  const load = useCallback(async (r: OverviewRange) => {
    try {
      const d = await fetch(`/api/office/overview?range=${r}`).then((res) => res.json());
      if (d.error) setError(d.error);
      else if (d.view === "member") setData(d as MemberOverview);
    } catch {
      setError("Nem sikerült betölteni az irodai adatokat.");
    }
  }, []);

  useEffect(() => { void load(range); }, [load, range]);

  // A felső „Miből fizetek?" és a lenti kredit-sáv UGYANAZT a beállítást kapcsolja.
  // Bármelyiken váltasz, a „twx-work-mode" esemény a másikat is azonnal átállítja.
  useEffect(() => {
    const onMode = (e: Event) => {
      const mode = (e as CustomEvent<{ mode: "office" | "private" }>).detail?.mode;
      if (mode) setData((d) => (d ? { ...d, me: { ...d.me, workMode: mode } } : d));
    };
    window.addEventListener("twx-work-mode", onMode);
    return () => window.removeEventListener("twx-work-mode", onMode);
  }, []);

  async function setMode(mode: "office" | "private") {
    if (!data || data.me.workMode === mode || modeBusy) return;
    const prev = data.me.workMode;
    setModeBusy(true);
    // azonnali visszajelzés mindkét helyen (optimista), hiba esetén visszaáll
    window.dispatchEvent(new CustomEvent("twx-work-mode", { detail: { mode } }));
    try {
      const res = await fetch("/api/office/mode", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode }),
      });
      if (!res.ok) {
        window.dispatchEvent(new CustomEvent("twx-work-mode", { detail: { mode: prev } }));
        showToast("Nem sikerült átváltani.", "error");
        return;
      }
      showToast(mode === "office" ? "Mostantól az irodai keretedből dolgozol." : "Mostantól a saját kreditedből dolgozol.", "success");
      router.refresh();   // a kredit-sáv egyenleg-felirata is frissüljön
    } catch {
      window.dispatchEvent(new CustomEvent("twx-work-mode", { detail: { mode: prev } }));
      showToast("Hálózati hiba.", "error");
    } finally {
      setModeBusy(false);
    }
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>;

  const { me, kpi, office } = data;
  const firstName = (me.name || "").trim().split(" ").slice(-1)[0];
  const officeMode = me.workMode === "office";
  const total = kpi.spent + kpi.allowance;
  const pct = total > 0 ? Math.round((kpi.allowance / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      {data.preview && (
        <div className="rounded-xl px-4 py-2.5 text-sm" style={{ background: "#7a2e17", color: "#fff", border: "2px solid var(--twx-coral)" }}>
          <strong>Kolléga-nézet előnézete</strong> — így látja az irodát egy meghívott kolléga (a te adataiddal). Visszaváltás: a jobb alsó sarokban.
        </div>
      )}

      {/* ====================== SÖTÉT FEJLÉC-SÁV ====================== */}
      <section className="flex flex-col gap-6 rounded-[20px] p-5 sm:p-7"
        style={{
          background: "#121110",
          backgroundImage: "radial-gradient(ellipse 520px 300px at 88% 0%, rgba(238,123,91,0.22), transparent 70%), linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "auto, 40px 40px, 40px 40px",
          border: "1px solid #2A2420",
          color: "#F3EDE6",
        }}>
        <div className="flex flex-wrap items-stretch justify-between gap-6">
          <div className="flex flex-[1_1_380px] flex-col gap-2">
            <p className="truncate text-[11px] font-semibold tracking-[0.16em]" style={{ color: "#EE7B5B" }}>
              IRODAI TWINX FIÓK · {office.name.toUpperCase()}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-[28px] font-bold leading-[1.1] sm:text-[34px]" style={{ color: "#F6F1EA" }}>
                Szia{firstName ? `, ${firstName}` : ""}!
              </h1>
              <span className="rounded-full px-2 py-[3px] text-[11px] font-semibold"
                style={{ background: "rgba(238,123,91,0.16)", color: "#F4A48A", border: "1px solid rgba(238,123,91,0.4)" }}>
                Tag
              </span>
            </div>
            <p className="text-sm" style={{ color: "#A89E94" }}>
              {officeMode ? "A munkáidat az irodai keretedből fizeted." : "Most a saját kreditedből dolgozol — az irodai kereted érintetlen."}
            </p>
          </div>

          {/* MIBŐL FIZETEK? */}
          <div className="flex min-w-[280px] max-w-[360px] flex-col gap-2 self-start rounded-[14px] px-3.5 py-3"
            style={{ background: "#1B1815", border: "1px solid rgba(238,123,91,0.5)" }}>
            <span className="text-[11px] font-semibold tracking-[0.1em]" style={{ color: "#F4A48A" }}>MIBŐL FIZETEK?</span>
            <div className="grid grid-cols-2 rounded-full p-[3px]" style={{ background: "#0E0C0B", border: "1px solid #2E2723" }} role="radiogroup">
              {(["private", "office"] as const).map((m) => {
                const on = me.workMode === m;
                return (
                  <button key={m} type="button" role="radio" aria-checked={on} disabled={modeBusy} onClick={() => void setMode(m)}
                    className="h-8 rounded-full text-xs font-semibold transition-colors disabled:opacity-60"
                    style={on ? { background: "#F08A68", color: "#1C1A17" } : { color: "#A89E94" }}>
                    {m === "office" ? "Irodai keret" : "Saját kredit"}
                  </button>
                );
              })}
            </div>
            <span className="text-[11px] leading-snug" style={{ color: "#8F857B" }}>
              Ha az irodai kereted elfogy, rákérdezünk, mielőtt a saját kreditedből vonunk. Ugyanez a kapcsoló a képernyő alján is.
            </span>
          </div>
        </div>

        {/* KPI-k */}
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <div className="col-span-2 rounded-xl px-4 py-3.5 lg:col-span-1"
            style={kpi.unlimited
              ? { background: "rgba(31,122,77,0.18)", border: "1px solid rgba(111,191,142,0.45)" }
              : { background: "rgba(238,123,91,0.12)", border: "1px solid rgba(238,123,91,0.35)" }}>
            <p className="text-xs" style={{ color: kpi.unlimited ? "#9FD8B3" : "#F4A48A" }}>Irodai keretemből elérhető</p>
            {kpi.unlimited ? (
              <p className="mt-0.5 font-display text-[22px] font-bold sm:text-[26px]" style={{ color: "#F6F1EA" }}>∞ Korlátlan</p>
            ) : (
              <>
                <p className="mt-0.5 font-display text-[22px] font-bold tabular-nums sm:text-[26px]" style={{ color: "#F6F1EA" }}>
                  {kpi.allowance}<span className="ml-1 text-[13px] font-medium" style={{ color: "#A89E94" }}>/ {total} kredit</span>
                </p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div className="h-full" style={{ width: `${pct}%`, background: "#EE7B5B" }} />
                </div>
              </>
            )}
          </div>
          <Kpi label="Saját kreditem" value={kpi.wallet} />
          <Kpi label={SPENT_LABEL[range]} value={kpi.spent} unit={`· ${kpi.works} munka`} />
          <div className="flex flex-col justify-between gap-2 rounded-xl px-4 py-3.5" style={{ background: "#1B1815", border: "1px solid #2E2723" }}>
            <p className="text-xs" style={{ color: "#8F857B" }}>{kpi.unlimited ? "Korlátlan kereted van" : "Kevés a keret?"}</p>
            {kpi.unlimited ? (
              <p className="text-xs" style={{ color: "#A89E94" }}>Kérés nélkül dolgozhatsz az irodai egyenlegből.</p>
            ) : (
              <button type="button" onClick={() => setAskOpen(true)}
                className="h-9 rounded-full px-3 text-xs font-semibold" style={{ background: "#F08A68", color: "#1C1A17" }}>
                Kredit kérése a vezetőtől
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ====================== ÜZENETEK ====================== */}
      <OfficeMessagesRow canDecide={false} />

      {/* ====================== MUNKÁIM ====================== */}
      <MyWorksCard range={range} onRange={setRange} />

      {/* ====================== FELADATAIM · MAPPÁK · KERETEM ====================== */}
      <div className="grid gap-4 md:grid-cols-3">
        <OfficeTasksCard height={CARD_H} />
        <OfficeFolders height={CARD_H} />
        <OfficeLedgerCard scope="me" height={CARD_H} />
      </div>

      {/* ====================== MODULOK ====================== */}
      <OfficeModuleShelf />

      {askOpen && (
        <OfficeDialog title="Kredit kérése a vezetőtől" onClose={() => setAskOpen(false)}>
          {data.preview ? (
            <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
              Előnézetben nem küldhető kérés — a kolléga itt adja meg, hány kreditre van szüksége és mire.
            </p>
          ) : (
            <OfficeCreditAsk />
          )}
        </OfficeDialog>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Munkáim — fix 5 sor, görgethető; modul, munka, mappa, dátum, kredit
// ---------------------------------------------------------------------------
function MyWorksCard({ range, onRange }: { range: OverviewRange; onRange: (r: OverviewRange) => void }) {
  const [works, setWorks] = useState<WorkRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setWorks(null);
    fetch(`/api/office/works/list?range=${range}`)
      .then((r) => r.json())
      .then((d) => { if (alive) { if (d.error) setError(d.error); else setWorks(d.works ?? []); } })
      .catch(() => alive && setError("Nem sikerült betölteni a munkáidat."));
    return () => { alive = false; };
  }, [range]);

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
        {works && works.map((w) => (
          <div key={w.id} className={`flex flex-col gap-1 px-4 py-2.5 text-[13px] md:h-12 md:py-0 ${COLS}`} style={{ borderBottom: "1px solid #EFE7DD" }}>
            <span className="truncate text-xs md:text-[13px]" style={{ color: "#6B6258" }}>{w.moduleLabel}</span>
            {w.fileUrl
              ? <a href={w.fileUrl} target="_blank" rel="noreferrer" className="truncate font-semibold hover:underline">{w.title}</a>
              : <strong className="truncate">{w.title}</strong>}
            <span className="min-w-0">
              {w.folders && w.folders.length > 0 ? (
                <span className="inline-block max-w-full truncate rounded-full px-2 py-[3px] text-[11px] font-semibold" title={w.folders.join(", ")}
                  style={{ background: "#FBE1D6", color: "#A8411F" }}>
                  {w.folders[0]}{w.folders.length > 1 ? ` +${w.folders.length - 1}` : ""}
                </span>
              ) : (
                <span className="text-xs" style={{ color: "#6B6258" }}>
                  Csak nekem · <a href="/dashboard/munkaim" className="font-semibold underline" style={{ color: "#C2512F" }}>megosztás</a>
                </span>
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
    </section>
  );
}

function Kpi({ label, value, unit }: { label: string; value: number | string; unit?: string }) {
  return (
    <div className="rounded-xl px-4 py-3.5" style={{ background: "#1B1815", border: "1px solid #2E2723" }}>
      <p className="text-xs" style={{ color: "#8F857B" }}>{label}</p>
      <p className="mt-0.5 font-display text-[22px] font-bold tabular-nums sm:text-[26px]" style={{ color: "#F6F1EA" }}>
        {value}{unit && <span className="ml-1 text-[13px] font-medium" style={{ color: "#A89E94" }}>{unit}</span>}
      </p>
    </div>
  );
}
