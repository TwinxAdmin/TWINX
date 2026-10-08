// GET /api/office/messages/unread — olvasatlan, nekem szóló irodai üzenetek száma
// + a függő kredit-kérések száma (vezetőnek) → a fejléc „Irodai fiók" menü jelzéséhez.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembership } from "@/lib/office-server";
import { unreadCount } from "@/lib/office-messages";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 });
  const me = await getMembership(user.id);
  if (!me) return NextResponse.json({ count: 0 });

  const unread = await unreadCount(me.office_id, user.id).catch(() => 0);
  let pending = 0;
  if (me.role === "owner" || me.can_allocate) {
    const { count } = await createAdminClient().from("office_credit_requests")
      .select("id", { count: "exact", head: true }).eq("office_id", me.office_id).eq("status", "pending");
    pending = count ?? 0;
  }
  return NextResponse.json({ count: unread + pending, unread, pending });
}
