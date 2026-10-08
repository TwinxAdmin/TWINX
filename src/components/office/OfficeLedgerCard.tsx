// OfficeLedgerCard — kredit-mozgások kártya.
//   scope "office": az iroda feltöltései, kiosztásai, visszavételei (létrehozó / vezető)
//   scope "me":     a saját keretem változásai (kapott keret, költések) — kolléga
// Fix magasságú kártya: az utolsó 50 tétel a kártyán belül görget (nem tolja el a többi blokkot).
"use client";

import { useEffect, useState } from "react";
import type { LedgerRow } from "@/lib/office-overview";
import { fmtWhen } from "@/lib/office-format";
import { EmptyState, Icons, OfficeCard } from "@/components/office/OfficeUi";

type Props = { scope: "office" | "me"; title?: string; reloadKey?: number; height?: number };

export default function OfficeLedgerCard({ scope, title, reloadKey = 0, height = 340 }: Props) {
  const [items, setItems] = useState<LedgerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/office/ledger?scope=${scope}&limit=50`)
      .then((r) => r.json())
      .then((d) => { if (alive) { if (d.error) setError(d.error); else setItems(d.items ?? []); } })
      .catch(() => alive && setError("Nem sikerült betölteni."));
    return () => { alive = false; };
  }, [scope, reloadKey]);

  return (
    <OfficeCard title={title ?? (scope === "office" ? "Kredit-mozgások" : "Keretem változásai")} height={height}
      badge={items && items.length > 0 ? <span className="text-xs" style={{ color: "#6B6258" }}>utolsó {items.length}</span> : undefined}>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!items && !error && <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>}
      {items && items.length === 0 && (
        <EmptyState icon={Icons.coins} title="Még nincs kredit-mozgás"
          text={scope === "office"
            ? "Itt látod majd az irodai egyenleg feltöltéseit, és hogy ki, kinek, mennyi keretet adott vagy vett vissza — megjegyzéssel együtt."
            : "Itt látod majd, ki mennyi keretet adott neked, és melyik munkád mennyi kreditbe került."} />
      )}

      {items && items.length > 0 && (
        <ul className="text-[13px]">
          {items.map((it, i) => {
            const { text, sub } = describe(it, scope);
            return (
              <li key={it.id} className="grid grid-cols-[52px_minmax(0,1fr)] gap-2.5 py-2"
                style={{ borderBottom: i < items.length - 1 ? "1px solid #EFE7DD" : "none" }}>
                <strong className="tabular-nums" style={{ color: it.amount >= 0 ? "#1F5C38" : "#B3261E" }}>
                  {it.amount > 0 ? `+${it.amount}` : `−${Math.abs(it.amount)}`}
                </strong>
                <div className="min-w-0">
                  <div className="truncate">{text}</div>
                  <div className="truncate text-xs" style={{ color: "#6B6258" }}>{sub}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </OfficeCard>
  );
}

/** Egy naplósor emberi szövege. */
function describe(it: LedgerRow, scope: "office" | "me"): { text: string; sub: string } {
  const when = fmtWhen(it.createdAt);
  const note = it.note && it.note !== "visszatérítve" ? ` · „${it.note}”` : "";
  const by = it.actorName ?? "Rendszer";

  if (it.kind === "purchase") return { text: "Irodai egyenleg feltöltése", sub: `${by} · ${when}${note}` };
  if (it.kind === "spend") {
    return { text: it.service ?? "Munka", sub: `${when}${it.note === "visszatérítve" ? " · visszatérítve" : ""}` };
  }
  if (it.kind === "adjust") return { text: it.note || "Korrekció", sub: when };

  // allocate
  if (scope === "me") {
    return it.amount >= 0
      ? { text: `${by} adta`, sub: `${when}${note}` }
      : { text: it.actorName ? `${by} visszavette` : "Visszakerült az irodához", sub: `${when}${note}` };
  }
  const who = it.memberName ?? "Kolléga";
  return it.amount >= 0
    ? { text: `${who} kerete`, sub: `${by} · ${when}${note}` }
    : { text: `${who} → vissza az irodába`, sub: `${by} · ${when}${note}` };
}
