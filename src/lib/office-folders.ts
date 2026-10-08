// Irodai mappák — CSAK szerveroldali segédek (service_role kliens).
// Láthatóság: az „everyone" mappát az iroda minden tagja látja; a többit csak a
// létrehozója, a kiválasztott tagok és az iroda létrehozója (aki minden mappát kezelhet).
import { createAdminClient } from "@/lib/supabase/admin";
import type { OfficeFolder } from "@/lib/office";

type FolderRow = { id: string; office_id: string; name: string; created_by: string | null; everyone: boolean; created_at: string };

export async function namesFor(ids: string[]): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return new Map();
  const { data: profiles } = await admin.from("profiles").select("id, full_name").in("id", uniq);
  const out = new Map<string, string>((profiles ?? []).map((p) => [p.id as string, (p.full_name as string) || ""]));
  await Promise.all(uniq.filter((id) => !out.get(id)).map(async (id) => {
    const { data } = await admin.auth.admin.getUserById(id);
    out.set(id, data.user?.email ?? "—");
  }));
  return out;
}

/** Egy mappa + a hozzáférés eldöntése az adott felhasználóra. */
export async function folderAccess(folderId: string, userId: string) {
  const admin = createAdminClient();
  const { data: f } = await admin
    .from("office_folders").select("id, office_id, name, created_by, everyone, created_at").eq("id", folderId).maybeSingle();
  if (!f) return null;
  const { data: m } = await admin
    .from("office_members").select("role").eq("user_id", userId).eq("office_id", f.office_id).maybeSingle();
  if (!m) return null; // nem tagja az irodának
  const isOfficeOwner = m.role === "owner";
  const isCreator = f.created_by === userId;
  let isMember = false;
  if (!f.everyone && !isOfficeOwner && !isCreator) {
    const { data: fm } = await admin
      .from("office_folder_members").select("user_id").eq("folder_id", folderId).eq("user_id", userId).maybeSingle();
    isMember = !!fm;
  }
  const canView = f.everyone || isOfficeOwner || isCreator || isMember;
  return { folder: f as FolderRow, canView, canManage: isOfficeOwner || isCreator, isOfficeOwner };
}

/** Az irodában a felhasználó által látható mappák. */
export async function listFolders(officeId: string, userId: string, isOfficeOwner: boolean): Promise<OfficeFolder[]> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("office_folders").select("id, office_id, name, created_by, everyone, created_at")
    .eq("office_id", officeId).order("created_at", { ascending: false });
  const folders = (rows ?? []) as FolderRow[];
  if (folders.length === 0) return [];

  const ids = folders.map((f) => f.id);
  const [{ data: fm }, { data: items }] = await Promise.all([
    admin.from("office_folder_members").select("folder_id, user_id").in("folder_id", ids),
    admin.from("office_folder_items").select("folder_id").in("folder_id", ids),
  ]);
  const membersOf = new Map<string, string[]>();
  for (const r of fm ?? []) membersOf.set(r.folder_id as string, [...(membersOf.get(r.folder_id as string) ?? []), r.user_id as string]);
  const counts = new Map<string, number>();
  for (const r of items ?? []) counts.set(r.folder_id as string, (counts.get(r.folder_id as string) ?? 0) + 1);

  const visible = folders.filter((f) =>
    f.everyone || isOfficeOwner || f.created_by === userId || (membersOf.get(f.id) ?? []).includes(userId)
  );
  const names = await namesFor(visible.map((f) => f.created_by ?? ""));

  return visible.map((f) => ({
    id: f.id,
    name: f.name,
    everyone: f.everyone,
    memberIds: membersOf.get(f.id) ?? [],
    createdBy: f.created_by,
    createdByName: names.get(f.created_by ?? "") ?? "—",
    itemCount: counts.get(f.id) ?? 0,
    canManage: isOfficeOwner || f.created_by === userId,
    createdAt: f.created_at,
  }));
}
