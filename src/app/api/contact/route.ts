// POST /api/contact — üzenet a twinx.hu/kapcsolat oldalról.
// Sorrend: validáció → mentés a leads táblába (az admin „Kérések és üzenetek" listájában jelenik meg) → e-mail értesítés.
// Az e-mail hibája nem veszít el üzenetet (a mentés a megbízható forrás). Nincs séma-változás: a téma az üzenet elejére kerül.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateContact } from "@/lib/contact";
import { sendLeadNotification } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  // Rejtett „csali" mező: ember nem tölti ki, a robot igen → csendben elfogadjuk, de nem mentjük.
  if (typeof body.website === "string" && body.website.trim()) return NextResponse.json({ ok: true });

  const { valid, errors, value } = validateContact(body);
  if (!valid) return NextResponse.json({ errors }, { status: 422 });

  const message = `[Kapcsolat oldal] Téma: ${value.topic}\n\n${value.message}`;
  const admin = createAdminClient();
  let { error } = await admin.from("leads").insert({
    name: value.name, email: value.email, company: null, phone: value.phone || null, message,
  });
  // régi séma (nincs phone oszlop): a telefon az üzenet végére kerül
  if (error && /phone|column/i.test(error.message)) {
    ({ error } = await admin.from("leads").insert({
      name: value.name, email: value.email, company: null,
      message: value.phone ? `${message}\n\nTelefon: ${value.phone}` : message,
    }));
  }
  if (error) return NextResponse.json({ error: "Nem sikerült elküldeni — próbáld újra, vagy írj e-mailt." }, { status: 500 });

  try {
    await sendLeadNotification({ name: value.name, email: value.email, phone: value.phone || "-", message }, "contact");
  } catch (e) {
    console.error("Kapcsolat e-mail hiba:", (e as Error).message);
  }
  return NextResponse.json({ ok: true });
}
