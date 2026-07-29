// dashboard/layout.tsx — Központi navigáció + user + kilépés.
// Server Component: lekéri a bejelentkezett usert (kredit egyenleg a 2.4 lépésben).
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import DashboardNav from "@/components/DashboardNav";
import AccountMenu from "@/components/AccountMenu";
import MobileNav from "@/components/MobileNav";
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
              href="/admin"
              className="hidden rounded-full px-3 py-1.5 transition-colors hover:bg-white/5 md:inline-block"
              style={{ color: "var(--twx-on-dark-muted)" }}
            >
              Admin
            </a>
          )}
        </div>

        {/* Közép: modulsáv (csak desktop) */}
        <div className="hidden flex-1 justify-center md:flex">
          <DashboardNav />
        </div>

        {/* Jobb: arculat + fiók-menü + kilépés (csak desktop) */}
        <div className="ml-auto hidden items-center gap-3 text-sm md:flex" style={{ color: "var(--twx-on-dark-muted)" }}>
          {/* Az arculat fiók-szintű: minden hirdetés és videó ebből dolgozik. */}
          <a
            href="/dashboard/branding"
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-white/5"
            style={{ color: "var(--twx-on-dark)" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3 4 7v6c0 4.4 3.4 7.3 8 8 4.6-.7 8-3.6 8-8V7l-8-4Z" />
            </svg>
            Arculatom
          </a>
          <AccountMenu email={user?.email ?? ""} role={me?.role ?? "user"} balance={balance} />
          <LogoutButton />
        </div>

        {/* Mobil: hamburger */}
        <div className="ml-auto md:hidden">
          <MobileNav
            email={user?.email ?? ""}
            role={me?.role ?? "user"}
            balance={balance}
            isAdmin={isAdmin}
          />
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>

      {/* Egyedi fejlesztés / árajánlatkérés + egyenleg feltöltés modálok */}
      <B2BModal />
      <PricingModal />
    </div>
  );
}
