// /api/sales/users/:id/calls — egy ügyfél hívásnaplója (admin és sales).
//   GET  → { migrated, notes: [...] }
//   POST { status, note?, callbackOn? } → új bejegyzés (a rögzítő a bejelentkezett admin / sales).
// Csak ügyfél (profiles.role = 'user') naplózható.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffRole } from "@/lib/staff";
import { addCallNote, isCallStatus, listCallNotes } from "@/lib/call-notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

async function guard(params: Promise<{ id: string }>) {
  const staff = await getStaffRole(await createClient());
  if (!staff) return { error: NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 }) };
  const { id } = await params;
  if (!UUID.test(id)) return { error: NextResponse.json({ error: "Érvénytelen azonosító." }, { status: 400 }) };
  const { data: prof } = await createAdminClient().from("profiles").select("role").eq("id", id).maybeSingle();
  if (!prof || prof.role !== "user") return { error: NextResponse.json({ error: "Nincs ilyen ügyfél." }, { status: 404 }) };
  return { staff, id };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(params);
  if ("error" in g) return g.error;
  return NextResponse.json(await listCallNotes(g.id));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(params);
  if ("error" in g) return g.error;
  const body = (await request.json().catch(() => ({}))) as { status?: unknown; note?: unknown; callbackOn?: unknown };
  if (!isCallStatus(body.status)) return NextResponse.json({ error: "Válassz eredményt." }, { status: 422 });
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";
  const callbackOn = typeof body.callbackOn === "string" && DAY.test(body.callbackOn) ? body.callbackOn : null;
  if (body.status === "callback" && !callbackOn) return NextResponse.json({ error: "Add meg, mikor hívjuk vissza." }, { status: 422 });

  const { data: me } = await createAdminClient().from("profiles").select("full_name").eq("id", g.staff.userId).maybeSingle();
  const r = await addCallNote({
    userId: g.id, authorId: g.staff.userId, authorName: (me?.full_name as string | null) || g.staff.email,
    status: body.status, note: note || null, callbackOn,
  });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json({ ok: true, note: r.note });
}
