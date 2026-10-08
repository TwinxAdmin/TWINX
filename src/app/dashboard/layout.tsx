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
import ViewAsBar from "@/components/ViewAsBar";
import AdminInboxBadge from "@/components/AdminInboxBadge";
import { resolveViewContext } from "@/lib/view-as";
import CreditDock from "@/components/CreditDock";
import { getMembershipIn, getWorkContext, listMyOffices } from "@/lib/office-server";

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
  // Előnézet: adminként átkapcsolható, hogy a felület a partner szemével látszódjon.
  // A jogosultságokat ez NEM érinti (lásd lib/view-as.ts).
  const view = await resolveViewContext(me?.role as string | undefined);
  const isAdmin = view.role === "admin";
  // A sales saját, szűkített megkeresés-felületet kap (jelvénnyel).
  const isSales = view.role === "sales";
  const balance = (wallet?.balance as number | undefined) ?? 0;

  // Irodai tag? → a kredit-sávon Privát | Irodai váltó (+ irodaválasztó, ha több irodája van).
  const dock = user ? await loadDockState(user.id) : null;

  return (
    <div className="min-h-screen font-sans" style={{ background: "var(--twx-cream)", color: "var(--twx-ink)" }}>
      <header
        className="relative flex items-center gap-4 px-6 py-3"
        style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)", zIndex: 50 }}
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
              className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-white/5 md:inline-flex"
              style={{ color: "var(--twx-on-dark-muted)" }}
            >
              Admin
              {/* Korall karika: csak akkor látszik, ha van elintézetlen megkeresés. */}
              <AdminInboxBadge />
            </a>
          )}
          {isSales && (
            <a
              href="/sales/megkeresesek"
              className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-white/5 md:inline-flex"
              style={{ color: "var(--twx-on-dark-muted)" }}
            >
              Megkeresések
              <AdminInboxBadge />
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
          {/* Irodai TWINX fiók — közös irodai kreditkeret (igénylés / csatlakozás). */}
          <a
            href="/dashboard/iroda"
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-white/5"
            style={{ color: "var(--twx-on-dark)" }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 21h18" />
              <path d="M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
              <path d="M15 10h3a1 1 0 0 1 1 1v10" />
              <path d="M8 8h1M11 8h1M8 12h1M11 12h1M8 16h1M11 16h1" />
            </svg>
            Irodai fiók
          </a>
          <AccountMenu email={user?.email ?? ""} role={view.role} balance={balance} />
          <LogoutButton />
        </div>

        {/* Mobil: hamburger */}
        <div className="ml-auto md:hidden">
          <MobileNav
            email={user?.email ?? ""}
            role={view.role}
            balance={balance}
            isAdmin={isAdmin}
          />
        </div>
      </header>
      {/* pb-28: a lebegő kredit-sáv ne takarja ki az oldal alját */}
      <div className="mx-auto max-w-5xl px-6 py-10 pb-28">{children}</div>

      {/* Egyedi fejlesztés / árajánlatkérés + egyenleg feltöltés modálok */}
      <B2BModal />
      <PricingModal />

      {/* Kredit-sáv alul középen: egyenleg; irodai tagnak Privát | Irodai váltóval. */}
      <CreditDock
        balance={balance}
        unlimited={view.role === "admin"}
        office={dock}
      />

      {/* Nézet-váltó (fejlesztést segítő) — csak adminnak, a bal alsó sarokban */}
      {view.canPreview && <ViewAsBar current={view.role as "admin" | "user" | "sales"} />}
    </div>
  );
}

/** A kredit-sáv irodai állapota: irodák listája, kiválasztott iroda, mód és a keret felirata. */
async function loadDockState(userId: string) {
  try {
    const offices = await listMyOffices(userId);
    if (offices.length === 0) return null;
    const ctx = await getWorkContext(userId);
    const selected = offices.find((o) => o.id === ctx.officeId) ?? offices[0];
    const m = await getMembershipIn(userId, selected.id);
    const label = !m ? "0 kredit" : m.role === "owner" || m.unlimited ? "Korlátlan" : `${m.allowance ?? 0} kredit`;
    return {
      mode: (ctx.useOffice && ctx.officeId === selected.id ? "office" : "private") as "office" | "private",
      label,
      officeId: selected.id,
      offices: offices.map((o) => ({ id: o.id, name: o.name })),
    };
  } catch {
    return null;
  }
}
