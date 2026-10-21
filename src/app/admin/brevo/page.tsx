// /admin/brevo — Brevo-szinkron (CSAK admin): a regisztrált felhasználók kontaktként a Brevóban, hírlevél-lista.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/admin/AdminShell";
import BrevoAdmin from "@/components/admin/BrevoAdmin";

export const runtime = "nodejs";

export default async function BrevoAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");
  return (
    <AdminShell title="Brevo-szinkron" subtitle="A regisztrált felhasználók a Brevóban — a hírlevél csak annak megy, aki kérte.">
      <BrevoAdmin />
    </AdminShell>
  );
}
