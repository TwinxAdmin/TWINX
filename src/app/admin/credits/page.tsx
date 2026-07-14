// /admin/credits — Admin kézi kredit-adás egy felhasználónak (CSAK admin).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminCreditForm, { type CreditUser } from "@/components/AdminCreditForm";

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

  // Felhasználók listája a legördülőhöz (e-mail + szerepkör).
  const admin = createAdminClient();
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const { data: profs } = await admin.from("profiles").select("id, role");
  const roleById = new Map<string, string>((profs ?? []).map((p) => [p.id as string, (p.role as string) ?? "user"]));
  const users: CreditUser[] = (list?.users ?? [])
    .filter((u) => u.email)
    .map((u) => ({ id: u.id, email: u.email as string, role: roleById.get(u.id) ?? "user" }))
    .sort((a, b) => a.email.localeCompare(b.email, "hu"));

  return (
    <main className="twx-page font-sans">
      <div className="mx-auto max-w-2xl space-y-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">Admin — Kredit adása</h1>
        <nav className="flex gap-3 text-sm" style={{ color: "var(--twx-coral)" }}>
          <a href="/admin/analytics">Analitika</a>
          <a href="/admin/prompts">Promptok</a>
          <a href="/admin/users">Felhasználók</a>
          <a href="/admin/ideas">Ötletek</a>
          <a href="/dashboard">Dashboard</a>
        </nav>
      </div>
      <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
        Manuális kredit-jóváírás egy felhasználónak (pl. értékesítői / prezentációs
        célra). A kreditek nem járnak le. Az Ingatlan modul egyenlegéhez írja jóvá.
      </p>
      <AdminCreditForm users={users} />
      </div>
    </main>
  );
}
