// /api/work-folders/items — munka be- és kivétele egy SAJÁT mappából.
//   POST   { folderId, historyId } — csak a saját munkádat, a saját mappádba
//   DELETE { folderId, historyId } — kivétel (a munka megmarad)
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function check(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 }) };
  let body: { folderId?: unknown; historyId?: unknown };
  try { body = await request.json(); } catch { return { error: NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }) }; }
  const folderId = String(body.folderId ?? "");
  const historyId = String(body.historyId ?? "");

  const admin = createAdminClient();
  const [{ data: f }, { data: h }] = await Promise.all([
    admin.from("work_folders").select("user_id").eq("id", folderId).maybeSingle(),
    admin.from("usage_history").select("user_id").eq("id", historyId).maybeSingle(),
  ]);
  if (!f || f.user_id !== user.id) return { error: NextResponse.json({ error: "A mappa nem található." }, { status: 404 }) };
  if (!h || h.user_id !== user.id) return { error: NextResponse.json({ error: "Csak a saját munkádat teheted a mappádba." }, { status: 403 }) };
  return { folderId, historyId };
}

export async function POST(request: Request) {
  const r = await check(request);
  if ("error" in r) return r.error;
  const { error } = await createAdminClient().from("work_folder_items")
    .upsert({ folder_id: r.folderId, history_id: r.historyId }, { onConflict: "folder_id,history_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: /work_folder/.test(error.message) ? "Futtasd le a work-folders.sql migrációt." : error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const r = await check(request);
  if ("error" in r) return r.error;
  const { error } = await createAdminClient().from("work_folder_items").delete().eq("folder_id", r.folderId).eq("history_id", r.historyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
