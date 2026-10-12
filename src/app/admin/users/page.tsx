// /admin/users — Felhasználók és modulok (CSAK admin), három füllel:
//   • „Egyenlegek és költés" (alap): felhasználónkénti költség/használat bontás, egyenleg, kredit adása
//     (gombra felugró, kereshető, görgethető ablak — kb. 8 sor egyszerre)
//   • „Modul-használat" (?tab=hasznalat): ki mit használ, melyik modul népszerű — pénzügy nélkül (ModuleUsageView)
//   • „Modul elemzés" (?tab=elemzes): maga a modul elemzése — TOP 3, egészség, visszatérés, kapcsolódások (ModuleAnalysisView)
// A fület az URL tartja, így frissítés után is ott marad; a pénzügyi lekérdezés csak az első fülön fut.
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserMetrics } from "@/lib/metrics";
import UserTable from "@/components/admin/UserTable";
import AdminShell from "@/components/admin/AdminShell";
import ModuleUsageView from "@/components/admin/ModuleUsageView";
import ModuleAnalysisView from "@/components/admin/ModuleAnalysisView";

export const runtime = "nodejs";

const TABS = [
  { key: "egyenlegek", label: "Egyenlegek és költés", href: "/admin/users" },
  { key: "hasznalat", label: "Modul-használat", href: "/admin/users?tab=hasznalat" },
  { key: "elemzes", label: "Modul elemzés", href: "/admin/users?tab=elemzes" },
] as const;

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const t = (await searchParams).tab;
  const tab = t === "hasznalat" || t === "elemzes" ? t : "egyenlegek";
  const metrics = tab === "egyenlegek" ? await getUserMetrics() : null;

  return (
    <AdminShell
      title="Admin — Felhasználók és modulok"
      subtitle={tab === "hasznalat"
        ? "Ki mit használ, és melyik modul iránt van a legnagyobb érdeklődés."
        : tab === "elemzes"
          ? "Melyik modul működik jól, és hol veszítjük el az embereket."
          : "Ki mit és mennyit használt, mennyibe került, és mennyit vásárolt."}
    >
      {/* három AZONOS méretű fül — váltáskor semmi nem ugrik */}
      <nav className="mb-5 inline-grid grid-cols-3 rounded-full p-1" style={{ background: "#EFE7DD" }} aria-label="Felhasználók nézetei">
        {TABS.map((t) => (
          <Link key={t.key} href={t.href} aria-current={tab === t.key ? "page" : undefined}
            className="flex h-9 w-[110px] items-center justify-center rounded-full px-2 text-center text-[12px] font-semibold leading-tight sm:w-[200px] sm:text-[13px]"
            style={tab === t.key ? { background: "#fff", color: "var(--twx-ink)", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" } : { color: "#6B6258" }}>
            {t.label}
          </Link>
        ))}
      </nav>

      {metrics ? <UserTable users={metrics.users} hufPerUsd={metrics.hufPerUsd} /> : tab === "elemzes" ? <ModuleAnalysisView /> : <ModuleUsageView />}
    </AdminShell>
  );
}
