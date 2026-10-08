// /api/work-folders — SAJÁT munka-mappák (Korábbi munkák).
//   GET                      — { folders: WorkFolder[], links: WorkFolderLink[] }
//   POST   { name }          — új mappa
//   PATCH  { id, name }      — átnevezés
//   DELETE { id }            — mappa törlése (a munkák megmaradnak, csak a hivatkozás szűnik meg)
// Írás csak itt, service_role-lal; minden művelet a bejelentkezett felhasználó SAJÁT mappáira szűr.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WORK_FOLDERS_MAX, validateWorkFolderName, type WorkFolder, type WorkFolderLink } from "@/lib/work-folders";

export const runtime = "nodejs";

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

const migrationHint = (msg: string) => (/work_folder/.test(msg) ? "Futtasd le a work-folders.sql migrációt." : msg);

async function listFor(userId: string): Promise<{ folders: WorkFolder[]; links: WorkFolderLink[] }> {
  const admin = createAdminClient();
  const { data: rows, error } = await admin.from("work_folders").select("id, name, created_at")
    .eq("user_id", userId).order("created_at", { ascending: true }).limit(WORK_FOLDERS_MAX);
  if (error) throw new Error(error.message);
  const ids = (rows ?? []).map((r) => r.id as string);
  const { data: items } = ids.length
    ? await admin.from("work_folder_items").select("folder_id, history_id, added_at").in("folder_id", ids)
    : { data: [] as { folder_id: string; history_id: string; added_at: string }[] };

  const count = new Map<string, number>();
  const last = new Map<string, string>();
  for (const it of items ?? []) {
    const f = it.folder_id as string;
    count.set(f, (count.get(f) ?? 0) + 1);
    const at = it.added_at as string;
    if (!last.has(f) || at > (last.get(f) as string)) last.set(f, at);
  }
  return {
    folders: (rows ?? []).map((r) => ({
      id: r.id as string, name: r.name as string, createdAt: r.created_at as string,
      itemCount: count.get(r.id as string) ?? 0, lastAddedAt: last.get(r.id as string) ?? null,
    })),
    links: (items ?? []).map((it) => ({ folderId: it.folder_id as string, historyId: it.history_id as string })),
  };
}

async function ownFolder(id: string, userId: string) {
  const { data } = await createAdminClient().from("work_folders").select("id, user_id").eq("id", id).maybeSingle();
  return data && data.user_id === userId ? data : null;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  try {
    return NextResponse.json(await listFor(user.id));
  } catch (e) {
    return NextResponse.json({ error: migrationHint((e as Error).message), folders: [], links: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  let body: { name?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const { name, error: nameError } = validateWorkFolderName(body.name);
  if (!name) return NextResponse.json({ errors: { name: nameError }, error: nameError }, { status: 422 });

  const admin = createAdminClient();
  const { count } = await admin.from("work_folders").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if ((count ?? 0) >= WORK_FOLDERS_MAX) {
    return NextResponse.json({ error: `Legfeljebb ${WORK_FOLDERS_MAX} saját mappád lehet.` }, { status: 422 });
  }
  const { data, error } = await admin.from("work_folders").insert({ user_id: user.id, name }).select("id").single();
  if (error) return NextResponse.json({ error: migrationHint(error.message) }, { status: 500 });
  return NextResponse.json({ id: data.id, ...(await listFor(user.id)) });
}

export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  let body: { id?: unknown; name?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const { name, error: nameError } = validateWorkFolderName(body.name);
  if (!name) return NextResponse.json({ error: nameError }, { status: 422 });
  if (!(await ownFolder(String(body.id ?? ""), user.id))) return NextResponse.json({ error: "A mappa nem található." }, { status: 404 });

  const { error } = await createAdminClient().from("work_folders").update({ name }).eq("id", String(body.id)).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(await listFor(user.id));
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  let body: { id?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }
  if (!(await ownFolder(String(body.id ?? ""), user.id))) return NextResponse.json({ error: "A mappa nem található." }, { status: 404 });

  // Csak a mappa és a hivatkozások szűnnek meg (cascade) — a munkák és a fájlok megmaradnak.
  const { error } = await createAdminClient().from("work_folders").delete().eq("id", String(body.id)).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(await listFor(user.id));
}
