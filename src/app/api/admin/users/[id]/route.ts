// GET /api/admin/users/:id — egy felhasználó minden adata (Admin → Felhasználók → „Részletek"). CSAK admin, csak olvas.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStaffRole } from "@/lib/staff";
import { getUserDetails } from "@/lib/admin-user-details";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffRole(await createClient());
  if (!staff || staff.role !== "admin") return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Érvénytelen azonosító." }, { status: 400 });
  const details = await getUserDetails(id);
  if (!details) return NextResponse.json({ error: "Nincs ilyen felhasználó." }, { status: 404 });
  return NextResponse.json(details);
}
