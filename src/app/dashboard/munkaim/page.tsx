// dashboard/munkaim — Korábbi munkák: MINDEN elkészült anyag egy helyen.
//
// Miért kell: eddig minden modul a saját oldalán tartotta az előzményét, és
// csak a hirdetésképnek volt önálló archívuma. Így a partnernek végig kellett
// járnia a modulokat, ha meg akart találni valamit. Ez az oldal a
// `usage_history`-ból gyűjti össze az összeset, modul szerint szűrhetően.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { WorkItem } from "@/components/dashboard/WorksBrowser";
import WorksLibrary from "@/components/works/WorksLibrary";
import type { WorkCategory } from "@/components/works/WorkTypeBadge";
import { activityTitle, featureLabel } from "@/lib/activity";
import { officeNonePreview } from "@/lib/view-as";

export const runtime = "nodejs";

const CATS: WorkCategory[] = ["video", "valuation", "visual", "enhance", "ad", "text", "other"];

type HistoryRow = {
  id: string;
  feature_used: string;
  input_data: Record<string, unknown> | null;
  output_file_url: string | null;
  created_at: string;
  hidden_at?: string | null;
};

export default async function MyWorksPage({ searchParams }: { searchParams: Promise<{ tab?: string; folder?: string; mappa?: string; tipus?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // EXPLICIT saját user-re szűrünk: adminként az RLS mindenkiét visszaadná.
  // hidden_at: „Törlés" = elrejtés (usage-history-hidden.sql). Ha a migráció még nem futott, nélküle kérdezünk.
  const query = (cols: string) => supabase.from("usage_history").select(cols)
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(300);
  let res = await query("id, feature_used, input_data, output_file_url, created_at, hidden_at");
  if (res.error && /hidden_at/.test(res.error.message)) res = await query("id, feature_used, input_data, output_file_url, created_at");
  const data = res.data;

  const rows = (data ?? []) as unknown as HistoryRow[];

  // Irodai tag? → a nézegetőben megjelenik a „Megosztás az irodával" gomb.
  const { data: memberships } = await supabase
    .from("office_members").select("office_id").eq("user_id", user.id).limit(1);
  // „Nincs iroda" előnézet: úgy jelenik meg, mintha nem lenne irodai tagság
  const membership = (await officeNonePreview()) ? null : memberships?.[0] ?? null;
  const items: WorkItem[] = rows.map((h) => ({
    id: h.id,
    feature: h.feature_used,
    title: activityTitle(h.feature_used, h.input_data, h.created_at),
    typeLabel: featureLabel(h.feature_used),
    output_file_url: h.output_file_url,
    created_at: h.created_at,
    hidden: !!h.hidden_at,
  }));

  return (
    <main className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold">Korábbi munkák</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          Minden elkészült anyagod egy helyen — rendszerezd saját mappákba, böngéssz típus szerint,
          és érd el a kollégáiddal közös irodai mappákat.
        </p>
      </div>

      <WorksLibrary items={items} isMember={!!membership}
        initial={sp.mappa ? { kind: "mine", id: sp.mappa }
          : sp.folder ? { kind: "office", id: sp.folder }
          : sp.tipus && CATS.includes(sp.tipus as WorkCategory) ? { kind: "cat", cat: sp.tipus as WorkCategory }
          : { kind: "all" }} />
    </main>
  );
}
