// Az összes admin szerepkörű felhasználó e-mail címe (profiles.role = 'admin'
// → auth.users e-mail). Értesítésekhez, hogy a döntés ne múljon egy emberen.
// Ha nincs admin, a LEADS_NOTIFY_EMAIL-re esik vissza.
import type { createAdminClient } from "@/lib/supabase/admin";

export async function adminNotifyEmails(
  admin: ReturnType<typeof createAdminClient>
): Promise<string[]> {
  const { data: profiles } = await admin.from("profiles").select("id").eq("role", "admin");
  const ids = new Set((profiles ?? []).map((p) => p.id as string));
  let out: string[] = [];
  if (ids.size) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    out = (list?.users ?? [])
      .filter((u) => ids.has(u.id) && u.email)
      .map((u) => u.email as string);
  }
  if (!out.length && process.env.LEADS_NOTIFY_EMAIL) out = [process.env.LEADS_NOTIFY_EMAIL];
  return out;
}
