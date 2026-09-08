// POST /api/admin/invites — az ingatlanos jelentkezők elbírálása.
//   action: "accept"  → kódot generál, elmenti, és KIKÜLDI a jelentkezőnek
//   action: "reject"  → elutasítja (kód nélkül)
//   action: "resend"  → a már kiadott kódot újraküldi
//
// Csak 'admin' szerepkör hívhatja. A kiadható kódok száma KEMÉNY LIMIT
// (INVITE_LIMIT): az 50. kiadott kód után a rendszer nem enged többet.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInviteCodeEmail } from "@/lib/email";
import {
  INVITE_LIMIT, INVITE_TOTAL_CREDITS, generateInviteCode, type Invite,
} from "@/lib/invites";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") {
    return NextResponse.json({ error: "Csak admin végezheti." }, { status: 403 });
  }

  let body: { id?: string; action?: string; note?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const id = String(body.id ?? "");
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Hibás azonosító." }, { status: 400 });

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("ingatlan_invites").select("*").eq("id", id).maybeSingle();
  if (!invite) return NextResponse.json({ error: "A jelentkező nem található." }, { status: 404 });
  const row = invite as Invite;

  // --- ELUTASÍTÁS ---
  if (body.action === "reject") {
    const { error } = await admin.from("ingatlan_invites").update({
      status: "elutasitva",
      decided_by: user.id, decided_by_email: user.email ?? null,
      decided_at: new Date().toISOString(),
      admin_note: String(body.note ?? "").trim() || null,
    }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // --- KÓD ÚJRAKÜLDÉSE ---
  if (body.action === "resend") {
    if (!row.code) return NextResponse.json({ error: "Ehhez a jelentkezőhöz még nincs kód." }, { status: 400 });
    try {
      await sendInviteCodeEmail({
        name: row.name, email: row.email, code: row.code, credits: row.credits,
      });
    } catch (e) {
      return NextResponse.json({ error: `A levél nem ment ki: ${(e as Error).message}` }, { status: 502 });
    }
    return NextResponse.json({ ok: true, code: row.code });
  }

  // --- ELFOGADÁS: kód generálása + kiküldés ---
  if (body.action !== "accept") {
    return NextResponse.json({ error: "Ismeretlen művelet." }, { status: 422 });
  }
  if (row.code) {
    return NextResponse.json({ error: "Ehhez a jelentkezőhöz már tartozik kód." }, { status: 409 });
  }

  // KEMÉNY LIMIT: hány kód ment ki eddig?
  const { count } = await admin
    .from("ingatlan_invites")
    .select("id", { count: "exact", head: true })
    .not("code", "is", null);
  if ((count ?? 0) >= INVITE_LIMIT) {
    return NextResponse.json({
      error: `A kampány kerete betelt (${INVITE_LIMIT} kód). Új kódot nem lehet kiadni.`,
    }, { status: 409 });
  }

  // Ütközés esetén (nagyon ritka) néhányszor újrapróbáljuk az egyedi kódot.
  let code = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateInviteCode();
    const { error } = await admin.from("ingatlan_invites").update({
      status: "elfogadva",
      code: candidate,
      credits: INVITE_TOTAL_CREDITS,
      decided_by: user.id, decided_by_email: user.email ?? null,
      decided_at: new Date().toISOString(),
      admin_note: String(body.note ?? "").trim() || null,
    }).eq("id", id).is("code", null);
    if (!error) { code = candidate; break; }
    if (!/duplicate|unique/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  if (!code) return NextResponse.json({ error: "Nem sikerült kódot generálni." }, { status: 500 });

  // A levél kimegy; ha elakad, a kód akkor is megvan → az adminban újraküldhető.
  let mailed = true;
  try {
    await sendInviteCodeEmail({
      name: row.name, email: row.email, code, credits: INVITE_TOTAL_CREDITS,
    });
  } catch (e) {
    mailed = false;
    console.error("[admin/invites] kód-levél hiba:", (e as Error).message);
  }

  return NextResponse.json({ ok: true, code, mailed, issued: (count ?? 0) + 1, limit: INVITE_LIMIT });
}
