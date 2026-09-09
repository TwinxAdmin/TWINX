// /admin/megkeresesek — „Beérkező kérések és üzenetek" (CSAK admin).
// Egy helyen: a `leads` táblába érkező megkeresések (tájékoztatás-kérés az
// /ingatlan landingről + B2B ajánlatkérés) és az ajándékkód-jelentkezők.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminShell from "@/components/admin/AdminShell";
import InboxTabs, { type Lead } from "@/components/admin/InboxTabs";
import { INVITE_LIMIT, type Invite } from "@/lib/invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminInboxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  const [{ data: leads }, { data: invites }, { count: issued }] = await Promise.all([
    admin.from("leads").select("*").order("created_at", { ascending: false }).limit(200),
    admin.from("ingatlan_invites").select("*").order("created_at", { ascending: false }).limit(300),
    admin.from("ingatlan_invites").select("id", { count: "exact", head: true }).not("code", "is", null),
  ]);

  return (
    <AdminShell
      title="Beérkező kérések és üzenetek"
      subtitle="Minden megkeresés egy helyen: tájékoztatás-kérés, B2B ajánlatkérés és az ajándékkódra jelentkezők."
    >
      <InboxTabs
        leads={(leads ?? []) as Lead[]}
        invites={(invites ?? []) as Invite[]}
        issued={issued ?? 0}
        limit={INVITE_LIMIT}
      />
    </AdminShell>
  );
}
