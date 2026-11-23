// /admin/penzugy — Admin → Pénzügy (terv 19 / 6. szakasz; CSAK admin): Esedékes / Kiszámlázva / Fizetve /
// Lejáró modulok, cégszűrő, CSV a könyvelőnek.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import { FinanceOverview } from "@/components/admin/Finance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function FinancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");
  return (
    <AdminShell title="Pénzügy" subtitle="Fizetési tételek a cégeken át, lejáró modulok, CSV a könyvelőnek. Számla: Számlázz.hu (kézzel), a számlaszámot itt rögzíted.">
      <FinanceOverview />
    </AdminShell>
  );
}
