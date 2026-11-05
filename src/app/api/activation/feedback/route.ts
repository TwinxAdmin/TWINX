// POST /api/activation/feedback — a levélből érkező visszajelzés. Belépés nem kell, az aláírt token azonosít.
// Egy levélre egy válasz rögzül (source_email_id egyedi); a szabad szöveg egyszer adható hozzá. A köszönő oldal POST-tal hívja,
// így a levelezők linkellenőrzője (ami csak megnyitja a linket) nem rögzít választ a felhasználó helyett.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyFeedbackToken } from "@/lib/activation-token";
import { ACTIVATION_MIGRATION, FEEDBACK_QUESTIONS } from "@/lib/activation-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT = 2000;
const INVALID = "Ez a link már nem érvényes.";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: unknown; text?: unknown } | null;
  const token = verifyFeedbackToken(typeof body?.token === "string" ? body.token : null);
  if (!token || !FEEDBACK_QUESTIONS[token.q]?.options[token.c]) {
    return NextResponse.json({ error: INVALID }, { status: 400 });
  }

  const admin = createAdminClient();
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";

  // Szabad szöveg: csak a már rögzített válaszhoz, és csak egyszer.
  if (text) {
    const { data, error } = await admin.from("activation_feedback")
      .update({ free_text: text, text_at: new Date().toISOString() })
      .eq("source_email_id", token.e).eq("user_id", token.u).is("free_text", null)
      .select("id");
    if (error) return migrationError(error.message);
    return NextResponse.json({ ok: true, saved: (data ?? []).length > 0 });
  }

  const { data, error } = await admin.from("activation_feedback")
    .upsert(
      { user_id: token.u, question_id: token.q, category: token.c, source_email_id: token.e, user_state: token.s ?? null },
      { onConflict: "source_email_id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) return migrationError(error.message);

  const first = (data ?? []).length > 0;
  if (first) return NextResponse.json({ ok: true, first, hasText: false });

  const { data: existing } = await admin.from("activation_feedback")
    .select("free_text").eq("source_email_id", token.e).maybeSingle();
  return NextResponse.json({ ok: true, first, hasText: !!existing?.free_text });
}

function migrationError(message: string) {
  console.error(`[activation-feedback] ${message} (migráció: ${ACTIVATION_MIGRATION})`);
  return NextResponse.json({ error: "Most nem sikerült rögzíteni. Kérlek, próbáld újra később." }, { status: 500 });
}
