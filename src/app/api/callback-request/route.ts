// POST /api/callback-request — időpont-kérés az ingyenes felméréshez (D73, 8. lépés kiegészítés).
// Sorrend: validáció → mentés a leads táblába (admin „Kérések és üzenetek") → e-mail értesítés a csapatnak.
// A foglalási rendszert (bookings) nem érinti; séma-változás nincs. Az e-mail hibája nem veszít el kérést.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendLeadNotification } from "@/lib/email";
import { callbackMessage, callbackSummary, validateCallback } from "@/lib/callback-request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  // Rejtett „csali" mező: ember nem tölti ki, a robot igen → csendben elfogadjuk, de nem mentjük.
  if (typeof body.website === "string" && body.website.trim()) return NextResponse.json({ ok: true });

  const { valid, errors, value } = validateCallback(body);
  if (!valid) return NextResponse.json({ errors }, { status: 422 });

  const message = callbackMessage(value);
  const admin = createAdminClient();
  let { error } = await admin.from("leads").insert({
    name: value.name, email: value.email, company: value.company || null, phone: value.phone, message,
    callback_time: callbackSummary(value),
  });
  // régi séma (nincs phone / callback_time oszlop): a telefon az üzenet végére kerül, a napok már az üzenetben vannak
  if (error && /phone|column/i.test(error.message)) {
    ({ error } = await admin.from("leads").insert({
      name: value.name, email: value.email, company: value.company || null, message: `${message}\n\nTelefon: ${value.phone}`,
    }));
  }
  if (error) return NextResponse.json({ error: "Most nem sikerült elküldeni. Próbáld újra, vagy írj e-mailt: office@twinx.hu." }, { status: 500 });

  try {
    await sendLeadNotification({ name: value.name, email: value.email, company: value.company || undefined, phone: value.phone, message }, "callback");
  } catch (e) {
    console.error("Időpont-kérés e-mail hiba:", (e as Error).message);
  }
  return NextResponse.json({ ok: true });
}
