// POST /api/activation/agent/report — az ügynök heti jelentése az admin felületre. Az adott hét jelentését felülírja.
// Védelem: Authorization: Bearer <ACTIVATION_AGENT_SECRET>.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { agentAuthorized } from "@/lib/activation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!agentAuthorized(request)) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { week_start?: unknown; summary?: unknown; data?: unknown } | null;
  const week = typeof body?.week_start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.week_start) ? body.week_start : null;
  const summary = typeof body?.summary === "string" ? body.summary.trim().slice(0, 8000) : "";
  if (!week || !summary) return NextResponse.json({ error: "Hiányos jelentés." }, { status: 422 });

  const { error } = await createAdminClient().from("activation_reports")
    .upsert({ week_start: week, summary, data: body?.data ?? null }, { onConflict: "week_start" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
