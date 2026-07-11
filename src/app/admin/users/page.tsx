// /admin/users — Felhasználónkénti költség/használat bontás (CSAK admin).
// Gombra felugró, kereshető, görgethető ablak (kb. 8 sor egyszerre).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserMetrics } from "@/lib/metrics";
import UserMetricsBrowser from "@/components/UserMetricsBrowser";

export const runtime = "nodejs";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const { users, hufPerUsd } = await getUserMetrics();

  return (
    <main className="twx-page font-sans">
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-semibold">Admin — Felhasználók</h1>
          <nav className="flex gap-3 text-sm" style={{ color: "var(--twx-coral)" }}>
            <a href="/admin/analytics">Költségfigyelő</a>
            <a href="/admin/prompts">Promptok</a>
            <a href="/admin/ideas">Ötletek</a>
            <a href="/admin/credits">Kredit</a>
            <a href="/dashboard">Dashboard</a>
          </nav>
        </div>
        <p className="text-sm" style={{ color: "var(--twx-ink-muted)" }}>
          Ki mit és mennyit használt, mennyibe került (becsült API-önköltség) és mennyit vásárolt.
          Nyisd meg a listát, ott név/e-mail alapján kereshetsz és görgethetsz.
        </p>

        <UserMetricsBrowser users={users} hufPerUsd={hufPerUsd} />
      </div>
    </main>
  );
}
