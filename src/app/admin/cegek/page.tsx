// /admin/cegek — Admin → Cégek (terv 12 / 1.3; CSAK admin).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import CompaniesAdmin from "@/components/admin/CompaniesAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CompaniesAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  return (
    <AdminShell title="Cégek" subtitle="Az ügyfeleink: tagok, cégvezetők, a cég története. A modulok és az előfizetés a következő lépésben kerül ide.">
      <CompaniesAdmin />
    </AdminShell>
  );
}
