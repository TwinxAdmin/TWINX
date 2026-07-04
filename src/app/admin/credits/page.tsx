// /admin/credits — Admin kézi kredit-adás egy felhasználónak (CSAK admin).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminCreditForm from "@/components/AdminCreditForm";

export const runtime = "nodejs";

export default async function AdminCreditsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (me?.role !== "admin") redirect("/dashboard");

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6 font-sans">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin — Kredit adása</h1>
        <nav className="flex gap-3 text-sm underline">
          <a href="/admin/analytics">Analitika</a>
          <a href="/admin/ideas">Ötletek</a>
          <a href="/dashboard">Dashboard</a>
        </nav>
      </div>
      <p className="text-sm text-gray-500">
        Manuális kredit-jóváírás egy felhasználónak (pl. értékesítői / prezentációs
        célra). A kreditek nem járnak le. Az Ingatlan modul egyenlegéhez írja jóvá.
      </p>
      <AdminCreditForm />
    </main>
  );
}
