// /admin/users — Felhasználónkénti költség/használat bontás (CSAK admin).
// Ki mit és mennyit használt, mennyibe került (USD/HUF), és mennyit vásárolt.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserMetrics } from "@/lib/metrics";

export const runtime = "nodejs";

const huf = (n: number) => `${Math.round(n).toLocaleString("hu-HU")} Ft`;
const usd = (n: number) => `$${n.toFixed(2)}`;

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const { users, hufPerUsd } = await getUserMetrics();

  return (
    <main className="twx-page font-sans">
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-semibold">Admin — Felhasználók</h1>
          <nav className="flex gap-3 text-sm" style={{ color: "var(--twx-coral)" }}>
            <a href="/admin/analytics">Költségfigyelő</a>
            <a href="/admin/ideas">Ötletek</a>
            <a href="/admin/credits">Kredit</a>
            <a href="/dashboard">Dashboard</a>
          </nav>
        </div>
        <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          Felhasználónkénti használat és becsült API-önköltség (1 USD = {hufPerUsd} Ft).
        </p>

        {users.length === 0 ? (
          <div className="rounded-xl p-4 text-sm" style={{ border: "1px dashed var(--twx-line)", color: "var(--twx-ink-muted)" }}>
            Még nincs felhasználó.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm twx-card">
              <thead>
                <tr className="text-left" style={{ borderBottom: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}>
                  <th className="p-2">Felhasználó</th>
                  <th className="p-2 text-right">Használat</th>
                  <th className="p-2">Mit használt</th>
                  <th className="p-2 text-right">Költség</th>
                  <th className="p-2 text-right">Bevétel</th>
                  <th className="p-2 text-right">Kredit vásárolt</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.userId} style={{ borderBottom: "1px solid var(--twx-line)" }}>
                    <td className="p-2">
                      <div className="font-medium">{u.email}</div>
                      {u.role !== "user" && (
                        <span className="text-xs" style={{ color: "var(--twx-coral)" }}>{u.role}</span>
                      )}
                    </td>
                    <td className="p-2 text-right font-medium">{u.uses}</td>
                    <td className="p-2" style={{ color: "var(--twx-ink-muted)" }}>
                      {u.features.length
                        ? u.features.map((f) => `${f.label} ${f.count}`).join(" · ")
                        : "—"}
                    </td>
                    <td className="p-2 text-right">
                      {huf(u.costUsd * hufPerUsd)}
                      <div className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>{usd(u.costUsd)}</div>
                    </td>
                    <td className="p-2 text-right">{huf(u.revenueHuf)}</td>
                    <td className="p-2 text-right">{u.creditsBought}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
          Megjegyzés: az admin/sales szerepkör díjmentesen használhatja az AI-modulokat, ezért náluk
          a „Használat" nőhet, de a bevétel/kredit alacsony maradhat. A költség becsült nyers API-önköltség.
        </p>
      </div>
    </main>
  );
}
