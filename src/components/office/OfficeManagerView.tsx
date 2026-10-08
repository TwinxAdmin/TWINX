// OfficeManagerView — az Irodai TWINX fiók felülete a létrehozónak és a vezetőknek
// (megjelenési terv: twinx-irodai-fiok-vezetoi). Minden adat a /api/office/overview-ból jön.
//   • sötét fejléc-sáv: iroda neve + szerep, Egyenleg feltöltése (csak létrehozó), csatlakozási kód
//     (Másolás; Új kód csak a létrehozónak), KPI-k (egyenleg, szabad, kiosztva, felhasználva, tagok)
//   • üzenetek sora (fix magasság): fogadott (kredit-kérések) + üzenet küldése („Hamarosan")
//   • Tagok és felhasználás (időszak-választóval) + jobb oszlop: közös mappák, kredit-mozgások
// Minden blokk MINDIG látszik (üresen is, szép üres állapottal), és fix magasságú: a tartalom
// a kártyán belül görget, az új mappa / mappa tartalma / feltöltés felugró ablakban nyílik.
"use client";

import { useCallback, useEffect, useState } from "react";
import type { MemberStat, OfficeRoleLabel, OverviewRange } from "@/lib/office-overview";
import { ROLE_TEXT } from "@/lib/office-format";
import { showToast } from "@/components/Toast";
import OfficeMemberTable from "@/components/office/OfficeMemberTable";
import OfficeLedgerCard from "@/components/office/OfficeLedgerCard";
import OfficeMessagesRow from "@/components/office/OfficeMessagesRow";
import { EmptyState, Icons, OfficeDialog } from "@/components/office/OfficeUi";
import OfficeFolders from "@/components/office/OfficeFolders";
import OfficeTopup from "@/components/office/OfficeTopup";
import OfficeModuleShelf from "@/components/office/OfficeModuleShelf";

type Overview = {
  view: "manager";
  range: OverviewRange;
  office: { id: string; name: string; joinCode: string; canRegenerate: boolean; canTopup: boolean };
  me: { userId: string; name: string; roleLabel: OfficeRoleLabel };
  kpi: { balance: number; allocated: number; free: number; spent: number; works: number; members: number; managers: number };
  members: MemberStat[];
};

const RANGES: OverviewRange[] = ["7d", "14d", "30d", "all"];
const RANGE_TEXT: Record<OverviewRange, string> = { "7d": "1 hét", "14d": "2 hét", "30d": "30 nap", all: "Összes" };
const SPENT_LABEL: Record<OverviewRange, string> = {
  "7d": "Felhasználva (1 hét)", "14d": "Felhasználva (2 hét)", "30d": "Felhasználva (30 nap)", all: "Felhasználva összesen",
};

export default function OfficeManagerView() {
  const [range, setRange] = useState<OverviewRange>("30d");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [topupOpen, setTopupOpen] = useState(false);

  const load = useCallback(async (r: OverviewRange) => {
    try {
      const d = await fetch(`/api/office/overview?range=${r}`).then((res) => res.json());
      if (d.error) setError(d.error);
      else if (d.view === "manager") setData(d as Overview);
    } catch {
      setError("Nem sikerült betölteni az irodai adatokat.");
    }
  }, []);

  useEffect(() => { void load(range); }, [load, range]);

  const refresh = () => { void load(range); setReloadKey((k) => k + 1); };

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>;

  const { office, kpi } = data;

  return (
    <div className="flex flex-col gap-4">
      <HeroBand data={data} onTopup={() => setTopupOpen(true)} onCodeChanged={refresh} spentLabel={SPENT_LABEL[range]} />

      <OfficeMessagesRow canDecide reloadKey={reloadKey} onDecided={refresh} />

      {/* Tagok és felhasználás — TELJES szélességben, hogy minden oszlop görgetés nélkül látszódjon */}
      <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl" style={{ background: "#FCFAF7", border: "1px solid #E9E0D5" }}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 pt-4 sm:px-[18px]">
            <h2 className="font-display text-[17px] font-semibold">Tagok és felhasználás</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "#6B6258" }}>Időszak:</span>
              {RANGES.map((r) => (
                <button key={r} type="button" onClick={() => setRange(r)} aria-pressed={range === r}
                  className="rounded-full px-2 py-[3px] text-[11px] font-semibold"
                  style={range === r ? { background: "#1C1A17", color: "#fff" } : { background: "#F1EAE1", color: "#4A433C" }}>
                  {RANGE_TEXT[r]}
                </button>
              ))}
            </div>
          </div>
          <OfficeMemberTable members={data.members} meId={data.me.userId} isOwner={data.me.roleLabel === "owner"}
            free={kpi.free} range={range} onChanged={refresh}
            hint={data.members.length <= 1 ? (
              <EmptyState icon={Icons.users} title="Hívd meg a kollégáidat"
                text={`Add át nekik a csatlakozási kódot (${office.joinCode}). Az „Irodai fiók → Csatlakozás kóddal” menüben beírják, és azonnal megjelennek itt — utána a + gombbal adhatsz nekik keretet.`}
                action={
                  <button type="button" onClick={() => { void navigator.clipboard.writeText(office.joinCode).then(() => showToast("Csatlakozási kód kimásolva.", "success")).catch(() => {}); }}
                    className="h-8 rounded-full px-3.5 text-xs font-semibold" style={{ background: "#F08A68", color: "#1C1A17" }}>
                    Kód másolása
                  </button>
                } />
            ) : undefined} />
      </section>

      {/* Közös mappák + kredit-mozgások egymás mellett, azonos fix magassággal */}
      <div className="grid gap-4 md:grid-cols-2">
        <OfficeFolders height={340} />
        <OfficeLedgerCard scope="office" reloadKey={reloadKey} height={340} />
      </div>

      {/* Kedvenc modulok — a vezető is dolgozik a modulokkal */}
      <OfficeModuleShelf />

      {topupOpen && office.canTopup && (
        <OfficeDialog title="Irodai egyenleg feltöltése" onClose={() => setTopupOpen(false)}>
          <OfficeTopup />
        </OfficeDialog>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sötét fejléc-sáv
// ---------------------------------------------------------------------------
function HeroBand({ data, onTopup, onCodeChanged, spentLabel }: {
  data: Overview; onTopup: () => void; onCodeChanged: () => void; spentLabel: string;
}) {
  const { office, kpi, me } = data;
  const [regen, setRegen] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(office.joinCode);
      showToast("Csatlakozási kód kimásolva.", "success");
    } catch {
      showToast("A vágólap nem elérhető — jelöld ki a kódot kézzel.", "error");
    }
  }

  async function newCode() {
    if (!window.confirm("Új csatlakozási kódot generálsz? A régi kód azonnal érvénytelen lesz (a már csatlakozott tagokat nem érinti).")) return;
    setRegen(true);
    try {
      const res = await fetch("/api/office", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "regenerateCode" }),
      });
      const d = await res.json();
      if (!res.ok) { showToast(d.error ?? "Nem sikerült új kódot generálni.", "error"); return; }
      showToast("Új csatlakozási kód kész. A régi már nem működik.", "success");
      onCodeChanged();
    } catch {
      showToast("Hálózati hiba.", "error");
    } finally {
      setRegen(false);
    }
  }

  const subtitle = me.roleLabel === "owner"
    ? "Egy iroda, egy közös kreditkeret. Te osztod ki, ők dolgoznak belőle."
    : "Vezetőként kioszthatod az iroda kreditjeit a kollégáknak.";

  return (
    <section className="flex flex-col gap-6 rounded-[20px] p-5 sm:p-7"
      style={{
        background: "#121110",
        backgroundImage: "radial-gradient(ellipse 520px 300px at 88% 0%, rgba(238,123,91,0.22), transparent 70%), linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
        backgroundSize: "auto, 40px 40px, 40px 40px",
        border: "1px solid #2A2420",
        color: "#F3EDE6",
      }}>
      <div className="flex flex-wrap items-stretch justify-between gap-6">
        <div className="flex flex-[1_1_380px] flex-col justify-between gap-[18px]">
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold tracking-[0.16em]" style={{ color: "#EE7B5B" }}>IRODAI TWINX FIÓK</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-[28px] font-bold leading-[1.1] sm:text-[34px]" style={{ color: "#F6F1EA" }}>{office.name}</h1>
              <span className="rounded-full px-2 py-[3px] text-[11px] font-semibold"
                style={{ background: "rgba(238,123,91,0.16)", color: "#F4A48A", border: "1px solid rgba(238,123,91,0.4)" }}>
                {ROLE_TEXT[me.roleLabel]}
              </span>
            </div>
            <p className="text-sm" style={{ color: "#A89E94" }}>{subtitle}</p>
          </div>
          {office.canTopup && (
            <div className="flex flex-wrap gap-2.5">
              <button type="button" onClick={onTopup} className="inline-flex h-[42px] items-center gap-1.5 rounded-full px-[18px] text-[13px] font-semibold"
                style={{ background: "#F08A68", color: "#1C1A17" }}>
                + Egyenleg feltöltése
              </button>
            </div>
          )}
        </div>

        {/* csatlakozási kód */}
        <div className="flex min-w-[260px] flex-col gap-2 self-start rounded-[14px] px-3.5 py-3"
          style={{ background: "#1B1815", border: "1px solid rgba(238,123,91,0.5)" }}>
          <span className="text-[11px] font-semibold tracking-[0.1em]" style={{ color: "#F4A48A" }}>CSATLAKOZÁSI KÓD</span>
          <div className="flex items-center justify-between gap-3">
            <span className="select-all font-mono text-lg font-bold tracking-[0.08em]" style={{ color: "#EE7B5B" }}>{office.joinCode}</span>
            {office.canRegenerate && (
              <button type="button" onClick={newCode} disabled={regen}
                className="h-8 rounded-full px-3 text-xs font-semibold disabled:opacity-60" style={{ background: "#F08A68", color: "#1C1A17" }}>
                {regen ? "…" : "Új kód"}
              </button>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 pt-2" style={{ borderTop: "1px solid #2E2723" }}>
            <span className="text-[11px]" style={{ color: "#8F857B" }}>Add át a kollégáidnak</span>
            <button type="button" onClick={copy} className="h-[26px] rounded-full px-2.5 text-[11px] font-semibold"
              style={{ border: "1px solid #3A322C", color: "#F3EDE6" }}>
              Másolás
            </button>
          </div>
        </div>
      </div>

      {/* KPI-k */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
        <Kpi label="Irodai egyenleg" value={kpi.balance} unit="kredit" accent />
        <Kpi label="Szabadon kiosztható" value={Math.max(kpi.free, 0)} warn={kpi.free < 0 ? "Túl van osztva — tölts fel vagy vegyél vissza" : undefined} />
        <Kpi label="Kiosztva, még fel nem használt" value={kpi.allocated} />
        <Kpi label={spentLabel} value={kpi.spent} unit={`· ${kpi.works} munka`} />
        <Kpi label="Tagok" value={`${kpi.members} fő`} unit={`· ${kpi.managers} vezető`} className="col-span-2 sm:col-span-1" />
      </div>
    </section>
  );
}

function Kpi({ label, value, unit, accent, warn, className = "" }: { label: string; value: number | string; unit?: string; accent?: boolean; warn?: string; className?: string }) {
  return (
    <div className={`rounded-xl px-4 py-3.5 ${className}`}
      style={accent
        ? { background: "rgba(238,123,91,0.12)", border: "1px solid rgba(238,123,91,0.35)" }
        : { background: "#1B1815", border: "1px solid #2E2723" }}>
      <p className="text-xs" style={{ color: accent ? "#F4A48A" : "#8F857B" }}>{label}</p>
      <p className="mt-0.5 font-display text-[22px] font-bold tabular-nums sm:text-[26px]" style={{ color: "#F6F1EA" }}>
        {value}{unit && <span className="ml-1 text-[13px] font-medium" style={{ color: "#A89E94" }}>{unit}</span>}
      </p>
      {warn && <p className="mt-0.5 text-[11px]" style={{ color: "#F4A48A" }}>{warn}</p>}
    </div>
  );
}
