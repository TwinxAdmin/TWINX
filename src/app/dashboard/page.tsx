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
    <main className="mx-auto max-w-4xl space-y-8">
      <h1 className="text-2xl font-semibold">Portál Központ</h1>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Elérhető modulok</h2>
          <a
            href="/pricing"
            className="border border-gray-800 bg-gray-800 px-3 py-1.5 text-xs text-white"
          >
            Kredit vásárlása
          </a>
        </div>
        {serviceList.length === 0 ? (
          <div className="mt-2 border border-dashed border-gray-300 p-4 text-sm text-gray-500">
            Nincs elérhető modul. (Vegyél fel egy sort a <code>services</code>{" "}
            táblába, pl. a <code>real-estate</code> modult.)
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {serviceList.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between border border-gray-200 p-3 text-sm"
              >
                <span>
                  {s.name}{" "}
                  {s.status === "private" && (
                    <span className="text-xs text-gray-400">(privát)</span>
                  )}
                </span>
                <span className="text-gray-600">
                  Kredit: {creditMap.get(s.id) ?? 0}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-medium">Legutóbbi tevékenység (max. 50)</h2>
        {historyList.length === 0 ? (
          <div className="mt-2 border border-dashed border-gray-300 p-4 text-sm text-gray-500">
            Még nincs tevékenység.
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-gray-200 border border-gray-200">
            {historyList.map((h) => (
              <li key={h.id} className="flex items-center justify-between p-3 text-sm">
                <span>
                  {h.services?.name ?? "—"} · {h.feature_used}
                </span>
                <span className="flex items-center gap-3 text-gray-500">
                  <time dateTime={h.created_at}>
                    {new Date(h.created_at).toLocaleString("hu-HU")}
                  </time>
                  {h.output_file_url && (
                    <a
                      href={h.output_file_url}
                      className="underline"
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
