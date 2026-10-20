// /api/real-estate/floorplan-3d/projects/[id]/share — megosztható bejárás-link (PROTOTÍPUS, csak admin, csak a saját).
//   GET  → az élő link (vagy null)
//   POST { action: "create" }  → új link (INGYENES: a 3D létrehozásának díját — creditsCreate — a jóváhagyáskor már levontuk), lejárat: linkDays
//   POST { action: "extend" }  → +linkDays, díja creditsExtend (config); ha a mentés nem sikerül, a kreditet visszaírjuk
//   POST { action: "revoke" }  → a link azonnal megszűnik
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { floorplan3dConfig } from "@/lib/floorplan3d/config";
import { activeShare, createShare, extendShare, revokeShare } from "@/lib/floorplan3d/shares";
import { chargeCredit, payFromRequest, refundCredit } from "@/lib/credits";
import { insufficientResponse } from "@/lib/credit-response";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function guard(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { res: NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 }) };
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return { res: NextResponse.json({ error: "A Prémium 3D hamarosan érkezik — a modul még fejlesztés alatt áll." }, { status: 403 }) };
  if (!UUID.test(id)) return { res: NextResponse.json({ error: "Érvénytelen azonosító." }, { status: 400 }) };
  return { userId: user.id };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(id);
  if ("res" in g) return g.res;
  const r = await activeShare(g.userId, id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json({ share: r.share });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(id);
  if ("res" in g) return g.res;
  const body = await request.json().catch(() => ({}));
  const action = body?.action;
  const cfg = floorplan3dConfig();

  if (action === "create") {
    const r = await createShare(g.userId, id, cfg.linkDays);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ share: r.share, created: r.created });
  }

  if (action === "extend") {
    const cur = await activeShare(g.userId, id);
    if ("error" in cur) return NextResponse.json({ error: cur.error }, { status: 500 });
    if (!cur.share) return NextResponse.json({ error: "Nincs meghosszabbítható link — hozz létre újat." }, { status: 404 });
    const price = cfg.creditsExtend;
    const charge = price > 0 ? await chargeCredit({ userId: g.userId, amount: price, service: "floorplan-3d-extend", payFrom: payFromRequest(request) }) : null;
    if (charge && !charge.ok) return insufficientResponse(g.userId, price, charge);
    const r = await extendShare(g.userId, id, cfg.linkDays);
    if ("error" in r) {
      if (charge?.ok && !charge.bypassed) await refundCredit(g.userId, price, charge.source);
      return NextResponse.json({ error: `${r.error} A kreditet visszaírtuk.` }, { status: r.status });
    }
    return NextResponse.json({ share: r.share, charged: charge?.ok && !charge.bypassed ? price : 0 });
  }

  if (action === "revoke") {
    const err = await revokeShare(g.userId, id);
    if (err) return NextResponse.json({ error: err }, { status: 500 });
    return NextResponse.json({ share: null });
  }

  return NextResponse.json({ error: "Ismeretlen művelet." }, { status: 400 });
}
