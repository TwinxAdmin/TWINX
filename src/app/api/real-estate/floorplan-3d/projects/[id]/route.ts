// /api/real-estate/floorplan-3d/projects/[id] — egy alaprajz-projekt (PROTOTÍPUS, csak admin, csak a saját).
//   GET:   betöltés (terv + aláírt link az eredetihez)
//   PATCH: a javított terv mentése { plan, handAccepted } — szerkezeti ellenőrzés után (sanitizePlan)
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizePlan } from "@/lib/floorplan3d/plan";
import { loadProject, saveProject } from "@/lib/floorplan3d/projects";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function adminUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 }) };
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return { error: NextResponse.json({ error: "A modul jelenleg prototípus — csak admin használhatja." }, { status: 403 }) };
  return { userId: user.id };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await adminUser();
  if ("error" in a) return a.error;
  if (!UUID.test(id)) return NextResponse.json({ error: "Érvénytelen azonosító." }, { status: 400 });
  const r = await loadProject(a.userId, id);
  return "error" in r ? NextResponse.json({ error: r.error }, { status: r.status }) : NextResponse.json(r);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await adminUser();
  if ("error" in a) return a.error;
  if (!UUID.test(id)) return NextResponse.json({ error: "Érvénytelen azonosító." }, { status: 400 });
  const body = await request.json().catch(() => null);
  const plan = sanitizePlan(body?.plan);
  if (!plan) return NextResponse.json({ error: "Hibás tervadat — nem mentettük." }, { status: 422 });
  const err = await saveProject(a.userId, id, { plan, handAccepted: body?.handAccepted === true });
  return err ? NextResponse.json({ error: err }, { status: 409 }) : NextResponse.json({ ok: true });
}
