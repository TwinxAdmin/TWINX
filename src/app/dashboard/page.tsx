// dashboard/page.tsx — Portál Központ.
// Server Component: közös egyenleg + kategória-áttekintés + a legutóbbi
// 50 tevékenység (usage_history, LIMIT 50). Az RLS csak a saját sorokat adja vissza.
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES } from "@/lib/catalog";

type HistoryRow = {
  id: string;
  feature_used: string;
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
      .select("id, feature_used, output_file_url, created_at, services(name)")
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
        <a
          href="/pricing"
          className="rounded-full px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
          style={{ background: "var(--twx-coral)", color: "#1c1005" }}
        >
          Egyenleg feltöltése
        </a>
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
                {soon ? (
                  <p className="mt-3 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
                    Fejlesztés alatt — hamarosan elérhető.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-1.5">
                    {cat.modules.map((m) => (
                      <li key={m.href}>
                        <a
                          href={m.href}
                          className="text-sm underline-offset-2 hover:underline"
                          style={{ color: "var(--twx-coral)" }}
                        >
                          {m.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Legutóbbi tevékenység */}
      <section>
        <h2 className="font-display text-xl font-medium">Legutóbbi tevékenység (max. 50)</h2>
        {historyList.length === 0 ? (
          <div
            className="mt-3 rounded-xl border border-dashed p-4 text-sm"
            style={{ borderColor: "var(--twx-line)", color: "var(--twx-ink-muted)" }}
          >
            Még nincs tevékenység.
          </div>
        ) : (
          <ul
            className="mt-3 divide-y overflow-hidden rounded-xl"
            style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream-card)", borderColor: "var(--twx-line)" }}
          >
            {historyList.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between p-4 text-sm"
                style={{ borderColor: "var(--twx-line)" }}
              >
                <span>
                  {h.services?.name ?? "—"} · {h.feature_used}
                </span>
                <span className="flex items-center gap-3" style={{ color: "var(--twx-ink-muted)" }}>
                  <time dateTime={h.created_at}>
                    {new Date(h.created_at).toLocaleString("hu-HU")}
                  </time>
                  {h.output_file_url && (
                    <a
                      href={h.output_file_url}
                      className="underline"
                      style={{ color: "var(--twx-coral)" }}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Letöltés
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
