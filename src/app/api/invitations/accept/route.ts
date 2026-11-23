// POST /api/invitations/accept { token } — meghívó elfogadása (terv 13 / 4., terv 22 / 4. B).
// Csak a belépett, MEGERŐSÍTETT, a meghívottal egyező e-mail című felhasználó fogadhatja el; a DB-függvény egy
// tranzakcióban hozza létre a cég-tagságot és a modul-hozzáférést. A felhasználó azonosítója a munkamenetből jön.
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { INVITE_TEXT } from "@/lib/invite-texts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Előbb lépj be." }, { status: 401 });
  let body: { token?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: INVITE_TEXT.invalid }, { status: 400 }); }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (token.length < 20 || token.length > 100) return NextResponse.json({ error: INVITE_TEXT.invalid }, { status: 400 });

  const { data, error } = await createAdminClient().rpc("accept_invitation", {
    p_user: user.id, p_token_hash: createHash("sha256").update(token).digest("hex"),
  });
  if (error) return NextResponse.json({ error: "Most nem sikerült. Próbáld újra később." }, { status: 500 });
  const r = data as { ok: boolean; error?: string };
  if (!r.ok) {
    const msg = r.error === "mas_email" ? INVITE_TEXT.otherEmail
      : r.error === "nem_megerositett" ? INVITE_TEXT.unconfirmed
      : r.error === "modul_nem_aktiv" ? INVITE_TEXT.notActive : INVITE_TEXT.invalid;
    return NextResponse.json({ error: msg, code: r.error }, { status: 422 });
  }
  return NextResponse.json({ ok: true });
}
