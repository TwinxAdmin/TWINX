// Admin felhasználó-táblázat: minden felhasználó egy nézetben, több oszlopban.
// Kereshető (név / cég / e-mail), rendezhető oszlopfejlécekkel, sorra kattintva
// kinyílik a funkciónkénti bontás. Mobilon kártyás elrendezés.
// A Kredit oszlopban egy „+" gombbal HELYBEN lehet kreditet adni bárkinek —
// nem kell átmenni külön kredit-oldalra és ott újra kikeresni a partnert.
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/components/Toast";
import type { UserMetric } from "@/lib/metrics";

type SortKey = "name" | "uses" | "cost" | "revenue";

const ROLE_LABEL: Record<string, string> = { user: "Felhasználó", sales: "Sales", admin: "Admin" };

function huf(n: number): string {
  return `${Math.round(n).toLocaleString("hu-HU")} Ft`;
}

export default function UserTable({
  users, hufPerUsd,
}: { users: UserMetric[]; hufPerUsd: number }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [openId, setOpenId] = useState<string | null>(null);

  // Kredit-adás helyben: melyik sor nyílt ki, mennyi, és fut-e épp.
  const [grantFor, setGrantFor] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [granting, setGranting] = useState(false);

  async function grant(email: string) {
    const amt = parseInt(amount, 10);
    if (!Number.isInteger(amt) || amt <= 0) {
      showToast("Adj meg egy pozitív kredit számot.", "error");
      return;
    }
    setGranting(true);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, amount: amt }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Hiba a jóváírás során.");
      showToast(`${amt} kredit jóváírva: ${email}`, "success");
      setGrantFor(null);
      setAmount("");
      router.refresh(); // hogy a friss egyenleg is látszódjon
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setGranting(false);
    }
  }

  /** A kredit-adó mező — a táblázatban és a mobil kártyán is ez fut. */
  const GrantBox = ({ email }: { email: string }) => (
    <div className="mt-1 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <input type="number" min={1} value={amount} autoFocus
        onChange={(e) => setAmount(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") void grant(email); }}
        placeholder="db" className="twx-input w-20 py-1 text-right text-xs" />
      <button type="button" onClick={() => void grant(email)} disabled={granting}
        className="rounded-lg px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40"
        style={{ background: "var(--twx-coral)" }}>
        {granting ? "…" : "Jóváír"}
      </button>
      <button type="button" onClick={() => { setGrantFor(null); setAmount(""); }}
        className="rounded-lg px-2 py-1 text-xs" style={{ border: "1px solid var(--twx-line)" }}>
        ✕
      </button>
    </div>
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? users.filter((u) => [u.name, u.company, u.email].some((v) => (v ?? "").toLowerCase().includes(q)))
      : users;
    const sorted = [...filtered];
    if (sort === "name") {
      sorted.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, "hu", { sensitivity: "base" }));
    } else if (sort === "uses") {
      sorted.sort((a, b) => b.uses - a.uses);
    } else if (sort === "cost") {
      sorted.sort((a, b) => b.costUsd - a.costUsd);
    } else {
      sorted.sort((a, b) => b.revenueHuf - a.revenueHuf);
    }
    return sorted;
  }, [users, query, sort]);

  const totals = useMemo(
    () => ({
      uses: rows.reduce((s, u) => s + u.uses, 0),
      cost: rows.reduce((s, u) => s + u.costUsd, 0) * hufPerUsd,
      revenue: rows.reduce((s, u) => s + u.revenueHuf, 0),
      credits: rows.reduce((s, u) => s + u.creditsBought, 0),
    }),
    [rows, hufPerUsd]
  );

  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th className={`pb-2 text-[11px] font-bold uppercase tracking-wide ${right ? "text-right" : "text-left"}`}
      style={{ color: "var(--twx-ink-muted)" }}>
      <button type="button" onClick={() => setSort(k)}
        className="transition hover:opacity-70"
        style={{ color: sort === k ? "var(--twx-coral)" : "inherit" }}>
        {label}{sort === k ? " ↓" : ""}
      </button>
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Keresés név, cég vagy e-mail alapján…"
          className="twx-input w-full text-sm sm:max-w-sm"
        />
        <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          {rows.length} felhasználó{query ? ` (${users.length}-ből)` : ""}
        </p>
      </div>

      {/* Asztali nézet: táblázat */}
      <div className="twx-card hidden overflow-x-auto p-4 sm:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--twx-line)" }}>
              <Th k="name" label="Név / cég / e-mail" />
              <th className="pb-2 text-left text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--twx-ink-muted)" }}>
                Szerep
              </th>
              <Th k="uses" label="Generálás" right />
              <Th k="cost" label="Költség" right />
              <Th k="revenue" label="Bevétel" right />
              <th className="pb-2 text-right text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--twx-ink-muted)" }}>
                Kredit
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.userId} onClick={() => setOpenId(openId === u.userId ? null : u.userId)}
                className="cursor-pointer align-top transition hover:bg-black/[0.02]"
                style={{ borderBottom: "1px solid var(--twx-line)" }}>
                <td className="py-2.5 pr-3">
                  <p className="font-semibold">{u.name || "(nincs név megadva)"}</p>
                  {u.company && (
                    <p className="text-xs font-medium" style={{ color: "var(--twx-coral)" }}>{u.company}</p>
                  )}
                  <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{u.email}</p>
                  {openId === u.userId && (
                    <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                      {u.features.length
                        ? u.features.map((f) => `${f.label} ${f.count}`).join(" · ")
                        : "nincs használat"}
                    </p>
                  )}
                </td>
                <td className="py-2.5 pr-3">
                  {u.role !== "user" ? (
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
                      style={{ background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>—</span>
                  )}
                </td>
                <td className="py-2.5 text-right font-medium">{u.uses}</td>
                <td className="py-2.5 text-right">{huf(u.costUsd * hufPerUsd)}</td>
                <td className="py-2.5 text-right">{huf(u.revenueHuf)}</td>
                <td className="py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <span>{u.creditsBought}</span>
                    <button type="button" title={`Kredit adása: ${u.email}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setGrantFor(grantFor === u.userId ? null : u.userId);
                        setAmount("");
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold text-white transition hover:opacity-85"
                      style={{ background: "var(--twx-coral)" }}>
                      +
                    </button>
                  </div>
                  {grantFor === u.userId && <GrantBox email={u.email} />}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={6} className="py-6 text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                Nincs találat.
              </td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td className="pt-3 text-xs font-semibold" colSpan={2}>Összesen</td>
                <td className="pt-3 text-right text-xs font-semibold">{totals.uses}</td>
                <td className="pt-3 text-right text-xs font-semibold">{huf(totals.cost)}</td>
                <td className="pt-3 text-right text-xs font-semibold">{huf(totals.revenue)}</td>
                <td className="pt-3 text-right text-xs font-semibold">{totals.credits}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Mobil nézet: kártyák */}
      <div className="space-y-2 sm:hidden">
        {rows.map((u) => (
          <div key={u.userId} className="twx-card p-3" onClick={() => setOpenId(openId === u.userId ? null : u.userId)}>
            <p className="font-semibold">{u.name || "(nincs név megadva)"}</p>
            {u.company && <p className="text-xs font-medium" style={{ color: "var(--twx-coral)" }}>{u.company}</p>}
            <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{u.email}</p>
            <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
              <span style={{ color: "var(--twx-ink-muted)" }}>Generálás</span><span className="text-right font-medium">{u.uses}</span>
              <span style={{ color: "var(--twx-ink-muted)" }}>Költség</span><span className="text-right">{huf(u.costUsd * hufPerUsd)}</span>
              <span style={{ color: "var(--twx-ink-muted)" }}>Bevétel</span><span className="text-right">{huf(u.revenueHuf)}</span>
              <span style={{ color: "var(--twx-ink-muted)" }}>Kredit</span>
              <span className="flex items-center justify-end gap-1.5">
                {u.creditsBought}
                <button type="button" title="Kredit adása"
                  onClick={(e) => {
                    e.stopPropagation();
                    setGrantFor(grantFor === u.userId ? null : u.userId);
                    setAmount("");
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: "var(--twx-coral)" }}>
                  +
                </button>
              </span>
            </div>
            {grantFor === u.userId && <GrantBox email={u.email} />}
            {openId === u.userId && (
              <p className="mt-2 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                {u.features.length ? u.features.map((f) => `${f.label} ${f.count}`).join(" · ") : "nincs használat"}
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
        Egy sorra kattintva megjelenik a funkciónkénti bontás. Az oszlopfejlécek kattintással rendezik a listát.
      </p>
    </div>
  );
}
