// /api/admin/package-caps — az Ingatlan csomag havi keretei cégenként (terv 27, D62; CSAK admin).
//   GET                                   → { rows, migrationMissing }
//   POST { companyId, capFt, reason }     — keret módosítása (indoklás kötelező, naplózva: package_cap_set)
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffRole } from "@/lib/staff";
import { ESTATE_PACKAGE_KEY, packageCapOverview } from "@/lib/package-cap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const staff = await getStaffRole(await createClient());
  return staff && staff.role === "admin" ? staff : null;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  return NextResponse.json(await packageCapOverview());
}

export async function POST(request: Request) {
  const staff = await requireAdmin();
  if (!staff) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  let b: { companyId?: unknown; capFt?: unknown; reason?: unknown };
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }
  const capFt = Number(b.capFt);
  const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 500) : "";
  if (typeof b.companyId !== "string" || !Number.isInteger(capFt) || capFt < 0 || capFt > 100_000_000) {
    return NextResponse.json({ error: "A keret nem negatív egész Ft legyen." }, { status: 400 });
  }
  if (!reason) return NextResponse.json({ error: "Az indoklás kötelező." }, { status: 400 });
  const { data, error } = await createAdminClient().rpc("package_cap_set", {
    p_actor: staff.userId, p_company: b.companyId, p_package: ESTATE_PACKAGE_KEY, p_new_cap: capFt, p_reason: reason,
  });
  if (error) return NextResponse.json({ error: `Nem sikerült (futtasd a 20261124200000_package-caps.sql-t): ${error.message}` }, { status: 500 });
  const r = data as { ok: boolean; error?: string };
  if (!r.ok) return NextResponse.json({ error: r.error === "nem_admin" ? "Nincs jogosultság." : `Nem sikerült (${r.error}).` }, { status: 400 });
  return NextResponse.json(await packageCapOverview());
}
