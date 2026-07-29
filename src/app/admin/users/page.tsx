// /admin/users — Felhasználónkénti költség/használat bontás (CSAK admin).
// Gombra felugró, kereshető, görgethető ablak (kb. 8 sor egyszerre).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserMetrics } from "@/lib/metrics";
import UserMetricsBrowser from "@/components/UserMetricsBrowser";
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

  return (
    <AdminShell
      title="Admin — Felhasználók"
      subtitle="Ki mit és mennyit használt, mennyibe került, és mennyit vásárolt."
    >
      <UserMetricsBrowser users={users} hufPerUsd={hufPerUsd} />
    </AdminShell>
  );
}
