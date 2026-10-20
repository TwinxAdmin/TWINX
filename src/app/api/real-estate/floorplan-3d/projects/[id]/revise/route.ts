// POST /api/real-estate/floorplan-3d/projects/[id]/revise — utólagos javítás: a kész 3D-ből vissza a 2D javítófelületre
// (PROTOTÍPUS, csak admin, csak a saját). A terv újra szerkeszthető; az újbóli jóváhagyás díja a creditsGeometryFix,
// és csak az érintett helyiségek épülnek újra. Itt NINCS kreditlevonás.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reopenProject } from "@/lib/floorplan3d/projects";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "A Prémium 3D hamarosan érkezik — a modul még fejlesztés alatt áll." }, { status: 403 });
  if (!UUID.test(id)) return NextResponse.json({ error: "Érvénytelen azonosító." }, { status: 400 });
  const err = await reopenProject(user.id, id);
  return err ? NextResponse.json({ error: err }, { status: 409 }) : NextResponse.json({ ok: true });
}
