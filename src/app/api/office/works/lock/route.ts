// /api/office/works/lock — „épp szerkeszti" zár egy munkán.
//   POST   { historyId } — zár megszerzése / frissítése (2 percenként hívja a szerkesztő)
//   DELETE { historyId } — zár elengedése (bezáráskor)
// Ha más tartja és 10 percen belül frissítette: 409 + a szerkesztő neve.
// Ha a work-edit SQL még nincs lefuttatva, a zár nem akadályozza a munkát (ok: true, disabled).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canEditWork, LOCK_TTL_MS, namesFor } from "@/lib/office-folders";

export const runtime = "nodejs";

async function body(request: Request): Promise<string> {
  try { return String((await request.json()).historyId ?? ""); } catch { return ""; }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const historyId = await body(request);
  if (!historyId) return NextResponse.json({ error: "Hiányzó azonosító." }, { status: 400 });

  const edit = await canEditWork(historyId, user.id);
  if (!edit.ok) return NextResponse.json({ error: "Ezt a munkát nem szerkesztheted." }, { status: 403 });

  const admin = createAdminClient();
  const { data: lock, error } = await admin.from("work_locks").select("user_id, locked_at").eq("history_id", historyId).maybeSingle();
  if (error) return NextResponse.json({ ok: true, disabled: true }); // SQL még nincs: zár nélkül
  if (lock && lock.user_id !== user.id && Date.now() - new Date(lock.locked_at as string).getTime() < LOCK_TTL_MS) {
    const names = await namesFor([lock.user_id as string]);
    return NextResponse.json({ error: `${names.get(lock.user_id as string) ?? "Egy kolléga"} épp szerkeszti ezt a munkát.`, lockedBy: names.get(lock.user_id as string) }, { status: 409 });
  }
  await admin.from("work_locks").upsert({ history_id: historyId, user_id: user.id, locked_at: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const historyId = await body(request);
  if (historyId) await createAdminClient().from("work_locks").delete().eq("history_id", historyId).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
