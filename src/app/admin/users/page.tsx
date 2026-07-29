// /admin/users — Felhasználónkénti költség/használat bontás (CSAK admin).
// Gombra felugró, kereshető, görgethető ablak (kb. 8 sor egyszerre).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserMetrics } from "@/lib/metrics";
import UserTable from "@/components/admin/UserTable";
import CreditGrantLog, { type CreditGrant } from "@/components/admin/CreditGrantLog";
import AdminShell from "@/components/admin/AdminShell";

export const runtime = "nodejs";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const { users, hufPerUsd } = await getUserMetrics();

  // Kredit-napló: a kézi jóváírások nyoma. Ha a migráció még nem futott le,
  // a lista üres marad — az oldal ettől még működik.
  const { data: grants } = await createAdminClient()
    .from("credit_grants")
    .select("id, admin_email, user_email, amount, note, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <AdminShell
      title="Admin — Felhasználók"
      subtitle="Ki mit és mennyit használt, mennyibe került, és mennyit vásárolt."
    >
      <div className="space-y-4">
        <UserTable users={users} hufPerUsd={hufPerUsd} />
        <CreditGrantLog grants={(grants ?? []) as CreditGrant[]} />
      </div>
    </AdminShell>
  );
}
