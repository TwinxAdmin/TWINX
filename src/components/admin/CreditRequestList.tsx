// Admin — kredit-kérések ügyintézése.
//
// Két munkafolyamat egy listában:
//   • Sales keret (billing_kind='free') — egy kattintás: Jóváhagyás → kredit.
//   • Számlázandó megrendelés (billing_kind='invoice') — kétlépcsős:
//       1) "Számla kiállítva" (+ számlaszám) → a kredit MÉG NEM jár,
//       2) "Befizetve" → EKKOR íródik jóvá a kredit.
//
// A számlázási adatok másolható blokkban vannak, hogy a számlázó programba
// egy mozdulattal átvihetők legyenek.
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/components/Toast";
import { billingCopyBlock, billingPayerName, formatHuf, type BillingInfo } from "@/lib/billing";

export type CreditRequestRow = {
  id: string;
  user_email: string | null;
  amount: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  decided_by_email: string | null;
  decided_at: string | null;
  decision_note: string | null;
  granted_amount: number | null;
  created_at: string;
  package_id: string | null;
  net_huf: number | null;
  billing_kind: "free" | "invoice" | null;
  invoice_status: "none" | "to_issue" | "issued" | "paid" | null;
  invoice_number: string | null;
  invoice_issued_at: string | null;
  paid_at: string | null;
  billing_snapshot: BillingInfo | null;
};

const STATUS: Record<CreditRequestRow["status"], { label: string; color: string; bg: string }> = {
  pending: { label: "Elbírálásra vár", color: "#7a5a12", bg: "#fff8ec" },
  approved: { label: "Jóváhagyva", color: "#2e7d52", bg: "#f2f9f5" },
  rejected: { label: "Elutasítva", color: "#c0392b", bg: "#fdecea" },
};

type TabId = "invoice" | "awaiting" | "free" | "closed";

const TABS: { id: TabId; label: string }[] = [
  { id: "invoice", label: "Számlázandó" },
  { id: "awaiting", label: "Fizetésre vár" },
  { id: "free", label: "Sales keret" },
  { id: "closed", label: "Lezárt" },
];

function csvEscape(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

export default function CreditRequestList({ items }: { items: CreditRequestRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [invoiceNos, setInvoiceNos] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<TabId>("invoice");

  const groups = useMemo(() => {
    const pending = items.filter((i) => i.status === "pending");
    return {
      // Régi (migráció előtti) kérésnél a billing_kind hiányozhat — azt sales-ként kezeljük.
      invoice: pending.filter((i) => i.billing_kind === "invoice" && i.invoice_status === "to_issue"),
      awaiting: pending.filter((i) => i.billing_kind === "invoice" && i.invoice_status === "issued"),
      free: pending.filter((i) => i.billing_kind !== "invoice"),
      closed: items.filter((i) => i.status !== "pending"),
    } as Record<TabId, CreditRequestRow[]>;
  }, [items]);

  async function act(id: string, action: "approve" | "reject" | "issue") {
    setBusy(id);
    try {
      const amt = parseInt(amounts[id] ?? "", 10);
      const res = await fetch("/api/admin/credit-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id, action,
          amount: Number.isInteger(amt) && amt > 0 ? amt : undefined,
          note: notes[id]?.trim() || undefined,
          invoiceNumber: invoiceNos[id]?.trim() || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "A művelet nem sikerült.");
      showToast(
        action === "approve" ? `Jóváírva: ${d.granted} kredit`
          : action === "issue" ? "Számla kiállítva — a partner értesül a felületén."
            : "A kérés elutasítva.",
        action === "reject" ? "info" : "success"
      );
      router.refresh();
    } catch (e) {
      showToast((e as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function copyBilling(r: CreditRequestRow) {
    const text = billingCopyBlock(r.billing_snapshot);
    if (!text) { showToast("Ehhez a kéréshez nincs számlázási adat.", "error"); return; }
    try {
      await navigator.clipboard.writeText(text);
      showToast("Számlázási adatok a vágólapon.", "success");
    } catch {
      showToast("A másolás nem sikerült — jelöld ki kézzel.", "error");
    }
  }

  // CSV a könyvelésnek: a számlázandó és a fizetésre váró tételek.
  function exportCsv() {
    const rows = [...groups.invoice, ...groups.awaiting];
    if (!rows.length) { showToast("Nincs exportálható tétel.", "info"); return; }
    const head = [
      "Beadva", "E-mail", "Kredit", "Nettó Ft",
      "Vevő", "Adószám", "Irsz", "Város", "Cím",
      "Kapcsolattartó", "Számlaszám", "Állapot",
    ];
    const body = rows.map((r) => {
      const b = r.billing_snapshot;
      const company = b?.billing_type === "company";
      return [
        new Date(r.created_at).toLocaleDateString("hu-HU"),
        r.user_email ?? "",
        String(r.amount),
        String(r.net_huf ?? ""),
        billingPayerName(b),
        b?.billing_tax_number ?? "",
        (company ? b?.billing_company_zip : b?.billing_zip) ?? "",
        (company ? b?.billing_company_city : b?.billing_city) ?? "",
        (company ? b?.billing_company_address : b?.billing_address) ?? "",
        company ? (b?.billing_name ?? "") : "",
        r.invoice_number ?? "",
        r.invoice_status === "issued" ? "Fizetésre vár" : "Számlázandó",
      ];
    });
    // BOM, hogy az Excel felismerje az ékezeteket.
    const csv = "﻿" + [head, ...body].map((r) => r.map(csvEscape).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `twinx-szamlazando-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const list = groups[tab];

  return (
    <div className="space-y-5">
      {/* Fülek */}
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const n = groups[t.id].length;
          const on = tab === t.id;
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className="rounded-xl px-3 py-1.5 text-sm font-medium transition"
              style={on
                ? { background: "var(--twx-coral)", color: "#fff" }
                : { border: "1px solid var(--twx-line)", background: "#fff" }}>
              {t.label}
              {n > 0 && t.id !== "closed" && (
                <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold"
                  style={on ? { background: "rgba(255,255,255,0.25)" } : { background: "var(--twx-coral-soft)", color: "#7a2e17" }}>
                  {n}
                </span>
              )}
            </button>
          );
        })}
        <button type="button" onClick={exportCsv}
          className="ml-auto rounded-xl px-3 py-1.5 text-xs font-medium"
          style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
          CSV export (könyvelés)
        </button>
      </div>

      {tab === "closed" ? (
        <ClosedTable rows={list} />
      ) : list.length === 0 ? (
        <p className="twx-card p-5 text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          Nincs tétel ebben a nézetben.
        </p>
      ) : (
        <div className="space-y-3">
          {list.map((r) => {
            const isInvoice = r.billing_kind === "invoice";
            const b = r.billing_snapshot;
            return (
              <div key={r.id} className="twx-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {r.user_email ?? "—"}
                      <span className="ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={isInvoice
                          ? { background: "#eef4ff", color: "#2b4d8f" }
                          : { background: "#f2f9f5", color: "#2e7d52" }}>
                        {isInvoice ? "Számlázandó" : "Sales — ingyenes"}
                      </span>
                    </p>
                    {/* Kire szól a számla — cégnél a cég, magánszemélynél a személy. */}
                    {isInvoice && b && (
                      <p className="text-xs font-medium">
                        Számla vevője: {billingPayerName(b)}
                        {b.billing_type === "company" && b.billing_tax_number
                          ? ` (${b.billing_tax_number})`
                          : ""}
                      </p>
                    )}
                    <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                      {new Date(r.created_at).toLocaleString("hu-HU")}
                      {r.invoice_issued_at ? ` · számla: ${new Date(r.invoice_issued_at).toLocaleDateString("hu-HU")}` : ""}
                      {r.invoice_number ? ` · ${r.invoice_number}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold" style={{ color: "var(--twx-coral)" }}>{r.amount} kredit</p>
                    {r.net_huf != null && (
                      <p className="text-xs font-semibold">{formatHuf(r.net_huf)} + áfa</p>
                    )}
                  </div>
                </div>

                {r.reason && (
                  <p className="mt-2 rounded-lg p-2 text-sm" style={{ background: "var(--twx-cream-card)" }}>
                    {r.reason}
                  </p>
                )}

                {/* Számlázási adatok — másolható blokk */}
                {isInvoice && b && (
                  <div className="mt-3 rounded-lg p-3" style={{ background: "var(--twx-cream-card)" }}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide"
                        style={{ color: "var(--twx-ink-muted)" }}>Számlázási adatok</span>
                      <button type="button" onClick={() => void copyBilling(r)}
                        className="rounded-lg px-2 py-1 text-[11px] font-medium"
                        style={{ border: "1px solid var(--twx-line)", background: "#fff" }}>
                        Másolás
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap font-mono text-xs">{billingCopyBlock(b)}</pre>
                  </div>
                )}

                {/* Műveletek */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {isInvoice && r.invoice_status === "to_issue" ? (
                    <>
                      <input type="text" placeholder="Számlaszám (nem kötelező)"
                        value={invoiceNos[r.id] ?? ""}
                        onChange={(e) => setInvoiceNos((n) => ({ ...n, [r.id]: e.target.value }))}
                        className="twx-input py-1 text-xs" style={{ minWidth: 180 }} />
                      <button type="button" disabled={busy === r.id}
                        onClick={() => void act(r.id, "issue")}
                        className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                        style={{ background: "#2b4d8f" }}>
                        Számla kiállítva
                      </button>
                    </>
                  ) : (
                    <label className="flex items-center gap-1.5 text-xs">
                      <span style={{ color: "var(--twx-ink-muted)" }}>Jóváírás:</span>
                      <input type="number" min={1} placeholder={String(r.amount)}
                        value={amounts[r.id] ?? ""}
                        onChange={(e) => setAmounts((a) => ({ ...a, [r.id]: e.target.value }))}
                        className="twx-input w-20 py-1 text-right text-xs" />
                    </label>
                  )}

                  <input type="text" placeholder="Megjegyzés (nem kötelező)"
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    className="twx-input flex-1 py-1 text-xs" style={{ minWidth: 160 }} />

                  {!(isInvoice && r.invoice_status === "to_issue") && (
                    <button type="button" disabled={busy === r.id}
                      onClick={() => void act(r.id, "approve")}
                      className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                      style={{ background: "var(--twx-coral)" }}>
                      {isInvoice ? "Befizetve → kredit jóváírása" : "Jóváhagyás"}
                    </button>
                  )}

                  <button type="button" disabled={busy === r.id}
                    onClick={() => void act(r.id, "reject")}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                    style={{ border: "1px solid #f0b3b3", color: "#c0392b", background: "#fff" }}>
                    Elutasítás
                  </button>
                </div>

                <p className="mt-1.5 text-[11px]" style={{ color: "var(--twx-ink-muted)" }}>
                  {isInvoice && r.invoice_status === "to_issue"
                    ? "A számla kiállítása még NEM ad kreditet — a jóváírás a befizetés rögzítésekor történik."
                    : `Ha üresen hagyod a mennyiséget, a kért ${r.amount} kredit kerül jóváírásra.`}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClosedTable({ rows }: { rows: CreditRequestRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="twx-card p-5 text-center text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Még nincs lezárt kérés.
      </p>
    );
  }
  return (
    <div className="twx-card overflow-x-auto p-4">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--twx-line)" }}>
            {["Mikor", "Kérelmező", "Kért", "Jóváírt", "Nettó", "Számlaszám", "Elbírálta", "Állapot"].map((h) => (
              <th key={h} className="pb-2 text-left text-[11px] font-bold uppercase tracking-wide"
                style={{ color: "var(--twx-ink-muted)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = STATUS[r.status];
            return (
              <tr key={r.id} style={{ borderBottom: "1px solid var(--twx-line)" }}>
                <td className="py-2 pr-3 text-xs" style={{ color: "var(--twx-ink-muted)" }}>
                  {new Date(r.decided_at ?? r.created_at).toLocaleDateString("hu-HU")}
                </td>
                <td className="py-2 pr-3 text-xs font-medium">{r.user_email ?? "—"}</td>
                <td className="py-2 pr-3 text-xs">{r.amount}</td>
                <td className="py-2 pr-3 text-xs font-semibold">{r.granted_amount ?? "—"}</td>
                <td className="py-2 pr-3 text-xs">{r.net_huf != null ? formatHuf(r.net_huf) : "—"}</td>
                <td className="py-2 pr-3 text-xs">{r.invoice_number ?? "—"}</td>
                <td className="py-2 pr-3 text-xs">{r.decided_by_email ?? "—"}</td>
                <td className="py-2">
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{ background: s.bg, color: s.color }}>{s.label}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
