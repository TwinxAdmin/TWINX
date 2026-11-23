// POST /api/admin/role — admin jog adása / elvétele (CSAK admin; terv 12 / 2. szakasz, D45).
// body: { userId, role } ; role ∈ { user, admin }. A `sales` szerepkör megszűnt.
// A módosítás az admin_set_role DB-függvényen megy (naplózva a role_audit_log-ba); az utolsó admint
// az adatbázis is védi, és a saját admin jogodat itt nem veheted el.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const ROLES = ["user", "admin"] as const;
const ERR: Record<string, string> = {
  nem_admin: "Csak admin végezheti.",
  ervenytelen_szerep: "Érvénytelen szerepkör.",
  nincs_ilyen: "A felhasználó nem található.",
  utolso_admin: "Az utolsó admint nem lehet levenni.",
  sajat_admin: "A saját admin jogodat itt nem veheted el.",
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return NextResponse.json({ error: "Csak admin végezheti." }, { status: 403 });

  let body: { userId?: string; role?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  const { userId, role } = body;
  if (!userId) return NextResponse.json({ error: "Hiányzó felhasználó." }, { status: 422 });
  if (!role || !ROLES.includes(role as (typeof ROLES)[number])) {
    return NextResponse.json({ error: "Érvénytelen szerepkör." }, { status: 422 });
  }

  const { data, error } = await createAdminClient().rpc("admin_set_role", { p_actor: user.id, p_target: userId, p_role: role });
  if (error) {
    const msg = /admin_set_role|function .* does not exist/i.test(error.message)
      ? "Futtasd le a 20261123210000_admin-roles.sql migrációt."
      : /utolso_admin/.test(error.message) ? ERR.utolso_admin : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  const r = data as { ok: boolean; error?: string };
  if (!r.ok) return NextResponse.json({ error: ERR[r.error ?? ""] ?? "Nem sikerült." }, { status: 422 });
  return NextResponse.json({ ok: true, role });
}
