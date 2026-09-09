// POST /api/ingatlan-lead — az /ingatlan landing jelentkező-űrlapja.
//
// A jelentkezés az `ingatlan_invites` táblába megy (kampány-lista státusszal),
// NEM a közös `leads`-be — így az admin egy helyen látja, ki vár ajándékkódra.
// Kreditet itt SEMMI nem ad: a kód kiadása admin-döntés (/admin/meghivok).
//
// Értesítés: MINDEN admin szerepkörű felhasználó kap e-mailt, hogy ne múljon
// egy emberen. Best-effort — a jelentkezés a levél nélkül is megmarad.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInviteApplicationNotification } from "@/lib/email";
import { adminNotifyEmails } from "@/lib/admin-emails";
import {
  validateIngatlanLead, type IngatlanLeadInput,
} from "@/lib/ingatlan-lead";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const { valid, errors } = validateIngatlanLead(body as Record<string, unknown>);
  if (!valid) return NextResponse.json({ errors }, { status: 422 });

  const lead = body as IngatlanLeadInput;
  const email = lead.email.trim().toLowerCase();
  const admin = createAdminClient();

  // Ugyanaz az e-mail ne szórja tele a listát: ha már van FÜGGŐBEN lévő
  // jelentkezése, nem hozunk létre újat — a partner felé ugyanaz a visszajelzés.
  const { data: existing } = await admin
    .from("ingatlan_invites")
    .select("id, status")
    .eq("email", email)
    .in("status", ["uj", "elfogadva"])
    .maybeSingle();

  if (!existing) {
    const { error: insertError } = await admin.from("ingatlan_invites").insert({
      name: lead.name.trim(),
      email,
      phone: lead.phone.trim(),
      office: lead.office.trim(),
      intent: lead.intent ?? null,
    });
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    try {
      await sendInviteApplicationNotification(
        {
          name: lead.name.trim(), email,
          phone: lead.phone.trim(), office: lead.office.trim(),
        },
        await adminNotifyEmails(admin)
      );
    } catch (err) {
      console.error("[ingatlan-lead] értesítő e-mail hiba:", (err as Error).message);
    }
  }

  return NextResponse.json({ ok: true });
}
