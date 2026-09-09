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

  // Az értesítő levél best-effort: ha nem megy ki, a kérés akkor is mentve van,
  // és az admin a Megkeresések oldalon látja. A `mailed` mezőt visszaadjuk, hogy
  // a hiba ne maradjon néma — a szerver naplójában a pontos ok is megjelenik.
  let mailed = false;
  try {
    const to = await adminNotifyEmails(admin);
    if (!to.length) {
      console.error("[ingatlan-consultation] nincs értesítendő admin e-mail cím (profiles.role='admin' és LEADS_NOTIFY_EMAIL is üres).");
    } else {
      await sendConsultationNotification(clean, to);
      mailed = true;
      console.log(`[ingatlan-consultation] értesítő kiment (${to.length} címre).`);
    }
  } catch (err) {
    console.error("[ingatlan-consultation] értesítő e-mail HIBA:", (err as Error).message);
  }

  return NextResponse.json({ ok: true, mailed });
}
