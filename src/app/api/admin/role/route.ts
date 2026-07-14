// POST /api/admin/role — felhasználó szerepkörének módosítása (CSAK admin).
// body: { userId, role } ; role ∈ { user, sales, admin }. Service-role klienssel ír.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const ROLES = ["user", "sales", "admin"] as const;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") {
    return NextResponse.json({ error: "Csak admin végezheti." }, { status: 403 });
  }

  let body: { userId?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 });
  }

  const { userId, role } = body;
  if (!userId) return NextResponse.json({ error: "Hiányzó felhasználó." }, { status: 422 });
  if (!role || !ROLES.includes(role as (typeof ROLES)[number])) {
    return NextResponse.json({ error: "Érvénytelen szerepkör." }, { status: 422 });
  }

  // Ne tudja magát véletlenül lefokozni (kizárná magát az admin felületről).
  if (userId === user.id && role !== "admin") {
    return NextResponse.json({ error: "A saját admin jogod nem veheted el itt." }, { status: 422 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, role });
}
