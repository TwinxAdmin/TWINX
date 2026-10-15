// POST /api/real-estate/floorplan-3d/projects/[id]/furnish — egy helyiség berendezése az ÉPÍTŐVEL (3. lépés, F3c; PROTOTÍPUS, csak admin).
// Body: { roomId }. Csak JÓVÁHAGYOTT tervre (a geometria rögzített); a prototípusban csak nappali. A stíluslap a tárhelyről jön
// (teszt időszak: japandi). Az eredményt a kód ellenőrzi (builder.ts), és a projekt `furnishing` mezőjébe mentjük.
// Kredit itt nincs külön: a 3D-építés díját a jóváhagyás már levonta.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadStyleSheet } from "@/lib/floorplan3d/stylesheet";
import { FURNISHABLE_KINDS, furnishRoom } from "@/lib/floorplan3d/builder";
import { projectForFurnishing, saveFurnishing } from "@/lib/floorplan3d/projects";
import { logCost } from "@/lib/costs";

export const runtime = "nodejs";
export const maxDuration = 300; // az építő gondolkodó modellel ~60 mp, javítókörrel kétszer annyi

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "A modul jelenleg prototípus — csak admin használhatja." }, { status: 403 });
  if (!UUID.test(id)) return NextResponse.json({ error: "Érvénytelen azonosító." }, { status: 400 });

  const body = await request.json().catch(() => null);
  const roomId = typeof body?.roomId === "string" ? body.roomId : "";
  const p = await projectForFurnishing(user.id, id);
  if ("error" in p) return NextResponse.json({ error: p.error }, { status: p.status });
  if (p.status === "draft") return NextResponse.json({ error: "Előbb hagyd jóvá a tervet (3D bejárás indítása)." }, { status: 409 });
  const room = p.plan.rooms.find((r) => r.id === roomId);
  if (!room) return NextResponse.json({ error: "A helyiség nem található." }, { status: 404 });
  if (!(FURNISHABLE_KINDS as readonly string[]).includes(room.kind)) return NextResponse.json({ error: "A prototípusban egyelőre csak a nappali rendezhető be." }, { status: 422 });

  const style = await loadStyleSheet("japandi");
  if ("error" in style) return NextResponse.json({ error: style.error }, { status: 500 });

  try {
    const result = await furnishRoom(p.plan, room, style.text);
    await logCost({ userId: user.id, serviceId: null, feature: "floorplan-3d-builder", serviceName: "google-studio", units: result.rounds, estimatedCostUsd: result.costUsd });
    const saveError = await saveFurnishing(user.id, id, room.id, { ...result, plan_revision: p.revision });
    return NextResponse.json({ ...result, roomId: room.id, saveError });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "A berendezés nem sikerült." }, { status: 500 });
  }
}
