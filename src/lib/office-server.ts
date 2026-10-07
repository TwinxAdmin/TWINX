// Irodai fiók — CSAK szerveroldali segédek (service_role kliens).
import { createAdminClient } from "@/lib/supabase/admin";
import type { MyOffice, OfficeMember } from "@/lib/office";

/** A felhasználó irodájának nézete — szerveroldalon állítjuk össze, hogy a tag ne kapja meg az egyenleget. */
export async function loadMyOffice(userId: string): Promise<MyOffice | null> {
  const admin = createAdminClient();
  const { data: m } = await admin
    .from("office_members")
    .select("office_id, role, allowance, unlimited, can_allocate")
    .eq("user_id", userId)
    .maybeSingle();
  if (!m) return null;

  const { data: o } = await admin
    .from("offices").select("id, name, balance, join_code").eq("id", m.office_id).single();
  if (!o) return null;

  const isOwner = m.role === "owner";
  const base: MyOffice = {
    id: o.id as string,
    name: o.name as string,
    role: isOwner ? "owner" : "member",
    allowance: (m.allowance as number) ?? 0,
    unlimited: !!m.unlimited,
    canAllocate: !!m.can_allocate,
  };
  if (!isOwner) return base;

  const { count } = await admin
    .from("office_members").select("user_id", { count: "exact", head: true }).eq("office_id", o.id);
  return { ...base, joinCode: o.join_code as string, balance: (o.balance as number) ?? 0, memberCount: count ?? 1 };
}

/** A felhasználó tagsági sora (vagy null). */
export async function getMembership(userId: string) {
  const { data } = await createAdminClient()
    .from("office_members")
    .select("office_id, user_id, role, allowance, unlimited, can_allocate")
    .eq("user_id", userId)
    .maybeSingle();
  return data as
    | { office_id: string; user_id: string; role: "owner" | "member"; allowance: number; unlimited: boolean; can_allocate: boolean }
    | null;
}

/** Az iroda taglistája névvel és e-maillel (a létrehozó és a kiosztók nézetéhez). */
export async function listMembers(officeId: string): Promise<OfficeMember[]> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("office_members")
    .select("user_id, role, allowance, unlimited, can_allocate, joined_at, joined_via")
    .eq("office_id", officeId)
    .order("joined_at", { ascending: true });
  const list = rows ?? [];
  if (list.length === 0) return [];

  const ids = list.map((r) => r.user_id as string);
  const { data: profiles } = await admin.from("profiles").select("id, full_name").in("id", ids);
  const names = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string) || ""]));
  const emails = await Promise.all(
    ids.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      return [id, data.user?.email ?? ""] as const;
    })
  );
  const emailMap = new Map(emails);

  return list.map((r) => ({
    userId: r.user_id as string,
    name: names.get(r.user_id as string) || "",
    email: emailMap.get(r.user_id as string) || "",
    role: r.role as "owner" | "member",
    allowance: (r.allowance as number) ?? 0,
    unlimited: !!r.unlimited,
    canAllocate: !!r.can_allocate,
    joinedAt: r.joined_at as string,
  }));
}
