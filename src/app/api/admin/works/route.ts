// GET /api/admin/works — az ügyfelek kész munkái (Admin → Felhasználók és modulok → „Munkák"). CSAK admin, csak olvas.
// Paraméterek: range (7d|30d|90d|all), group (all|enhance|flyer|valuation|video|visualization|other), q (név / e-mail), before (kurzor).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStaffRole } from "@/lib/staff";
import { listAdminWorks } from "@/lib/admin-works";
import { WORK_GROUPS, type WorkGroupKey, type WorksRange } from "@/lib/admin-works-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RANGES: WorksRange[] = ["7d", "30d", "90d", "all"];
const GROUPS: (WorkGroupKey | "all")[] = ["all", ...WORK_GROUPS.map((g) => g.key), "other"];

export async function GET(req: Request) {
  const staff = await getStaffRole(await createClient());
  if (!staff || staff.role !== "admin") return NextResponse.json({ error: "Nincs jogosultság." }, { status: 403 });

  const sp = new URL(req.url).searchParams;
  const range = (RANGES as string[]).includes(sp.get("range") ?? "") ? (sp.get("range") as WorksRange) : "30d";
  const group = (GROUPS as string[]).includes(sp.get("group") ?? "") ? (sp.get("group") as WorkGroupKey | "all") : "all";
  const q = (sp.get("q") ?? "").slice(0, 100);
  const beforeRaw = sp.get("before");
  const before = beforeRaw && !Number.isNaN(Date.parse(beforeRaw)) ? beforeRaw : null;

  try {
    return NextResponse.json(await listAdminWorks({ range, group, q, before }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Nem sikerült betölteni a munkákat." }, { status: 500 });
  }
}
