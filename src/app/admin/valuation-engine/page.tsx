// /admin/valuation-engine — a comp-alapú Értékbecslő motor hangolása (CSAK admin).
// Minden gomb egy számszerű config-paraméter; verziózva menthető és aktiválható.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listConfigVersions } from "@/lib/valuation-engine-server";
import AdminShell from "@/components/admin/AdminShell";
import ValuationEngineAdmin from "@/components/admin/ValuationEngineAdmin";

export const runtime = "nodejs";

export default async function ValuationEngineAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const { active, versions } = await listConfigVersions();

  return (
    <AdminShell title="Értékbecslő motor" subtitle="A comp-alapú becslő számítási paramétereinek hangolása és verziózása.">
      <ValuationEngineAdmin initialConfig={active} initialVersions={versions} />
    </AdminShell>
  );
}
