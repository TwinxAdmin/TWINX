// POST /api/admin/invites — az ingatlanos jelentkezők elbírálása.
//
// A folyamat SZÁNDÉKOSAN kétlépcsős, hogy egy kolléga átnézhesse a levelet,
// mielőtt kimegy a partnernek:
//   1) action: "accept"  → kódot generál és elmenti. LEVÉL MÉG NEM MEGY KI.
//   2) action: "preview" → visszaadja a KÉSZ levelet (tárgy + HTML) az adott
//                          jelentkező nevével és címével — csak megjelenítésre.
//   3) action: "send"    → kiküldi ugyanezt a levelet a jelentkező címére,
//                          és naplózza (code_sent_at, code_sent_by_email).
//   ("resend" a "send" régi neve, ugyanazt csinálja.)
//   action: "reject"     → elutasítás kód nélkül.
//
// Admin ÉS sales hívhatja — több kolléga tud párhuzamosan jóváhagyni, így nem
// torlódik a kampány. A kiadható kódok száma KEMÉNY LIMIT (INVITE_LIMIT): az
// 50. kiadott kód után a rendszer senkinek nem enged többet, és a döntés
// naplózva van (decided_by_email), tehát utólag látszik, ki hagyta jóvá.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInviteCodeEmail, renderInviteCodeEmail } from "@/lib/email";
import { getStaffRole } from "@/lib/staff";
import {
  INVITE_LIMIT, INVITE_TOTAL_CREDITS, generateInviteCode, type Invite,
} from "@/lib/invites";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createClient();
  const staff = await getStaffRole(supabase);
  if (!staff) {
    return NextResponse.json({ error: "Csak admin vagy értékesítő végezheti." }, { status: 403 });
  }
  const user = { id: staff.userId, email: staff.email };

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

  // --- ELŐNÉZET: pontosan az a levél, ami ki fog menni ---
  if (body.action === "preview") {
    if (!row.code) {
      return NextResponse.json({ error: "Előbb fogadd el a jelentkezést — akkor lesz kód." }, { status: 400 });
    }
    const mail = renderInviteCodeEmail({
      name: row.name, code: row.code, credits: row.credits || INVITE_TOTAL_CREDITS,
    });
    return NextResponse.json({
      ok: true,
      to: row.email,
      toName: row.name,
      from: mail.from,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      code: row.code,
      sentAt: row.code_sent_at ?? null,
      sentBy: row.code_sent_by_email ?? null,
    });
  }

  // --- KÉZI KIKÜLDÉS MEGJELÖLÉSE ---
  // Amíg a saját domain hitelesítése nincs kész, a levelet a kolléga a saját
  // (office@) postafiókjából küldi ki. Ilyenkor a rendszer nem küld semmit,
  // csak rögzíti, hogy a kód eljutott a jelentkezőhöz — így a többi munkatárs
  // sem fogja elintézetlen feladatként látni.
  if (body.action === "mark-sent") {
    if (!row.code) {
      return NextResponse.json({ error: "Ehhez a jelentkezőhöz még nincs kód." }, { status: 400 });
    }
    if (row.code_sent_at) {
      return NextResponse.json({
        error: `Ez a kód már ki van küldve (${row.code_sent_by_email ?? "munkatárs"}).`,
        alreadySent: true,
      }, { status: 409 });
    }
    const { error } = await admin.from("ingatlan_invites").update({
      code_sent_at: new Date().toISOString(),
      code_sent_by_email: `${user.email ?? "munkatárs"} (kézi küldés)`,
    }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, manual: true });
  }

  // --- KIKÜLDÉS (és újraküldés) ---
  if (body.action === "send" || body.action === "resend") {
    if (!row.code) {
      return NextResponse.json({ error: "Ehhez a jelentkezőhöz még nincs kód." }, { status: 400 });
    }
    // KÖZÖS MUNKA VÉDELME: ha közben egy másik kolléga már kiküldte, ne menjen
    // ki mégegyszer véletlenül. Tudatos újraküldéshez az "resend" művelet való.
    if (body.action === "send" && row.code_sent_at) {
      return NextResponse.json({
        error: `Ezt a kódot már kiküldte ${row.code_sent_by_email ?? "egy munkatárs"} (${new Date(row.code_sent_at).toLocaleString("hu-HU")}). Frissítsd a listát.`,
        alreadySent: true,
      }, { status: 409 });
    }
    try {
      await sendInviteCodeEmail({
        name: row.name, email: row.email, code: row.code,
        credits: row.credits || INVITE_TOTAL_CREDITS,
      });
    } catch (e) {
      return NextResponse.json({ error: `A levél nem ment ki: ${(e as Error).message}` }, { status: 502 });
    }
    // A naplózás nem buktathatja el a küldést: a levél már kiment.
    await admin.from("ingatlan_invites").update({
      code_sent_at: new Date().toISOString(),
      code_sent_by_email: user.email ?? null,
    }).eq("id", id);
    return NextResponse.json({ ok: true, code: row.code, to: row.email });
  }

  // --- ELFOGADÁS: CSAK kódgenerálás, levél nélkül ---
  if (body.action !== "accept") {
    return NextResponse.json({ error: "Ismeretlen művelet." }, { status: 422 });
  }
  if (row.code) {
    return NextResponse.json({ error: "Ehhez a jelentkezőhöz már tartozik kód." }, { status: 409 });
  }

  // KEMÉNY LIMIT: hány kód ment eddig ki?
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

  // A levél NEM megy ki automatikusan — a kolléga előbb átnézi az előnézetben.
  return NextResponse.json({ ok: true, code, issued: (count ?? 0) + 1, limit: INVITE_LIMIT });
}
