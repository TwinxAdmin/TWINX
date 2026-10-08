// /api/office/folders — közös irodai mappák.
//   GET    — a számomra látható mappák + az iroda taglistája (név) a tagválasztóhoz
//   POST   { name, everyone, memberIds[] }        — új mappa (bármely tag)
//   PATCH  { id, name?, everyone?, memberIds? }   — módosítás (mappa létrehozója / iroda létrehozója)
//   DELETE { id }                                  — törlés: csak a mappa és a hivatkozások szűnnek meg, a munkák maradnak
import { NextResponse } from "next/server";
import { officeNonePreview } from "@/lib/view-as";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateFolderName } from "@/lib/office";
import { getMembership, listMembers } from "@/lib/office-server";
import { folderAccess, listFolders } from "@/lib/office-folders";

export const runtime = "nodejs";

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 }) };
  const m = await getMembership(user.id);
  if (!m) return { error: NextResponse.json({ error: "Nem vagy tagja irodának." }, { status: 403 }) };
  return { user, m };
}

/** A kiválasztott tagok közül csak az irodához tartozók maradhatnak. */
async function cleanMemberIds(officeId: string, raw: unknown, exclude: string): Promise<string[]> {
  if (!Array.isArray(raw)) return [];
  const { data } = await createAdminClient().from("office_members").select("user_id").eq("office_id", officeId);
  const allowed = new Set((data ?? []).map((r) => r.user_id as string));
  return [...new Set(raw.map(String))].filter((id) => allowed.has(id) && id !== exclude);
}

export async function GET() {
  const r = await me();
  if ("error" in r) return r.error;
  const { user, m } = r;
  // „Nincs iroda" előnézetben a közös mappák sem látszanak (csak megjelenítés)
  if ((m.role === "owner" || m.can_allocate) && (await officeNonePreview())) {
    return NextResponse.json({ folders: [], members: [], meId: user.id, nonePreview: true });
  }
  try {
    const [folders, members] = await Promise.all([
      listFolders(m.office_id, user.id, m.role === "owner"),
      listMembers(m.office_id),
    ]);
    return NextResponse.json({
      folders,
      members: members.map((x) => ({ userId: x.userId, name: x.name || x.email })),
      meId: user.id,
    });
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json({ error: /office_folder/.test(msg) ? "Futtasd le az office-folders.sql migrációt." : msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const r = await me();
  if ("error" in r) return r.error;
  const { user, m } = r;
  let body: { name?: unknown; everyone?: unknown; memberIds?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const { name, error: nameError } = validateFolderName(body.name);
  if (!name) return NextResponse.json({ errors: { name: nameError } }, { status: 422 });
  const everyone = body.everyone === true;
  const memberIds = everyone ? [] : await cleanMemberIds(m.office_id, body.memberIds, user.id);

  const admin = createAdminClient();
  const { data: folder, error } = await admin
    .from("office_folders").insert({ office_id: m.office_id, name, created_by: user.id, everyone })
    .select("id").single();
  if (error) {
    return NextResponse.json({ error: /office_folders/.test(error.message) ? "Futtasd le az office-folders.sql migrációt." : error.message }, { status: 500 });
  }
  if (memberIds.length) {
    await admin.from("office_folder_members").insert(memberIds.map((uid) => ({ folder_id: folder.id, user_id: uid })));
  }
  return NextResponse.json({ ok: true, folders: await listFolders(m.office_id, user.id, m.role === "owner") });
}

export async function PATCH(request: Request) {
  const r = await me();
  if ("error" in r) return r.error;
  const { user, m } = r;
  let body: { id?: string; name?: unknown; everyone?: unknown; memberIds?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const acc = await folderAccess(String(body.id ?? ""), user.id);
  if (!acc || !acc.canView) return NextResponse.json({ error: "A mappa nem található." }, { status: 404 });
  if (!acc.canManage) return NextResponse.json({ error: "A mappát a létrehozója vagy az irodai fiók létrehozója módosíthatja." }, { status: 403 });

  const admin = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const { name, error } = validateFolderName(body.name);
    if (!name) return NextResponse.json({ errors: { name: error } }, { status: 422 });
    patch.name = name;
  }
  if (typeof body.everyone === "boolean") patch.everyone = body.everyone;
  if (Object.keys(patch).length) {
    const { error } = await admin.from("office_folders").update(patch).eq("id", acc.folder.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (body.memberIds !== undefined) {
    const ids = await cleanMemberIds(m.office_id, body.memberIds, acc.folder.created_by ?? "");
    await admin.from("office_folder_members").delete().eq("folder_id", acc.folder.id);
    if (ids.length) await admin.from("office_folder_members").insert(ids.map((uid) => ({ folder_id: acc.folder.id, user_id: uid })));
  }
  return NextResponse.json({ ok: true, folders: await listFolders(m.office_id, user.id, m.role === "owner") });
}

export async function DELETE(request: Request) {
  const r = await me();
  if ("error" in r) return r.error;
  const { user, m } = r;
  let body: { id?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const acc = await folderAccess(String(body.id ?? ""), user.id);
  if (!acc || !acc.canView) return NextResponse.json({ error: "A mappa nem található." }, { status: 404 });
  if (!acc.canManage) return NextResponse.json({ error: "Mappát a létrehozója vagy az irodai fiók létrehozója törölhet." }, { status: 403 });

  // Csak a mappa és a benne lévő HIVATKOZÁSOK szűnnek meg — a munkák a készítőiknél maradnak.
  const { error } = await createAdminClient().from("office_folders").delete().eq("id", acc.folder.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, folders: await listFolders(m.office_id, user.id, m.role === "owner") });
}
