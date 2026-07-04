// dashboard/page.tsx — Portál Központ (wireframe).
// Server Component: modulok + kredit egyenleg lekérése, valamint a legutóbbi
// 50 tevékenység (usage_history, LIMIT 50). Az RLS csak a saját sorokat adja vissza.
import { createClient } from "@/lib/supabase/server";

type ServiceRow = {
  id: string;
  name: string;
  slug: string;
  status: "public" | "private";
};

type HistoryRow = {
  id: string;
  feature_used: string;
  output_file_url: string | null;
  created_at: string;
  services: { name: string } | null;
};

export default async function DashboardHome() {
  const supabase = await createClient();

  const [{ data: services }, { data: credits }, { data: history }] =
    await Promise.all([
      supabase.from("services").select("id, name, slug, status"),
      supabase.from("user_credits").select("service_id, remaining_credits"),
      supabase
        .from("usage_history")
        .select("id, feature_used, output_file_url, created_at, services(name)")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  // service_id -> remaining_credits
  const creditMap = new Map<string, number>(
    (credits ?? []).map((c) => [c.service_id as string, c.remaining_credits as number])
  );

  const serviceList = (services ?? []) as ServiceRow[];
  const historyList = (history ?? []) as unknown as HistoryRow[];

  return (
    <main className="space-y-10">
      <h1 className="font-display text-4xl font-semibold">Portál Központ</h1>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-medium">Elérhető modulok</h2>
          <a
            href="/pricing"
            className="rounded-full px-4 py-2 text-xs font-medium"
            style={{ background: "var(--twx-coral)", color: "#1c1005" }}
          >
            Kredit vásárlása
          </a>
        </div>
        {serviceList.length === 0 ? (
          <div
            className="mt-3 rounded-xl border border-dashed p-4 text-sm"
            style={{ borderColor: "var(--twx-line)", color: "var(--twx-ink-muted)" }}
          >
            Nincs elérhető modul.
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {serviceList.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-xl p-4 text-sm"
                style={{ background: "var(--twx-cream-card)", border: "1px solid var(--twx-line)" }}
              >
                <span>
                  {s.name}{" "}
                  {s.status === "private" && (
                    <span className="text-xs" style={{ color: "var(--twx-ink-muted)" }}>(privát)</span>
                  )}
                </span>
                <span style={{ color: "var(--twx-ink-muted)" }}>
                  Kredit: {creditMap.get(s.id) ?? 0}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

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
