// dashboard/settings — Beállítások / profil: adatok megtekintése + jelszó/e-mail módosítás.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AccountSettingsForm from "@/components/AccountSettingsForm";
import ProfileForm from "@/components/ProfileForm";
import CreditRequestPanel from "@/components/CreditRequestPanel";
import BillingForm from "@/components/BillingForm";
import type { BillingInfo } from "@/lib/billing";
import { resolveViewContext } from "@/lib/view-as";

const BILLING_COLS =
  "billing_type, billing_name, billing_tax_number, billing_country, billing_zip, billing_city, billing_address, billing_email";

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

  const { data: me } = await supabase
    .from("profiles")
    .select("role, full_name, company")
    .eq("id", user.id)
    .single();
  // Előnézet: adminként megnézhető, hogy a partner mit lát ezen az oldalon.
  const view = await resolveViewContext(me?.role as string | undefined);
  const role = view.role;
  const created = user.created_at ? new Date(user.created_at).toLocaleDateString("hu-HU") : "—";

  // Az admin korlátlan, neki nincs értelme kreditet kérnie.
  const { data: wallet } = await supabase
    .from("wallets").select("balance").eq("user_id", user.id).maybeSingle();
  const balance = (wallet?.balance as number) ?? 0;

  // Számlázási adatok KÜLÖN lekérdezéssel: ha a credit-billing.sql még nem futott
  // le, ez a lekérdezés hibázik — az oldal többi része attól még működjön.
  const { data: billingRow } = await supabase
    .from("profiles").select(BILLING_COLS).eq("id", user.id).maybeSingle();
  const billing = (billingRow as BillingInfo | null) ?? null;

  // A sales kolléga belső keretet kap (ingyen), neki nincs számlázás.
  const needsBilling = role === "user";

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-3xl font-semibold">Beállítások</h1>

      {role !== "admin" && (
        <CreditRequestPanel
          balance={balance}
          billing={billing}
          needsBilling={needsBilling}
          preview={view.previewing}
        />
      )}

      <ProfileForm
        initialName={(me?.full_name as string) ?? ""}
        initialCompany={(me?.company as string) ?? ""}
      />

      {needsBilling && <BillingForm initial={billing} preview={view.previewing} />}

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
