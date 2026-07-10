// dashboard/layout.tsx — Központi navigáció + user + kilépés.
// Server Component: lekéri a bejelentkezett usert (kredit egyenleg a 2.4 lépésben).
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import DashboardNav from "@/components/DashboardNav";
import AccountMenu from "@/components/AccountMenu";
import B2BModal from "@/components/B2BModal";
import PricingModal from "@/components/PricingModal";
import Wordmark from "@/components/Wordmark";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: me }, { data: wallet }] = user
    ? await Promise.all([
        supabase.from("profiles").select("role").eq("id", user.id).single(),
        supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
      ])
    : [{ data: null }, { data: null }];
  const isAdmin = me?.role === "admin";
  const balance = (wallet?.balance as number | undefined) ?? 0;

  return (
    <div className="min-h-screen font-sans" style={{ background: "var(--twx-cream)", color: "var(--twx-ink)" }}>
      <header
        className="flex items-center gap-4 px-6 py-3"
        style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}
      >
        {/* Bal: logó + fiók/admin linkek */}
        <div className="flex items-center gap-3 text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>
          <a
            href="/dashboard"
            className="font-display text-2xl font-semibold tracking-wide"
            style={{ color: "var(--twx-on-dark)" }}
          >
            <Wordmark />
          </a>
          {isAdmin && (
            <a
              href="/admin/analytics"
              className="rounded-full px-3 py-1.5 transition-colors hover:bg-white/5"
              style={{ color: "var(--twx-on-dark-muted)" }}
            >
              Admin
            </a>
          )}
        </div>

        {/* Közép: modulsáv */}
        <div className="flex flex-1 justify-center">
          <DashboardNav />
        </div>

        {/* Jobb: fiók-menü + kilépés */}
        <div className="flex items-center gap-3 text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>
          <AccountMenu email={user?.email ?? ""} role={me?.role ?? "user"} balance={balance} />
          <LogoutButton />
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>

      {/* Egyedi fejlesztés / árajánlatkérés + egyenleg feltöltés modálok */}
      <B2BModal />
      <PricingModal />
    </div>
  );
}
