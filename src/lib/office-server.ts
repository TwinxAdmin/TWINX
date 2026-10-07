// Irodai fiók — CSAK szerveroldali segédek (service_role kliens).
import { createAdminClient } from "@/lib/supabase/admin";
import type { MyOffice } from "@/lib/office";

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
