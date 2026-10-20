// POST /api/real-estate/floorplan-3d/projects/[id]/approve — a terv jóváhagyása = a 3D-építés indítása (PROTOTÍPUS, csak admin).
// Szabály: kreditlevonás és 3D-építés CSAK akkor, ha a felhasználó végigment az ellenőrzésen. Ezért a szerver
// a mentett tervet ÚJRA ellenőrzi (checkPlan + kézi rajz nyilatkozat), csak utána von (config: creditsCreate) és zár le.
// Jóváhagyás után a terv nem szerkeszthető (a 3D, a célképek és a videó ebből a változatból készül).
// UTÓLAGOS JAVÍTÁS (már volt jóváhagyva): a díj a creditsGeometryFix (alapból 0 — a digitalizálás hibáját javítja), és csak
// az érintett helyiségek épülnek újra (affectedRooms a korábbi pillanatképhez képest → rebuild_rooms).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { affectedRooms, checkPlan } from "@/lib/floorplan3d/geometry";
import { floorplan3dConfig } from "@/lib/floorplan3d/config";
import { REVISIONS_MIGRATION_MSG, markApproved, projectForApproval } from "@/lib/floorplan3d/projects";
import { chargeCredit, payFromRequest, refundCredit } from "@/lib/credits";
import { insufficientResponse } from "@/lib/credit-response";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "A Prémium 3D hamarosan érkezik — a modul még fejlesztés alatt áll." }, { status: 403 });
  if (!UUID.test(id)) return NextResponse.json({ error: "Érvénytelen azonosító." }, { status: 400 });

  const p = await projectForApproval(user.id, id);
  if ("error" in p) return NextResponse.json({ error: p.error }, { status: p.status });
  if (p.status !== "draft") return NextResponse.json({ ok: true, already: true }); // már jóváhagyva — nem vonunk újra

  const cfg = floorplan3dConfig();
  const check = checkPlan(p.plan, cfg.areaTolerancePct);
  if (!check.canBuild) return NextResponse.json({ error: check.issues[0] ?? "Még nem minden helyiség rendben (vagy tudatosan jóváhagyva)." }, { status: 422 });
  if (p.sourceKind === "hand" && !p.handAccepted) return NextResponse.json({ error: "Kézi rajznál el kell fogadnod, hogy a rajz pontossága a te felelősséged." }, { status: 422 });

  // utólagos javításhoz kellenek az új oszlopok (különben nem tudnánk, mi változott → nem hagyjuk jóvá vakon)
  if (p.wasApproved && !p.revisionsReady) return NextResponse.json({ error: REVISIONS_MIGRATION_MSG }, { status: 500 });

  const price = p.wasApproved ? cfg.creditsGeometryFix : cfg.creditsCreate;
  const rebuild = affectedRooms(p.wasApproved ? p.approvedPlan : null, p.plan);
  let charge: Awaited<ReturnType<typeof chargeCredit>> | null = null;
  if (price > 0) {
    charge = await chargeCredit({ userId: user.id, amount: price, service: "floorplan-3d", payFrom: payFromRequest(request) });
    if (!charge.ok) return insufficientResponse(user.id, price, charge);
  }
  const locked = await markApproved(user.id, id, p.revisionsReady ? { plan: p.plan, rebuildRooms: rebuild, revision: p.revision + 1 } : null);
  if (!locked) {
    if (charge?.ok && !charge.bypassed) await refundCredit(user.id, price, charge.source);
    return NextResponse.json({ error: "A jóváhagyás nem sikerült — a kreditet visszaírtuk." }, { status: 409 });
  }
  return NextResponse.json({ ok: true, rebuildRooms: rebuild, revision: p.revision + 1, charged: charge && !charge.bypassed ? price : 0 });
}
