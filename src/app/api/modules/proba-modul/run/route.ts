// POST /api/modules/proba-modul/run — a próba modul „költséges" próbaművelete (terv 20 kipróbálására).
// Nincs valódi API-hívás: 10 Ft becsült költséget foglal és számol el a havi keretből (withModuleCap).
import { MODULE_UNAVAILABLE_TEXT } from "@/lib/user-texts";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { userCanUseModule } from "@/lib/custom-modules";
import { withModuleCap } from "@/lib/module-cap";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
  if (!(await userCanUseModule(user.id, "proba-modul"))) {
    return NextResponse.json({ error: MODULE_UNAVAILABLE_TEXT }, { status: 403 });
  }
  const r = await withModuleCap(
    { userId: user.id, moduleKey: "proba-modul", operation: "proba-muvelet", estimatedFt: 10, requestKey: randomUUID() },
    async () => ({ value: { at: new Date().toISOString() }, actualFt: 10 }),
  );
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, ...r.value });
}
