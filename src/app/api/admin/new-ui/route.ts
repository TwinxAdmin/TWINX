// /api/admin/new-ui — az „Új felület" kapcsoló és az Ingatlan-hozzáférés (CSAK admin; 3d lépés).
//   GET  → { enabled, accessCount }
//   POST { enabled }                 — kapcsoló (naplózva)
//   POST { userId, estateAccess }    — Ingatlan-hozzáférés megadása / elvétele egy felhasználónak (naplózva)
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
  let b: { enabled?: unknown; userId?: unknown; estateAccess?: unknown };
  try { b = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }

  if (typeof b.userId === "string" && typeof b.estateAccess === "boolean") {
    const r = await setEstateAccess(b.userId, b.estateAccess, staff.userId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
    return NextResponse.json({ ...(await payload()), userId: b.userId, estateAccess: b.estateAccess });
  }
  if (typeof b.enabled === "boolean") {
    const r = await setNewUiEnabled(b.enabled, staff.userId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
    return NextResponse.json(await payload());
  }
  return NextResponse.json({ error: "Nincs mit módosítani." }, { status: 400 });
}
