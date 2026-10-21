// /sales/felhasznalok — Sales → Felhasználók: az ügyfelek elérhetősége és tevékenysége (pénzügy nélkül), hogy fel lehessen hívni őket.
// Admin és sales érheti el. A pénzügyi és számlázási adatok a szerveren maradnak (src/lib/sales-users.ts).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import SalesUserTable from "@/components/admin/SalesUserTable";
import { getStaffRole } from "@/lib/staff";
import { getSalesUsers } from "@/lib/sales-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SalesUsersPage() {
  const staff = await getStaffRole(await createClient());
  if (!staff) redirect("/dashboard");
  const users = await getSalesUsers();

  return (
    <AdminShell
      variant="sales"
      title="Felhasználók"
      subtitle="Az ügyfelek elérhetősége és tevékenysége. A telefonszámra kattintva hívhatod, a „Részletek” gombbal minden elérhetőséget és a használatot látod."
    >
      <SalesUserTable users={users} />
    </AdminShell>
  );
}
