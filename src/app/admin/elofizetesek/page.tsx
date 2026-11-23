// /admin/elofizetesek — Admin → Előfizetések (terv 12 / 1. és 6. szakasz; CSAK admin).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import CompanyModulesAdmin from "@/components/admin/CompanyModulesAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");
  return (
    <AdminShell title="Előfizetések" subtitle="Cégenként és modulonként: helyek (foglalt / összes), érvényesség, plafon. A lejáró modulok kiemelve.">
      <CompanyModulesAdmin view="subscriptions" />
    </AdminShell>
  );
}
