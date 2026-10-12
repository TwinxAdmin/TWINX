// OfficeTeamView — a KÖZÖS MUNKATÉR felülete (offices.kind = team; látványterv: design/kozos-munkater-latvanyterv.html).
// Adat: /api/office/overview (team-ág) + /api/office/transfers.
//   • türkiz fejléc-sáv: név, „Társ", Kredit adása társnak, Kredit vásárlása magamnak, ÁLLANDÓ kód (mindenkinek),
//     KPI-k: saját kreditem, felhasználásom (30 nap), társaimnak adtam / kaptam, társak
//   • Munkáim (közös OfficeMyWorks — megosztás közös mappába)
//   • Társak · Közös mappák · Kredit-átadások — azonos fix magassággal
//   • Kedvenc modulok sáv; alul: Kilépés (Hamarosan — KM8)
// Mindenki egyenrangú; mindenki a SAJÁT kreditjéből dolgozik. Egymás egyenlegét / költését senki nem látja.
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { OverviewRange, TeamMate, TransferRow } from "@/lib/office-overview";
import { avatarColor, fmtWhen, initials } from "@/lib/office-format";
import { showToast } from "@/components/Toast";
import OfficeMyWorks from "@/components/office/OfficeMyWorks";
import OfficeFolders from "@/components/office/OfficeFolders";
import OfficeModuleShelf from "@/components/office/OfficeModuleShelf";
import TeamTransferDialog from "@/components/office/TeamTransferDialog";
import { EmptyState, Icons, OfficeCard, OfficeDialog, SoonBadge } from "@/components/office/OfficeUi";

type TeamOverview = {
  view: "team";
  office: { id: string; name: string; joinCode: string };
  me: { userId: string; name: string };
  kpi: { wallet: number; spent: number; works: number; given: number; received: number; members: number };
  members: TeamMate[];
};

const TEAM_MAX = 5;
const CARD_H = 340;

export default function OfficeTeamView() {
  const router = useRouter();
  const [data, setData] = useState<TeamOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [worksRange, setWorksRange] = useState<OverviewRange>("30d");
  const [transfer, setTransfer] = useState<{ preselect: string | null } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const d = await fetch("/api/office/overview?range=30d").then((r) => r.json());
      if (d.error) setError(d.error);
      else if (d.view === "team") setData(d as TeamOverview);
    } catch {
      setError("Nem sikerült betölteni a munkatér adatait.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>;

  const others = data.members.filter((m) => m.userId !== data.me.userId);
  const canGive = others.length > 0;

  function afterTransfer() {
    setTransfer(null);
    void load();
    setReloadKey((k) => k + 1);
    router.refresh(); // a lenti kredit-sáv egyenlege is frissüljön
  }

  return (
    <div className="flex flex-col gap-4">
      <HeroBand data={data} canGive={canGive} onGive={() => setTransfer({ preselect: null })} />

      <OfficeMyWorks range={worksRange} onRange={setWorksRange} />

      <div className="grid gap-4 md:grid-cols-3">
        <MatesCard data={data} onGive={(id) => setTransfer({ preselect: id })} />
        <OfficeFolders height={CARD_H} />
        <TransfersCard reloadKey={reloadKey} />
      </div>

      <OfficeModuleShelf />

      {/* Kilépés — a munka-átadással együtt a KM8-ban készül; addig halványan, magyarázattal a helyén */}
      <div className="flex justify-end">
        <span className="inline-flex items-center gap-2" title="A kilépés (munkák átadásával) hamarosan elérhető.">
          <button type="button" disabled className="h-[34px] cursor-not-allowed rounded-full px-3.5 text-xs font-semibold opacity-50"
            style={{ color: "#8A3A25", border: "1px solid #E8B9A6" }}>
            Kilépés a munkatérből…
          </button>
          <SoonBadge />
        </span>
      </div>

      {transfer && (
        <OfficeDialog title="Kredit adása társnak" onClose={() => setTransfer(null)} wide>
          <TeamTransferDialog mates={data.members} meId={data.me.userId} wallet={data.kpi.wallet}
            preselect={transfer.preselect} onDone={afterTransfer} />
        </OfficeDialog>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Türkiz fejléc-sáv
// ---------------------------------------------------------------------------
function HeroBand({ data, canGive, onGive }: { data: TeamOverview; canGive: boolean; onGive: () => void }) {
  const { office, kpi } = data;

  async function copy() {
    try {
      await navigator.clipboard.writeText(office.joinCode);
      showToast("Csatlakozási kód kimásolva.", "success");
    } catch {
      showToast("A vágólap nem elérhető — jelöld ki a kódot kézzel.", "error");
    }
  }

  return (
    <section className="flex flex-col gap-6 rounded-[20px] p-5 sm:p-7"
      style={{
        background: "#121110",
        backgroundImage: "radial-gradient(ellipse 520px 300px at 88% 0%, rgba(47,127,134,0.32), transparent 70%), linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
        backgroundSize: "auto, 40px 40px, 40px 40px",
        border: "1px solid #2A2420",
        color: "#F3EDE6",
      }}>
      <div className="flex flex-wrap items-stretch justify-between gap-6">
        <div className="flex flex-[1_1_380px] flex-col justify-between gap-[18px]">
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold tracking-[0.16em]" style={{ color: "#7FC8CE" }}>KÖZÖS MUNKATÉR</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-[28px] font-bold leading-[1.1] sm:text-[34px]" style={{ color: "#F6F1EA" }}>{office.name}</h1>
              <span className="rounded-full px-2 py-[3px] text-[11px] font-semibold"
                style={{ background: "rgba(47,127,134,0.2)", color: "#9ED6DB", border: "1px solid rgba(127,200,206,0.45)" }}>
                Társ
              </span>
            </div>
            <p className="text-sm" style={{ color: "#A89E94" }}>Egyenrangú társak, közös mappák. Mindenki a saját kreditjéből dolgozik.</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <span title={canGive ? undefined : "Még nincs társad — add át nekik a csatlakozási kódot."}>
              <button type="button" onClick={onGive} disabled={!canGive}
                className="inline-flex h-[42px] items-center gap-1.5 rounded-full px-[18px] text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: "#7FC8CE", color: "#0F2A2C" }}>
                Kredit adása társnak
              </button>
            </span>
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("open-pricing"))}
              className="inline-flex h-[42px] items-center gap-1.5 rounded-full px-[18px] text-[13px] font-semibold"
              style={{ border: "1px solid rgba(127,200,206,0.55)", background: "rgba(127,200,206,0.08)", color: "#F6F1EA" }}>
              + Kredit vásárlása magamnak
            </button>
          </div>
        </div>

        {/* csatlakozási kód — ÁLLANDÓ, minden társ látja */}
        <div className="flex min-w-[260px] flex-col gap-2 self-start rounded-[14px] px-3.5 py-3"
          style={{ background: "#1B1815", border: "1px solid rgba(127,200,206,0.45)" }}>
          <span className="flex justify-between text-[11px] font-semibold tracking-[0.1em]" style={{ color: "#9ED6DB" }}>
            CSATLAKOZÁSI KÓD <span className="font-medium tracking-normal" style={{ color: "#8F857B" }}>állandó</span>
          </span>
          <span className="select-all font-mono text-lg font-bold tracking-[0.08em]" style={{ color: "#7FC8CE" }}>{office.joinCode}</span>
          <div className="flex items-center justify-between gap-3 pt-2" style={{ borderTop: "1px solid #2E2723" }}>
            <span className="text-[11px]" style={{ color: "#8F857B" }}>Add át a társaidnak ({kpi.members} / {TEAM_MAX})</span>
            <button type="button" onClick={copy} className="h-[26px] rounded-full px-2.5 text-[11px] font-semibold"
              style={{ border: "1px solid #3A322C", color: "#F3EDE6" }}>
              Másolás
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Kpi label="Saját kreditem" value={kpi.wallet} unit="kredit" accent />
        <Kpi label="Felhasználtam (30 nap)" value={kpi.spent} unit={`· ${kpi.works} munka`} />
        <Kpi label="Társaimnak adtam / kaptam" value={kpi.given} unit={`/ ${kpi.received} kredit`} />
        <Kpi label="Társak" value={`${kpi.members} fő`} />
      </div>
    </section>
  );
}

function Kpi({ label, value, unit, accent }: { label: string; value: number | string; unit?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl px-4 py-3.5"
      style={accent
        ? { background: "rgba(47,127,134,0.14)", border: "1px solid rgba(127,200,206,0.38)" }
        : { background: "#1B1815", border: "1px solid #2E2723" }}>
      <p className="text-xs" style={{ color: accent ? "#9ED6DB" : "#8F857B" }}>{label}</p>
      <p className="mt-0.5 font-display text-[22px] font-bold tabular-nums sm:text-[24px]" style={{ color: "#F6F1EA" }}>
        {value}{unit && <span className="ml-1 text-[12px] font-medium" style={{ color: "#A89E94" }}>{unit}</span>}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Társak — fix magasság; a többieknél „Kredit adása" (az ablak az adott társnál nyílik)
// ---------------------------------------------------------------------------
function MatesCard({ data, onGive }: { data: TeamOverview; onGive: (userId: string) => void }) {
  const free = Math.max(TEAM_MAX - data.members.length, 0);
  return (
    <OfficeCard title="Társak" height={CARD_H} bodyClassName="!px-0"
      badge={<span className="text-xs" style={{ color: "#6B6258" }}>{data.members.length} / {TEAM_MAX}</span>}>
      {data.members.map((m) => {
        const me = m.userId === data.me.userId;
        const av = avatarColor(m.userId);
        return (
          <div key={m.userId} className="flex h-[58px] items-center gap-3 px-4 sm:px-[18px]" style={{ borderTop: "1px solid #EFE7DD" }}>
            <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-xs font-bold" style={{ background: av.bg, color: av.fg }}>
              {initials(m.name, m.email)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">{m.name || m.email}{me && <span className="font-medium" style={{ color: "#6B6258" }}> (te)</span>}</div>
              <div className="truncate text-xs" style={{ color: "#6B6258" }}>
                {m.opener ? "nyitotta" : "csatlakozott"} · {fmtWhen(m.joinedAt, false)}
              </div>
            </div>
            {!me && (
              <button type="button" onClick={() => onGive(m.userId)}
                className="h-[30px] flex-none rounded-full px-3 text-xs font-semibold" style={{ background: "#DCEFF0", color: "#1F5F65" }}>
                Kredit adása
              </button>
            )}
          </div>
        );
      })}
      {free > 0 && (
        <div className="flex h-[58px] items-center gap-3 px-4 opacity-60 sm:px-[18px]" style={{ borderTop: "1px solid #EFE7DD" }}>
          <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-sm font-bold" style={{ background: "#F1EAE1", color: "#6B6258" }}>+</span>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold">Még {free} társ csatlakozhat</div>
            <div className="text-xs" style={{ color: "#6B6258" }}>add át nekik a csatlakozási kódot</div>
          </div>
        </div>
      )}
    </OfficeCard>
  );
}

// ---------------------------------------------------------------------------
// Kredit-átadások — csak a SAJÁT átadások (adtam / kaptam)
// ---------------------------------------------------------------------------
function TransfersCard({ reloadKey }: { reloadKey: number }) {
  const [items, setItems] = useState<TransferRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/office/transfers")
      .then((r) => r.json())
      .then((d) => { if (alive) { if (d.error) setError(d.error); else setItems(d.items ?? []); } })
      .catch(() => alive && setError("Nem sikerült betölteni az átadásokat."));
    return () => { alive = false; };
  }, [reloadKey]);

  return (
    <OfficeCard title="Kredit-átadások" height={CARD_H} bodyClassName="!px-0"
      badge={<span className="text-xs" style={{ color: "#6B6258" }}>csak a tieid</span>}>
      {error && <p className="px-4 text-sm text-red-600">{error}</p>}
      {!items && !error && <p className="px-4 text-sm" style={{ color: "#6B6258" }}>Betöltés…</p>}
      {items && items.length === 0 && (
        <div className="h-full px-4 sm:px-[18px]">
          <EmptyState icon={Icons.coins} title="Még nem volt átadás"
            text="Ha egy társadnak elfogy a kreditje, a saját egyenlegedből adhatsz neki. Itt látod, kinek adtál és kitől kaptál — visszavétel nincs." />
        </div>
      )}
      {items && items.map((t) => (
        <div key={t.id} className="flex h-[52px] items-center justify-between gap-3 px-4 text-[13px] sm:px-[18px]" style={{ borderTop: "1px solid #EFE7DD" }}>
          <div className="min-w-0">
            <div className="truncate">{t.direction === "out" ? <>Te → <strong>{t.otherName}</strong></> : <><strong>{t.otherName}</strong> → te</>}</div>
            <div className="truncate text-[11px]" style={{ color: "#6B6258" }}>
              {fmtWhen(t.createdAt, false)}{t.note ? ` · „${t.note}”` : ""}
            </div>
          </div>
          <strong className="flex-none tabular-nums" style={{ color: t.direction === "out" ? "#B3261E" : "#1F7A4D" }}>
            {t.direction === "out" ? "−" : "+"}{t.amount}
          </strong>
        </div>
      ))}
    </OfficeCard>
  );
}
