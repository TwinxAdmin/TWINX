// POST /api/b2b — B2B ajánlatkérés.
// Sorrend: validáció -> lead mentés (DB, forrás) -> e-mail értesítés (Resend).
// Ha az e-mail hibázik, a lead akkor is mentve marad.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateLeadInput, type LeadInput } from "@/lib/leads";
import { sendLeadNotification } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const { valid, errors } = validateLeadInput(body as Record<string, unknown>);
  if (!valid) {
    return NextResponse.json({ errors }, { status: 422 });
  }
  const lead = body as LeadInput;

  const admin = createAdminClient();

  // 1) Lead mentése (ez a megbízható forrás).
  const { error: insertError } = await admin.from("leads").insert({
    name: lead.name,
    email: lead.email,
    company: lead.company ?? null,
    message: lead.message,
  });
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // 2) E-mail értesítés (best-effort — hiba esetén a lead így is mentve van).
  try {
    await sendLeadNotification(lead);
  } catch (err) {
    console.error("Lead e-mail hiba:", (err as Error).message);
  }

  return NextResponse.json({ ok: true });
}
