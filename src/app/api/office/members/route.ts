// GET   /api/office/members — az iroda taglistája (csak a létrehozó és a kiosztó jogú tag).
// PATCH /api/office/members — egy tag kezelése. body: { userId, action, ... }
//   • action "allocate"    { delta }                    — keret +/−  (létrehozó vagy kiosztó; a kiosztó magának nem)
//   • action "permissions" { canAllocate?, unlimited? } — jogosultságok (CSAK a létrehozó)
//   • action "remove"                                   — tag eltávolítása (CSAK a létrehozó; magát nem)
// A keretkiosztás szabályait az adatbázis (office_allocate) is kikényszeríti.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ALLOCATE_MAX } from "@/lib/office";
import { getMembership, listMembers } from "@/lib/office-server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const me = await getMembership(user.id);
  if (!me || !(me.role === "owner" || me.can_allocate)) {
    return NextResponse.json({ error: "A taglistát a létrehozó és a kiosztó jogú tag látja." }, { status: 403 });
  }
  return NextResponse.json({ members: await listMembers(me.office_id), canManage: me.role === "owner", meId: user.id });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  let body: { userId?: string; action?: string; delta?: unknown; canAllocate?: unknown; unlimited?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const targetId = String(body.userId ?? "");
  if (!targetId) return NextResponse.json({ error: "Hiányzó tag-azonosító." }, { status: 400 });

  const me = await getMembership(user.id);
  if (!me) return NextResponse.json({ error: "Nem vagy tagja irodának." }, { status: 403 });
  const isOwner = me.role === "owner";

  const target = await getMembership(targetId);
  if (!target || target.office_id !== me.office_id) {
    return NextResponse.json({ error: "Ez a felhasználó nem tagja az irodádnak." }, { status: 404 });
  }

  const admin = createAdminClient();

  // --- Keret kiosztása / visszavétele ---------------------------------
  if (body.action === "allocate") {
    const delta = Number(body.delta);
    if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > ALLOCATE_MAX) {
      return NextResponse.json({ error: `Adj meg egy egész számot (legfeljebb ±${ALLOCATE_MAX}).` }, { status: 422 });
    }
    if (!(isOwner || me.can_allocate)) return NextResponse.json({ error: "Nincs jogod keretet kiosztani." }, { status: 403 });
    if (!isOwner && targetId === user.id) return NextResponse.json({ error: "Magadnak nem oszthatsz keretet." }, { status: 403 });
    if (delta < 0 && target.allowance + delta < 0) {
      return NextResponse.json({ error: `Legfeljebb ${target.allowance} kredit vehető vissza.` }, { status: 422 });
    }
    const { data, error } = await admin.rpc("office_allocate", {
      p_actor: user.id, p_member: targetId, p_delta: delta, p_note: null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (data === null) return NextResponse.json({ error: "A kiosztás nem engedélyezett." }, { status: 403 });
    return NextResponse.json({ ok: true, members: await listMembers(me.office_id) });
  }

  // --- Jogosultságok (csak a létrehozó) --------------------------------
  if (body.action === "permissions") {
    if (!isOwner) return NextResponse.json({ error: "Jogosultságot csak az irodai fiók létrehozója állíthat." }, { status: 403 });
    if (target.role === "owner") return NextResponse.json({ error: "A létrehozó jogosultságai nem módosíthatók." }, { status: 400 });
    const patch: Record<string, boolean> = {};
    if (typeof body.canAllocate === "boolean") patch.can_allocate = body.canAllocate;
    if (typeof body.unlimited === "boolean") patch.unlimited = body.unlimited;
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nincs módosítandó jogosultság." }, { status: 400 });
    const { error } = await admin.from("office_members").update(patch)
      .eq("office_id", me.office_id).eq("user_id", targetId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, members: await listMembers(me.office_id) });
  }

  // --- Tag eltávolítása (csak a létrehozó) -----------------------------
  if (body.action === "remove") {
    if (!isOwner) return NextResponse.json({ error: "Tagot csak az irodai fiók létrehozója távolíthat el." }, { status: 403 });
    if (target.role === "owner") return NextResponse.json({ error: "A létrehozó nem távolítható el." }, { status: 400 });
    // A keret csak plafon volt — eltávolításkor nincs mit „visszautalni" az irodának.
    const { error } = await admin.from("office_members").delete()
      .eq("office_id", me.office_id).eq("user_id", targetId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, members: await listMembers(me.office_id) });
  }

  return NextResponse.json({ error: "Ismeretlen művelet." }, { status: 400 });
}
