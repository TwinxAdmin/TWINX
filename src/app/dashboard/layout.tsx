// dashboard/layout.tsx — Központi navigáció + user + kilépés.
// Server Component: lekéri a bejelentkezett usert (kredit egyenleg a 2.4 lépésben).
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import DashboardNav from "@/components/DashboardNav";
import AccountMenu from "@/components/AccountMenu";
import MobileNav from "@/components/MobileNav";
import B2BModal from "@/components/B2BModal";
import PricingModal from "@/components/PricingModal";
import PurchaseSuccessNotice from "@/components/PurchaseSuccessNotice";
import { Suspense } from "react";
import Wordmark from "@/components/Wordmark";
import ViewAsBar from "@/components/ViewAsBar";
import AdminInboxBadge from "@/components/AdminInboxBadge";
import { officeMemberPreview, officeNonePreview, resolveViewContext } from "@/lib/view-as";
import CreditDock from "@/components/CreditDock";
import { SmartsuppIdentity } from "@/components/SmartsuppChat";
import OfficeFallbackProvider from "@/components/office/OfficeFallbackProvider";
import OfficeMenu from "@/components/office/OfficeMenu";
import OfficeModals from "@/components/office/OfficeModals";
import ModuleViewTracker from "@/components/ModuleViewTracker";
import ModuleFeedbackHost from "@/components/ModuleFeedbackHost";
import TermsGate from "@/components/TermsGate";
import { termsStatus } from "@/lib/terms";
import { premium3dStatus } from "@/lib/premium3d";
import { loadDockState } from "@/lib/office-dock";

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
        supabase.from("profiles").select("role, full_name").eq("id", user.id).single(),
        supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
      ])
    : [{ data: null }, { data: null }];
  // Előnézet: adminként átkapcsolható, hogy a felület a partner szemével látszódjon.
  // A jogosultságokat ez NEM érinti (lásd lib/view-as.ts).
  const view = await resolveViewContext(me?.role as string | undefined);
  const isAdmin = view.role === "admin";
  // Prémium 3D menüpont: Rejtett → csak admin, Hamarosan → mindenki „Hamarosan" jelvénnyel (Admin → Prémium 3D)
  const premium3d = (await premium3dStatus()).status;
  // A sales saját, szűkített megkeresés-felületet kap (jelvénnyel).
  const isSales = view.role === "sales";
  const balance = (wallet?.balance as number | undefined) ?? 0;

  // Irodai tag? → a kredit-sávon Privát | Irodai váltó (+ irodaválasztó, ha több irodája van).
  const realDock = user ? await loadDockState(user.id) : null;
  const officePreview = realDock?.isManager ? await officeMemberPreview() : false;
  // „Nincs iroda" előnézet: a felület úgy néz ki, mintha nem lenne irodai tagság (csak megjelenítés)
  const officeNone = realDock?.isManager ? await officeNonePreview() : false;
  const dock = officeNone ? null : realDock;
  // ÁSZF: ha az aktuális változatot még nem fogadta el → kötelező elfogadó ablak (null = migráció előtt, nem kérdezünk)
  const terms = user ? await termsStatus(user.id) : null;

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
            // A Sales munkafelület: Felhasználók (ügyfelek elérhetősége + tevékenysége) és Megkeresések.
            <a
              href="/sales/felhasznalok"
              className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-white/5 md:inline-flex"
              style={{ color: "var(--twx-on-dark-muted)" }}
            >
              Sales
              <AdminInboxBadge />
            </a>
          )}
        </div>

        {/* Közép: modulsáv (csak desktop) */}
        <div className="hidden flex-1 justify-center md:flex">
          <DashboardNav isAdmin={isAdmin} premium3d={premium3d} />
        </div>

        {/* Jobb: irodai menü + fiók-menü (benne az Arculatom) + kilépés (csak desktop) */}
        <div className="ml-auto hidden items-center gap-3 text-sm md:flex" style={{ color: "var(--twx-on-dark-muted)" }}>
          {/* Irodai TWINX fiók — legördülő menü (magyarázó, igénylés, csatlakozás, irodáim). */}
          <OfficeMenu
            currentOffice={dock?.offices.find((o) => o.id === dock.officeId)?.name ?? null}
            officeCount={dock?.offices.length ?? 0}
          />
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
            premium3d={premium3d}
          />
        </div>
      </header>
      {/* pb-28: a lebegő kredit-sáv ne takarja ki az oldal alját */}
      <div className="mx-auto max-w-5xl px-6 py-10 pb-28">{children}</div>

      {/* Egyedi fejlesztés / árajánlatkérés + egyenleg feltöltés modálok */}
      <B2BModal />
      <PricingModal />
      {/* bankkártyás fizetés utáni visszajelzés (?purchase=success) */}
      <Suspense fallback={null}><PurchaseSuccessNotice /></Suspense>
      {/* Elfogyott irodai keret → „Folytatás saját kreditből?" (minden modulra, egy helyen) */}
      {dock && <OfficeFallbackProvider />}
      <OfficeModals />
      {/* modul-megnyitások mérése (admin „Modul-használat") — láthatatlan */}
      <ModuleViewTracker />
      {/* csillagos értékelés (3. / 6. futtatás) és „Mi hiányzik?” — kis, bezárható kártyák (ME3c) */}
      <ModuleFeedbackHost />
      {terms && !terms.accepted && <TermsGate updated={terms.updated} />}

      {/* Élő chat: a bejelentkezett felhasználó neve + e-mail-címe (a chat maga a gyökér-layoutban töltődik be). */}
      {user && <SmartsuppIdentity name={(me?.full_name as string | null) ?? null} email={user.email ?? null} />}

      {/* Kredit-sáv alul középen: egyenleg; irodai tagnak Privát | Irodai váltóval. */}
      <CreditDock
        balance={balance}
        unlimited={view.role === "admin"}
        office={dock}
      />

      {/* Nézet-váltó — jobb alsó sarok: admin (Admin/Sales/Felhasználó) + irodai vezető (Vezető/Kolléga) */}
      {(view.canPreview || realDock?.isManager) && (
        <ViewAsBar
          current={view.canPreview ? (view.role as "admin" | "user" | "sales") : null}
          office={realDock?.isManager ? { preview: officePreview, none: officeNone } : null}
        />
      )}
    </div>
  );
}
