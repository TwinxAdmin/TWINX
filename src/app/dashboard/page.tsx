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

  const { data: me } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const role = (me?.role as string | undefined) ?? "user";
  const isAdmin = role === "admin"; // korlátlan, prezentációs mód (nincs kreditlevonás)
  const isSales = role === "sales"; // az admin által biztosított keretet fogyasztja

  // Időszakok a folyamat-számláláshoz (hét = hétfőtől, hónap = 1-jétől).
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const sinceMonday = (now.getDay() + 6) % 7;
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - sinceMonday).toISOString();

  // FONTOS: az admin RLS-ben minden sort lát, ezért mindenhol EXPLICIT a saját user-re szűrünk,
  // hogy a személyes dashboard (előzmény + folyamat-számláló) tényleg a sajátot mutassa.
  const uid = user?.id ?? "__none__";

  const [{ data: wallet }, { data: history }, weekRes, monthRes] = await Promise.all([
    user
      ? supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("usage_history")
      .select("id, feature_used, input_data, output_file_url, created_at, services(name)")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50),
    isAdmin
      ? supabase.from("usage_history").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", startOfWeek)
      : Promise.resolve({ count: 0 }),
    isAdmin
      ? supabase.from("usage_history").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("created_at", startOfMonth)
      : Promise.resolve({ count: 0 }),
  ]);

  const balance = (wallet?.balance as number | undefined) ?? 0;
  const weekCount = (weekRes as { count: number | null }).count ?? 0;
  const monthCount = (monthRes as { count: number | null }).count ?? 0;
  const historyList = (history ?? []) as unknown as HistoryRow[];

  return (
    <main className="space-y-10">
      <h1 className="font-display text-4xl font-semibold">Portál Központ</h1>

      {/* Fejléc-kártya: usernek egyenleg (csökken), staffnak folyamat-számláló (nő) */}
      <section
        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl p-6"
        style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}
      >
        {isAdmin ? (
          <>
            <div>
              <p className="text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>
                Prezentációs mód — a modulok kreditlevonás nélkül futnak (csak API-költség)
              </p>
              <div className="mt-2 flex flex-wrap gap-10">
                <div>
                  <p className="font-display text-5xl font-semibold">{weekCount}</p>
                  <p className="text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>folyamat ezen a héten</p>
                </div>
                <div>
                  <p className="font-display text-5xl font-semibold">{monthCount}</p>
                  <p className="text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>folyamat ebben a hónapban</p>
                </div>
              </div>
            </div>
            <span
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: "var(--twx-coral)", color: "#1c1005" }}
            >
              Admin
            </span>
          </>
        ) : (
          <>
            <div>
              <p className="text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>
                {isSales
                  ? "Kereted — az admin által biztosított folyamatok (bármelyik modulban)"
                  : "Egyenleged — bármelyik modulban felhasználható"}
              </p>
              <p className="font-display text-5xl font-semibold">{balance}</p>
            </div>
            {isSales ? (
              <span
                className="rounded-full px-3 py-1 text-xs font-medium"
                style={{ background: "var(--twx-line)", color: "var(--twx-on-dark-muted)" }}
              >
                Sales · a keretet az admin tölti fel
              </span>
            ) : (
              <PricingTrigger
                className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
                style={{ background: "var(--twx-coral)", color: "#1c1005" }}
              >
                Egyenleg feltöltése
              </PricingTrigger>
            )}
          </>
        )}
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
