// dashboard/layout.tsx — Központi navigáció + user + kilépés.
// Server Component: lekéri a bejelentkezett usert (kredit egyenleg a 2.4 lépésben).
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import DashboardNav from "@/components/DashboardNav";

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
        className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
        style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}
      >
        <div className="flex flex-wrap items-center gap-4">
          <a
            href="/dashboard"
            className="font-display text-2xl font-semibold tracking-wide"
            style={{ color: "var(--twx-on-dark)" }}
          >
            TWINX
          </a>
          <DashboardNav />
          {isAdmin && (
            <a
              href="/admin/analytics"
              className="rounded-full px-3 py-1.5 text-sm transition-colors hover:bg-white/5"
              style={{ color: "var(--twx-on-dark-muted)" }}
            >
              Admin
            </a>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>
          <span className="hidden sm:inline">{user?.email}</span>
          <a
            href="/pricing"
            className="flex items-center gap-2 rounded-full px-4 py-2 font-medium transition-opacity hover:opacity-90"
            style={{ background: "var(--twx-coral)", color: "#1c1005" }}
          >
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ background: "rgba(0,0,0,0.14)" }}
            >
              {balance}
            </span>
            Egyenleg feltöltése
          </a>
          <LogoutButton />
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
    </div>
  );
}
