// GET /api/activation/agent/feedback?since=<ISO> — az adott időpont óta érkezett visszajelzések az ügynöknek (Telegram, heti jelentés).
// Védelem: Authorization: Bearer <ACTIVATION_AGENT_SECRET>. Csak olvas.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { agentAuthorized, firstNameOf } from "@/lib/activation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!agentAuthorized(request)) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 401 });

  const since = new Date(new URL(request.url).searchParams.get("since") ?? "");
  if (Number.isNaN(since.getTime())) return NextResponse.json({ error: "Hibás since." }, { status: 422 });
  const iso = since.toISOString();

  const admin = createAdminClient();
  const { data, error } = await admin.from("activation_feedback")
    .select("id, user_id, question_id, category, free_text, text_at, user_state, created_at")
    .or(`created_at.gt.${iso},text_at.gt.${iso}`)
    .order("created_at")
    .limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = [...new Set((data ?? []).map((r) => r.user_id as string))];
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] as { id: string; full_name: string | null }[] };
  const names = new Map((profiles ?? []).map((p) => [p.id as string, firstNameOf(p.full_name as string | null)]));

  return NextResponse.json({ feedback: (data ?? []).map((r) => ({ ...r, first_name: names.get(r.user_id as string) ?? null })) });
}
