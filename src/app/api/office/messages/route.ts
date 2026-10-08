// /api/office/messages — irodai üzenetek és feladatok a KIVÁLASZTOTT irodában.
//   GET    ?box=inbox|sent|tasks            → { items, unread }   (max 50, a legfrissebb elöl)
//   POST   { kind, recipientId|null, body, dueDate?, moduleHref?, folderId?, historyId?, parentId? }
//   PATCH  { id, action: "read" | "readAll" | "accept" | "done" | "reopen" }
// Szabályok: lib/office-messages.ts (címzett, csatolmány-láthatóság), feladat-állapot itt.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembership } from "@/lib/office-server";
import { getVisibleMessage, listMessages, sendMessage, unreadCount, type Box } from "@/lib/office-messages";
import { validateSend } from "@/lib/office-messages-shared";

export const runtime = "nodejs";

const MIGRATION = "Futtasd le az office-messages.sql migrációt.";

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { err: NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 }) };
  const me = await getMembership(user.id);
  if (!me) return { err: NextResponse.json({ error: "Nem vagy tagja irodának." }, { status: 403 }) };
  return { user, me };
}

export async function GET(request: Request) {
  const c = await ctx();
  if ("err" in c) return c.err;
  const b = new URL(request.url).searchParams.get("box");
  const box: Box = b === "sent" || b === "tasks" ? b : "inbox";
  try {
    const [items, unread] = await Promise.all([
      listMessages(c.me.office_id, c.user.id, box),
      unreadCount(c.me.office_id, c.user.id),
    ]);
    return NextResponse.json({ items, unread });
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json({ error: /office_messages/.test(msg) ? MIGRATION : msg, items: [], unread: 0 }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const c = await ctx();
  if ("err" in c) return c.err;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const v = validateSend(body);
  if (!v.ok) return NextResponse.json({ errors: v.errors }, { status: 422 });

  const res = await sendMessage(c.me.office_id, c.user.id, v.value);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, id: res.id });
}

export async function PATCH(request: Request) {
  const c = await ctx();
  if ("err" in c) return c.err;
  let body: { id?: string; action?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }
  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Minden látható, nekem szóló üzenet olvasottnak jelölése
  if (body.action === "readAll") {
    const items = await listMessages(c.me.office_id, c.user.id, "inbox").catch(() => []);
    const unreadIds = items.filter((m) => !m.read).map((m) => ({ message_id: m.id, user_id: c.user.id }));
    if (unreadIds.length) await admin.from("office_message_reads").upsert(unreadIds, { ignoreDuplicates: true });
    return NextResponse.json({ ok: true });
  }

  const id = String(body.id ?? "");
  const msg = id ? await getVisibleMessage(id, c.me.office_id, c.user.id) : null;
  if (!msg) return NextResponse.json({ error: "Nem található." }, { status: 404 });

  if (body.action === "read") {
    await admin.from("office_message_reads").upsert({ message_id: id, user_id: c.user.id }, { ignoreDuplicates: true });
    return NextResponse.json({ ok: true });
  }

  if (msg.kind !== "task") return NextResponse.json({ error: "Ez nem feladat." }, { status: 400 });
  if (msg.sender_id === c.user.id && body.action !== "reopen") {
    return NextResponse.json({ error: "A saját feladatodat a címzett vállalja el." }, { status: 403 });
  }

  // Elvállalom: csak ha még nyitott, és nekem szól (vagy Mindenkinek) — az első vállaló nyer.
  if (body.action === "accept") {
    const { data } = await admin.from("office_messages")
      .update({ task_status: "accepted", assignee_id: c.user.id, accepted_at: now })
      .eq("id", id).eq("task_status", "open").select("id");
    if (!data?.length) return NextResponse.json({ error: "Ezt a feladatot már valaki elvállalta." }, { status: 409 });
    await admin.from("office_message_reads").upsert({ message_id: id, user_id: c.user.id }, { ignoreDuplicates: true });
    return NextResponse.json({ ok: true });
  }

  // Késznek jelölöm: aki elvállalta (közvetlen feladatnál a címzett vállalás nélkül is).
  if (body.action === "done") {
    const mayFinish = msg.assignee_id === c.user.id || (msg.recipient_id === c.user.id && !msg.assignee_id);
    if (!mayFinish) return NextResponse.json({ error: "Ezt a feladatot más vállalta el." }, { status: 403 });
    const { data } = await admin.from("office_messages")
      .update({ task_status: "done", done_at: now, assignee_id: msg.assignee_id ?? c.user.id, accepted_at: msg.task_status === "open" ? now : undefined })
      .eq("id", id).neq("task_status", "done").select("id");
    if (!data?.length) return NextResponse.json({ error: "Ez a feladat már kész." }, { status: 409 });
    return NextResponse.json({ ok: true });
  }

  // Újranyitás: a feladat küldője (ha mégsem kész).
  if (body.action === "reopen") {
    if (msg.sender_id !== c.user.id) return NextResponse.json({ error: "Csak a feladat kiadója nyithatja újra." }, { status: 403 });
    await admin.from("office_messages").update({ task_status: msg.assignee_id ? "accepted" : "open", done_at: null }).eq("id", id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ismeretlen művelet." }, { status: 400 });
}
