// /admin/credits — Admin kézi kredit-adás egy felhasználónak (CSAK admin).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminCreditForm, { type CreditUser } from "@/components/AdminCreditForm";
import AdminShell from "@/components/admin/AdminShell";

export const runtime = "nodejs";

export default async function AdminCreditsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin") redirect("/dashboard");

  // Felhasználók listája a legördülőhöz (e-mail + szerepkör).
  const admin = createAdminClient();
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const { data: profs } = await admin.from("profiles").select("id, role");
  const roleById = new Map<string, string>((profs ?? []).map((p) => [p.id as string, (p.role as string) ?? "user"]));
  const users: CreditUser[] = (list?.users ?? [])
    .filter((u) => u.email)
    .map((u) => ({ id: u.id, email: u.email as string, role: roleById.get(u.id) ?? "user" }))
    .sort((a, b) => a.email.localeCompare(b.email, "hu"));

  return (
    <AdminShell
      title="Admin — Kredit adása"
      subtitle="Kredit kézi jóváírása partnernek."
    >
      <AdminCreditForm users={users} />
    </AdminShell>
  );
}
