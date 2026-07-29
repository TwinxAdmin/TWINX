// Kredit-napló: melyik admin kinek, mikor, mennyi kreditet adott (és miért).
// Összecsukható, hogy ne vigye el a helyet a felhasználó-táblázat elől.
"use client";

import { useState } from "react";

export type CreditGrant = {
  id: string;
  admin_email: string | null;
  user_email: string | null;
  amount: number;
  note: string | null;
  created_at: string;
};

function when(iso: string): string {
  return new Date(iso).toLocaleString("hu-HU", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export default function CreditGrantLog({ grants }: { grants: CreditGrant[] }) {
  const [open, setOpen] = useState(false);
  const total = grants.reduce((s, g) => s + g.amount, 0);

  return (
    <section className="twx-card p-4 sm:p-5">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left">
        <div>
          <p className="text-sm font-semibold">Kredit-napló</p>
          <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
            {grants.length
              ? `${grants.length} kézi jóváírás · összesen ${total} kredit`
              : "Még nem adtál kézzel kreditet."}
          </p>
        </div>
        <span className="text-sm" style={{ color: "var(--twx-coral)" }}>
          {open ? "Elrejtés ▲" : "Megnyitás ▼"}
        </span>
      </button>

      {open && grants.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--twx-line)" }}>
                {["Mikor", "Ki adta", "Kinek", "Mennyi", "Indoklás"].map((h, i) => (
                  <th key={h}
                    className={`pb-2 text-[11px] font-bold uppercase tracking-wide ${i === 3 ? "text-right" : "text-left"}`}
                    style={{ color: "var(--twx-ink-muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grants.map((g) => (
                <tr key={g.id} style={{ borderBottom: "1px solid var(--twx-line)" }}>
                  <td className="py-2 pr-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    {when(g.created_at)}
                  </td>
                  <td className="py-2 pr-3 text-xs">{g.admin_email ?? "—"}</td>
                  <td className="py-2 pr-3 text-xs font-medium">{g.user_email ?? "—"}</td>
                  <td className="py-2 text-right font-semibold" style={{ color: "var(--twx-coral)" }}>
                    +{g.amount}
                  </td>
                  <td className="py-2 pl-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                    {g.note ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
