// POST /api/ingatlan-consultation — ingyenes bemutató / konzultáció kérése az
// /ingatlan landing felugró ablakából.
//
// 1) Validáció  2) mentés a közös `leads` táblába (megbízható forrás)
// 3) e-mail MINDEN adminnak (best-effort — a kérés a levél nélkül is megmarad).
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminNotifyEmails } from "@/lib/admin-emails";
import { sendConsultationNotification } from "@/lib/email";
import {
  validateConsultation, composeConsultationMessage, type ConsultationInput,
} from "@/lib/consultation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const { valid, errors } = validateConsultation(body as Record<string, unknown>);
  if (!valid) return NextResponse.json({ errors }, { status: 422 });

  const req = body as ConsultationInput;
  const clean: ConsultationInput = {
    name: req.name.trim(),
    email: req.email.trim().toLowerCase(),
    phone: req.phone.trim(),
    office: req.office?.trim() || undefined,
    preferred: req.preferred?.trim() || undefined,
    note: req.note?.trim() || undefined,
  };

  const admin = createAdminClient();
  const { error: insertError } = await admin.from("leads").insert({
    name: clean.name,
    email: clean.email,
    company: clean.office ?? null,
    message: composeConsultationMessage(clean),
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  try {
    await sendConsultationNotification(clean, await adminNotifyEmails(admin));
  } catch (err) {
    console.error("[ingatlan-consultation] értesítő e-mail hiba:", (err as Error).message);
  }

  return NextResponse.json({ ok: true });
}
