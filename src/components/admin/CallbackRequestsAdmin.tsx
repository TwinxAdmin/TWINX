// Admin → Foglalások → „Visszahívás-kérések" (D73, Márk kérése 2026-11-27): a kapcsolat-blokk naptáras ablakából érkezett
// kérések (leads tábla, az üzenet „[Visszahívás-kérés" / régebben „[Időpont-kérés" kezdetű). Soronként: beérkezés ideje,
// név, e-mail, telefon, cég, a három (régebben kettő) alkalmas nap napszakkal, megjegyzés, és az állapot
// („Új" ↔ „Visszahívva") — a meglévő POST /api/admin/leads végponttal (handled_at). Fix magasságú sorok, belül görget.
"use client";

import { useState } from "react";
import { showToast } from "@/components/Toast";

export type CallbackLead = {
  id: string; created_at: string; name: string; email: string; phone: string | null; company: string | null;
  message: string | null; callback_time: string | null; handled_at: string | null; handled_email: string | null;
};

/** A napok és a megjegyzés kiolvasása az üzenetből (a callback_time hiányában is működik). */
function parse(l: CallbackLead) {
  const lines = (l.message ?? "").split("\n");
  const days = lines.filter((x) => /^\d\.\s/.test(x)).map((x) => x.replace(/^\d\.\s/, "").replace(/\s\(\d{4}-\d{2}-\d{2}\)/, ""));
  const ni = lines.findIndex((x) => x.trim() === "Megjegyzés:");
  const note = ni >= 0 ? lines.slice(ni + 1).join("\n").trim() : "";
  return { days, note };
}

const fmt = (iso: string) => new Date(iso).toLocaleString("hu-HU", { timeZone: "Europe/Budapest", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default function CallbackRequestsAdmin({ initial }: { initial: CallbackLead[] }) {
  const [rows, setRows] = useState(initial);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [busy, setBusy] = useState<string | null>(null);
  const list = filter === "open" ? rows.filter((r) => !r.handled_at) : rows;
  const open = rows.filter((r) => !r.handled_at).length;

  const toggle = async (r: CallbackLead) => {
    setBusy(r.id);
    const handled = !r.handled_at;
    try {
      const res = await fetch("/api/admin/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, handled }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(d.error ?? "Nem sikerült.", "error"); return; }
      setRows((cur) => cur.map((x) => (x.id === r.id ? { ...x, handled_at: handled ? new Date().toISOString() : null, handled_email: handled ? d.email ?? null : null } : x)));
      showToast(handled ? "Visszahívottnak jelölve." : "Újra nyitva.", "success");
    } finally { setBusy(null); }
  };

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          <b style={{ color: "var(--twx-ink)" }}>{open}</b> visszahívásra vár · összesen {rows.length} kérés
        </p>
        <div className="flex gap-1 rounded-full p-1" style={{ boxShadow: "inset 0 0 0 1px var(--twx-line)" }}>
          {([["open", "Visszahívásra vár"], ["all", "Összes"]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setFilter(k)} className="h-8 w-[150px] rounded-full text-sm"
              style={filter === k ? { background: "var(--twx-ink)", color: "var(--twx-cream)", fontWeight: 600 } : { color: "var(--twx-ink-muted)" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
        {list.length === 0 ? (
          <p className="rounded-2xl px-5 py-10 text-center text-sm" style={{ color: "var(--twx-ink-muted)", boxShadow: "inset 0 0 0 1px var(--twx-line)" }}>
            {rows.length === 0 ? "Még nem érkezett visszahívás-kérés. Ha valaki a kapcsolat-blokkban időpontot kér, itt jelenik meg." : "Nincs visszahívásra váró kérés."}
          </p>
        ) : list.map((r) => {
          const { days, note } = parse(r);
          return (
            <div key={r.id} className="grid gap-4 rounded-2xl bg-white p-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_auto]"
              style={{ boxShadow: "0 0 0 1px var(--twx-line)", opacity: r.handled_at ? 0.72 : 1 }}>
              <div className="min-w-0">
                <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>Beérkezett: {fmt(r.created_at)}</p>
                <p className="mt-1 truncate text-[16px] font-semibold">{r.name}{r.company ? <span className="font-normal" style={{ color: "var(--twx-ink-muted)" }}> · {r.company}</span> : null}</p>
                <p className="mt-1 truncate text-sm"><a className="underline" href={`mailto:${r.email}`}>{r.email}</a></p>
                {r.phone && <p className="truncate text-sm"><a className="font-semibold" href={`tel:${r.phone.replace(/\s/g, "")}`}>{r.phone}</a></p>}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[1px]" style={{ color: "var(--twx-ink-muted)" }}>Hívható napok</p>
                <ul className="mt-1 space-y-0.5 text-sm">
                  {days.length ? days.map((d) => <li key={d} className="truncate capitalize">{d}</li>) : <li>{r.callback_time ?? "—"}</li>}
                </ul>
                {note && <p className="mt-2 line-clamp-3 text-sm" style={{ color: "var(--twx-ink-muted)" }} title={note}>„{note}”</p>}
              </div>
              <div className="flex flex-col items-start gap-2 md:items-end">
                <span className="rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={r.handled_at ? { background: "#e3f1e6", color: "#2f6b3d" } : { background: "#fde4d9", color: "#a8411f" }}>
                  {r.handled_at ? "Visszahívva" : "Új"}
                </span>
                <button type="button" disabled={busy === r.id} onClick={() => toggle(r)}
                  className="h-9 w-[170px] rounded-full text-sm font-semibold disabled:opacity-50"
                  style={r.handled_at ? { boxShadow: "inset 0 0 0 1px var(--twx-line)" } : { background: "var(--twx-coral)", color: "#1c1005" }}>
                  {r.handled_at ? "Újranyitás" : "Visszahívtam ✓"}
                </button>
                {r.handled_at && <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{fmt(r.handled_at)}{r.handled_email ? ` · ${r.handled_email}` : ""}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
