// dashboard/munkaim — Korábbi munkák: MINDEN elkészült anyag egy helyen.
//
// Miért kell: eddig minden modul a saját oldalán tartotta az előzményét, és
// csak a hirdetésképnek volt önálló archívuma. Így a partnernek végig kellett
// járnia a modulokat, ha meg akart találni valamit. Ez az oldal a
// `usage_history`-ból gyűjti össze az összeset, modul szerint szűrhetően.
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import WorksBrowser, { type WorkItem } from "@/components/dashboard/WorksBrowser";
import { activityTitle, featureLabel } from "@/lib/activity";

export const runtime = "nodejs";

type HistoryRow = {
  id: string;
  feature_used: string;
  input_data: Record<string, unknown> | null;
  output_file_url: string | null;
  created_at: string;
};

export default async function MyWorksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // EXPLICIT saját user-re szűrünk: adminként az RLS mindenkiét visszaadná.
  const { data } = await supabase
    .from("usage_history")
    .select("id, feature_used, input_data, output_file_url, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(300);

  const rows = (data ?? []) as unknown as HistoryRow[];
  const items: WorkItem[] = rows.map((h) => ({
    id: h.id,
    feature: h.feature_used,
    title: activityTitle(h.feature_used, h.input_data),
    typeLabel: featureLabel(h.feature_used),
    output_file_url: h.output_file_url,
    created_at: h.created_at,
  }));

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-semibold">Korábbi munkák</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
            Minden elkészült anyagod egy helyen. Kattints rá a megnyitáshoz vagy letöltéshez.
          </p>
        </div>
        {/* A hirdetésképeknek van saját, MAPPÁS archívuma is — ott lehet rendezni. */}
        <Link
          href="/dashboard/flyer/history"
          className="rounded-xl px-4 py-2 text-sm font-medium"
          style={{ border: "1px solid var(--twx-line)", background: "var(--twx-cream-card)" }}
        >
          Hirdetésképek mappákban →
        </Link>
      </div>

      <WorksBrowser items={items} />
    </main>
  );
}
