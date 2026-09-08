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
import {
  validateIngatlanLead, type IngatlanLeadInput,
} from "@/lib/ingatlan-lead";

export const runtime = "nodejs";

/** Az összes admin e-mail címe (profiles.role = 'admin' → auth.users e-mail). */
async function adminEmails(admin: ReturnType<typeof createAdminClient>): Promise<string[]> {
  const { data: profiles } = await admin.from("profiles").select("id").eq("role", "admin");
  const ids = new Set((profiles ?? []).map((p) => p.id as string));
  if (!ids.size) return [];
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  return (list?.users ?? [])
    .filter((u) => ids.has(u.id) && u.email)
    .map((u) => u.email as string);
}

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
      const to = await adminEmails(admin);
      const fallback = process.env.LEADS_NOTIFY_EMAIL;
      await sendInviteApplicationNotification(
        {
          name: lead.name.trim(), email,
          phone: lead.phone.trim(), office: lead.office.trim(),
        },
        to.length ? to : (fallback ? [fallback] : [])
      );
    } catch (err) {
      console.error("[ingatlan-lead] értesítő e-mail hiba:", (err as Error).message);
    }
  }

  return NextResponse.json({ ok: true });
}
