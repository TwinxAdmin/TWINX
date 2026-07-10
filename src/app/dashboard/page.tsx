// dashboard/page.tsx — Portál Központ.
// Server Component: közös egyenleg + kategória-áttekintés + a legutóbbi
// 50 tevékenység (usage_history, LIMIT 50). Az RLS csak a saját sorokat adja vissza.
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES } from "@/lib/catalog";
import RecentActivity from "@/components/RecentActivity";
import PricingTrigger from "@/components/PricingTrigger";
import { activityTitle, featureLabel } from "@/lib/activity";

type HistoryRow = {
  id: string;
  feature_used: string;
  input_data: Record<string, unknown> | null;
  output_file_url: string | null;
  created_at: string;
  services: { name: string } | null;
};

export default async function DashboardHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: wallet }, { data: history }] = await Promise.all([
    user
      ? supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("usage_history")
      .select("id, feature_used, input_data, output_file_url, created_at, services(name)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const balance = (wallet?.balance as number | undefined) ?? 0;
  const historyList = (history ?? []) as unknown as HistoryRow[];

  return (
    <main className="space-y-10">
      <h1 className="font-display text-4xl font-semibold">Portál Központ</h1>

      {/* Közös egyenleg — bármelyik modulban elkölthető */}
      <section
        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl p-6"
        style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}
      >
        <div>
          <p className="text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>
            Egyenleged — bármelyik modulban felhasználható
          </p>
          <p className="font-display text-5xl font-semibold">{balance}</p>
        </div>
        <PricingTrigger
          className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
          style={{ background: "var(--twx-coral)", color: "#1c1005" }}
        >
          Egyenleg feltöltése
        </PricingTrigger>
      </section>

      {/* Kategóriák (App Store-szerű áttekintés) */}
      <section>
        <h2 className="font-display text-xl font-medium">Kategóriák</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((cat) => {
            const soon = cat.status === "soon";
            return (
              <div key={cat.slug} className="twx-card flex flex-col p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-medium">{cat.label}</h3>
                  {soon && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ background: "var(--twx-line)", color: "var(--twx-ink-muted)" }}
                    >
                      Hamarosan
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--twx-ink-muted)" }}>
                  {soon ? `${cat.blurb} Hamarosan elérhető.` : cat.blurb}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Legutóbbi tevékenység — összecsukva, gombra nyílik */}
      <RecentActivity
        items={historyList.map((h) => ({
          id: h.id,
          title: activityTitle(h.feature_used, h.input_data),
          typeLabel: featureLabel(h.feature_used),
          output_file_url: h.output_file_url,
          created_at: h.created_at,
        }))}
      />
    </main>
  );
}
