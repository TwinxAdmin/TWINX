// POST /api/feedback/rating — csillagos értékelés mentése (ME3b).
// body: { module, stars: 1–5 | null, reasons?: string[], comment? }
//   • stars = null → bezárta értékelés nélkül: 1. alkalommal dismissed (asked_count 1),
//     ha már egyszer bezárta, a 2. (utolsó) alkalom is rögzül (asked_count 2) — utána soha nem kérdezzük
//   • okok és megjegyzés csak 1–3 csillagnál kerül mentésre
// Csak akkor fogadjuk el, ha a szabály szerint épp kérdezhető (feedbackPrompt) — így nem lehet „szavazni" kérés nélkül.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { moduleForPath } from "@/lib/module-favorites";
import { feedbackPrompt } from "@/lib/module-feedback";
import { FEEDBACK_COMMENT_MAX, RATING_REASONS } from "@/lib/module-feedback-shared";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { module?: unknown; stars?: unknown; reasons?: unknown; comment?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  // 1) Validáció
  const path = typeof body.module === "string" ? body.module.slice(0, 300) : "";
  const moduleHref = path.startsWith("/dashboard/") ? moduleForPath(path) : null;
  if (!moduleHref) return NextResponse.json({ error: "Ismeretlen modul." }, { status: 422 });
  const stars = body.stars === null ? null : Number(body.stars);
  if (stars !== null && (!Number.isInteger(stars) || stars < 1 || stars > 5)) {
    return NextResponse.json({ error: "1 és 5 közötti csillagot adj meg." }, { status: 422 });
  }
  const allowed = new Set<string>(RATING_REASONS.map((r) => r.value));
  const reasons = Array.isArray(body.reasons) ? [...new Set(body.reasons.map(String).filter((r) => allowed.has(r)))] : [];
  const comment = typeof body.comment === "string" ? body.comment.trim().slice(0, FEEDBACK_COMMENT_MAX) : "";

  // 2) Csak akkor, ha épp kérdezhető
  const p = await feedbackPrompt(user.id, moduleHref);
  if (!p.rating) return NextResponse.json({ ok: true, saved: false });

  // 3) Mentés
  const admin = createAdminClient();
  const { data: prev } = await admin.from("module_ratings").select("status, asked_count").eq("user_id", user.id).eq("module_href", moduleHref).maybeSingle();
  const askedCount = prev ? 2 : 1;
  const low = stars !== null && stars <= 3;
  const { error } = await admin.from("module_ratings").upsert({
    user_id: user.id, module_href: moduleHref,
    status: stars === null ? "dismissed" : "rated",
    stars, reasons: low ? reasons : [], comment: low && comment ? comment : null,
    asked_count: askedCount, run_count: p.runs,
  }, { onConflict: "user_id,module_href" });
  if (error) return NextResponse.json({ error: "Nem sikerült menteni." }, { status: 500 });
  return NextResponse.json({ ok: true, saved: true });
}
