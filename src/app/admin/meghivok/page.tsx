// /admin/meghivok — az /ingatlan landingről érkező jelentkezők elbírálása.
// Elfogadás → egyszer használatos ajándékkód + automatikus e-mail a jelentkezőnek.
// A kiadható kódok száma kemény limit (lásd lib/invites.ts).
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminShell from "@/components/admin/AdminShell";
import InviteList from "@/components/admin/InviteList";
import { INVITE_LIMIT, INVITE_TOTAL_CREDITS, type Invite } from "@/lib/invites";

export const runtime = "nodejs";

export default async function AdminInvitesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  const [{ data: invites }, { count }] = await Promise.all([
    admin.from("ingatlan_invites").select("*").order("created_at", { ascending: false }).limit(300),
    admin.from("ingatlan_invites").select("id", { count: "exact", head: true }).not("code", "is", null),
  ]);

  return (
    <AdminShell
      title="Admin — Ingatlanos jelentkezők"
      subtitle={`Elfogadás után a jelentkező e-mailben kap egy egyszer használatos kódot, amivel a fiókja ${INVITE_TOTAL_CREDITS} kredittel indul.`}
    >
      <InviteList
        invites={(invites ?? []) as Invite[]}
        issued={count ?? 0}
        limit={INVITE_LIMIT}
      />
    </AdminShell>
  );
}
