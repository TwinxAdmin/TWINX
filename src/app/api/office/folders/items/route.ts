// /api/office/folders/items — munkák egy irodai mappában (hivatkozások a usage_history-ra).
//   GET    ?folderId=…                 — a mappa tartalma (csak aki látja a mappát)
//   GET    ?historyId=…                — mely (általam látható) közös mappákban van ez a munka → { folderIds }
//   POST   { folderId, historyId }      — saját munka berakása („Megosztás az irodával")
//   PATCH  { folderId, historyId, title } — átnevezés (ugyanaz a jog, mint a kivételnél)
//   DELETE { folderId, historyId }      — kivétel (aki berakta, a munka készítője, a mappa vagy az iroda létrehozója)
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { activityTitle, featureLabel } from "@/lib/activity";
import { WORK_TITLE_MAX, type OfficeFolderItem } from "@/lib/office";
import { folderAccess, namesFor } from "@/lib/office-folders";

export const runtime = "nodejs";

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const params = new URL(request.url).searchParams;

  // Melyik közös mappákban van egy adott munka? (a „Mappába teszem" választó pipáihoz)
  const historyId = params.get("historyId");
  if (historyId) {
    const { data: rows } = await createAdminClient().from("office_folder_items").select("folder_id").eq("history_id", historyId);
    const folderIds: string[] = [];
    for (const r of rows ?? []) {
      const a = await folderAccess(r.folder_id as string, user.id);
      if (a?.canView) folderIds.push(r.folder_id as string);
    }
    return NextResponse.json({ folderIds });
  }

  const folderId = params.get("folderId") ?? "";
  const acc = await folderAccess(folderId, user.id);
  if (!acc || !acc.canView) return NextResponse.json({ error: "A mappa nem található." }, { status: 404 });

  const admin = createAdminClient();
  const { data: links } = await admin
    .from("office_folder_items").select("history_id, added_by, added_at")
    .eq("folder_id", folderId).order("added_at", { ascending: false }).limit(300);
  const ids = (links ?? []).map((l) => l.history_id as string);
  if (ids.length === 0) return NextResponse.json({ folder: { id: acc.folder.id, name: acc.folder.name }, items: [] });

  const { data: rows } = await admin
    .from("usage_history").select("id, user_id, feature_used, input_data, output_file_url, created_at").in("id", ids);
  const byId = new Map((rows ?? []).map((r) => [r.id as string, r]));
  const names = await namesFor([...(rows ?? []).map((r) => r.user_id as string), ...(links ?? []).map((l) => (l.added_by as string) ?? "")]);

  const items: OfficeFolderItem[] = (links ?? []).flatMap((l) => {
    const h = byId.get(l.history_id as string);
    if (!h) return [];
    return [{
      historyId: h.id as string,
      title: activityTitle(h.feature_used as string, h.input_data as Record<string, unknown> | null, h.created_at as string),
      typeLabel: featureLabel(h.feature_used as string),
      feature: h.feature_used as string,
      url: (h.output_file_url as string) ?? null,
      ownerName: names.get(h.user_id as string) ?? "—",
      addedByName: names.get((l.added_by as string) ?? "") ?? "—",
      addedAt: l.added_at as string,
      createdAt: h.created_at as string,
      canRemove: acc.canManage || l.added_by === user.id || h.user_id === user.id,
      mine: h.user_id === user.id,
    }];
  });
  return NextResponse.json({ folder: { id: acc.folder.id, name: acc.folder.name }, items });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  let body: { folderId?: string; historyId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const acc = await folderAccess(String(body.folderId ?? ""), user.id);
  if (!acc || !acc.canView) return NextResponse.json({ error: "A mappa nem található." }, { status: 404 });

  const admin = createAdminClient();
  // Csak a SAJÁT munkát lehet megosztani (privátot és irodait is).
  const { data: h } = await admin
    .from("usage_history").select("id, user_id").eq("id", String(body.historyId ?? "")).maybeSingle();
  if (!h || h.user_id !== user.id) return NextResponse.json({ error: "Csak a saját munkádat oszthatod meg." }, { status: 403 });

  const { error } = await admin.from("office_folder_items")
    .upsert({ folder_id: acc.folder.id, history_id: h.id, added_by: user.id }, { onConflict: "folder_id,history_id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  let body: { folderId?: string; historyId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const acc = await folderAccess(String(body.folderId ?? ""), user.id);
  if (!acc || !acc.canView) return NextResponse.json({ error: "A mappa nem található." }, { status: 404 });

  const admin = createAdminClient();
  const historyId = String(body.historyId ?? "");
  const [{ data: link }, { data: h }] = await Promise.all([
    admin.from("office_folder_items").select("added_by").eq("folder_id", acc.folder.id).eq("history_id", historyId).maybeSingle(),
    admin.from("usage_history").select("user_id").eq("id", historyId).maybeSingle(),
  ]);
  if (!link) return NextResponse.json({ error: "Ez a munka nincs a mappában." }, { status: 404 });
  if (!(acc.canManage || link.added_by === user.id || h?.user_id === user.id)) {
    return NextResponse.json({ error: "Ezt a munkát nem veheted ki a mappából." }, { status: 403 });
  }
  const { error } = await admin.from("office_folder_items").delete().eq("folder_id", acc.folder.id).eq("history_id", historyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  let body: { folderId?: string; historyId?: string; title?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const title = typeof body.title === "string" ? body.title.replace(/\s+/g, " ").trim() : "";
  if (!title) return NextResponse.json({ error: "Adj meg egy nevet." }, { status: 422 });
  if (title.length > WORK_TITLE_MAX) return NextResponse.json({ error: `Legfeljebb ${WORK_TITLE_MAX} karakter lehet.` }, { status: 422 });

  const acc = await folderAccess(String(body.folderId ?? ""), user.id);
  if (!acc || !acc.canView) return NextResponse.json({ error: "A mappa nem található." }, { status: 404 });

  const admin = createAdminClient();
  const historyId = String(body.historyId ?? "");
  const [{ data: link }, { data: h }] = await Promise.all([
    admin.from("office_folder_items").select("added_by").eq("folder_id", acc.folder.id).eq("history_id", historyId).maybeSingle(),
    admin.from("usage_history").select("user_id, input_data").eq("id", historyId).maybeSingle(),
  ]);
  if (!link || !h) return NextResponse.json({ error: "Ez a munka nincs a mappában." }, { status: 404 });
  if (!(acc.canManage || link.added_by === user.id || h.user_id === user.id)) {
    return NextResponse.json({ error: "Ezt a munkát nem nevezheted át." }, { status: 403 });
  }
  const input = { ...((h.input_data as Record<string, unknown> | null) ?? {}), custom_title: title };
  const { error } = await admin.from("usage_history").update({ input_data: input }).eq("id", historyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, title });
}
