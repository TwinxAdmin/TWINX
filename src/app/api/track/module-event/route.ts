// POST /api/track/module-event — modul-esemény naplózása (ME2b, admin „Modul elemzés": tölcsér, hibák, futási idő, eszköz).
// body: { module, event, runId?, durationMs?, detail? }
//   module: a modul útvonala (vagy bármely aloldala) — a szerver a katalógus alapján dönti el, melyik modul
//   event:  form_start | run_start | run_success | run_error | download | share
// Az eszközt (mobile / tablet / desktop) a szerver állapítja meg a User-Agentből — a kliens nem küldi.
// A mérés soha nem zavarhatja a felhasználót: hiba esetén is csendben válaszol (a 20261012191016_module-events.sql
// nélkül egyszerűen kimarad).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { moduleForPath } from "@/lib/module-favorites";
import { MODULE_EVENTS, type ModuleEvent } from "@/lib/module-events-shared";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function deviceOf(ua: string): "mobile" | "tablet" | "desktop" {
  if (/iPad|Tablet|Nexus 7|Nexus 10|SM-T|Kindle|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "tablet";
  if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) return "mobile";
  return "desktop";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let body: { module?: unknown; event?: unknown; runId?: unknown; durationMs?: unknown; detail?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  // 1) Validáció
  const path = typeof body.module === "string" ? body.module.slice(0, 300) : "";
  const moduleHref = path.startsWith("/dashboard/") ? moduleForPath(path) : null;
  const event = typeof body.event === "string" && (MODULE_EVENTS as readonly string[]).includes(body.event) ? (body.event as ModuleEvent) : null;
  if (!moduleHref || !event) return NextResponse.json({ ok: true, tracked: false });

  const runId = typeof body.runId === "string" && UUID.test(body.runId) ? body.runId : null;
  const d = Number(body.durationMs);
  const durationMs = Number.isFinite(d) && d >= 0 && d <= 86_400_000 ? Math.round(d) : null;
  const detail = typeof body.detail === "string" && body.detail.trim() ? body.detail.trim().slice(0, 200) : null;

  // 2) Mentés
  const { error } = await createAdminClient().from("module_events").insert({
    user_id: user.id, module_href: moduleHref, event, run_id: runId,
    duration_ms: event === "run_success" || event === "run_error" ? durationMs : null,
    device: deviceOf(request.headers.get("user-agent") ?? ""), detail,
  });
  return NextResponse.json({ ok: !error, tracked: !error });
}
