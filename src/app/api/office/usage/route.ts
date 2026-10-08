// GET /api/office/usage?month=YYYY-MM — kredithasználat-kimutatás (CSAK létrehozó / kiosztó).
// Kollégánként és modulonként: ki, melyik modulban, mennyi irodai kreditet használt.
// A visszatérített (sikertelen) levonások nem számítanak bele. A munkák TARTALMÁT nem mutatja.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMembership, listMembers } from "@/lib/office-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const me = await getMembership(user.id);
  if (!me || !(me.role === "owner" || me.can_allocate)) {
    return NextResponse.json({ error: "A kimutatást a létrehozó és a kiosztó jogú tag látja." }, { status: 403 });
  }

  const param = new URL(request.url).searchParams.get("month") ?? "";
  const now = new Date();
  const [y, m] = /^\d{4}-\d{2}$/.test(param) ? param.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));

  const { data: rows, error } = await createAdminClient()
    .from("office_ledger")
    .select("member_id, amount, service_id, note")
    .eq("office_id", me.office_id)
    .eq("kind", "spend")
    .gte("created_at", from.toISOString())
    .lt("created_at", to.toISOString())
    .limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const members = await listMembers(me.office_id);
  const byMember = new Map<string, { total: number; services: Record<string, number> }>();
  for (const r of rows ?? []) {
    if (r.note === "visszatérítve") continue;
    const id = r.member_id as string;
    const used = -(r.amount as number);
    const svc = (r.service_id as string) || "egyeb";
    const cur = byMember.get(id) ?? { total: 0, services: {} };
    cur.total += used;
    cur.services[svc] = (cur.services[svc] ?? 0) + used;
    byMember.set(id, cur);
  }

  const items = members
    .map((mb) => ({ userId: mb.userId, name: mb.name || mb.email, ...(byMember.get(mb.userId) ?? { total: 0, services: {} }) }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({
    month: `${y}-${String(m).padStart(2, "0")}`,
    total: items.reduce((s, i) => s + i.total, 0),
    items,
  });
}
