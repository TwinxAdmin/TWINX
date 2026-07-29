// /admin/credit-requests — Kredit-kérések elbírálása (CSAK admin).
// A sales kollégák a Beállításokban tudnak kreditet kérni; az adminok e-mailt
// kapnak, és itt hagyják jóvá vagy utasítják el.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import CreditRequestList, { type CreditRequestRow } from "@/components/admin/CreditRequestList";
import AdminShell from "@/components/admin/AdminShell";

export const runtime = "nodejs";

export default async function AdminCreditRequestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const { data: items, error } = await createAdminClient()
    .from("credit_requests")
    .select("id, user_email, amount, reason, status, decided_by_email, decided_at, decision_note, granted_amount, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <AdminShell
      title="Admin — Kredit-kérések"
      subtitle="A kollégák keret-igényei. Jóváhagyáskor a kredit azonnal jóváíródik, és bekerül a kredit-naplóba."
    >
      {error ? (
        // Ne úgy nézzen ki, mintha üres lenne a lista — derüljön ki a valódi ok.
        <p className="twx-card p-5 text-sm" style={{ color: "#c0392b" }}>
          A kérések nem tölthetők be: {error.message}
          <br />
          <span style={{ color: "var(--twx-ink-muted)" }}>
            Ha még nem futott le, futtasd a <code>credit-requests.sql</code> migrációt.
          </span>
        </p>
      ) : (
        <CreditRequestList items={(items ?? []) as CreditRequestRow[]} />
      )}
    </AdminShell>
  );
}
