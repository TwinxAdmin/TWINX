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

  const { data: me } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const isAdmin = me?.role === "admin";

  return (
    <div className="min-h-screen font-sans" style={{ background: "var(--twx-cream)", color: "var(--twx-ink)" }}>
      <header
        className="relative flex items-center justify-between gap-4 px-6 py-3"
        style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}
      >
        <a
          href="/dashboard"
          className="font-display text-2xl font-semibold tracking-wide"
          style={{ color: "var(--twx-on-dark)" }}
        >
          TWINX
        </a>

        {/* Modulsáv középre igazítva */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <DashboardNav />
        </div>

        <div className="flex items-center gap-4 text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>
          {isAdmin && (
            <a
              href="/admin/analytics"
              className="rounded-full px-3 py-1.5 transition-colors hover:bg-white/5"
              style={{ color: "var(--twx-on-dark-muted)" }}
            >
              Admin
            </a>
          )}
          <span className="hidden sm:inline">{user?.email}</span>
          <LogoutButton />
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
    </div>
  );
}
