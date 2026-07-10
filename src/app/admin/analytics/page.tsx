// /admin/analytics — Admin Költségfigyelő dashboard (CSAK admin).
// Bevétel (HUF) vs. API-költség (USD→HUF), profitmarzs, funkció/API-bontás.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMetrics } from "@/lib/metrics";

export const runtime = "nodejs";

const huf = (n: number) => `${Math.round(n).toLocaleString("hu-HU")} Ft`;
const usd = (n: number) => `$${n.toFixed(2)}`;

export default async function AdminAnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin") redirect("/dashboard");

  const m = await getMetrics();

  return (
    <main className="twx-page font-sans">
      <div className="mx-auto max-w-4xl space-y-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">Admin — Költségfigyelő</h1>
        <nav className="flex gap-3 text-sm" style={{ color: "var(--twx-coral)" }}>
          <a href="/admin/ideas">Ötletek</a>
          <a href="/admin/credits">Kredit</a>
          <a href="/dashboard">Dashboard</a>
        </nav>
      </div>
      <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Árfolyam: 1 USD = {m.hufPerUsd} Ft. A költség becsült nyers API-önköltség.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card label="Bevétel" value={huf(m.revenueHuf)} sub={`${m.purchases} vásárlás · ${m.creditsSold} kredit`} />
        <Card
          label="API-költség"
          value={huf(m.costHuf)}
          sub={`${usd(m.costUsd)} · ${m.generations} generálás`}
        />
        <Card
          label="Profit (becsült)"
          value={huf(m.profitHuf)}
          sub={m.marginPct !== null ? `Marzs: ${m.marginPct.toFixed(1)}%` : "Nincs bevétel"}
          highlight={m.profitHuf >= 0 ? "pos" : "neg"}
        />
      </div>

      <section>
        <h2 className="font-display font-medium">Szolgáltatás-alapú lebontás</h2>
        {m.byFeature.length === 0 ? (
          <div className="mt-2 rounded-xl p-4 text-sm" style={{ border: "1px dashed var(--twx-line)", color: "var(--twx-ink-muted)" }}>
            Még nincs költségadat.
          </div>
        ) : (
          <table className="mt-2 w-full text-sm twx-card">
            <thead>
              <tr className="text-left" style={{ borderBottom: "1px solid var(--twx-line)", color: "var(--twx-ink-muted)" }}>
                <th className="p-2">Funkció</th>
                <th className="p-2">Külső API</th>
                <th className="p-2 text-right">Hívások</th>
                <th className="p-2 text-right">Egységek</th>
                <th className="p-2 text-right">Költség (USD)</th>
                <th className="p-2 text-right">Költség (HUF)</th>
              </tr>
            </thead>
            <tbody>
              {m.byFeature.map((f) => (
                <tr key={`${f.feature}-${f.serviceName}`} style={{ borderBottom: "1px solid var(--twx-line)" }}>
                  <td className="p-2">{f.feature}</td>
                  <td className="p-2">{f.serviceName}</td>
                  <td className="p-2 text-right">{f.count}</td>
                  <td className="p-2 text-right">{f.units}</td>
                  <td className="p-2 text-right">{usd(f.costUsd)}</td>
                  <td className="p-2 text-right">{huf(f.costUsd * m.hufPerUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>
        Megjegyzés: a bevétel csak azoknál a vásárlásoknál jelenik meg, ahol a fizetett
        összeg rögzítve van (`amount_huf`). Régi teszt-vásárlásokhoz a `metrics.sql`-ben
        lévő visszatöltő sorral pótolható.
      </p>
      </div>
    </main>
  );
}

function Card({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "pos" | "neg";
}) {
  const color =
    highlight === "pos"
      ? "text-green-700"
      : highlight === "neg"
        ? "text-red-600"
        : "";
  return (
    <div className="twx-card p-4">
      <p className="text-xs uppercase" style={{ color: "var(--twx-ink-muted)" }}>{label}</p>
      <p className={`mt-1 text-xl font-semibold ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs" style={{ color: "var(--twx-ink-muted)" }}>{sub}</p>}
    </div>
  );
}
