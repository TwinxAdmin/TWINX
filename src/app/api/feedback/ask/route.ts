// POST /api/feedback/ask — „Mi hiányzik?" válasz mentése (ME3b). body: { module, choice: string | null, comment? }
//   choice = null → bezárta válasz nélkül (dismissed) — akkor sem kérdezzük újra.
// Csak akkor fogadjuk el, ha a szabály szerint épp kérdezhető (feedbackPrompt). Az eszköz a User-Agentből jön.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { moduleForPath } from "@/lib/module-favorites";
import { feedbackPrompt } from "@/lib/module-feedback";
import { ASK_CHOICES, FEEDBACK_COMMENT_MAX } from "@/lib/module-feedback-shared";
import { deviceOf } from "@/lib/device";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { module?: unknown; choice?: unknown; comment?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  // 1) Validáció
  const path = typeof body.module === "string" ? body.module.slice(0, 300) : "";
  const moduleHref = path.startsWith("/dashboard/") ? moduleForPath(path) : null;
  if (!moduleHref) return NextResponse.json({ error: "Ismeretlen modul." }, { status: 422 });
  const choice = body.choice === null ? null : String(body.choice ?? "");
  if (choice !== null && !ASK_CHOICES.some((c) => c.value === choice)) return NextResponse.json({ error: "Ismeretlen válasz." }, { status: 422 });
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, FEEDBACK_COMMENT_MAX) : "";

  // 2) Csak akkor, ha épp kérdezhető
  const p = await feedbackPrompt(user.id, moduleHref);
  if (!p.ask) return NextResponse.json({ ok: true, saved: false });

  // 3) Mentés (modulonként egyszer — ha már van, nem írjuk felül)
  const { error } = await createAdminClient().from("module_asks").upsert({
    user_id: user.id, module_href: moduleHref,
    status: choice === null ? "dismissed" : "answered", choice, comment: comment || null,
    device: deviceOf(request.headers.get("user-agent") ?? ""),
  }, { onConflict: "user_id,module_href", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "Nem sikerült menteni." }, { status: 500 });
  return NextResponse.json({ ok: true, saved: true });
}
