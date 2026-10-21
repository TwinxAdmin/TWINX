// AdminWorksView — Admin → Felhasználók és modulok → „Munkák" fül (látványterv: design/admin-munkak-latvanyterv.html).
// Az ügyfelek kész anyagai: szűrők (időszak, modul, felhasználó) · modulonkénti darabszám-sáv (kattintva szűr)
// · fix méretű kártyarács (48-asával, „Továbbiak betöltése") · „⋯" menü (jobb klikkre is) · közös nézegető.
// Csak valódi ügyfelek munkái — az admin / sales próbái és a lomtárba tett munkák nélkül. Adat: GET /api/admin/works.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SelectField from "@/components/SelectField";
import { ActionMenu, MenuDots, useActionMenu, type MenuItem } from "@/components/ui/ActionMenu";
import WorkViewer, { ghost, workKind, type ViewerWork } from "@/components/works/WorkViewer";
import UserDetailDialog from "@/components/admin/UserDetailDialog";
import { toDownloadUrl } from "@/lib/files";
import { avatarColor, fmtWhen, initials } from "@/lib/office-format";
import { OTHER_GROUP_LABEL, WORK_GROUPS, type AdminWork, type AdminWorksResult, type WorkGroupKey, type WorksRange } from "@/lib/admin-works-shared";

type Group = WorkGroupKey | "all";

const RANGES: { key: WorksRange; label: string }[] = [
  { key: "7d", label: "7 nap" }, { key: "30d", label: "30 nap" }, { key: "90d", label: "90 nap" }, { key: "all", label: "Mind" },
];
const GROUP_TABS: { key: Group; label: string }[] = [
  { key: "all", label: "Összes" },
  ...WORK_GROUPS.map((g) => ({ key: g.key as Group, label: g.label })),
  { key: "other", label: OTHER_GROUP_LABEL },
];
const GROUP_LABEL = Object.fromEntries(GROUP_TABS.map((g) => [g.key, g.label])) as Record<Group, string>;

export default function AdminWorksView() {
  const [range, setRange] = useState<WorksRange>("30d");
  const [group, setGroup] = useState<Group>("all");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState<AdminWorksResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<number | null>(null);
  const [detailsFor, setDetailsFor] = useState<string | null>(null);
  const [menuWork, setMenuWork] = useState<AdminWork | null>(null);
  const menu = useActionMenu();
  const reqId = useRef(0);

  // keresés: 300 ms-mal gépelés után
  useEffect(() => {
    const t = window.setTimeout(() => setQ(qInput.trim()), 300);
    return () => window.clearTimeout(t);
  }, [qInput]);

  const load = useCallback(async (before: string | null) => {
    const id = ++reqId.current;
    if (before) setMore(true); else setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams({ range, group, q });
      if (before) sp.set("before", before);
      const res = await fetch(`/api/admin/works?${sp}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Nem sikerült betölteni a munkákat.");
      if (id !== reqId.current) return; // közben újabb szűrés indult
      const r = d as AdminWorksResult;
      setData((prev) => (before && prev ? { ...r, works: [...prev.works, ...r.works] } : r));
    } catch (e) {
      if (id === reqId.current) setError((e as Error).message);
    } finally {
      if (id === reqId.current) { setLoading(false); setMore(false); }
    }
  }, [range, group, q]);

  useEffect(() => { void load(null); }, [load]);

  const works = useMemo(() => data?.works ?? [], [data]);
  const viewerWorks: ViewerWork[] = useMemo(() => works.map((w) => ({
    id: w.id, title: w.title, typeLabel: w.typeLabel, url: w.url, createdAt: w.createdAt, ownerName: w.userName, mine: false,
  })), [works]);

  const onlyUser = (w: AdminWork) => { setQInput(w.userEmail || w.userName); setGroup("all"); };

  function menuItems(w: AdminWork): MenuItem[] {
    const i = works.findIndex((x) => x.id === w.id);
    const items: MenuItem[] = [{ label: "Megnyitás", onClick: () => setView(i) }];
    if (w.url) items.push({ kind: "link", label: "Letöltés", href: toDownloadUrl(w.url) });
    items.push({ label: "A felhasználó adatai", onClick: () => setDetailsFor(w.userId) });
    items.push({ label: "Csak ennek a felhasználónak a munkái", onClick: () => onlyUser(w) });
    return items;
  }

  function openMenu(e: React.MouseEvent<HTMLElement>, w: AdminWork, how: "button" | "event") {
    setMenuWork(w);
    if (how === "button") menu.openAtButton(e); else menu.openAtEvent(e);
  }

  const counts = data?.counts;
  const shown = works.length;

  return (
    <div>
      <p className="mb-3 rounded-xl px-3 py-2 text-xs leading-relaxed" style={{ background: "#FFF3EC", border: "1px dashed #E8B9A6", color: "#7A4A2E" }}>
        <b style={{ color: "#A8411F" }}>Csak valódi ügyfelek munkái:</b> az admin és a sales próbái, valamint a felhasználó által lomtárba tett munkák nem látszanak.
      </p>

      {/* Szűrők */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-2xl px-3.5 py-3" style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
        <div className="inline-flex rounded-full p-[3px]" style={{ background: "#F1EAE1" }} role="group" aria-label="Időszak">
          {RANGES.map((r) => (
            <button key={r.key} type="button" onClick={() => setRange(r.key)} aria-pressed={range === r.key}
              className="h-7 w-[64px] rounded-full text-xs font-semibold"
              style={range === r.key ? { background: "var(--twx-dark)", color: "#fff" } : { color: "#4A433C" }}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="w-[200px]">
          <SelectField value={group} onChange={(v) => setGroup(v as Group)} ariaLabel="Modul" size="sm"
            options={GROUP_TABS.map((g) => ({ value: g.key, label: g.key === "all" ? "Minden modul" : g.label }))} />
        </div>
        <input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Felhasználó neve vagy e-mail…"
          aria-label="Felhasználó keresése" className="twx-input h-9 text-sm" style={{ width: 240, background: "#fff" }} />
        {qInput && (
          <button type="button" onClick={() => setQInput("")} className="text-xs font-semibold underline" style={{ color: "var(--twx-ink-muted)" }}>Szűrés törlése</button>
        )}
        <span className="flex-1" />
        <span className="text-xs tabular-nums" style={{ color: "var(--twx-ink-muted)" }}>
          <b style={{ color: "var(--twx-ink)" }}>{counts?.total ?? "–"}</b> munka · <b style={{ color: "var(--twx-ink)" }}>{counts?.users ?? "–"}</b> felhasználó
        </span>
      </div>

      {/* Modulonkénti darabszám — kattintva szűr */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {GROUP_TABS.map((g) => {
          const on = group === g.key;
          const n = !counts ? null : g.key === "all" ? counts.total : counts.groups[g.key];
          return (
            <button key={g.key} type="button" onClick={() => setGroup(g.key)} aria-pressed={on}
              className="flex h-16 flex-col justify-between rounded-xl px-3 py-2 text-left"
              style={on ? { background: "var(--twx-dark)", color: "#fff", border: "1px solid var(--twx-dark)" } : { background: "#fff", border: "1px solid var(--twx-line)" }}>
              <span className="truncate text-[11px] font-semibold" style={{ color: on ? "#BFB4A8" : "var(--twx-ink-muted)" }}>{g.label}</span>
              <span className="font-display text-xl font-bold tabular-nums">{n ?? "–"}</span>
            </button>
          );
        })}
      </div>

      {/* Rács */}
      {error ? (
        <p className="mt-4 rounded-xl p-3 text-sm" style={{ background: "#F7E1DC", color: "#8E2F1C" }}>{error}</p>
      ) : loading && !data ? (
        <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[232px] animate-pulse rounded-2xl" style={{ background: "#EFE7DD" }} />)}
        </div>
      ) : shown === 0 ? (
        <div className="mt-4 flex h-[220px] flex-col items-center justify-center gap-2 rounded-2xl text-center"
          style={{ border: "1.5px dashed #D9CFC3", background: "var(--twx-cream-card)" }}>
          <div className="mb-1.5 flex gap-2" aria-hidden>
            {[0, 1, 2].map((k) => <i key={k} className="h-11 w-[60px] rounded-lg" style={{ background: "repeating-linear-gradient(135deg,#f3ece3 0 6px,#ece3d7 6px 12px)", boxShadow: "inset 0 0 0 1px #e3d9cc" }} />)}
          </div>
          <b className="text-[15px]">Ebben az időszakban nincs ilyen munka</b>
          <span className="max-w-[420px] text-[12.5px] leading-normal" style={{ color: "var(--twx-ink-muted)" }}>
            Próbálj hosszabb időszakot vagy másik modult — a lista csak a valódi ügyfelek kész anyagait mutatja.
          </span>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3.5 transition-opacity sm:grid-cols-2 lg:grid-cols-4" style={{ opacity: loading ? 0.5 : 1 }}>
            {works.map((w, i) => (
              <WorkCard key={w.id} w={w} onOpen={() => setView(i)}
                onMenu={(e) => openMenu(e, w, "button")} onContext={(e) => openMenu(e, w, "event")} />
            ))}
          </div>
          <div className="mt-4 flex items-center justify-center gap-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            {data?.next && (
              <button type="button" onClick={() => void load(data.next)} disabled={more}
                className="h-[38px] rounded-full px-[18px] text-[13px] font-semibold disabled:opacity-50"
                style={{ background: "#fff", border: "1px solid #d9cfc4", color: "var(--twx-ink)" }}>
                {more ? "Betöltés…" : "Továbbiak betöltése"}
              </button>
            )}
            <span className="tabular-nums">
              {shown} / {group === "all" ? counts?.total ?? shown : counts?.groups[group] ?? shown} látszik
            </span>
          </div>
        </>
      )}

      {menu.open && menuWork && <ActionMenu at={menu.at} items={menuItems(menuWork)} onClose={menu.close} />}

      {view !== null && viewerWorks[view] && (
        <WorkViewer works={viewerWorks} index={view} onIndex={setView} onClose={() => setView(null)}
          extraActions={(vw) => {
            const w = works.find((x) => x.id === vw.id);
            if (!w) return null;
            return (
              <>
                <button type="button" onClick={() => { setView(null); setDetailsFor(w.userId); }}
                  className="inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold" style={ghost}>
                  A felhasználó adatai
                </button>
                <button type="button" onClick={() => { setView(null); onlyUser(w); }}
                  className="inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold" style={ghost}>
                  Csak az ő munkái
                </button>
              </>
            );
          }} />
      )}

      {detailsFor && <UserDetailDialog userId={detailsFor} onClose={() => setDetailsFor(null)} />}
    </div>
  );
}

/** Egy munka-kártya — fix méret (230 px), a felső rész a munka típusához igazodik. */
function WorkCard({ w, onOpen, onMenu, onContext }: {
  w: AdminWork;
  onOpen: () => void;
  onMenu: (e: React.MouseEvent<HTMLElement>) => void;
  onContext: (e: React.MouseEvent<HTMLElement>) => void;
}) {
  const kind = workKind(w.url);
  const av = avatarColor(w.userId);
  return (
    <div role="button" tabIndex={0} onClick={onOpen} onContextMenu={onContext}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      className="group cursor-pointer overflow-hidden rounded-2xl bg-white transition-shadow hover:shadow-[0_10px_26px_rgba(28,24,21,.10)]"
      style={{ border: "1px solid var(--twx-line)" }}>
      <div className="relative h-[150px] overflow-hidden" style={{ background: "#EFE8DE" }}>
        <Thumb w={w} kind={kind} />
        <span className="absolute left-2 top-2 rounded-full px-2 py-[3px] text-[10px] font-extrabold text-white" style={{ background: "rgba(20,18,16,.78)" }}>
          {GROUP_LABEL[w.group] === OTHER_GROUP_LABEL ? w.typeLabel : GROUP_LABEL[w.group]}
        </span>
        <span className="absolute right-1.5 top-1.5 rounded-full bg-white/90 shadow-sm" onClick={(e) => e.stopPropagation()}>
          <MenuDots onClick={onMenu} label={`Műveletek: ${w.title}`} />
        </span>
      </div>
      <div className="px-3 pb-3 pt-2.5">
        <p className="truncate text-[13px] font-bold" title={w.title}>{w.title}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[10.5px] font-extrabold" style={{ background: av.bg, color: av.fg }}>
            {initials(w.userName, w.userEmail)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold">{w.userName}</p>
            <p className="truncate text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>{w.userEmail}</p>
          </div>
          <time className="flex-none text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>{fmtWhen(w.createdAt, false)}</time>
        </div>
      </div>
    </div>
  );
}

function Thumb({ w, kind }: { w: AdminWork; kind: ReturnType<typeof workKind> }) {
  if (kind === "image" && w.url) {
    // eslint-disable-next-line @next/next/no-img-element
    if (w.group !== "flyer") return <img src={w.url} alt="" loading="lazy" className="h-full w-full object-cover" />;
    // a hirdetéskép egészben látszik (álló / fekvő / négyzetes is), krém alapon
    return (
      <div className="flex h-full items-center justify-center p-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={w.url} alt="" loading="lazy" className="max-h-full max-w-full rounded object-contain shadow-md" />
      </div>
    );
  }
  if (kind === "video" && w.url) {
    return (
      <>
        <video src={`${w.url}#t=0.5`} preload="metadata" muted playsInline className="h-full w-full object-cover" />
        <span className="absolute inset-0 m-auto flex h-[42px] w-[42px] items-center justify-center rounded-full text-[15px] text-white" style={{ background: "rgba(239,122,90,.92)" }}>▶</span>
      </>
    );
  }
  if (kind === "pdf") {
    return (
      <div className="flex h-full flex-col gap-1.5 px-4 pb-3.5 pt-9" style={{ background: "linear-gradient(160deg,#f6f1ea,#ece4d8)" }}>
        <span className="text-[9.5px] font-bold tracking-[0.14em]" style={{ color: "#8c8279" }}>{w.typeLabel.toUpperCase()}</span>
        <span className="line-clamp-2 font-display text-base font-bold leading-snug">{w.title}</span>
        <span className="mt-1 h-1.5 w-4/5 rounded" style={{ background: "#ddd2c4" }} />
        <span className="h-1.5 w-3/5 rounded" style={{ background: "#ddd2c4" }} />
        <span className="absolute bottom-2.5 right-2.5 rounded px-1.5 py-0.5 text-[10px] font-extrabold text-white" style={{ background: "#B3261E" }}>PDF</span>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col gap-1 bg-white px-4 pb-3.5 pt-9 text-xs leading-normal" style={{ color: "#4b443d", borderBottom: "1px solid #EFE7DD" }}>
      <b className="text-[12.5px]" style={{ color: "var(--twx-ink)" }}>{w.typeLabel}</b>
      <span className="line-clamp-3">{w.url ? "Letölthető fájl — megnyitva látszik." : "Ehhez a munkához nincs letölthető fájl; a tartalma a modul oldalán látszik."}</span>
    </div>
  );
}
