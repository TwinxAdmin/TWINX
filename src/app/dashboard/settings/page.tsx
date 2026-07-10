// dashboard/settings — Beállítások / profil: adatok megtekintése + jelszó/e-mail módosítás.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AccountSettingsForm from "@/components/AccountSettingsForm";

const ROLE_LABEL: Record<string, string> = {
  user: "Felhasználó",
  sales: "Sales",
  admin: "Admin",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = me?.role ?? "user";
  const created = user.created_at ? new Date(user.created_at).toLocaleDateString("hu-HU") : "—";

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-3xl font-semibold">Beállítások</h1>

      {/* Profiladatok */}
      <div className="twx-card space-y-2 p-5 text-sm">
        <div className="flex justify-between gap-3">
          <span style={{ color: "var(--twx-ink-muted)" }}>E-mail</span>
          <span className="font-medium">{user.email}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span style={{ color: "var(--twx-ink-muted)" }}>Szerepkör</span>
          <span>{ROLE_LABEL[role] ?? role}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span style={{ color: "var(--twx-ink-muted)" }}>Regisztráció</span>
          <span>{created}</span>
        </div>
      </div>

      <AccountSettingsForm currentEmail={user.email ?? ""} />
    </main>
  );
}
