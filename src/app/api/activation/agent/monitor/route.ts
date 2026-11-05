// POST /api/activation/agent/monitor — az ügynök állapota és új naplósorai az Admin → AI-ügynökök oldalra.
// Védelem: Authorization: Bearer <ACTIVATION_AGENT_SECRET>. Az ügynök 5 percenként hívja.
// 503: még nem futott le a migráció; az ügynök ezt csendben tudomásul veszi, és később újrapróbálja.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { agentAuthorized } from "@/lib/activation";
import { AGENT_EVENTS_KEEP_DAYS, AGENT_MONITOR_MIGRATION } from "@/lib/agents-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_EVENTS = 200;
const MAX_JSON_CHARS = 20_000;

type IncomingEvent = { source_id?: unknown; dry_run?: unknown; kind?: unknown; message?: unknown; data?: unknown; created_at?: unknown };

function boundedJson(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value).length <= MAX_JSON_CHARS ? value : null;
}

function validEvent(e: IncomingEvent): e is { source_id: number; dry_run: boolean; kind: string; message?: unknown; data?: unknown; created_at: string } {
  return Number.isSafeInteger(e?.source_id) && typeof e?.dry_run === "boolean" && typeof e?.kind === "string" && e.kind.length > 0
    && typeof e?.created_at === "string" && !Number.isNaN(Date.parse(e.created_at));
}

export async function POST(request: Request) {
  if (!agentAuthorized(request)) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { agent?: unknown; dry_run?: unknown; summary?: unknown; events?: unknown } | null;
  const agent = typeof body?.agent === "string" && /^[a-z0-9_-]{1,40}$/.test(body.agent) ? body.agent : null;
  if (!agent || typeof body?.dry_run !== "boolean") return NextResponse.json({ error: "Hiányos jelentés." }, { status: 422 });

  const incoming = Array.isArray(body.events) ? (body.events as IncomingEvent[]) : [];
  if (incoming.length > MAX_EVENTS || !incoming.every(validEvent)) return NextResponse.json({ error: "Hibás naplósor." }, { status: 422 });

  const admin = createAdminClient();
  const { error: statusError } = await admin.from("agent_status").upsert(
    { agent, dry_run: body.dry_run, last_seen_at: new Date().toISOString(), summary: boundedJson(body.summary) },
    { onConflict: "agent" },
  );
  if (statusError) {
    const missing = /agent_status|schema cache/i.test(statusError.message);
    return NextResponse.json({ error: missing ? `Futtasd le: ${AGENT_MONITOR_MIGRATION}` : statusError.message }, { status: missing ? 503 : 500 });
  }

  if (incoming.length) {
    const rows = incoming.filter(validEvent).map((e) => ({
      agent,
      source_id: e.source_id,
      dry_run: e.dry_run,
      kind: e.kind.slice(0, 60),
      message: typeof e.message === "string" ? e.message.slice(0, 1000) : null,
      data: boundedJson(e.data),
      created_at: e.created_at,
    }));
    const { error } = await admin.from("agent_events").upsert(rows, { onConflict: "agent,source_id", ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // A napló nem nő a végtelenségig.
  const cutoff = new Date(Date.now() - AGENT_EVENTS_KEEP_DAYS * 86_400_000).toISOString();
  await admin.from("agent_events").delete().lt("created_at", cutoff);

  return NextResponse.json({ ok: true });
}
