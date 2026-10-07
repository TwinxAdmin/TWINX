// /admin/irodak — Irodai TWINX fiók igénylések elbírálása (CSAK admin).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminShell from "@/components/admin/AdminShell";
import OfficeRequestList, { type AdminOfficeRequest } from "@/components/admin/OfficeRequestList";

export const runtime = "nodejs";

export default async function AdminOfficesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const { data: items, error } = await createAdminClient()
    .from("office_requests")
    .select("id, user_email, office_name, team_size, phone, note, leader_view, status, decision_note, created_at, decided_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <AdminShell
      title="Admin — Irodai fiókok"
      subtitle="Irodai TWINX igénylések. Jóváhagyás után az igénylő maga nyitja meg az irodát, és hívja meg a kollégáit."
    >
      {error ? (
        <p className="twx-card p-5 text-sm" style={{ color: "#c0392b" }}>
          Az igénylések nem tölthetők be: {error.message}
          <br />
          <span style={{ color: "var(--twx-ink-muted)" }}>Ha még nem futott le, futtasd az <code>office.sql</code> migrációt.</span>
        </p>
      ) : (
        <OfficeRequestList items={(items ?? []) as AdminOfficeRequest[]} />
      )}
    </AdminShell>
  );
}
