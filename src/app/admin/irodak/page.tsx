// /admin/irodak — Irodai TWINX fiók igénylések elbírálása (CSAK admin).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminShell from "@/components/admin/AdminShell";
import OfficeRequestList, { type AdminOfficeRequest } from "@/components/admin/OfficeRequestList";
import AdminOfficeList, { type AdminOffice } from "@/components/admin/AdminOfficeList";

export const runtime = "nodejs";

export default async function AdminOfficesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const adminDb = createAdminClient();

  // Megnyitott irodák: név, létrehozó, egyenleg, létszám (az office.sql nélkül üres lista).
  const { data: officeRows } = await adminDb
    .from("offices").select("id, name, owner_id, balance, created_at").order("created_at", { ascending: false }).limit(100);
  const offices: AdminOffice[] = await Promise.all(
    (officeRows ?? []).map(async (o) => {
      const [{ count }, { data: owner }] = await Promise.all([
        adminDb.from("office_members").select("user_id", { count: "exact", head: true }).eq("office_id", o.id),
        adminDb.auth.admin.getUserById(o.owner_id as string),
      ]);
      return {
        id: o.id as string, name: o.name as string, balance: (o.balance as number) ?? 0,
        ownerEmail: owner.user?.email ?? "-", memberCount: count ?? 0, createdAt: o.created_at as string,
      };
    })
  );

  const { data: items, error } = await adminDb
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
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold">Megnyitott irodák</h2>
            <AdminOfficeList items={offices} />
          </section>
          <section className="space-y-3">
            <h2 className="font-display text-xl font-semibold">Igénylések</h2>
            <OfficeRequestList items={(items ?? []) as AdminOfficeRequest[]} />
          </section>
        </div>
      )}
    </AdminShell>
  );
}
