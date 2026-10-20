// /api/admin/premium3d — a Prémium 3D modul ÁLLAPOTA és a várólista (CSAK admin).
//   GET  → { status, migrated, updatedAt, waitlist: [...] }
//   POST { status: "hidden" | "coming_soon" } → azonnal érvényes. Az „available" ELŐKÉSZÍTVE, de még nem kapcsolható
//   (külön feladat köti be, amikor a modul kész).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStaffRole } from "@/lib/staff";
import { listWaitlist, premium3dStatus, setPremium3dStatus } from "@/lib/premium3d";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin() {
  const staff = await getStaffRole(await createClient());
  return staff && staff.role === "admin" ? staff : null;
}

async function payload() {
  const [s, w] = await Promise.all([premium3dStatus(), listWaitlist()]);
  return { status: s.status, migrated: s.migrated && w.migrated, updatedAt: s.updatedAt, waitlist: w.rows };
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  return NextResponse.json(await payload());
}

export async function POST(request: Request) {
  const staff = await requireAdmin();
  if (!staff) return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });
  let body: { status?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Érvénytelen kérés." }, { status: 400 }); }
  if (body.status === "available") return NextResponse.json({ error: "Az „Elérhető” állapot még nincs bekötve — külön feladat, amikor a modul kész." }, { status: 422 });
  if (body.status !== "hidden" && body.status !== "coming_soon") return NextResponse.json({ error: "Ismeretlen állapot." }, { status: 422 });
  const r = await setPremium3dStatus(body.status, staff.userId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
  return NextResponse.json(await payload());
}
