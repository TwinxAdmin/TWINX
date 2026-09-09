// /sales/megkeresesek — az értékesítő munkafelülete.
//
// Ugyanaz a szerkezet, mint az adminé, de SZŰKÍTVE: a sales csak a beérkező
// tájékoztatás-kéréseket és az ajándékkódra jelentkezőket látja — felhasználó-
// listát, pénzügyet, tartalmat nem. A jelentkezéseket VISZONT jóváhagyhatja:
// több kolléga párhuzamosan dolgozhat, így nem torlódik a kampány. A keret
// (INVITE_LIMIT) és a naplózás (ki hagyta jóvá) a szerveren őrzött.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminShell from "@/components/admin/AdminShell";
import InboxTabs, { type Lead } from "@/components/admin/InboxTabs";
import { getStaffRole, CONSULTATION_MARKER } from "@/lib/staff";
import { INVITE_LIMIT, type Invite } from "@/lib/invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SalesInboxPage() {
  const supabase = await createClient();
  const staff = await getStaffRole(supabase);
  if (!staff) redirect("/dashboard");

  const admin = createAdminClient();
  const [{ data: leads }, { data: invites }, { count: issued }] = await Promise.all([
    // CSAK a tájékoztatás-kérések — a B2B ajánlatkérések az adminnál maradnak.
    admin.from("leads").select("*").ilike("message", `%${CONSULTATION_MARKER}%`)
      .order("created_at", { ascending: false }).limit(200),
    admin.from("ingatlan_invites").select("*").order("created_at", { ascending: false }).limit(300),
    admin.from("ingatlan_invites").select("id", { count: "exact", head: true }).not("code", "is", null),
  ]);

  return (
    <AdminShell
      variant="sales"
      title="Beérkező megkeresések"
      subtitle="A tájékoztatást kérők és az ajándékkódra jelentkezők. Elfogadás után a jelentkező azonnal megkapja az ajándékkódot e-mailben."
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
