// OfficeUsage — kredithasználat-kimutatás (létrehozó / kiosztó): ki, melyik modulban, mennyit.
// Csak számokat mutat — a munkák tartalmát nem (azok csak közös mappán át láthatók).
"use client";

import { useEffect, useState } from "react";
import { SERVICE_LABELS } from "@/lib/office";

type Row = { userId: string; name: string; total: number; services: Record<string, number> };

function monthKey(offset: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function OfficeUsage() {
  const [month, setMonth] = useState(monthKey(0));
  const [data, setData] = useState<{ total: number; items: Row[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    fetch(`/api/office/usage?month=${month}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch(() => setError("Nem sikerült betölteni."));
  }, [month]);

  const months = [0, -1, -2].map(monthKey);
  const label = (k: string) => new Date(`${k}-01T00:00:00`).toLocaleDateString("hu-HU", { year: "numeric", month: "long" });

  return (
    <div className="space-y-3 rounded-2xl p-5" style={{ border: "1px solid var(--twx-line)" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-semibold">Kredithasználat</h3>
        <select className="twx-input w-auto" value={month} onChange={(e) => setMonth(e.target.value)}>
          {months.map((k) => <option key={k} value={k}>{label(k)}</option>)}
        </select>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {!data && !error && <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>Betöltés…</p>}

      {data && (
        <>
          <p className="text-sm">Összesen: <strong>{data.total} kredit</strong> az irodai egyenlegből.</p>
          <ul className="space-y-2">
            {data.items.map((r) => (
              <li key={r.userId} className="rounded-xl p-3" style={{ background: "var(--twx-cream)" }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{r.name}</span>
                  <span className="font-display text-lg font-semibold">{r.total} kredit</span>
                </div>
                {r.total > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {Object.entries(r.services).sort((a, b) => b[1] - a[1]).map(([svc, n]) => (
                      <span key={svc} className="rounded-full px-2 py-0.5 text-[11px]" style={{ background: "#fff", border: "1px solid var(--twx-line)" }}>
                        {SERVICE_LABELS[svc] ?? "Egyéb"}: {n}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
