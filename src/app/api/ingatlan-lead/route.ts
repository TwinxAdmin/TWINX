// POST /api/ingatlan-lead — az /ingatlan landing jelentkező-űrlapja.
// A meglévő `leads` táblába ír (nincs séma-változás): telefon + érdeklődés a
// message-be, az iroda a company-ba. E-mail értesítés best-effort (a lead a
// mentés után akkor is megvan, ha a levél nem megy ki).
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendLeadNotification } from "@/lib/email";
import {
  validateIngatlanLead, composeLeadMessage, type IngatlanLeadInput,
} from "@/lib/ingatlan-lead";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const { valid, errors } = validateIngatlanLead(body as Record<string, unknown>);
  if (!valid) return NextResponse.json({ errors }, { status: 422 });

  const lead = body as IngatlanLeadInput;
  const message = composeLeadMessage(lead);

  const admin = createAdminClient();
  const { error: insertError } = await admin.from("leads").insert({
    name: lead.name.trim(),
    email: lead.email.trim(),
    company: lead.office.trim(),
    message,
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  try {
    await sendLeadNotification({
      name: lead.name.trim(),
      email: lead.email.trim(),
      company: lead.office.trim(),
      message,
    });
  } catch (err) {
    console.error("[ingatlan-lead] értesítő e-mail hiba:", (err as Error).message);
  }

  return NextResponse.json({ ok: true });
}
