// /admin/premium-3d — a Prémium 3D („Alaprajzból 3D") állapota + a várólista (CSAK admin).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import Premium3dAdmin from "@/components/admin/Premium3dAdmin";

export const runtime = "nodejs";

export default async function Premium3dAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");
  return (
    <AdminShell title="Prémium 3D" subtitle="A menüpont állapota a felhasználóknál, és akik kérték, hogy szóljunk, ha elérhető.">
      <Premium3dAdmin />
    </AdminShell>
  );
}
