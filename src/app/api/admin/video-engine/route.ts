// /api/admin/video-engine — a VIDEÓMOTOR KAPCSOLÓJA (CSAK admin).
//   GET  → melyik motor készíti most a partnerek videóit (+ forrás, Shotstack-állapot)
//   POST { renderer: "twinx" | "shotstack" } → átkapcsolás (azonnal érvényes)
// A Videólabor „Videógenerálás motorja" kártyája használja.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStaffRole } from "@/lib/staff";
import { rendererInfo, setActiveRenderer } from "@/lib/video-renderer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const supabase = await createClient();
  const staff = await getStaffRole(supabase);
  return staff && staff.role === "admin" ? staff : null;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  return NextResponse.json(await rendererInfo());
}

export async function POST(request: Request) {
  const staff = await requireAdmin();
  if (!staff) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  let body: { renderer?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }
  const renderer = body.renderer === "shotstack" ? "shotstack" : body.renderer === "twinx" ? "twinx" : null;
  if (!renderer) return NextResponse.json({ error: "Ismeretlen motor." }, { status: 422 });
  if (renderer === "shotstack" && !process.env.SHOTSTACK_API_KEY) {
    return NextResponse.json({ error: "A Shotstack nincs beállítva (hiányzik a SHOTSTACK_API_KEY) — nem kapcsolható be." }, { status: 422 });
  }
  const r = await setActiveRenderer(renderer, staff.userId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json(await rendererInfo());
}
