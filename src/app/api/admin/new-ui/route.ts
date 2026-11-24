// /api/admin/new-ui — az „Új felület" kapcsoló és az Ingatlan-hozzáférés (CSAK admin; 3d lépés).
//   GET  → { enabled, accessCount }
//   POST { enabled }                 — kapcsoló (naplózva)
//   POST { userId, estateAccess, capFt? } — Ingatlan-hozzáférés megadása / elvétele (naplózva). Megadáskor a cégnek
//        Ingatlan-keret kell (terv 27): ha még nincs, 409 { code: "keret_kell" } → a felület bekéri a capFt-t (Ft).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStaffRole } from "@/lib/staff";
import { estateAccessUserIds, newUiEnabled, setEstateAccess, setNewUiEnabled } from "@/lib/new-ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const staff = await getStaffRole(await createClient());
  return staff && staff.role === "admin" ? staff : null;
}

async function payload() {
  const [enabled, ids] = await Promise.all([newUiEnabled(), estateAccessUserIds()]);
  return { enabled, accessCount: ids.size };
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  return NextResponse.json(await payload());
}

export async function POST(request: Request) {
  const staff = await requireAdmin();
  if (!staff) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  let b: { enabled?: unknown; userId?: unknown; estateAccess?: unknown; capFt?: unknown };
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  if (typeof b.userId === "string" && typeof b.estateAccess === "boolean") {
    let capFt: number | null = null;
    if (b.capFt != null) {
      const n = Number(b.capFt);
      if (!Number.isInteger(n) || n <= 0 || n > 100_000_000) return NextResponse.json({ error: "A havi keret pozitív egész Ft legyen." }, { status: 400 });
      capFt = n;
    }
    const r = await setEstateAccess(b.userId, b.estateAccess, staff.userId, capFt);
    if (!r.ok) return NextResponse.json({ error: r.error, code: r.code, companyId: r.companyId }, { status: r.code ? 409 : 500 });
    return NextResponse.json({ ...(await payload()), userId: b.userId, estateAccess: b.estateAccess });
  }
  if (typeof b.enabled === "boolean") {
    const r = await setNewUiEnabled(b.enabled, staff.userId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
    return NextResponse.json(await payload());
  }
  return NextResponse.json({ error: "Nincs mit módosítani." }, { status: 400 });
}
