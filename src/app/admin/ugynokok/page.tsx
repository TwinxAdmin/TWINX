// /admin/ugynokok — AI-ügynökök egy helyen: állapot, mai munka, napló, visszajelzések és heti jelentések (CSAK admin).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminShell from "@/components/admin/AdminShell";
import AgentsDashboard, { type AgentTab } from "@/components/admin/AgentsDashboard";
import type { FeedbackRow, ReportRow } from "@/components/admin/ActivationFeedbackList";
import { ACTIVATION_MIGRATION } from "@/lib/activation-shared";
import { AGENT_MONITOR_MIGRATION, type AgentEventRow, type AgentLetter, type AgentStatusRow } from "@/lib/agents-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TABS: AgentTab[] = ["attekintes", "naplo", "visszajelzesek"];

export default async function AdminAgentsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  const [statuses, events, feedback, reports] = await Promise.all([
    admin.from("agent_status").select("agent, dry_run, last_seen_at, summary").order("agent"),
    admin.from("agent_events").select("id, agent, dry_run, kind, message, created_at").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(200),
    admin.from("activation_feedback").select("id, user_id, question_id, category, free_text, user_state, created_at").order("created_at", { ascending: false }).limit(200),
    admin.from("activation_reports").select("week_start, summary").order("week_start", { ascending: false }).limit(12),
  ]);

  const statusRows = (statuses.data ?? []) as AgentStatusRow[];
  const feedbackItems = feedback.data ?? [];

  // A nevek csak itt, olvasáskor kerülnek a sorok mellé: az ügynök napi jelentése csak azonosítót tárol.
  const ids = [...new Set([
    ...feedbackItems.map((r) => r.user_id as string),
    ...statusRows.flatMap((s) => (s.summary?.letters ?? []).map((l) => l.user_id)),
  ])];
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] as { id: string; full_name: string | null }[] };
  const names = new Map((profiles ?? []).map((p) => [p.id as string, p.full_name as string | null]));

  const lettersByAgent: Record<string, AgentLetter[]> = {};
  for (const s of statusRows) {
    lettersByAgent[s.agent] = (s.summary?.letters ?? []).map((l) => ({ ...l, name: names.get(l.user_id) || "Névtelen" }));
  }

  const feedbackRows: FeedbackRow[] = feedbackItems.map((r) => ({
    id: r.id as string,
    created_at: r.created_at as string,
    name: names.get(r.user_id as string) || "Névtelen",
    user_state: r.user_state as string | null,
    question_id: r.question_id as string,
    category: r.category as string,
    free_text: r.free_text as string | null,
  }));

  const requested = (await searchParams).tab as AgentTab | undefined;

  return (
    <AdminShell title="Admin — AI-ügynökök" subtitle="Mit csinálnak az ügynökök: állapot, mai munka, napló és visszajelzések egy helyen.">
      <AgentsDashboard
        initialTab={requested && TABS.includes(requested) ? requested : "attekintes"}
        nowIso={new Date().toISOString()}
        statuses={statusRows}
        lettersByAgent={lettersByAgent}
        events={(events.data ?? []) as AgentEventRow[]}
        monitorMissing={statuses.error ? AGENT_MONITOR_MIGRATION : null}
        feedback={feedbackRows}
        reports={(reports.data ?? []) as ReportRow[]}
        feedbackMissing={feedback.error ? ACTIVATION_MIGRATION : null}
      />
    </AdminShell>
  );
}
