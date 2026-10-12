// OfficeUsageCard — „Irodák és munkaterek" blokk az admin Modul-használat fülön (MH7).
//   • kétállású váltó (azonos méretű fülek): Irodai fiókok | Közös munkaterek — külön nézzük őket
//   • irodánál: aktív tag, irodai módban készült futtatás, megnyitásból futtatás, modul-mix, legnépszerűbb
//   • munkatérnél: aktív társ, a munkatérben készült futtatás, kredit-átadások (db · összeg), modul-mix, legnépszerűbb
//   • fix magasságú lista, belül görget; sorra kattintva (vagy „⋯" → Részletek) az iroda részletei: tag × modul
// Pénz itt sincs: az irodai egyenleg az Irodai fiókok oldalon marad.
"use client";

import { useEffect, useState } from "react";
import { OfficeDialog } from "@/components/office/OfficeUi";
import { ActionMenu, MI, MenuDots, useActionMenu, type MenuItem } from "@/components/ui/ActionMenu";

export type OfficeUsageRow = {
  id: string; name: string; kind: "office" | "team"; owner: string; members: number; activeMembers: number; runs: number;
  conversionPct: number | null; transfers: { count: number; sum: number };
  mix: { href: string; label: string; runs: number }[]; top: string | null;
};

type OfficeDetail = {
  office: { id: string; name: string; kind: "office" | "team" };
  kpi: { runs: number; members: number; activeMembers: number; folders: number };
  modules: { href: string; label: string }[];
  matrix: { userId: string; name: string; counts: number[] }[];
};

const MIX_COLORS = ["#E3683F", "#F4A48A", "#C9B8A8", "#8B5E4A", "#2F7F86", "#7FC8CE"];
const COLS = "lg:grid lg:grid-cols-[minmax(200px,1.5fr)_88px_80px_100px_minmax(0,1.6fr)_minmax(0,1fr)_34px] lg:items-center lg:gap-3";
const MUTED = "#6E655C";

export default function OfficeUsageCard({ data, query, loading }: {
  data: { office: OfficeUsageRow[]; team: OfficeUsageRow[] } | null; query: string; loading: boolean;
}) {
  const [kind, setKind] = useState<"office" | "team">("office");
  const [open, setOpen] = useState<OfficeUsageRow | null>(null);
  const menu = useActionMenu();
  const [menuFor, setMenuFor] = useState<OfficeUsageRow | null>(null);
  const rows = data ? data[kind] : null;
  const team = kind === "team";
  const items: MenuItem[] = menuFor ? [{ label: "Részletek", icon: MI.open, onClick: () => setOpen(menuFor) }] : [];

  return (
    <section className="overflow-hidden rounded-2xl" style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] pb-3 pt-4">
        <h2 className="font-display text-lg font-semibold">Irodák és munkaterek</h2>
        <div className="inline-grid grid-cols-2 rounded-full p-[3px]" style={{ background: "#F1EAE1" }} role="tablist">
          {(["office", "team"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
              className="h-[30px] w-[160px] rounded-full text-xs font-bold"
              style={kind === k ? { background: "#12100e", color: "#fff" } : { color: "#4A433C" }}>
              {k === "office" ? "Irodai fiókok" : "Közös munkaterek"} · {data ? data[k].length : "…"}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[336px] overflow-y-auto overscroll-contain">
        {/* a fejléc a görgető dobozon BELÜL, rögzítve — a görgetősáv így a fejlécet is szűkíti, az oszlopok egy vonalban maradnak */}
        <div className={`sticky top-0 z-10 hidden px-[18px] py-2 text-[10.5px] font-bold uppercase tracking-[0.06em] ${COLS}`} style={{ background: "#1B1815", color: "#BFB4A8" }}>
          <span>{team ? "Közös munkatér" : "Iroda"}</span><span>{team ? "Aktív társ" : "Aktív tag"}</span><span>Futtatás</span>
          <span>{team ? "Kredit-átadás" : "Megnyitásból"}</span><span>Modul-mix</span><span>Legnépszerűbb</span><span />
        </div>
        {!rows && <p className="p-5 text-sm" style={{ color: MUTED }}>{loading ? "Betöltés…" : "Nincs adat."}</p>}
        {rows && rows.length === 0 && (
          <p className="p-5 text-sm" style={{ color: MUTED }}>{team ? "Még nincs közös munkatér." : "Még nincs megnyitott irodai fiók."}</p>
        )}
        {rows?.map((o) => {
          const total = o.mix.reduce((s, m) => s + m.runs, 0) || 1;
          return (
            <div key={o.id} role="button" tabIndex={0} onClick={() => setOpen(o)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(o); }}
              onContextMenu={(e) => { setMenuFor(o); menu.openAtEvent(e); }}
              className={`flex cursor-pointer flex-col gap-1.5 px-[18px] py-3 text-[13px] transition-colors hover:bg-[#FBF6F0] lg:h-[58px] lg:py-0 ${COLS}`}
              style={{ borderTop: "1px solid #EFE7DD", opacity: o.runs ? 1 : 0.6 }}>
              <span className="min-w-0">
                <b className="block break-words leading-tight">{o.name}</b>
                <span className="block truncate text-[10.5px]" style={{ color: MUTED }}>{o.members} {team ? "társ" : "tag"} · gazda: {o.owner}</span>
              </span>
              <span className="tabular-nums"><Lbl>{team ? "Aktív társ" : "Aktív tag"}</Lbl>{o.activeMembers} / {o.members}</span>
              <b className="tabular-nums"><Lbl>Futtatás</Lbl>{o.runs}</b>
              <span className="tabular-nums">
                <Lbl>{team ? "Kredit-átadás" : "Megnyitásból"}</Lbl>
                {team ? `${o.transfers.count} db · ${o.transfers.sum} kr` : o.conversionPct === null ? "—" : `${o.conversionPct}%`}
              </span>
              <span className="flex h-3 overflow-hidden rounded-full" style={{ background: "#F1EAE1" }}
                title={o.mix.map((m) => `${m.label}: ${m.runs}`).join(" · ") || "Nincs futtatás"}>
                {o.mix.map((m, i) => <i key={m.href} className="block h-full" style={{ width: `${(m.runs / total) * 100}%`, background: MIX_COLORS[i % MIX_COLORS.length] }} />)}
              </span>
              <span className="truncate"><Lbl>Legnépszerűbb</Lbl>{o.top ?? <span style={{ color: MUTED }}>— nincs futtatás</span>}</span>
              <span className="hidden lg:block" onClick={(e) => e.stopPropagation()}>
                <MenuDots onClick={(e) => { setMenuFor(o); menu.openAtButton(e); }} label={`Műveletek: ${o.name}`} />
              </span>
            </div>
          );
        })}
      </div>

      {menu.open && <ActionMenu at={menu.at} items={items} onClose={menu.close} />}

      {open && (
        <OfficeDialog title={open.name} onClose={() => setOpen(null)} xwide>
          <OfficeDetailBody officeId={open.id} query={query} />
        </OfficeDialog>
      )}
    </section>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <span className="font-normal lg:hidden" style={{ color: MUTED }}>{children}: </span>;
}

// ---------------------------------------------------------------------------
// Iroda részletei — tag × modul (mind a modulok; a táblázat fix méretű, mindkét irányban belül görget)
// ---------------------------------------------------------------------------
const PAL = ["#FDF3EE", "#FBE1D6", "#F7C3AE", "#F4A48A", "#EE865F", "#E3683F"];

function OfficeDetailBody({ officeId, query }: { officeId: string; query: string }) {
  const [d, setD] = useState<OfficeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/module-usage?${query}&office=${officeId}`)
      .then((r) => r.json())
      .then((x) => { if (alive) { if (x.error) setError(x.error); else setD(x as OfficeDetail); } })
      .catch(() => alive && setError("Nem sikerült betölteni."));
    return () => { alive = false; };
  }, [officeId, query]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  const team = d?.office.kind === "team";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs" style={{ color: MUTED }}>
        <span className="mr-2 rounded-full px-2 py-[2px] text-[10px] font-extrabold"
          style={team ? { background: "#DCEFF0", color: "#1F5F65" } : { background: "#FBE1D6", color: "#A8411F" }}>
          {d ? (team ? "KÖZÖS MUNKATÉR" : "IRODA") : "…"}
        </span>
        {team ? "A munkatérben készült futtatások társanként." : "Irodai módban készült futtatások tagonként (a privát módban készültek a felhasználó saját sorában számítanak)."}
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[["Futtatás", d?.kpi.runs], [team ? "Aktív társ" : "Aktív tag", d ? `${d.kpi.activeMembers} / ${d.kpi.members}` : undefined], [team ? "Társak" : "Tagok", d?.kpi.members], ["Közös mappák", d?.kpi.folders]].map(([t, v]) => (
          <div key={t as string} className="rounded-xl px-3 py-2" style={{ background: "#F8F3EC" }}>
            <p className="text-[10.5px]" style={{ color: MUTED }}>{t}</p>
            <b className="text-lg tabular-nums">{v ?? "…"}</b>
          </div>
        ))}
      </div>

      <div className="h-[320px] overflow-auto rounded-xl" style={{ background: "#fff", border: "1px solid #EFE7DD" }}>
        {!d && <p className="p-3 text-sm" style={{ color: MUTED }}>Betöltés…</p>}
        {d && d.matrix.length === 0 && <p className="p-3 text-sm" style={{ color: MUTED }}>Nincs tag.</p>}
        {d && d.matrix.length > 0 && (
          <table className="w-full border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 px-3 py-2 text-left text-[10.5px] font-bold" style={{ background: "#1B1815", color: "#BFB4A8" }}>{team ? "Társ" : "Tag"}</th>
                {d.modules.map((m) => (
                  <th key={m.href} className="sticky top-0 z-10 whitespace-nowrap px-2 py-2 text-center text-[10.5px] font-bold" style={{ background: "#1B1815", color: "#BFB4A8" }}>{m.label}</th>
                ))}
                <th className="sticky top-0 z-10 px-2 py-2 text-[10.5px] font-bold" style={{ background: "#1B1815", color: "#BFB4A8" }}>Össz.</th>
              </tr>
            </thead>
            <tbody>
              {d.matrix.map((row) => {
                const max = Math.max(...row.counts, 1);
                const sum = row.counts.reduce((s, n) => s + n, 0);
                return (
                  <tr key={row.userId}>
                    <td className="sticky left-0 z-10 min-w-[180px] whitespace-nowrap px-3 font-semibold" style={{ background: "#fff", borderBottom: "1px solid #F3EDE6", height: 40 }}>{row.name}</td>
                    {row.counts.map((n, i) => {
                      const lvl = n === 0 ? 0 : Math.min(5, 1 + Math.round((n / max) * 4));
                      return (
                        <td key={i} className="p-0 text-center" style={{ borderBottom: "1px solid #F3EDE6" }}>
                          <div className="m-[3px] flex h-8 min-w-[44px] items-center justify-center rounded-md font-bold tabular-nums"
                            style={{ background: n ? PAL[lvl] : "#FAF7F2", color: lvl >= 4 ? "#fff" : "#1C1815" }}>
                            {n || "·"}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-2 text-center font-bold tabular-nums" style={{ borderBottom: "1px solid #F3EDE6" }}>{sum}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
