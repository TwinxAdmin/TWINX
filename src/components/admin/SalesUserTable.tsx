// Sales → Felhasználók: az ügyfelek listája (elérhetőség + tevékenység, PÉNZÜGY NÉLKÜL).
// Kereshető, rendezhető; „Csak telefonszámmal" szűrő a hívólistához; a telefonszám kattintható (hívás),
// a „Részletek" a szűkített (sales) adatlapot nyitja (UserDetailDialog scope="sales").
"use client";

import { useMemo, useState } from "react";
import UserDetailDialog from "@/components/admin/UserDetailDialog";
import type { SalesUser } from "@/lib/sales-users";
import { SIGNUP_SOURCE_LABEL } from "@/lib/onboarding";

type SortKey = "name" | "created" | "lastSignIn" | "uses";

function dt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("hu-HU", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
const t = (iso: string | null) => (iso ? Date.parse(iso) : 0);
const telHref = (p: string) => `tel:${p.replace(/[^\d+]/g, "")}`;

export default function SalesUserTable({ users }: { users: SalesUser[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("created");
  const [onlyPhone, setOnlyPhone] = useState(false);
  const [detailsFor, setDetailsFor] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = users;
    if (onlyPhone) list = list.filter((u) => u.phone);
    if (q) {
      list = list.filter((u) =>
        [u.name, u.company, u.email, u.phone ?? "", u.signupSource ? SIGNUP_SOURCE_LABEL[u.signupSource] : ""]
          .some((v) => (v ?? "").toLowerCase().includes(q)));
    }
    const out = [...list];
    if (sort === "name") out.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, "hu", { sensitivity: "base" }));
    else if (sort === "created") out.sort((a, b) => t(b.createdAt) - t(a.createdAt));
    else if (sort === "lastSignIn") out.sort((a, b) => t(b.lastSignInAt) - t(a.lastSignInAt));
    else out.sort((a, b) => b.uses - a.uses);
    return out;
  }, [users, query, sort, onlyPhone]);

  const withPhone = users.filter((u) => u.phone).length;

  const Th = ({ k, label, right }: { k?: SortKey; label: string; right?: boolean }) => (
    <th className={`pb-2 text-[11px] font-bold uppercase tracking-wide ${right ? "text-right" : "text-left"}`} style={{ color: "var(--twx-ink-muted)" }}>
      {k ? (
        <button type="button" onClick={() => setSort(k)} className="transition hover:opacity-70"
          style={{ color: sort === k ? "var(--twx-coral)" : "inherit" }}>
          {label}{sort === k ? " ↓" : ""}
        </button>
      ) : label}
    </th>
  );

  const DetailsButton = ({ u }: { u: SalesUser }) => (
    <button type="button" onClick={(e) => { e.stopPropagation(); setDetailsFor(u.userId); }}
      className="h-8 whitespace-nowrap rounded-full bg-white px-3 text-xs font-semibold transition hover:shadow-sm"
      style={{ border: "1px solid var(--twx-line)", color: "var(--twx-ink)" }}>
      Részletek
    </button>
  );

  const Source = ({ u }: { u: SalesUser }) =>
    u.signupSource && SIGNUP_SOURCE_LABEL[u.signupSource] ? (
      <span className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
        <span aria-hidden>🎁</span> {SIGNUP_SOURCE_LABEL[u.signupSource]}
      </span>
    ) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Keresés név, cég, e-mail vagy telefon alapján…" className="twx-input w-full text-sm sm:max-w-sm" />
        <button type="button" onClick={() => setOnlyPhone((v) => !v)} aria-pressed={onlyPhone}
          className="h-9 rounded-full px-3 text-xs font-semibold"
          style={onlyPhone ? { background: "var(--twx-coral-soft)", border: "1px solid var(--twx-coral)", color: "#7a2e17" } : { background: "#fff", border: "1px solid var(--twx-line)" }}>
          {onlyPhone ? "✓ " : ""}Csak telefonszámmal ({withPhone})
        </button>
        <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          {rows.length} ügyfél{rows.length !== users.length ? ` (${users.length}-ből)` : ""}
        </p>
      </div>

      {/* Asztali nézet */}
      <div className="twx-card hidden overflow-x-auto p-4 sm:block">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--twx-line)" }}>
              <Th k="name" label="Név / cég / e-mail" />
              <Th label="Telefon" />
              <Th k="created" label="Regisztrált" />
              <Th k="lastSignIn" label="Utolsó belépés" />
              <Th label="Egyenleg" right />
              <Th k="uses" label="Generálás" right />
              <th className="pb-2" aria-label="Részletek" />
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.userId} className="align-top" style={{ borderBottom: "1px solid var(--twx-line)" }}>
                <td className="py-2.5 pr-3">
                  <p className="font-semibold">{u.name || "(nincs név megadva)"}</p>
                  {u.company && <p className="text-xs font-medium" style={{ color: "var(--twx-coral)" }}>{u.company}</p>}
                  <a href={`mailto:${u.email}`} className="text-xs hover:underline" style={{ color: "var(--twx-ink-muted)" }}>{u.email}</a>
                  <div><Source u={u} /></div>
                </td>
                <td className="whitespace-nowrap py-2.5 pr-3">
                  {u.phone
                    ? <a href={telHref(u.phone)} className="font-semibold hover:underline" style={{ color: "var(--twx-ink)" }}>{u.phone}</a>
                    : <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>nincs megadva</span>}
                </td>
                <td className="whitespace-nowrap py-2.5 pr-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{dt(u.createdAt)}</td>
                <td className="whitespace-nowrap py-2.5 pr-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{dt(u.lastSignInAt)}</td>
                <td className="py-2.5 text-right font-bold">{u.balance}</td>
                <td className="py-2.5 text-right font-medium" title={u.features.map((f) => `${f.label} ${f.count}`).join(" · ") || "nincs használat"}>{u.uses}</td>
                <td className="py-2 pl-3 text-right"><DetailsButton u={u} /></td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={7} className="py-6 text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>Nincs találat.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobil nézet: kártyák, nagy „Hívás" gombbal */}
      <div className="space-y-2 sm:hidden">
        {rows.map((u) => (
          <div key={u.userId} className="twx-card p-3">
            <p className="font-semibold">{u.name || "(nincs név megadva)"}</p>
            {u.company && <p className="text-xs font-medium" style={{ color: "var(--twx-coral)" }}>{u.company}</p>}
            <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{u.email}</p>
            <Source u={u} />
            <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
              <span style={{ color: "var(--twx-ink-muted)" }}>Regisztrált</span><span className="text-right">{dt(u.createdAt)}</span>
              <span style={{ color: "var(--twx-ink-muted)" }}>Utolsó belépés</span><span className="text-right">{dt(u.lastSignInAt)}</span>
              <span style={{ color: "var(--twx-ink-muted)" }}>Egyenleg</span><span className="text-right font-bold">{u.balance}</span>
              <span style={{ color: "var(--twx-ink-muted)" }}>Generálás</span><span className="text-right font-medium">{u.uses}</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              {u.phone ? (
                <a href={telHref(u.phone)} className="flex h-11 flex-1 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ background: "var(--twx-coral)" }}>
                  Hívás: {u.phone}
                </a>
              ) : (
                <span className="flex h-11 flex-1 items-center justify-center rounded-full text-xs" style={{ background: "#EFE7DD", color: "var(--twx-ink-muted)" }}>
                  Nincs telefonszám
                </span>
              )}
              <DetailsButton u={u} />
            </div>
          </div>
        ))}
        {!rows.length && <p className="py-6 text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>Nincs találat.</p>}
      </div>

      <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
        Csak az ügyfelek látszanak (az admin és a sales fiókok nem). Pénzügyi és számlázási adat itt nem jelenik meg.
      </p>

      {detailsFor && <UserDetailDialog scope="sales" userId={detailsFor} onClose={() => setDetailsFor(null)} />}
    </div>
  );
}
