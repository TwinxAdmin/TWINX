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

  const { data } = await supabase
    .from("credit_purchases")
    .select("id, credits, amount_huf, created_at")
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as { id: string; credits: number; amount_huf: number; created_at: string }[];
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
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--twx-line)" }}>
                  <td className="p-3">{new Date(r.created_at).toLocaleString("hu-HU")}</td>
                  <td className="p-3 text-right">{r.credits}</td>
                  <td className="p-3 text-right">{huf(r.amount_huf)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </main>
  );
}
