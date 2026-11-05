// /admin/visszajelzesek — az aktiváló levelekre érkezett válaszok és a heti jelentések (CSAK admin).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminShell from "@/components/admin/AdminShell";
import ActivationFeedbackList, { type FeedbackRow, type ReportRow } from "@/components/admin/ActivationFeedbackList";
import { ACTIVATION_MIGRATION } from "@/lib/activation-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  const [feedback, reports] = await Promise.all([
    admin.from("activation_feedback").select("id, user_id, question_id, category, free_text, user_state, created_at").order("created_at", { ascending: false }).limit(200),
    admin.from("activation_reports").select("week_start, summary").order("week_start", { ascending: false }).limit(12),
  ]);

  const items = feedback.data ?? [];
  const ids = [...new Set(items.map((r) => r.user_id as string))];
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] as { id: string; full_name: string | null }[] };
  const names = new Map((profiles ?? []).map((p) => [p.id as string, p.full_name as string | null]));

  const rows: FeedbackRow[] = items.map((r) => ({
    id: r.id as string,
    created_at: r.created_at as string,
    name: names.get(r.user_id as string) || "Névtelen",
    user_state: r.user_state as string | null,
    question_id: r.question_id as string,
    category: r.category as string,
    free_text: r.free_text as string | null,
  }));

  return (
    <AdminShell title="Admin — Visszajelzések" subtitle="A levelekre érkezett válaszok és a heti jelentések.">
      {feedback.error ? (
        <div className="twx-card p-6 text-sm">A lista betöltéséhez futtasd le a <strong>{ACTIVATION_MIGRATION}</strong> migrációt.</div>
      ) : (
        <ActivationFeedbackList rows={rows} reports={(reports.data ?? []) as ReportRow[]} />
      )}
    </AdminShell>
  );
}
