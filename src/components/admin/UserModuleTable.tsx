// UserModuleTable — „Felhasználók és kedvenc moduljaik" blokk az admin Modul-használat fülön (MH6).
//   • soronként: felhasználó + forrás, TOP 5 modul (öt fix szélességű, sorszámozott „pirula": rövid név + futtatás,
//     alul arány-sáv az első helyezetthez), futtatás / megnyitás, kipróbált modulok, utolsó aktivitás, állapot, „⋯"
//   • kevesebb mint 5 modulnál halvány „—" — a sor sosem ugrik; kereső, állapot-szűrő, rendezés; fix magasság, belül görget
//   • sorra kattintva: részletes felhasználói ablak (6 KPI, összegzés, MINDEN modul 30 napos görbével, idővonal max. 50)
"use client";

import { useEffect, useMemo, useState } from "react";
import SelectField from "@/components/SelectField";
import { OfficeDialog } from "@/components/office/OfficeUi";
import { ActionMenu, MI, MenuDots, useActionMenu, type MenuItem } from "@/components/ui/ActionMenu";

export type UsageUser = {
  id: string; name: string; email: string; role: string; source: string; offices: string[];
  top5: { href: string; label: string; runs: number }[];
  runs: number; views: number; tried: number; lastActive: number | null; status: "active" | "sleeping" | "never";
};

type UserDetail = {
  user: { id: string; email: string; name: string; role: string; source: string; createdAt: string | null; offices: { id: string; name: string; kind: "office" | "team" }[] };
  kpi: { runs: number; views: number; conversionPct: number | null; tried: number; modules: number; lastActive: string | null };
  summary: string;
  modules: { href: string; label: string; runs: number; views: number; lastUsed: string | null; favorite: boolean; spark: number[] }[];
  timeline: { kind: "run" | "view"; at: string; module: string; title: string | null }[];
};

/** Rövid modulnevek a pirulákba (a teljes név a tooltipben). */
const SHORT: Record<string, string> = {
  "/dashboard/real-estate/valuation": "Becslés", "/dashboard/flyer": "Hird.kép", "/dashboard/real-estate/image-enhance": "Képjavító",
  "/dashboard/real-estate/video": "Videó", "/dashboard/real-estate/ad-check": "Szöveg-ell.", "/dashboard/real-estate/visualization": "Látványterv",
  "/dashboard/real-estate/fb-ads": "Hird.szöveg", "/dashboard/real-estate/land": "Telek", "/dashboard/real-estate/professionals": "Szakember",
  "/dashboard/hospitality/menu": "Menü", "/dashboard/hospitality/costing": "Önköltség", "/dashboard/hospitality/suppliers": "Beszállító",
  "/dashboard/hospitality/ingredients": "Alapanyag", "/dashboard/hospitality/inventory": "Kínálat", "/dashboard/hospitality/pricing": "Árazás",
  "/dashboard/hospitality/professionals": "Szakember",
};

type Status = "all" | "active" | "sleeping" | "never";
type SortKey = "runs" | "lastActive" | "tried" | "views";
const STATUS_TEXT: Record<Exclude<Status, "all">, string> = { active: "Aktív", sleeping: "Alvó", never: "Még nem futtatott" };
// a felhasználó oszlop széles, a név SOHA nem vágódik le (szükség esetén két sorba törik)
const COLS = "lg:grid lg:grid-cols-[minmax(190px,1.4fr)_minmax(0,4.8fr)_76px_64px_72px_124px_34px] lg:items-center lg:gap-2.5";
const MUTED = "#6E655C";

export default function UserModuleTable({ users, moduleCount, query, loading, onOpenBalances }: {
  users: UsageUser[] | null; moduleCount: number; query: string; loading: boolean; onOpenBalances: () => void;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [sort, setSort] = useState<SortKey>("runs");
  const [open, setOpen] = useState<UsageUser | null>(null);
  const menu = useActionMenu();
  const [menuFor, setMenuFor] = useState<UsageUser | null>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (users ?? [])
      .filter((u) => status === "all" || u.status === status)
      .filter((u) => !needle || `${u.name} ${u.email}`.toLowerCase().includes(needle))
      .sort((a, b) => (sort === "lastActive" ? (b.lastActive ?? 0) - (a.lastActive ?? 0) : b[sort] - a[sort]) || b.runs - a.runs);
  }, [users, q, status, sort]);

  const menuItems: MenuItem[] = menuFor ? [
    { label: "Részletek", icon: MI.open, onClick: () => setOpen(menuFor) },
    { label: "Ugrás az Egyenlegek fülre", icon: MI.out, onClick: onOpenBalances, hint: "kredit adása, költés" },
  ] : [];

  return (
    <section className="overflow-hidden rounded-2xl" style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] pb-3 pt-4">
        <h2 className="font-display text-lg font-semibold">Felhasználók és kedvenc moduljaik</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="⌕ Keresés név / e-mail" aria-label="Keresés"
            className="h-9 w-[210px] rounded-lg px-3 text-[13px] outline-none" style={{ border: "1px solid var(--twx-line)", background: "#fff" }} />
          <div className="inline-flex rounded-full p-[3px]" style={{ background: "#F1EAE1" }}>
            {(["all", "active", "sleeping", "never"] as Status[]).map((s) => (
              <button key={s} type="button" onClick={() => setStatus(s)} aria-pressed={status === s}
                className="h-7 rounded-full px-3 text-xs font-semibold"
                style={status === s ? { background: "#12100e", color: "#fff" } : { color: "#4A433C" }}>
                {s === "all" ? "Mind" : STATUS_TEXT[s]}
              </button>
            ))}
          </div>
          <SelectField size="sm" className="w-[200px]" ariaLabel="Rendezés" value={sort} onChange={(v) => setSort(v as SortKey)}
            options={[{ value: "runs", label: "Rendezés: futtatás" }, { value: "lastActive", label: "Rendezés: utolsó aktivitás" },
              { value: "tried", label: "Rendezés: kipróbált modul" }, { value: "views", label: "Rendezés: megnyitás" }]} />
        </div>
      </div>

      <div className="h-[456px] overflow-y-auto overscroll-contain">
        {/* a fejléc a görgető dobozon BELÜL, rögzítve — a görgetősáv így a fejlécet is szűkíti, az oszlopok egy vonalban maradnak */}
        <div className={`sticky top-0 z-10 hidden px-[18px] py-2 text-[10.5px] font-bold uppercase tracking-[0.06em] ${COLS}`} style={{ background: "#1B1815", color: "#BFB4A8" }}>
          <span>Felhasználó</span><span>TOP 5 modul (futtatás szerint)</span><span>Fut. / megn.</span><span>Kipróbált</span><span>Utolsó</span><span>Állapot</span><span />
        </div>
        {!users && <p className="p-5 text-sm" style={{ color: MUTED }}>{loading ? "Betöltés…" : "Nincs adat."}</p>}
        {users && shown.length === 0 && <p className="p-5 text-sm" style={{ color: MUTED }}>Nincs a szűrésnek megfelelő felhasználó.</p>}
        {shown.map((u) => {
          const max = u.top5[0]?.runs || 1;
          return (
            <div key={u.id} role="button" tabIndex={0} onClick={() => setOpen(u)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(u); }}
              onContextMenu={(e) => { setMenuFor(u); menu.openAtEvent(e); }}
              className={`flex cursor-pointer flex-col gap-2 px-[18px] py-3 text-[13px] transition-colors hover:bg-[#FBF6F0] lg:h-[60px] lg:py-0 ${COLS}`}
              style={{ borderTop: "1px solid #EFE7DD" }}>
              <span className="flex min-w-0 items-center gap-2">
                <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[10px] font-extrabold" style={{ background: "#FBE1D6", color: "#A8411F" }}>
                  {initials(u.name || u.email)}
                </span>
                <span className="min-w-0" title={u.name ? `${u.name} · ${u.email}` : u.email}>
                  <b className="block break-words leading-tight">{u.name || u.email}{(u.role === "admin" || u.role === "sales") && <RoleTag role={u.role} />}</b>
                  <span className="block truncate text-[10.5px]" style={{ color: MUTED }}>{u.offices[0] ?? u.source}</span>
                </span>
              </span>

              <span className="grid grid-cols-5 gap-[5px]">
                {Array.from({ length: 5 }, (_, i) => {
                  const t = u.top5[i];
                  if (!t) return <span key={i} className="flex h-[34px] items-center justify-center rounded-[9px] text-[#C9B8A8]" style={{ border: "1px dashed #E1D6C9" }}>—</span>;
                  return (
                    <span key={t.href} title={`${i + 1}. hely — ${t.label}: ${t.runs} futtatás`} className="relative flex h-[34px] items-center gap-1 overflow-hidden rounded-[9px] px-2 text-[12px]"
                      style={i === 0 ? { background: "#FBE1D6", border: "1px solid #F1C7B5" } : { background: "#F8F3EC", border: "1px solid #EFE7DD" }}>
                      {/* a sorrend balról jobbra (az 1. kiemelt) — külön sorszám-korong nélkül, hogy a név kiférjen */}
                      <span className="min-w-0 flex-1 truncate font-semibold">{SHORT[t.href] ?? t.label}</span>
                      <span className="flex-none font-extrabold tabular-nums">{t.runs}</span>
                      <i className="absolute bottom-0 left-0 h-[3px]" style={{ width: `${Math.round((t.runs / max) * 100)}%`, background: "#E3683F" }} />
                    </span>
                  );
                })}
              </span>

              <span className="tabular-nums"><span className="lg:hidden" style={{ color: MUTED }}>Futtatás / megnyitás: </span>{u.runs} / {u.views}</span>
              <span className="tabular-nums"><span className="lg:hidden" style={{ color: MUTED }}>Kipróbált: </span>{u.tried} / {moduleCount}</span>
              <span style={{ color: MUTED }}>{u.lastActive ? fmtWhen(u.lastActive) : "—"}</span>
              <span><StatusChip s={u.status} /></span>
              <span className="hidden lg:block" onClick={(e) => e.stopPropagation()}>
                <MenuDots onClick={(e) => { setMenuFor(u); menu.openAtButton(e); }} label={`Műveletek: ${u.name || u.email}`} />
              </span>
            </div>
          );
        })}
      </div>

      {menu.open && <ActionMenu at={menu.at} items={menuItems} onClose={menu.close} />}

      {open && (
        <OfficeDialog title="Felhasználó részletei" onClose={() => setOpen(null)} xwide>
          <UserDetailBody userId={open.id} query={query} />
        </OfficeDialog>
      )}
    </section>
  );
}

function RoleTag({ role }: { role: string }) {
  const admin = role === "admin";
  return <span className="ml-1 rounded-full px-1.5 py-[1px] text-[9.5px] font-extrabold" style={admin ? { background: "#E8E1F5", color: "#4B3B7A" } : { background: "#FFF0D6", color: "#8A5A00" }}>{admin ? "ADMIN" : "SALES"}</span>;
}

function StatusChip({ s }: { s: UsageUser["status"] }) {
  const st = s === "active" ? { background: "#DDF0E4", color: "#1F5C38" } : { background: "#F1EAE1", color: "#6B6258" };
  return <span className="inline-flex h-[22px] items-center whitespace-nowrap rounded-full px-2 text-[10.5px] font-extrabold" style={st}>{STATUS_TEXT[s]}</span>;
}

function initials(n: string): string {
  return n.split(/[\s@._-]+/).filter(Boolean).map((x) => x[0]).slice(0, 2).join("").toUpperCase();
}

function fmtWhen(t: number | string): string {
  const d = new Date(t), now = new Date();
  const same = d.toDateString() === now.toDateString();
  return same ? `ma ${d.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" })}` : d.toLocaleDateString("hu-HU", { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Részletes felhasználói ablak (fix méret — a modul-tábla és az idővonal a saját dobozában görget)
// ---------------------------------------------------------------------------
function UserDetailBody({ userId, query }: { userId: string; query: string }) {
  const [d, setD] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/module-usage?${query}&user=${userId}`)
      .then((r) => r.json())
      .then((x) => { if (alive) { if (x.error) setError(x.error); else setD(x as UserDetail); } })
      .catch(() => alive && setError("Nem sikerült betölteni."));
    return () => { alive = false; };
  }, [userId, query]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;

  const u = d?.user;
  const kpis: [string, string][] = [
    ["Futtatás", d ? String(d.kpi.runs) : "…"], ["Megnyitás", d ? String(d.kpi.views) : "…"],
    ["Megnyitásból futtatás", d ? (d.kpi.conversionPct === null ? "—" : `${d.kpi.conversionPct}%`) : "…"],
    ["Kipróbált modul", d ? `${d.kpi.tried} / ${d.kpi.modules}` : "…"],
    ["Utolsó aktivitás", d?.kpi.lastActive ? fmtWhen(d.kpi.lastActive) : d ? "—" : "…"],
    ["Regisztrált", u?.createdAt ? new Date(u.createdAt).toLocaleDateString("hu-HU", { year: "numeric", month: "short", day: "numeric" }) : "…"],
  ];

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="font-display text-lg font-semibold">{u ? u.name || u.email : "…"}</p>
        <p className="text-xs" style={{ color: MUTED }}>
          {u ? [u.email, u.source, u.role === "user" ? "felhasználó" : u.role, ...u.offices.map((o) => `${o.name} (${o.kind === "team" ? "munkatér" : "iroda"})`)].join(" · ") : " "}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {kpis.map(([t, v]) => (
          <div key={t} className="rounded-xl px-3 py-2" style={{ background: "#F8F3EC" }}>
            <p className="truncate text-[10.5px]" style={{ color: MUTED }}>{t}</p>
            <b className="block truncate text-[15px] tabular-nums">{v}</b>
          </div>
        ))}
      </div>

      <p className="min-h-[44px] rounded-xl px-3 py-2.5 text-[13px] leading-relaxed" style={{ background: "#FFF8F3", border: "1px solid #F1D3BF" }}>
        <b>Összegzés:</b> {d ? d.summary || "—" : "…"}
      </p>

      <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
        <div className="min-w-0">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: MUTED }}>Minden modul</p>
          <div className="h-[300px] overflow-y-auto rounded-xl" style={{ background: "#fff", border: "1px solid #EFE7DD" }}>
            <div className="sticky top-0 z-10 grid h-[30px] grid-cols-[minmax(0,1.3fr)_44px_48px_96px_70px] items-center gap-2 px-2.5 text-[10px] font-bold uppercase tracking-[0.06em]"
              style={{ background: "#1B1815", color: "#BFB4A8" }}>
              <span>Modul</span><span className="text-right">Fut.</span><span className="text-right">Megn.</span><span>30 nap</span><span>Utolsó</span>
            </div>
            {(d?.modules ?? []).map((m) => {
              const used = m.runs > 0;
              return (
                <div key={m.href} className="grid h-[38px] grid-cols-[minmax(0,1.3fr)_44px_48px_96px_70px] items-center gap-2 px-2.5 text-[12.5px]"
                  style={{ borderBottom: "1px solid #F3EDE6", opacity: used || m.views ? 1 : 0.4 }}>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate">{m.label}</span>
                    {m.favorite && <b title="Kedvencnek jelölte" style={{ color: "#E3683F" }}>★</b>}
                    {!used && m.views > 0 && <span className="flex-none rounded-full px-1.5 text-[9px] font-extrabold" style={{ background: "#FFF0D6", color: "#8A5A00" }}>csak megnyitotta</span>}
                  </span>
                  <b className="text-right tabular-nums">{m.runs || "·"}</b>
                  <span className="text-right tabular-nums" style={{ color: MUTED }}>{m.views || "·"}</span>
                  <Spark values={m.spark} />
                  <span className="truncate text-[11.5px]" style={{ color: MUTED }}>{m.lastUsed ? fmtWhen(m.lastUsed) : "—"}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="min-w-0">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: MUTED }}>Idővonal (max. 50)</p>
          <div className="h-[300px] overflow-y-auto rounded-xl" style={{ background: "#fff", border: "1px solid #EFE7DD" }}>
            {d && d.timeline.length === 0 && <p className="p-3 text-sm" style={{ color: MUTED }}>Még nincs aktivitás.</p>}
            {(d?.timeline ?? []).map((t, i) => (
              <div key={`${t.at}-${i}`} className="flex items-center justify-between gap-2 px-2.5 py-2 text-xs" style={{ borderBottom: "1px solid #F3EDE6" }}>
                <span className="min-w-0 truncate">
                  <span className="mr-1.5 rounded-full px-1.5 py-[1px] text-[9.5px] font-extrabold"
                    style={t.kind === "run" ? { background: "#FBE1D6", color: "#A8411F" } : { background: "#F1EAE1", color: "#6B6258" }}>
                    {t.kind === "run" ? "FUTTATÁS" : "MEGNYITÁS"}
                  </span>
                  {t.module}{t.title ? ` · ${t.title}` : ""}
                </span>
                <span className="flex-none" style={{ color: MUTED }}>{fmtWhen(t.at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 30 napos mini-görbe (napi futtatás). */
function Spark({ values }: { values: number[] }) {
  const max = Math.max(...values, 0);
  if (!max) return <svg width="92" height="22" aria-hidden><line x1="0" y1="19" x2="92" y2="19" stroke="#EFE7DD" strokeWidth="1.5" /></svg>;
  const step = 92 / Math.max(values.length - 1, 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(19 - (v / max) * 16).toFixed(1)}`).join(" ");
  return (
    <svg width="92" height="22" viewBox="0 0 92 22" aria-label="30 napos futtatás-görbe">
      <polyline points={pts} fill="none" stroke="#E3683F" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
