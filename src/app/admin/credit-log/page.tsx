// /admin/credit-log — Kredit-napló: melyik admin kinek, mikor, mennyi kreditet
// adott, és miért. A kredit ADÁSA a Felhasználók táblában történik („+" gomb).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import CreditGrantLog, { type CreditGrant } from "@/components/admin/CreditGrantLog";
import AdminShell from "@/components/admin/AdminShell";

export const runtime = "nodejs";

export default async function AdminCreditLogPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const { data: grants } = await createAdminClient()
    .from("credit_grants")
    .select("id, admin_email, user_email, amount, note, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <AdminShell
      title="Admin — Kredit-napló"
      subtitle="Ki kinek, mikor és mennyi kreditet adott kézzel — és miért."
    >
      <CreditGrantLog grants={(grants ?? []) as CreditGrant[]} />
    </AdminShell>
  );
}
