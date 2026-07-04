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
    <div className="min-h-screen font-sans">
      <header className="flex items-center justify-between border-b border-gray-200 p-4">
        <a href="/dashboard" className="font-semibold">
          Twinx Portál
        </a>
        <nav className="flex gap-4 text-sm underline">
          <a href="/dashboard/real-estate/valuation">Értékbecslő</a>
          <a href="/dashboard/real-estate/visualization">Látványtervező</a>
          <a href="/dashboard/custom">Egyedi modulok</a>
          {isAdmin && (
            <a href="/admin/analytics" className="font-medium">
              Admin
            </a>
          )}
        </nav>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{user?.email}</span>
          <LogoutButton />
        </div>
      </header>
      <div className="p-6">{children}</div>
    </div>
  );
}
