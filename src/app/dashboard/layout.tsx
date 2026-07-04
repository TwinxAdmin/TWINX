// dashboard/layout.tsx — Központi navigáció + user + kilépés.
// Server Component: lekéri a bejelentkezett usert (kredit egyenleg a 2.4 lépésben).
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import DashboardNav from "@/components/DashboardNav";
import B2BModal from "@/components/B2BModal";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: me }, { data: privateServices }] = user
    ? await Promise.all([
        supabase.from("profiles").select("role").eq("id", user.id).single(),
        // RLS: a felhasználó csak a számára engedélyezett privát modulokat látja.
        supabase.from("services").select("id").eq("status", "private"),
      ])
    : [{ data: null }, { data: null }];
  const isAdmin = me?.role === "admin";
  // Van saját (privát) modulja? -> akkor a menü a modul-oldalra visz; különben B2B-modál.
  const hasCustom = isAdmin || ((privateServices?.length ?? 0) > 0);

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
          <DashboardNav hasCustom={hasCustom} />
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

      {/* Egyedi fejlesztés / árajánlatkérés modál (ha nincs saját modul) */}
      <B2BModal />
    </div>
  );
}
