// GET /api/admin/inbox-counts — a fejléc-jelvényhez (admin ÉS sales).
//
// Minden beérkező típus KÜLÖN számot ad vissza, hogy az admin menüben lássa,
// melyik részre érkezett: üzenetek, ajándékkód-jelentkezők, kredit-kérések, ötletek.
// Sales: csak a tájékoztatás-kérések és a jelentkezők (pénzügyet, ötletet nem lát).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffRole, CONSULTATION_MARKER } from "@/lib/staff";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const staff = await getStaffRole(supabase);
  if (!staff) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  const isAdmin = staff.role === "admin";

  const admin = createAdminClient();
  const openLeadsQuery = admin.from("leads").select("id", { count: "exact", head: true }).is("handled_at", null);

  const [invites, leads, credits, ideas] = await Promise.all([
    admin.from("ingatlan_invites").select("id", { count: "exact", head: true }).eq("status", "uj"),
    isAdmin ? openLeadsQuery : openLeadsQuery.ilike("message", `%${CONSULTATION_MARKER}%`),
    isAdmin
      ? admin.from("credit_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
      : Promise.resolve({ count: 0 }),
    isAdmin
      ? admin.from("ideas").select("id", { count: "exact", head: true }).eq("status", "new")
      : Promise.resolve({ count: 0 }),
  ]);

  const newInvites = invites.count ?? 0;
  const openLeads = leads.count ?? 0;
  const pendingCredits = credits.count ?? 0;
  const newIdeas = ideas.count ?? 0;

  return NextResponse.json({
    newInvites, openLeads, pendingCredits, newIdeas,
    // A „Kérések és üzenetek" oldalon két dolog van egy helyen.
    inboxPage: openLeads + newInvites,
    total: newInvites + openLeads + pendingCredits + newIdeas,
  });
}
