// /admin/users — Felhasználók (CSAK admin), két füllel:
//   • „Egyenlegek és költés" (alap): felhasználónkénti költség/használat bontás, egyenleg, kredit adása
//     (gombra felugró, kereshető, görgethető ablak — kb. 8 sor egyszerre)
//   • „Modul-használat" (?tab=hasznalat): ki mit használ, melyik modul népszerű — pénzügy nélkül (ModuleUsageView)
// A fület az URL tartja, így frissítés után is ott marad; a pénzügyi lekérdezés csak az első fülön fut.
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserMetrics } from "@/lib/metrics";
import UserTable from "@/components/admin/UserTable";
import AdminShell from "@/components/admin/AdminShell";
import ModuleUsageView from "@/components/admin/ModuleUsageView";

export const runtime = "nodejs";

const TABS = [
  { key: "egyenlegek", label: "Egyenlegek és költés", href: "/admin/users" },
  { key: "hasznalat", label: "Modul-használat", href: "/admin/users?tab=hasznalat" },
] as const;

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const tab = (await searchParams).tab === "hasznalat" ? "hasznalat" : "egyenlegek";
  const metrics = tab === "egyenlegek" ? await getUserMetrics() : null;

  return (
    <AdminShell
      title="Admin — Felhasználók"
      subtitle={tab === "hasznalat"
        ? "Ki mit használ, és melyik modul iránt van a legnagyobb érdeklődés."
        : "Ki mit és mennyit használt, mennyibe került, és mennyit vásárolt."}
    >
      {/* két AZONOS méretű fül — váltáskor semmi nem ugrik */}
      <nav className="mb-5 inline-grid grid-cols-2 rounded-full p-1" style={{ background: "#EFE7DD" }} aria-label="Felhasználók nézetei">
        {TABS.map((t) => (
          <Link key={t.key} href={t.href} aria-current={tab === t.key ? "page" : undefined}
            className="flex h-9 w-[180px] items-center justify-center rounded-full text-[13px] font-semibold sm:w-[220px]"
            style={tab === t.key ? { background: "#fff", color: "var(--twx-ink)", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" } : { color: "#6B6258" }}>
            {t.label}
          </Link>
        ))}
      </nav>

      {metrics ? <UserTable users={metrics.users} hufPerUsd={metrics.hufPerUsd} /> : <ModuleUsageView />}
    </AdminShell>
  );
}
