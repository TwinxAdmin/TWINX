// dashboard/purchases — a felhasználó korábbi kredit-vásárlásai (RLS: saját sorok).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const huf = (n: number) => `${Math.round(n).toLocaleString("hu-HU")} Ft`;

export default async function PurchasesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // „*": a számla- és iroda-oszlopok csak a 20261017115051_card-invoicing.sql / 20261017160355_office-card-topup.sql
  // után léteznek — így a lekérdezés előttük is működik (a hiányzó mezők üresek).
  type Row = { id: string; credits: number; amount_huf: number; created_at: string; invoice_status?: string | null; invoice_number?: string | null; office_id?: string | null };
  const { data } = await supabase
    .from("credit_purchases")
    .select("*")
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as Row[];
  const totalHuf = rows.reduce((s, r) => s + (Number(r.amount_huf) || 0), 0);
  const totalCredits = rows.reduce((s, r) => s + (Number(r.credits) || 0), 0);

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-3xl font-semibold">Korábbi vásárlások</h1>

      {rows.length === 0 ? (
        <div className="rounded-xl p-4 text-sm" style={{ border: "1px dashed var(--twx-line)", color: "var(--twx-ink-muted)" }}>
          Még nincs vásárlásod.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="twx-card p-4">
              <p className="text-xs uppercase" style={{ color: "var(--twx-ink-muted)" }}>Összes vásárolt</p>
              <p className="mt-1 text-xl font-semibold">{totalCredits} kredit</p>
            </div>
            <div className="twx-card p-4">
              <p className="text-xs uppercase" style={{ color: "var(--twx-ink-muted)" }}>Összes költés</p>
              <p className="mt-1 text-xl font-semibold">{huf(totalHuf)}</p>
            </div>
          </div>

          <table className="w-full text-sm twx-card">
            <thead>
              <tr className="text-left" style={{ borderBottom: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}>
                <th className="p-3">Dátum</th>
                <th className="p-3 text-right">Kredit</th>
                <th className="p-3 text-right">Összeg</th>
                <th className="p-3 text-right">Számla</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--twx-line)" }}>
                  <td className="p-3">{new Date(r.created_at).toLocaleString("hu-HU")}</td>
                  <td className="p-3 text-right">
                    {r.credits}
                    {r.office_id && <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "var(--twx-cream)", border: "1px solid var(--twx-line)" }} title="Az iroda közös egyenlegére">iroda</span>}
                  </td>
                  <td className="p-3 text-right">{huf(r.amount_huf)}</td>
                  <td className="p-3 text-right" style={{ color: r.invoice_number ? undefined : "var(--twx-ink-muted)" }}
                    title={r.invoice_number ? "A számlát e-mailben is elküldtük." : undefined}>
                    {r.invoice_number ?? (r.invoice_status === "issuing" ? "készül…" : r.invoice_status === "failed" || r.invoice_status === "uncertain" ? "hamarosan" : "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
