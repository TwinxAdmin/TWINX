// dashboard/layout.tsx — Központi navigáció + user + kilépés.
// Server Component: lekéri a bejelentkezett usert (kredit egyenleg a 2.4 lépésben).
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";

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
        className="flex flex-wrap items-center justify-between gap-3 px-6 py-4"
        style={{ background: "var(--twx-dark)", color: "var(--twx-on-dark)" }}
      >
        <a
          href="/dashboard"
          className="font-display text-2xl font-semibold tracking-wide"
          style={{ color: "var(--twx-on-dark)" }}
        >
          TWINX
        </a>
        <nav className="flex flex-wrap gap-5 text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>
          <a href="/dashboard/real-estate/valuation" className="hover:text-white">Értékbecslő</a>
          <a href="/dashboard/real-estate/visualization" className="hover:text-white">Látványtervező</a>
          <a href="/dashboard/real-estate/video" className="hover:text-white">Videó</a>
          <a href="/dashboard/custom" className="hover:text-white">Egyedi modulok</a>
          <a href="/pricing" className="hover:opacity-80" style={{ color: "var(--twx-coral)" }}>Csomagok</a>
          {isAdmin && (
            <a href="/admin/analytics" className="hover:text-white">Admin</a>
          )}
        </nav>
        <div className="flex items-center gap-4 text-sm" style={{ color: "var(--twx-on-dark-muted)" }}>
          <span className="hidden sm:inline">{user?.email}</span>
          <LogoutButton />
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
    </div>
  );
}
