// Admin → Felhasználók → „Részletek": egy felhasználó minden adata egy fix méretű ablakban (belül görgethető).
// Adat: GET /api/admin/users/:id (csak admin, csak olvas). Blokkok: Fiók, Számlázás, Kredit, Iroda, Arculatok, Használat.
"use client";

import { useEffect, useState } from "react";
import type { UserDetails } from "@/lib/admin-user-details";

const ROLE_LABEL: Record<string, string> = { user: "Felhasználó", sales: "Sales", admin: "Admin" };
const OFFICE_ROLE: Record<string, string> = { owner: "Vezető", member: "Kolléga" };
const REQ_STATUS: Record<string, string> = { pending: "Függőben", approved: "Jóváhagyva", rejected: "Elutasítva" };
const PROVIDER: Record<string, string> = { email: "E-mail + jelszó", google: "Google" };

function dt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("hu-HU", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
const huf = (n: number | null) => (n === null ? "—" : `${Math.round(n).toLocaleString("hu-HU")} Ft`);

/**
 * @param scope "admin": minden adat (/api/admin/users/:id); "sales": elérhetőség + tevékenység (/api/sales/users/:id) —
 *              a pénzügyi és számlázási blokkokat a szerver nem is küldi, itt el is rejtjük őket.
 */
export default function UserDetailDialog({ userId, onClose, scope = "admin" }: { userId: string; onClose: () => void; scope?: "admin" | "sales" }) {
  const [data, setData] = useState<UserDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(scope === "sales" ? `/api/sales/users/${userId}` : `/api/admin/users/${userId}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Nem sikerült betölteni.");
        if (!cancelled) setData(d as UserDetails);
      })
      .catch((e) => { if (!cancelled) setError((e as Error).message); });
    return () => { cancelled = true; };
  }, [userId, scope]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const a = data?.account;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6" style={{ background: "rgba(20,12,8,0.55)" }}
      onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Felhasználó adatai" onClick={(e) => e.stopPropagation()}
        className="flex h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-[22px]"
        style={{ background: "var(--twx-cream-card)", boxShadow: "0 30px 70px rgba(0,0,0,0.3)" }}>
        {/* Fejléc */}
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4 sm:px-6" style={{ borderColor: "var(--twx-line)" }}>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--twx-coral)" }}>Felhasználó adatai</p>
            <h2 className="mt-0.5 truncate font-display text-xl font-semibold">{a ? a.name || "(nincs név megadva)" : "Betöltés…"}</h2>
            {a && <p className="truncate text-sm" style={{ color: "var(--twx-ink-muted)" }}>{a.email}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Bezárás"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-lg" style={{ border: "1px solid var(--twx-line)" }}>
            ×
          </button>
        </div>

        {/* Tartalom — belül görget */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          {error ? (
            <p className="rounded-xl p-4 text-sm text-red-700" style={{ background: "#fdecea" }}>{error}</p>
          ) : !data ? (
            [0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl" style={{ background: "#EFE7DD" }} />)
          ) : (
            <>
              <Block title="Fiók">
                <Grid rows={[
                  ["Név", a!.name],
                  ["E-mail", a!.email ? <a key="e" href={`mailto:${a!.email}`} className="underline">{a!.email}</a> : null],
                  ["Telefon", a!.phone ? <a key="t" href={`tel:${a!.phone.replace(/\s/g, "")}`} className="underline">{a!.phone}</a> : null],
                  ["Cég", a!.company],
                  ["Szerepkör", a!.role ? (ROLE_LABEL[a!.role] ?? a!.role) : null],
                  ["Regisztrált", dt(a!.createdAt)],
                  ["Honnan jött", a!.signupSource ?? "Közvetlen regisztráció"],
                  ["Meghívókód", a!.inviteCode],
                  ["Belépési mód", a!.providers.length ? a!.providers.map((p) => PROVIDER[p] ?? p).join(", ") : null],
                  ["E-mail megerősítve", a!.emailConfirmedAt ? dt(a!.emailConfirmedAt) : "Még nem"],
                  ["Utolsó belépés", dt(a!.lastSignInAt)],
                  ["ÁSZF", a!.termsVersion ? `${a!.termsVersion} — elfogadva: ${dt(a!.termsAcceptedAt)}` : "Még nem fogadta el"],
                ]} />
              </Block>

              {data.scope === "admin" && <Block title="Számlázási adatok">
                {data.billing.length ? <Grid rows={data.billing.map((b) => [b.label, b.value])} /> : <Empty>Még nem adott meg számlázási adatot.</Empty>}
              </Block>}

              {data.scope === "sales" ? (
                <Block title="Kredit">
                  <Grid rows={[["Egyenleg", data.credits.balance !== null ? `${data.credits.balance} kredit` : null]]} />
                </Block>
              ) : <Block title="Kredit" aside={data.credits.balance !== null ? `Egyenleg: ${data.credits.balance} kredit` : undefined}>
                <Sub title={`Vásárlások (${data.credits.purchases.length})`}>
                  {data.credits.purchases.length ? (
                    <List items={data.credits.purchases.map((p) => [dt(p.at), `${p.credits ?? "—"} kredit`, huf(p.amountHuf), p.invoice ? `Számla: ${p.invoice}` : ""])} />
                  ) : <Empty>Nincs vásárlás.</Empty>}
                </Sub>
                <Sub title={`Kézi jóváírások (${data.credits.grants.length})`}>
                  {data.credits.grants.length ? (
                    <List items={data.credits.grants.map((g) => [dt(g.at), `+${g.amount ?? "—"} kredit`, g.note ?? "", g.by ? `— ${g.by}` : ""])} />
                  ) : <Empty>Nincs kézi jóváírás.</Empty>}
                </Sub>
                <Sub title={`Kredit-kérések (${data.credits.requests.length})`}>
                  {data.credits.requests.length ? (
                    <List items={data.credits.requests.map((r) => [dt(r.at), `${r.amount ?? "—"} kredit`, r.status ? (REQ_STATUS[r.status] ?? r.status) : "", r.granted ? `jóváírva: ${r.granted}` : ""])} />
                  ) : <Empty>Nem kért kreditet.</Empty>}
                </Sub>
              </Block>}

              <Block title="Iroda">
                {data.offices.length ? (
                  <List items={data.offices.map((o) => [o.name, o.role ? (OFFICE_ROLE[o.role] ?? o.role) : "", o.role === "owner" ? "" : o.unlimited ? "korlátlan keret" : o.allowance !== null ? `keret: ${o.allowance}` : "", `csatlakozott: ${dt(o.joinedAt)}`])} />
                ) : <Empty>Nem tagja irodának.</Empty>}
              </Block>

              <Block title={`Arculatok (${data.brandings.length})`}>
                {data.brandings.length ? (
                  <div className="space-y-2">
                    {data.brandings.map((b, i) => (
                      <div key={i} className="rounded-xl bg-white p-3 text-sm" style={{ border: "1px solid var(--twx-line)" }}>
                        <p className="font-semibold">{b.label || b.name || "(névtelen arculat)"}</p>
                        <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                          {[b.name, b.title, b.company, b.phone, b.email, b.website].filter(Boolean).join(" · ") || "nincs kitöltött adat"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : <Empty>Nincs mentett arculata.</Empty>}
              </Block>

              <Block title="Használat" aside={`${data.usage.total} generálás · utolsó: ${dt(data.usage.lastAt)}`}>
                {data.usage.features.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {data.usage.features.map((f) => (
                      <span key={f.label} className="rounded-full bg-white px-2.5 py-1 text-xs" style={{ border: "1px solid var(--twx-line)" }}>
                        {f.label} <strong>{f.count}</strong>
                      </span>
                    ))}
                  </div>
                ) : <Empty>Még nem használt modult.</Empty>}
              </Block>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Block({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-4" style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {aside && <span className="text-xs font-medium" style={{ color: "var(--twx-ink-muted)" }}>{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 first:mt-0">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--twx-ink-muted)" }}>{title}</p>
      {children}
    </div>
  );
}

function Grid({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[140px_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-xs font-medium sm:pt-0.5" style={{ color: "var(--twx-ink-muted)" }}>{k}</dt>
          <dd className="min-w-0 break-words">{v ?? <span style={{ color: "var(--twx-ink-muted)" }}>—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Egyszerű sorlista (pl. vásárlások) — a cellák „ · "-tal elválasztva, az üresek kimaradnak. */
function List({ items }: { items: string[][] }) {
  return (
    <ul className="space-y-1 text-sm">
      {items.map((cells, i) => (
        <li key={i} className="rounded-lg px-2.5 py-1.5" style={{ background: "var(--twx-cream)" }}>
          {cells.filter(Boolean).join(" · ")}
        </li>
      ))}
    </ul>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>{children}</p>;
}
